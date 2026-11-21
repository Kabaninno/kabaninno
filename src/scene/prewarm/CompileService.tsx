'use client';

import { useEffect, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { HalfFloatType, WebGLRenderTarget } from 'three';
import type { CompileApiRef } from './api';
import { browserCompileHost, createCompileQueue } from './compile-queue';
import { buildCompileTasks } from './compile-tasks';

interface CompileServiceProps {
  apiRef: CompileApiRef;
  /** Bloom is on: the real render targets the composer's linear buffer (program key). */
  linearTarget: boolean;
}

/**
 * Owns the shader compile queue (compile-queue.ts) and a 1×1 linear render
 * target used only to compile with the composer's output colour space. The
 * boot reveal, live system content and the prewarm all compile through it,
 * so no compile ever runs as one long task (perf P-01b, P-04).
 */
export function CompileService({ apiRef, linearTarget }: CompileServiceProps) {
  const gl = useThree((state) => state.gl);
  const camera = useThree((state) => state.camera);
  const scene = useThree((state) => state.scene);
  const [queue] = useState(() => createCompileQueue(browserCompileHost()));
  const linearRef = useRef(linearTarget);
  const targetRef = useRef<WebGLRenderTarget | null>(null);

  useEffect(() => {
    linearRef.current = linearTarget;
  }, [linearTarget]);

  useEffect(
    () => () => {
      queue.dispose();
      targetRef.current?.dispose();
      targetRef.current = null;
    },
    [queue],
  );

  useEffect(() => {
    const target = () =>
      linearRef.current
        ? (targetRef.current ??= new WebGLRenderTarget(1, 1, { type: HalfFloatType }))
        : null;
    apiRef.current = {
      compile: (object, priority) =>
        queue.push(buildCompileTasks(gl, object, camera, scene, target), priority),
    };
    return () => {
      apiRef.current = null;
    };
  }, [apiRef, queue, gl, camera, scene]);

  return null;
}
