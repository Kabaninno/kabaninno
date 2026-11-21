'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Group } from 'three';
import type { CompileApiRef } from '../prewarm/api';
import { COMPILE_PRIORITY } from '../prewarm/compile-queue';

interface RevealProps {
  compileRef: CompileApiRef;
  /** Show now even if compiling has not finished (the boot deadline passed). */
  force: boolean;
  /** The content is compiled and visible (the canvas may fade in). */
  onRevealed: () => void;
  children: ReactNode;
}

/**
 * Staged boot (perf P-01b): the children mount hidden, their programs go
 * through the compile queue at boot priority (one material per idle slice
 * without the parallel compile extension, compileAsync with it), and only
 * then become visible — so neither the mount nor the first frame that draws
 * them compiles everything in one long task. `force` (Experience's boot
 * deadline) shows them regardless; a cancelled or failed compile also reveals.
 */
export function Reveal({ compileRef, force, onRevealed, children }: RevealProps) {
  const groupRef = useRef<Group>(null);
  const [visible, setVisible] = useState(false);
  const onRevealedRef = useRef(onRevealed);

  useEffect(() => {
    onRevealedRef.current = onRevealed;
  }, [onRevealed]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    let active = true;
    const reveal = () => {
      if (!active) return;
      setVisible(true);
      onRevealedRef.current();
    };
    const ticket = compileRef.current?.compile(group, COMPILE_PRIORITY.boot);
    if (ticket) void ticket.promise.then(reveal);
    else queueMicrotask(reveal);
    return () => {
      active = false;
      ticket?.cancel();
    };
  }, [compileRef]);

  return (
    <group ref={groupRef} visible={visible || force}>
      {children}
    </group>
  );
}
