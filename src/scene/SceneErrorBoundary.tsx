'use client';

import { Component, Fragment, type ReactNode } from 'react';

interface SceneErrorBoundaryProps {
  children: ReactNode;
}

interface SceneErrorBoundaryState {
  failed: boolean;
  /** Bumped on retry: remounts the subtree (fresh Canvas and WebGL context). */
  attempt: number;
}

/** Remounts after the first failure; gives up after this many retries. */
const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 1500;

/**
 * Keeps a failure of the 3D layer local: any render/commit error inside the
 * scene (R3F re-throws Canvas errors into the React tree) renders nothing
 * instead of replacing the page with Next's error screen. The HTML content
 * and HUD work without the scene. One delayed retry covers transient issues
 * (e.g. a lost WebGL context while creating the renderer).
 */
export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  state: SceneErrorBoundaryState = { failed: false, attempt: 0 };

  private failures = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): Partial<SceneErrorBoundaryState> {
    return { failed: true };
  }

  componentDidCatch() {
    // React already reports the error itself; only the outcome is logged here.
    this.failures += 1;
    if (this.failures > MAX_RETRIES) {
      console.warn('[scene] The 3D layer is disabled after repeated errors.');
      return;
    }
    console.warn('[scene] The 3D layer failed; retrying once.');
    this.clearRetry();
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.setState((state) => ({ failed: false, attempt: state.attempt + 1 }));
    }, RETRY_DELAY_MS);
  }

  componentWillUnmount() {
    this.clearRetry();
  }

  private clearRetry() {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  render() {
    if (this.state.failed) return null;
    return <Fragment key={this.state.attempt}>{this.props.children}</Fragment>;
  }
}
