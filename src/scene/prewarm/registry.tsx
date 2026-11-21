'use client';

import type { QualityPreset } from '../quality';
import { SystemContent } from '../system/SystemContent';
import type { UniverseModel } from '../universe/model';
import { systemPrewarmKey } from './api';
import type { PrewarmEntry } from './Prewarm';
import type { SystemMaterialCache } from './system-materials';

/**
 * Prewarm registry: every piece of content that is hidden at first and may
 * appear later. Data-driven — one entry per category system, in content
 * order, so a new category is prewarmed with no scene changes. M3 extends
 * `SystemContent` (planets, rings, moons) and keeps these keys.
 */
export function buildPrewarmEntries(
  model: UniverseModel,
  preset: QualityPreset,
  materials: SystemMaterialCache,
): PrewarmEntry[] {
  return model.categories.map((node) => ({
    key: systemPrewarmKey(node.categoryId),
    render: () => (
      <SystemContent
        node={node}
        preset={preset}
        materials={materials.get(node, preset.lowQualityShaders)}
        mode="prewarm"
      />
    ),
  }));
}
