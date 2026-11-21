'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from '@react-three/fiber';
import { Scene, type Group } from 'three';
import { isSceneDebugEnabled } from '../debug/scene-stats';
import type { CompileApiRef, PrewarmApiRef } from './api';
import { COMPILE_PRIORITY, type CompileTicket } from './compile-queue';
import { browserIdleHost, createPrewarmScheduler } from './scheduler';

/** One prewarmable piece of hidden content (see registry.tsx). */
export interface PrewarmEntry {
  key: string;
  render: () => ReactNode;
}

interface PrewarmProps {
  entries: readonly PrewarmEntry[];
  /** Changes when program keys change (LOW_QUALITY, bloom on/off): every key turns cold. */
  generation: string;
  apiRef: PrewarmApiRef;
  compileRef: CompileApiRef;
}

interface Job {
  key: string;
  prioritized: boolean;
  resolve: (completed: boolean) => void;
}

/**
 * The blind idle queue starts this long after the universe is revealed: well
 * after the boot, so it never extends the load's busy period (Lighthouse
 * looks for a 5 s quiet window). Hover / touchstart / focus start at once.
 */
const START_DELAY_MS = 6000;

/**
 * Shader prewarming (BRIEF B2.1, B2.2). One key at a time, its content is
 * mounted into an off-screen portal scene (never rendered), its materials
 * go through the compile queue (one material per idle slice; prioritized
 * for hover / touchstart / focus, which also preempt a blind idle key), and
 * it is unmounted again — geometry is disposed, the Experience-owned
 * material cache keeps the programs alive. After a tier change only
 * prioritized keys and live systems compile again (no blind re-run, P-03).
 */
export function Prewarm({ entries, generation, apiRef, compileRef }: PrewarmProps) {
  const [portal] = useState(() => new Scene());
  const [job, setJob] = useState<Job | null>(null);
  const groupRef = useRef<Group>(null);
  const ticketRef = useRef<CompileTicket | null>(null);
  const generationRef = useRef(generation);

  const scheduler = useMemo(
    () =>
      createPrewarmScheduler(
        (key, prioritized) =>
          new Promise<boolean>((resolve) => setJob({ key, prioritized, resolve })),
        browserIdleHost(),
      ),
    [],
  );

  useEffect(() => () => scheduler.dispose(), [scheduler]);

  useEffect(() => {
    scheduler.enqueue(entries.map((entry) => entry.key));
  }, [scheduler, entries]);

  useEffect(() => {
    const timer = window.setTimeout(() => scheduler.start(), START_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [scheduler]);

  useEffect(() => {
    if (generation === generationRef.current) return;
    generationRef.current = generation;
    scheduler.reset(false);
  }, [generation, scheduler]);

  useEffect(() => {
    apiRef.current = {
      prioritize: (key) => {
        const current = scheduler.current();
        // A blind idle key gives way to the system the visitor is about to open.
        if (current && !current.prioritized && current.key !== key) ticketRef.current?.cancel();
        scheduler.prioritize(key);
      },
      isWarm: (key) => scheduler.isWarm(key),
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, scheduler]);

  // The job's content is committed together with this effect: queue it, then unmount it.
  useEffect(() => {
    if (!job) return;
    const group = groupRef.current;
    const compile = compileRef.current;
    let active = true;
    const debug = isSceneDebugEnabled(window.location.search);
    const startedAt = performance.now();
    if (debug) {
      window.__scenePrewarm = { warm: window.__scenePrewarm?.warm ?? [], current: job.key };
    }
    const done = (completed: boolean) => {
      if (!active) return;
      active = false;
      ticketRef.current = null;
      if (debug) {
        const ms = Math.round((performance.now() - startedAt) * 10) / 10;
        const warm = window.__scenePrewarm?.warm ?? [];
        window.__scenePrewarm = {
          warm: completed ? [...warm, { key: job.key, ms }] : warm,
          current: null,
        };
      }
      setJob(null);
      job.resolve(completed);
    };
    if (!group || !compile) {
      // Nothing to compile with: count the key as attempted (no retry loop).
      queueMicrotask(() => done(true));
      return () => {
        active = false;
      };
    }
    const ticket = compile.compile(
      group,
      job.prioritized ? COMPILE_PRIORITY.prioritized : COMPILE_PRIORITY.idle,
    );
    ticketRef.current = ticket;
    void ticket.promise.then(done);
    return () => {
      active = false;
      ticket.cancel();
      job.resolve(false);
    };
  }, [job, compileRef]);

  const entry = job ? entries.find((candidate) => candidate.key === job.key) : undefined;
  return createPortal(<group ref={groupRef}>{entry ? entry.render() : null}</group>, portal);
}
