/**
 * Shader compile queue (perf P-01b, P-04). Compiling a program can block the
 * main thread for tens to hundreds of milliseconds where
 * KHR_parallel_shader_compile is missing (Safari, software GL), and a single
 * program cannot be split. So work is cut into one task per material and run
 * in idle callbacks:
 * - each idle callback runs at least one task, and more only while the
 *   deadline leaves time (`timeRemaining()`);
 * - an asynchronous task (compileAsync where the extension exists) ends the
 *   slice; the next slice starts when it settled;
 * - jobs run by priority (boot reveal > live system > hovered/touched/
 *   focused system > blind idle prewarm), FIFO within a priority;
 * - a job can be cancelled between tasks; its promise then resolves `false`.
 * Three-free and DOM-free: the host provides the idle callbacks.
 */
export interface IdleDeadlineLike {
  timeRemaining(): number;
}

export interface CompileQueueHost {
  /** `urgent` jobs ask for a short idle timeout. */
  requestIdle(callback: (deadline: IdleDeadlineLike) => void, urgent: boolean): number;
  cancelIdle(handle: number): void;
}

export type CompileTask = () => void | PromiseLike<unknown>;

export interface CompileTicket {
  /** Resolves `true` when every task ran, `false` when cancelled or disposed. */
  promise: Promise<boolean>;
  cancel(): void;
}

export const COMPILE_PRIORITY = {
  /** Idle prewarm of the next system. */
  idle: 0,
  /** System under the pointer / finger / keyboard focus (B2.1 triggers). */
  prioritized: 1,
  /** System content mounted for a dive that started before its prewarm. */
  live: 2,
  /** The universe itself, before the canvas fades in. */
  boot: 3,
} as const;

/** Priorities at or above this ask the host for a short idle timeout. */
const URGENT_PRIORITY = COMPILE_PRIORITY.live;
/** With less idle time left than this, the next task waits for the next callback. */
export const MIN_REMAINING_MS = 8;

export interface CompileQueue {
  push(tasks: readonly CompileTask[], priority: number): CompileTicket;
  /** Jobs waiting or running. */
  size(): number;
  dispose(): void;
}

interface Job {
  tasks: CompileTask[];
  priority: number;
  order: number;
  resolve: (completed: boolean) => void;
}

export function createCompileQueue(host: CompileQueueHost): CompileQueue {
  const jobs: Job[] = [];
  let handle: number | null = null;
  let busy = false;
  let disposed = false;
  let order = 0;

  const remove = (job: Job, completed: boolean) => {
    const index = jobs.indexOf(job);
    if (index >= 0) jobs.splice(index, 1);
    job.resolve(completed);
  };

  const nextJob = (): Job | undefined => {
    let best: Job | undefined;
    for (const job of jobs) {
      if (!best || job.priority > best.priority) best = job;
    }
    return best;
  };

  let handleUrgent = false;
  const schedule = () => {
    if (disposed || busy) return;
    const job = nextJob();
    if (!job) return;
    const urgent = job.priority >= URGENT_PRIORITY;
    if (handle !== null) {
      // Urgent work must not wait for a relaxed idle timeout.
      if (handleUrgent || !urgent) return;
      host.cancelIdle(handle);
    }
    handle = host.requestIdle(slice, urgent);
    handleUrgent = urgent;
  };

  const slice = async (deadline: IdleDeadlineLike) => {
    handle = null;
    busy = true;
    let ran = 0;
    try {
      while (!disposed) {
        const job = nextJob();
        if (!job) break;
        if (job.tasks.length === 0) {
          remove(job, true);
          continue;
        }
        if (ran > 0 && deadline.timeRemaining() < MIN_REMAINING_MS) break;
        const task = job.tasks.shift()!;
        ran += 1;
        let result: void | PromiseLike<unknown>;
        try {
          result = task();
        } catch {
          result = undefined;
        }
        if (result && typeof result.then === 'function') {
          try {
            await result;
          } catch {
            // A failed compile still counts as attempted.
          }
          if (job.tasks.length === 0 && jobs.includes(job)) remove(job, true);
          break;
        }
        if (job.tasks.length === 0) remove(job, true);
      }
    } finally {
      busy = false;
      schedule();
    }
  };

  return {
    push(tasks, priority) {
      let resolve: (completed: boolean) => void = () => {};
      const promise = new Promise<boolean>((r) => {
        resolve = r;
      });
      if (disposed) {
        resolve(false);
        return { promise, cancel: () => {} };
      }
      const job: Job = { tasks: [...tasks], priority, order: order++, resolve };
      jobs.push(job);
      schedule();
      return { promise, cancel: () => remove(job, false) };
    },
    size: () => jobs.length,
    dispose() {
      disposed = true;
      if (handle !== null) host.cancelIdle(handle);
      handle = null;
      for (const job of [...jobs]) remove(job, false);
    },
  };
}

/** requestIdleCallback (short timeout for urgent work), setTimeout fallback (Safari). */
export function browserCompileHost(): CompileQueueHost {
  const hasIdle = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function';
  const noTime: IdleDeadlineLike = { timeRemaining: () => 0 };
  return {
    requestIdle: (callback, urgent) =>
      hasIdle
        ? window.requestIdleCallback((deadline) => callback(deadline), {
            timeout: urgent ? 60 : 1500,
          })
        : window.setTimeout(() => callback(noTime), urgent ? 16 : 120),
    cancelIdle: (handle) =>
      hasIdle ? window.cancelIdleCallback(handle) : window.clearTimeout(handle),
  };
}
