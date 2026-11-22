import { describe, expect, it } from 'vitest';
import { categoriesData } from '~/content/categories';
import { timelineDisplay } from './timeline';

describe('timelineDisplay', () => {
  it('shows up to ten days in days', () => {
    expect(timelineDisplay([3, 7])).toEqual({ unit: 'days', min: 3, max: 7 });
    expect(timelineDisplay([2, 5])).toEqual({ unit: 'days', min: 2, max: 5 });
    expect(timelineDisplay([3, 10])).toEqual({ unit: 'days', min: 3, max: 10 });
  });

  it('shows longer times in rounded weeks', () => {
    expect(timelineDisplay([7, 14])).toEqual({ unit: 'weeks', min: 1, max: 2 });
    expect(timelineDisplay([14, 28])).toEqual({ unit: 'weeks', min: 2, max: 4 });
    expect(timelineDisplay([21, 35])).toEqual({ unit: 'weeks', min: 3, max: 5 });
    expect(timelineDisplay([21, 42])).toEqual({ unit: 'weeks', min: 3, max: 6 });
    expect(timelineDisplay([5, 11])).toEqual({ unit: 'weeks', min: 1, max: 2 });
  });

  it('never reads like "2–2" for the real service data', () => {
    for (const category of categoriesData) {
      for (const service of category.services) {
        const shown = timelineDisplay(service.timelineDays);
        expect(shown.min, service.slug).toBeLessThan(shown.max);
      }
    }
  });
});
