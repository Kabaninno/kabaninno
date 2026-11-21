/**
 * Guard for the exported site (out/): no deployed page may point at
 * localhost or carry an unreplaced placeholder from site.config.ts. Run by
 * scripts/postbuild.mjs after every build, locally and in the Pages
 * workflow, so a deploy can never ship them. Pure (unit-tested in
 * tests/unit/url-guard.test.ts).
 *
 * - Documents and metadata (HTML, XML, TXT incl. RSC payloads, JSON,
 *   webmanifest): any `//localhost`, `//127.0.0.1`, `[ДОМЕН]` or
 *   `[TELEGRAM_USERNAME]`.
 * - JavaScript chunks: only URL-shaped `http(s)://localhost` /
 *   `http(s)://127.0.0.1`. Next.js's own router contains harmless bare
 *   literals such as `"localhost"===s.host` (checked in the F3 build).
 */

const DOCUMENT_EXTENSIONS = ['.html', '.xml', '.txt', '.json', '.webmanifest'];
const SCRIPT_EXTENSIONS = ['.js', '.mjs'];

const DOCUMENT_PATTERNS = [
  { label: '//localhost', pattern: /\/\/localhost\b/ },
  { label: '//127.0.0.1', pattern: /\/\/127\.0\.0\.1\b/ },
  { label: '[ДОМЕН]', pattern: /\[ДОМЕН\]/ },
  { label: '[TELEGRAM_USERNAME]', pattern: /\[TELEGRAM_USERNAME\]/ },
];

const SCRIPT_PATTERNS = [
  { label: 'http(s)://localhost', pattern: /https?:\/\/localhost\b/ },
  { label: 'http(s)://127.0.0.1', pattern: /https?:\/\/127\.0\.0\.1\b/ },
];

/** Which rule set applies to a file path (null: not scanned, e.g. images, fonts). */
export function guardKind(path) {
  const lower = path.toLowerCase();
  if (DOCUMENT_EXTENSIONS.some((extension) => lower.endsWith(extension))) return 'document';
  if (SCRIPT_EXTENSIONS.some((extension) => lower.endsWith(extension))) return 'script';
  return null;
}

/**
 * Forbidden strings in one file, with a short excerpt around the first hit
 * of each kind. `extraPatterns` adds `{ label, pattern }` rules to documents
 * (e.g. the `.invalid` preview origin in a real deploy).
 */
export function findForbiddenUrls(path, content, extraPatterns = []) {
  const kind = guardKind(path);
  if (!kind) return [];
  const rules = kind === 'document' ? [...DOCUMENT_PATTERNS, ...extraPatterns] : SCRIPT_PATTERNS;
  const hits = [];
  for (const { label, pattern } of rules) {
    const match = pattern.exec(content);
    if (!match) continue;
    const from = Math.max(0, match.index - 30);
    const excerpt = content.slice(from, match.index + match[0].length + 30).replace(/\s+/g, ' ');
    hits.push({ path, label, excerpt });
  }
  return hits;
}
