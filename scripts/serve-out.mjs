#!/usr/bin/env node
/**
 * Minimal static server for out/ that behaves like GitHub Pages:
 * - the site is mounted at a base path (default "/kabaninno");
 * - "/<base>" and directories without a trailing slash redirect to ".../";
 * - a directory serves its index.html;
 * - unknown paths get out/404.html with HTTP 404.
 *
 *   npm run serve                    # base path auto-detected, else /kabaninno
 *   npm run serve -- --base=repo     # explicit base path (leading "/" optional)
 *   npm run serve -- --base=         # empty base path (custom-domain build)
 *   npm run serve -- --port=5000
 *   npm run serve -- --gzip          # gzip text responses, like GitHub Pages
 *
 * Git Bash rewrites arguments that start with "/" into Windows paths
 * (`--base=/kabaninno` → `C:/Program Files/Git/kabaninno`). Write the base
 * without the leading slash, or set MSYS_NO_PATHCONV=1. A rewritten value is
 * rejected with that hint instead of mounting the site at a strange path.
 *
 * Env alternatives: SERVE_BASE_PATH, PORT, SERVE_GZIP=1. Dependency-free,
 * cross-platform.
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = resolve(fileURLToPath(new URL('../out', import.meta.url)));

function argValue(name) {
  const prefix = `--${name}=`;
  const arg = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return arg === undefined ? undefined : arg.slice(prefix.length);
}

function normalizeBase(raw) {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '' || trimmed === '/') return '';
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}`;
}

/** Reads the base path baked into the build from the root redirect page. */
function detectBase() {
  try {
    const html = readFileSync(join(outDir, 'index.html'), 'utf8');
    const target = (html.match(/http-equiv="refresh" content="0; url=([^"]+)"/i) ?? [])[1];
    if (target) return normalizeBase(target.replace(/\/[a-z]{2}\/$/, ''));
  } catch {
    // fall through
  }
  return undefined;
}

const explicitBase = argValue('base') ?? process.env.SERVE_BASE_PATH;
if (explicitBase !== undefined && /^[A-Za-z]:[\\/]|\\/.test(explicitBase)) {
  console.error(
    `[serve] --base="${explicitBase}" looks like a Windows path: Git Bash rewrote "/…".\n` +
      '        Use --base=kabaninno (no leading slash) or set MSYS_NO_PATHCONV=1.',
  );
  process.exit(1);
}
const basePath = normalizeBase(explicitBase ?? detectBase() ?? '/kabaninno');
const port = Number(argValue('port') ?? process.env.PORT ?? 4173);
const gzip = process.argv.includes('--gzip') || process.env.SERVE_GZIP === '1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.webmanifest': 'application/manifest+json',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
};

function contentType(file) {
  return MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

/** Types GitHub Pages compresses; fonts and images are compressed already. */
const COMPRESSIBLE = new Set([
  '.html',
  '.js',
  '.mjs',
  '.css',
  '.json',
  '.map',
  '.txt',
  '.xml',
  '.svg',
  '.webmanifest',
]);
/** Compressed bodies, keyed by path and mtime (files do not change while serving). */
const gzipCache = new Map();

function gzipped(file) {
  const { mtimeMs } = statSync(file);
  const key = `${file}:${mtimeMs}`;
  let body = gzipCache.get(key);
  if (!body) {
    body = gzipSync(readFileSync(file), { level: 6 });
    gzipCache.set(key, body);
  }
  return body;
}

function sendFile(res, file, status = 200) {
  const head = res.req?.method === 'HEAD';
  const headers = { 'Content-Type': contentType(file), 'Cache-Control': 'no-cache' };
  const acceptsGzip = /\bgzip\b/.test(res.req?.headers['accept-encoding'] ?? '');
  if (gzip && COMPRESSIBLE.has(extname(file).toLowerCase())) {
    headers.Vary = 'Accept-Encoding';
    if (acceptsGzip) {
      const body = gzipped(file);
      res.writeHead(status, {
        ...headers,
        'Content-Encoding': 'gzip',
        'Content-Length': body.length,
      });
      return res.end(head ? undefined : body);
    }
  }
  res.writeHead(status, { ...headers, 'Content-Length': statSync(file).size });
  if (head) return res.end();
  createReadStream(file).pipe(res);
}

function sendNotFound(res) {
  const page = join(outDir, '404.html');
  if (existsSync(page)) return sendFile(res, page, 404);
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 Not Found');
}

function redirect(res, location) {
  res.writeHead(301, { Location: location });
  res.end();
}

/** Maps a URL path below the base path to a file inside out/ (or null). */
function resolveFile(relativePath) {
  let decoded;
  try {
    decoded = decodeURIComponent(relativePath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const candidate = normalize(join(outDir, decoded));
  // Never serve files outside out/ (path traversal).
  if (candidate !== outDir && !candidate.startsWith(outDir + sep)) return null;
  return candidate;
}

if (!existsSync(join(outDir, 'index.html'))) {
  console.error('[serve] out/index.html not found. Run `npm run build:preview` first.');
  process.exit(1);
}

const server = createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    return res.end();
  }
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const { pathname, search } = url;

  if (basePath && pathname === basePath) return redirect(res, `${basePath}/${search}`);
  if (basePath && !pathname.startsWith(`${basePath}/`)) return sendNotFound(res);

  const file = resolveFile(pathname.slice(basePath.length) || '/');
  if (!file || !existsSync(file)) return sendNotFound(res);

  const stats = statSync(file);
  if (stats.isDirectory()) {
    if (!pathname.endsWith('/')) return redirect(res, `${pathname}/${search}`);
    const index = join(file, 'index.html');
    return existsSync(index) ? sendFile(res, index) : sendNotFound(res);
  }
  return sendFile(res, file);
});

server.listen(port, () => {
  console.log(`[serve] out/ at http://localhost:${port}${basePath}/`);
  console.log(
    `[serve] base path: ${basePath || '(none)'}${explicitBase === undefined ? ' (auto)' : ''}` +
      `, gzip: ${gzip ? 'on' : 'off'}`,
  );
});
