'use client';

import { useCallback, useEffect, useState } from 'react';
import { PerformanceMonitor } from '@react-three/drei';
import type { QualityTier } from '@/store/scene';

/**
 * Sampling starts well after the boot and the intro (a decline is a costly
 * switch; it must not land in the load's busy period).
 */
const MONITOR_DELAY_MS = 6000;

/**
 * Decline thresholds (fps): below the lower bound on most samples → step
 * down. Wide margin on purpose — 30+ fps on a mid-range phone is the target,
 * so only a clearly struggling device declines.
 */
const bounds = (refreshRate: number): [number, number] => (refreshRate > 100 ? [45, 90] : [28, 55]);

interface QualityManagerProps {
  tier: QualityTier;
  /** frameloop is "always" and the universe is on screen (QA-M2-04: no idle-gap samples). */
  active: boolean;
  onDecline: () => void;
}

/**
 * Runtime quality adaptation (BRIEF: PerformanceMonitor; DPR ≤ 2). The tier
 * starts from a device guess (Experience) and only ever steps **down** within
 * a session: no incline after a decline, so the tier cannot flip-flop and
 * each costly switch (geometry counts, bloom chain, at most one LOW_QUALITY
 * recompile) happens at most twice (perf P-03). The tier's DPR is the Canvas
 * `dpr` prop itself (Experience), not AdaptiveDpr: R3F re-applies the Canvas
 * prop on every render, which reset AdaptiveDpr's value (P-02).
 */
export function QualityManager({ tier, active, onDecline }: QualityManagerProps) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => setArmed(true), MONITOR_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  const handleDecline = useCallback(() => onDecline(), [onDecline]);

  if (!active || !armed || tier === 'low') return null;
  // Keyed by tier: a fresh sample window after every switch.
  return <PerformanceMonitor key={tier} bounds={bounds} onDecline={handleDecline} />;
}
