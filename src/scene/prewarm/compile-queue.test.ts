import { describe, expect, it } from 'vitest';
import {
  COMPILE_PRIORITY,
  MIN_REMAINING_MS,
  URGENT_SLICE_MS,
  createCompileQueue,
  type CompileQueueHost,
} from './compile-queue';

function fakeHost() {
  let next = 1;
  const pending = new Map<
    number,
    { callback: Parameters<CompileQueueHost['requestIdle']>[0]; urgent: boolean }
  >();
  const host: CompileQueueHost = {
    requestIdle: (callback, urgent) => {
      const handle = next++;
      pending.set(handle, { callback, urgent });
      return handle;
    },
    cancelIdle: (handle) => {
      pending.delete(handle);
    },
  };
  /** Runs the pending idle callbacks with `remaining` ms of idle time each. */
  const flush = async (remaining = 0) => {
    const entries = [...pending.values()];
    pending.clear();
    for (const { callback } of entries) await callback({ timeRemaining: () => remaining });
    await Promise.resolve();
  };
  return { host, flush, pending };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createCompileQueue', () => {
  it('runs one task per idle callback when the deadline is spent', async () => {
    const { host, flush } = fakeHost();
    const queue = createCompileQueue(host);
    const ran: string[] = [];
    const ticket = queue.push(
      ['a', 'b', 'c'].map((name) => () => void ran.push(name)),
      COMPILE_PRIORITY.idle,
    );
    await flush(0);
    expect(ran).toEqual(['a']);
    await flush(0);
    expect(ran).toEqual(['a', 'b']);
    await flush(0);
    expect(ran).toEqual(['a', 'b', 'c']);
    expect(await ticket.promise).toBe(true);
    expect(queue.size()).toBe(0);
  });

  it('runs more tasks in one callback while idle time remains', async () => {
    const { host, flush } = fakeHost();
    const queue = createCompileQueue(host);
    const ran: number[] = [];
    queue.push(
      [1, 2, 3].map((n) => () => void ran.push(n)),
      COMPILE_PRIORITY.idle,
    );
    await flush(MIN_REMAINING_MS + 20);
    expect(ran).toEqual([1, 2, 3]);
  });

  it('runs urgent tasks for up to the slice budget even with no idle time left (V5-01)', async () => {
    const { host, flush } = fakeHost();
    let clock = 0;
    host.now = () => clock;
    const queue = createCompileQueue(host);
    const ran: number[] = [];
    // Each task "takes" 5 ms: three fit the budget before the slice yields.
    const ticket = queue.push(
      [1, 2, 3, 4, 5].map((n) => () => {
        ran.push(n);
        clock += 5;
      }),
      COMPILE_PRIORITY.live,
    );
    await flush(0);
    expect(ran.length).toBe(Math.ceil(URGENT_SLICE_MS / 5));
    await flush(0);
    expect(ran).toEqual([1, 2, 3, 4, 5]);
    expect(await ticket.promise).toBe(true);
  });

  it('serves higher priorities first and asks for a short timeout for urgent work', async () => {
    const { host, flush, pending } = fakeHost();
    const queue = createCompileQueue(host);
    const ran: string[] = [];
    queue.push(
      [() => void ran.push('idle-1'), () => void ran.push('idle-2')],
      COMPILE_PRIORITY.idle,
    );
    expect([...pending.values()][0]!.urgent).toBe(false);
    await flush(0);
    expect(ran).toEqual(['idle-1']);
    // Boot work arriving while idle work is half done goes first.
    queue.push([() => void ran.push('boot')], COMPILE_PRIORITY.boot);
    expect([...pending.values()][0]!.urgent).toBe(true);
    await flush(0);
    expect(ran).toEqual(['idle-1', 'boot']);
    await flush(0);
    expect(ran).toEqual(['idle-1', 'boot', 'idle-2']);
  });

  it('ends a slice on an asynchronous task and continues after it settles', async () => {
    const { host, flush } = fakeHost();
    const queue = createCompileQueue(host);
    let release: () => void = () => {};
    const ran: string[] = [];
    const ticket = queue.push(
      [
        () => {
          ran.push('async');
          return new Promise<void>((resolve) => {
            release = resolve;
          });
        },
        () => void ran.push('after'),
      ],
      COMPILE_PRIORITY.live,
    );
    const first = flush(100);
    await tick();
    expect(ran).toEqual(['async']);
    release();
    await first;
    expect(ran).toEqual(['async']);
    await flush(100);
    expect(ran).toEqual(['async', 'after']);
    expect(await ticket.promise).toBe(true);
  });

  it('cancels between tasks and survives throwing tasks', async () => {
    const { host, flush } = fakeHost();
    const queue = createCompileQueue(host);
    const ran: string[] = [];
    const ticket = queue.push(
      [
        () => {
          throw new Error('compile failed');
        },
        () => void ran.push('never'),
      ],
      COMPILE_PRIORITY.idle,
    );
    await flush(0);
    ticket.cancel();
    expect(await ticket.promise).toBe(false);
    await flush(100);
    expect(ran).toEqual([]);
    const other = queue.push([() => void ran.push('next')], COMPILE_PRIORITY.idle);
    await flush(0);
    expect(await other.promise).toBe(true);
  });

  it('resolves pending jobs as incomplete on dispose', async () => {
    const { host, pending } = fakeHost();
    const queue = createCompileQueue(host);
    const ticket = queue.push([() => {}], COMPILE_PRIORITY.idle);
    queue.dispose();
    expect(pending.size).toBe(0);
    expect(await ticket.promise).toBe(false);
    expect(await queue.push([() => {}], COMPILE_PRIORITY.boot).promise).toBe(false);
  });
});
