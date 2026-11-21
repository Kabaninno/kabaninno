'use client';

import { ArchiveContent } from '../portfolio/ArchiveContent';
import type { ArchiveMaterialCache } from '../portfolio/archive-materials';
import type { QualityPreset } from '../quality';
import { SystemContent } from '../system/SystemContent';
import type { UniverseModel } from '../universe/model';
import { ARCHIVE_PREWARM_KEY, systemPrewarmKey } from './api';
import type { PrewarmEntry } from './Prewarm';
import type { SystemMaterialCache } from './system-materials';

/**
 * Prewarm registry: every piece of content that is hidden at first and may
 * appear later. Data-driven — one entry per category system, in content
 * order, then the portfolio archive, so a new category or case is prewarmed
 * with no scene changes.
 */
export function buildPrewarmEntries(
  model: UniverseModel,
  preset: QualityPreset,
  materials: SystemMaterialCache,
  archiveMaterials: ArchiveMaterialCache,
): PrewarmEntry[] {
  const archive: PrewarmEntry = {
    key: ARCHIVE_PREWARM_KEY,
    render: () => (
      <ArchiveContent
        node={model.portfolio}
        preset={preset}
        materials={archiveMaterials.get(model.portfolio, preset.lowQualityShaders)}
        mode="prewarm"
      />
    ),
  };
  const systems = model.categories.map((node) => ({
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
  return [...systems, archive];
}
