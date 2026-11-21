import { getConsoleFunction, setConsoleFunction } from 'three';

type ConsoleType = 'log' | 'warn' | 'error';
type ConsoleFunction = (type: ConsoleType, message: string, ...params: unknown[]) => void;

/**
 * three r183+ deprecates `THREE.Clock` and warns when one is constructed. The
 * warning on every page comes from R3F, not from our code: R3F 9.8 (the
 * latest 9.x) creates a `Clock` in each root store (moving to `Timer` in
 * v10), and a root's clock cannot be injected before the store exists. Our
 * code never constructs a Clock.
 *
 * Instead of patching `console`, this uses three's official logging hook
 * (`setConsoleFunction`) to drop exactly that one message and forwards every
 * other message unchanged (to a previously installed hook if there is one).
 * Remove once R3F stops creating a Clock.
 */
export const CLOCK_DEPRECATION_PREFIX = 'THREE.Clock: This module has been deprecated';

export function isClockDeprecation(type: ConsoleType, message: unknown): boolean {
  return (
    type === 'warn' && typeof message === 'string' && message.startsWith(CLOCK_DEPRECATION_PREFIX)
  );
}

let installed = false;

/** Idempotent; call before the first R3F root is created. */
export function filterR3fClockDeprecation(): void {
  if (installed) return;
  installed = true;
  // Typed as non-null, but three returns null when no hook is installed.
  const previous = getConsoleFunction() as ConsoleFunction | null;
  setConsoleFunction((type, message, ...params) => {
    if (isClockDeprecation(type, message)) return;
    if (previous) previous(type, message, ...params);
    else forwardToConsole(type, message, params);
  });
}

/** three's default behaviour when no hook is set (utils.js log/warn/error). */
function forwardToConsole(type: ConsoleType, message: string, params: unknown[]): void {
  const first = params[0] as { isStackTrace?: boolean; getError?: (m: string) => Error } | null;
  if (type !== 'log' && first?.isStackTrace && typeof first.getError === 'function') {
    console[type](first.getError(message));
    return;
  }
  console[type](message, ...params);
}
