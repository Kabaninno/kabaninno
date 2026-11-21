/**
 * Shader prewarm scheduler (BRIEF B2.1). Keys name hidden scene content
 * (e.g. "system:web"); `run(key)` mounts it off-screen, compiles its
 * programs and unmounts it again. Tasks run strictly one at a time:
 * - the idle queue starts once the universe is ready and advances one task
 *   per idle callback (requestIdleCallback), so prewarming never competes
 *   with the intro or with input;
 * - `prioritize(key)` (touchstart on a node, desktop hover, HTML highlight)
 *   moves a key to the front and runs it as soon as the current task ends,
 *   without waiting for idle time.
 * Three-free and DOM-free: the host provides the idle callback functions.
 */
export interface PrewarmHost {
  requestIdle(callback: () => void): number;
  cancelIdle(handle: number): void;
}

export interface PrewarmScheduler {
  /** Adds keys to the idle queue in order; known keys are ignored. */
  enqueue(keys: readonly string[]): void;
  /** Starts working through the idle queue. */
  start(): void;
  /** Runs `key` next, without waiting for idle time. Unknown keys are added. */
  prioritize(key: string): void;
  isWarm(key: string): boolean;
  /** The key being compiled now and whether it was prioritized. */
  current(): { key: string; prioritized: boolean } | null;
  /**
   * Forgets what is warm (programs changed, e.g. the LOW_QUALITY tier).
   * `requeue: false` leaves the blind idle queue empty: only prioritized
   * keys (hover, touchstart, focus) and live systems compile again (P-03).
   */
  reset(requeue?: boolean): void;
  dispose(): void;
}

/**
 * `run(key, prioritized)` resolves `true` when the key's content compiled,
 * `false` when it was cancelled (preempted by a prioritized key, unmounted):
 * an incomplete key is not warm and goes back to the idle queue.
 */
export function createPrewarmScheduler(
  run: (key: string, prioritized: boolean) => Promise<boolean>,
  host: PrewarmHost,
): PrewarmScheduler {
  const known: string[] = [];
  let queue: string[] = [];
  const warm = new Set<string>();
  let urgent: string | null = null;
  let running: string | null = null;
  let runningPrioritized = false;
  let started = false;
  let disposed = false;
  let idleHandle: number | null = null;
  let generation = 0;

  const cancelIdle = () => {
    if (idleHandle !== null) {
      host.cancelIdle(idleHandle);
      idleHandle = null;
    }
  };

  const nextQueued = (): string | null => {
    queue = queue.filter((key) => !warm.has(key));
    return queue[0] ?? null;
  };

  const execute = (key: string, prioritized: boolean) => {
    running = key;
    runningPrioritized = prioritized;
    queue = queue.filter((queued) => queued !== key);
    const taskGeneration = generation;
    const finish = (completed: boolean) => {
      if (disposed) return;
      // Programs compiled for a previous tier do not count.
      if (completed && taskGeneration === generation) warm.add(key);
      else if (!completed && !queue.includes(key)) queue.push(key);
      running = null;
      pump();
    };
    // A failed compile counts as attempted (no retry loop).
    run(key, prioritized).then(finish, () => finish(true));
  };

  const pump = () => {
    if (disposed || running !== null) return;
    if (urgent !== null) {
      const key = urgent;
      urgent = null;
      if (!warm.has(key)) {
        cancelIdle();
        execute(key, true);
        return;
      }
    }
    if (!started || idleHandle !== null || nextQueued() === null) return;
    idleHandle = host.requestIdle(() => {
      idleHandle = null;
      if (disposed || running !== null) return;
      const key = nextQueued();
      if (key !== null) execute(key, false);
    });
  };

  return {
    enqueue(keys) {
      for (const key of keys) {
        if (known.includes(key)) continue;
        known.push(key);
        if (!warm.has(key)) queue.push(key);
      }
      pump();
    },
    start() {
      started = true;
      pump();
    },
    prioritize(key) {
      if (disposed || warm.has(key) || running === key) return;
      if (!known.includes(key)) known.push(key);
      queue = [key, ...queue.filter((queued) => queued !== key)];
      urgent = key;
      pump();
    },
    isWarm: (key) => warm.has(key),
    current: () => (running === null ? null : { key: running, prioritized: runningPrioritized }),
    reset(requeue = true) {
      generation += 1;
      warm.clear();
      urgent = null;
      queue = requeue ? [...known] : [];
      pump();
    },
    dispose() {
      disposed = true;
      cancelIdle();
      queue = [];
      urgent = null;
    },
  };
}

/** requestIdleCallback with a timeout, falling back to setTimeout (Safari). */
export function browserIdleHost(timeoutMs = 2000): PrewarmHost {
  const hasIdle = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function';
  return {
    requestIdle: (callback) =>
      hasIdle
        ? window.requestIdleCallback(() => callback(), { timeout: timeoutMs })
        : window.setTimeout(callback, 200),
    cancelIdle: (handle) =>
      hasIdle ? window.cancelIdleCallback(handle) : window.clearTimeout(handle),
  };
}
