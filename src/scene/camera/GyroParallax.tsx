'use client';

import { useEffect } from 'react';
import { keepAlive, type SceneBusRef } from '../bus';
import { gyroAvailable, readTilt } from './gyro';

/**
 * Whether a `deviceorientation` listener can matter on this device (see
 * `gyroAvailable`). Reads the browser only; never calls `requestPermission`.
 */
export function canUseGyro(): boolean {
  if (typeof window === 'undefined') return false;
  const hasOrientationEvent = typeof window.DeviceOrientationEvent !== 'undefined';
  const permissionApi =
    hasOrientationEvent &&
    typeof (window.DeviceOrientationEvent as unknown as { requestPermission?: unknown })
      .requestPermission === 'function';
  const chromium = Boolean((navigator as unknown as { userAgentData?: unknown }).userAgentData);
  return gyroAvailable({
    hasOrientationEvent,
    permissionApi,
    chromium,
    coarsePointer: window.matchMedia('(pointer: coarse)').matches,
  });
}

/** Screen orientation angle in degrees (0 when the platform does not say). */
function screenAngle(): number {
  const angle = window.screen?.orientation?.angle;
  if (typeof angle === 'number') return angle;
  const legacy = (window as unknown as { orientation?: unknown }).orientation;
  return typeof legacy === 'number' ? legacy : 0;
}

interface GyroParallaxProps {
  busRef: SceneBusRef;
  /** The tab is visible and motion is allowed (reduced motion: no listener at all). */
  enabled: boolean;
}

/**
 * Feeds the device tilt to the camera director (`bus.gyro`). The listener
 * exists only while it can matter — a touch device without a permission API,
 * a visible tab, motion allowed — and is removed on unmount. Readings without
 * real values (desktops report nulls) change nothing. The handler only stores
 * two numbers; mapping, smoothing and the camera turn live in the director.
 */
export function GyroParallax({ busRef, enabled }: GyroParallaxProps) {
  useEffect(() => {
    if (!enabled || !canUseGyro()) return;
    const bus = busRef.current;
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (readTilt(bus.gyro, event.beta, event.gamma, screenAngle())) keepAlive(bus, 200);
    };
    window.addEventListener('deviceorientation', onOrientation, { passive: true });
    return () => {
      window.removeEventListener('deviceorientation', onOrientation);
      bus.gyro.live = false;
    };
  }, [enabled, busRef]);

  return null;
}
