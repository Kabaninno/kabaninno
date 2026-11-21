import { describe, expect, it } from 'vitest';
import { isSceneDebugEnabled } from './debug/scene-stats';
import { focusKeyForTarget, sceneNodeId, universeKeyForHighlight } from './node-ids';
import { GOLDEN_ANGLE, orbitPosition } from './orbit-math';

describe('node ids', () => {
  it('builds the ids shared with the HTML navigation', () => {
    expect(sceneNodeId.category('web')).toBe('category:web');
    expect(sceneNodeId.service('web', 'landing-pages')).toBe('service:web/landing-pages');
    expect(sceneNodeId.project('x')).toBe('project:x');
  });

  it('maps highlight ids to universe nodes', () => {
    expect(universeKeyForHighlight(null)).toBeNull();
    expect(universeKeyForHighlight('category:crm')).toBe('category:crm');
    expect(universeKeyForHighlight('service:crm/custom-crm')).toBe('category:crm');
    expect(universeKeyForHighlight('project:demo')).toBe('portfolio');
    expect(universeKeyForHighlight('configurator')).toBe('configurator');
  });

  it('maps URL targets to the focused node', () => {
    expect(focusKeyForTarget({ mode: 'universe' })).toBeNull();
    expect(focusKeyForTarget({ mode: 'unknown' })).toBeNull();
    expect(focusKeyForTarget({ mode: 'system', category: 'ai' })).toBe('category:ai');
    expect(focusKeyForTarget({ mode: 'planet', category: 'ai', service: 'x' })).toBe('category:ai');
    expect(focusKeyForTarget({ mode: 'project', project: 'x' })).toBe('portfolio');
    expect(focusKeyForTarget({ mode: 'configurator' })).toBe('configurator');
  });
});

describe('orbitPosition', () => {
  it('stays on the orbit radius for any tilt and yaw', () => {
    const out = { x: 0, y: 0, z: 0 };
    for (const angle of [0, 1, 2.5, 4]) {
      orbitPosition({ radius: 2, tilt: 0.4, yaw: GOLDEN_ANGLE }, angle, out);
      expect(Math.hypot(out.x, out.y, out.z)).toBeCloseTo(2, 6);
    }
  });

  it('lies in the XZ plane without tilt', () => {
    const out = orbitPosition({ radius: 1, tilt: 0, yaw: 0 }, Math.PI / 2, { x: 0, y: 0, z: 0 });
    expect(out.y).toBeCloseTo(0, 6);
    expect(out.z).toBeCloseTo(1, 6);
  });
});

describe('isSceneDebugEnabled', () => {
  it('is on only for debug=1', () => {
    expect(isSceneDebugEnabled('?debug=1')).toBe(true);
    expect(isSceneDebugEnabled('?a=b&debug=1')).toBe(true);
    expect(isSceneDebugEnabled('?debug=0')).toBe(false);
    expect(isSceneDebugEnabled('')).toBe(false);
  });
});
