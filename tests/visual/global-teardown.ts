import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { META_DIR, SCREENSHOT_DIR, SCREENSHOT_LABEL } from './output';

interface ShotMeta {
  state: string;
  viewport: string;
  files: string[];
  issues: unknown[];
  sceneReady: boolean | null;
}

/**
 * Merges the per-shot metadata into `screenshots/<label>/manifest.json`
 * (existing entries of states not captured in this run are kept, so a
 * filtered re-run updates the manifest instead of replacing it).
 */
export default function globalTeardown(): void {
  if (!existsSync(META_DIR)) return;
  const manifestPath = join(SCREENSHOT_DIR, 'manifest.json');
  const previous: ShotMeta[] = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as { shots: ShotMeta[] }).shots
    : [];
  const fresh = readdirSync(META_DIR)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(join(META_DIR, file), 'utf8')) as ShotMeta);
  const key = (shot: ShotMeta) => `${shot.viewport}:${shot.state}`;
  const freshKeys = new Set(fresh.map(key));
  const shots = [...previous.filter((shot) => !freshKeys.has(key(shot))), ...fresh].sort((a, b) =>
    key(a).localeCompare(key(b)),
  );
  writeFileSync(
    manifestPath,
    JSON.stringify(
      { label: SCREENSHOT_LABEL, updatedAt: new Date().toISOString(), shots },
      null,
      2,
    ),
  );
  rmSync(META_DIR, { recursive: true, force: true });

  const withIssues = fresh.filter((shot) => shot.issues.length > 0 || shot.sceneReady === false);
  const files = fresh.reduce((sum, shot) => sum + shot.files.length, 0);
  console.log(`\n[screenshots] ${files} file(s) in ${SCREENSHOT_DIR}`);
  if (withIssues.length > 0) {
    console.log(
      `[screenshots] ${withIssues.length} state(s) with browser issues or no scene: ` +
        withIssues.map(key).join(', '),
    );
  }
}
