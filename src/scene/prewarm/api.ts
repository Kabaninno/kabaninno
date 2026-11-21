import type { RefObject } from 'react';
import type { Object3D } from 'three';
import type { CompileTicket } from './compile-queue';

/**
 * Compile handle (CompileService): queues the programs of `object` for
 * compilation in idle slices, one material per slice where the parallel
 * compile extension is missing, with the renderer state of the real render.
 */
export interface CompileApi {
  compile(object: Object3D, priority: number): CompileTicket;
}

export type CompileApiRef = RefObject<CompileApi | null>;

/** Prewarm handle shared with the universe (hover, touchstart, HTML highlight). */
export interface PrewarmApi {
  /** Compile `key` next (preempting a blind idle key), without waiting for idle time. */
  prioritize(key: string): void;
  isWarm(key: string): boolean;
}

export type PrewarmApiRef = RefObject<PrewarmApi | null>;

/** Prewarm key of a category's planetary system content. */
export function systemPrewarmKey(categoryId: string): string {
  return `system:${categoryId}`;
}

/** Prewarm key of the portfolio archive (project card-objects, observatory rings). */
export const ARCHIVE_PREWARM_KEY = 'archive';
