/**
 * Thin analytics layer. Currently a no-op; plug a real provider into
 * `setAnalyticsProvider` later without touching call sites.
 */
export type AnalyticsEvent =
  | 'cta_click'
  | 'locale_switch'
  | 'system_open'
  | 'planet_open'
  | 'project_open'
  | 'request_add_service'
  | 'configurator_step'
  | 'lead_submit'
  | 'lead_copy'
  | 'simple_mode'
  | 'intro_skip';

export type AnalyticsProps = Record<string, string | number | boolean | undefined>;

export interface AnalyticsProvider {
  track(event: AnalyticsEvent, props?: AnalyticsProps): void;
}

const noopProvider: AnalyticsProvider = { track: () => {} };

let provider: AnalyticsProvider = noopProvider;

export function setAnalyticsProvider(next: AnalyticsProvider | null): void {
  provider = next ?? noopProvider;
}

export const analytics = {
  track(event: AnalyticsEvent, props?: AnalyticsProps): void {
    try {
      provider.track(event, props);
    } catch {
      // Analytics must never break the UI.
    }
  },
};
