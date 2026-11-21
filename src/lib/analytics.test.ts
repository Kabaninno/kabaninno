import { afterEach, describe, expect, it, vi } from 'vitest';
import { analytics, setAnalyticsProvider } from './analytics';

afterEach(() => {
  setAnalyticsProvider(null);
});

describe('analytics', () => {
  it('is a no-op without a provider', () => {
    expect(() => analytics.track('cta_click', { placement: 'hud' })).not.toThrow();
  });

  it('forwards events and props to the provider', () => {
    const track = vi.fn();
    setAnalyticsProvider({ track });
    analytics.track('locale_switch', { from: 'pl', to: 'uk' });
    expect(track).toHaveBeenCalledWith('locale_switch', { from: 'pl', to: 'uk' });
  });

  it('never lets a failing provider break the UI', () => {
    setAnalyticsProvider({
      track: () => {
        throw new Error('provider down');
      },
    });
    expect(() => analytics.track('lead_submit')).not.toThrow();
  });

  it('goes back to the no-op provider when reset with null', () => {
    const track = vi.fn();
    setAnalyticsProvider({ track });
    setAnalyticsProvider(null);
    analytics.track('cta_click');
    expect(track).not.toHaveBeenCalled();
  });
});
