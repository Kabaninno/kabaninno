import { describe, expect, it } from 'vitest';
import { createPrewarmScheduler, type PrewarmHost } from './scheduler';

/** Manual idle host: callbacks run only when the test flushes them. */
function fakeHost() {
  let next = 1;
  const pending = new Map<number, () => void>();
  const host: PrewarmHost = {
    requestIdle: (callback) => {
      const handle = next++;
      pending.set(handle, callback);
      return handle;
    },
    cancelIdle: (handle) => {
      pending.delete(handle);
    },
  };
  const flushIdle = () => {
    const callbacks = [...pending.values()];
    pending.clear();
    callbacks.forEach((callback) => callback());
  };
  return { host, flushIdle, pendingCount: () => pending.size };
}

/** Task runner whose tasks finish when the test resolves them. */
function fakeRunner() {
  const started: string[] = [];
  const resolvers = new Map<string, (completed: boolean) => void>();
  const flags: boolean[] = [];
  const run = (key: string, prioritized: boolean) =>
    new Promise<boolean>((resolve) => {
      started.push(key);
      flags.push(prioritized);
      resolvers.set(key, resolve);
    });
  const finish = async (key: string, completed = true) => {
    resolvers.get(key)?.(completed);
    resolvers.delete(key);
    // Let the scheduler's promise continuation run.
    await Promise.resolve();
    await Promise.resolve();
  };
  return { run, started, finish, flags };
}

describe('createPrewarmScheduler', () => {
  it('waits for start(), then runs one task per idle callback, in order', async () => {
    const { host, flushIdle, pendingCount } = fakeHost();
    const runner = fakeRunner();
    const scheduler = createPrewarmScheduler(runner.run, host);
    scheduler.enqueue(['system:web', 'system:crm']);
    expect(pendingCount()).toBe(0);
    scheduler.start();
    expect(runner.started).toEqual([]);
    flushIdle();
    expect(runner.started).toEqual(['system:web']);
    // One at a time: nothing else is scheduled while a task runs.
    expect(pendingCount()).toBe(0);
    await runner.finish('system:web');
    expect(scheduler.isWarm('system:web')).toBe(true);
    flushIdle();
    expect(runner.started).toEqual(['system:web', 'system:crm']);
    await runner.finish('system:crm');
    flushIdle();
    expect(runner.started).toHaveLength(2);
  });

  it('runs a prioritized key next without waiting for idle time (touchstart / hover)', async () => {
    const { host, flushIdle } = fakeHost();
    const runner = fakeRunner();
    const scheduler = createPrewarmScheduler(runner.run, host);
    scheduler.enqueue(['system:web', 'system:crm', 'system:ai']);
    // Even before start(): hovering a node warms it immediately.
    scheduler.prioritize('system:ai');
    expect(runner.started).toEqual(['system:ai']);
    // While it runs, a second prioritized key waits for it, then goes first.
    scheduler.prioritize('system:crm');
    expect(runner.started).toEqual(['system:ai']);
    await runner.finish('system:ai');
    expect(runner.started).toEqual(['system:ai', 'system:crm']);
    await runner.finish('system:crm');
    scheduler.start();
    flushIdle();
    expect(runner.started).toEqual(['system:ai', 'system:crm', 'system:web']);
  });

  it('ignores warm, running and duplicate keys', async () => {
    const { host, flushIdle } = fakeHost();
    const runner = fakeRunner();
    const scheduler = createPrewarmScheduler(runner.run, host);
    scheduler.enqueue(['a', 'a', 'b']);
    scheduler.prioritize('a');
    scheduler.prioritize('a');
    expect(runner.started).toEqual(['a']);
    await runner.finish('a');
    scheduler.prioritize('a');
    scheduler.start();
    flushIdle();
    expect(runner.started).toEqual(['a', 'b']);
  });

  it('treats failed tasks as attempted and keeps going', async () => {
    const { host, flushIdle } = fakeHost();
    const started: string[] = [];
    const scheduler = createPrewarmScheduler((key) => {
      started.push(key);
      return Promise.reject(new Error('compile failed'));
    }, host);
    scheduler.enqueue(['a', 'b']);
    scheduler.start();
    flushIdle();
    await Promise.resolve();
    await Promise.resolve();
    flushIdle();
    expect(started).toEqual(['a', 'b']);
  });

  it('requeues everything on reset and ignores results from the previous generation', async () => {
    const { host, flushIdle } = fakeHost();
    const runner = fakeRunner();
    const scheduler = createPrewarmScheduler(runner.run, host);
    scheduler.enqueue(['a', 'b']);
    scheduler.start();
    flushIdle();
    scheduler.reset();
    await runner.finish('a');
    expect(scheduler.isWarm('a')).toBe(false);
    flushIdle();
    expect(runner.started).toEqual(['a', 'a']);
  });

  it('stops on dispose', () => {
    const { host, flushIdle, pendingCount } = fakeHost();
    const runner = fakeRunner();
    const scheduler = createPrewarmScheduler(runner.run, host);
    scheduler.enqueue(['a']);
    scheduler.start();
    scheduler.dispose();
    expect(pendingCount()).toBe(0);
    flushIdle();
    scheduler.prioritize('a');
    expect(runner.started).toEqual([]);
  });
});

describe('preemption and reset without requeue', () => {
  it('flags prioritized runs and requeues a key whose run was cancelled', async () => {
    const { host, flushIdle } = fakeHost();
    const runner = fakeRunner();
    const scheduler = createPrewarmScheduler(runner.run, host);
    scheduler.enqueue(['a', 'b']);
    scheduler.start();
    flushIdle();
    expect(scheduler.current()).toEqual({ key: 'a', prioritized: false });
    // A hover arrives: the caller cancels the idle run of "a".
    scheduler.prioritize('b');
    await runner.finish('a', false);
    expect(scheduler.isWarm('a')).toBe(false);
    expect(runner.started).toEqual(['a', 'b']);
    expect(runner.flags).toEqual([false, true]);
    await runner.finish('b');
    flushIdle();
    expect(runner.started).toEqual(['a', 'b', 'a']);
  });

  it('reset(false) forgets warm keys but leaves the idle queue empty', async () => {
    const { host, flushIdle, pendingCount } = fakeHost();
    const runner = fakeRunner();
    const scheduler = createPrewarmScheduler(runner.run, host);
    scheduler.enqueue(['a']);
    scheduler.start();
    flushIdle();
    await runner.finish('a');
    scheduler.reset(false);
    expect(scheduler.isWarm('a')).toBe(false);
    expect(pendingCount()).toBe(0);
    scheduler.prioritize('a');
    expect(runner.started).toEqual(['a', 'a']);
  });
});
