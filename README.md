# KABANINNO — interactive 3D studio site

Website of a digital studio (websites, CRM, automation, AI, Telegram bots) presented as an
interactive "digital universe": every service category is a planetary system, every service a
planet. Built with Next.js (App Router) and React Three Fiber and exported as a **fully static
site** for GitHub Pages.

- Languages: Polish (default), English, Ukrainian — every URL carries its locale (`/pl/…`).
- All service and case-study content is real, server-rendered HTML; the 3D scene is a
  progressive enhancement loaded after the page.
- Specification and decisions (in Ukrainian): [`docs/BRIEF.md`](docs/BRIEF.md),
  [`docs/PLAN.md`](docs/PLAN.md), [`DECISIONS.md`](DECISIONS.md), [`PROGRESS.md`](PROGRESS.md).

## Requirements

- Node.js **≥ 20.9** (CI uses Node 24)
- npm (the lockfile is `package-lock.json`)
- Internet access during `next build` (fonts are downloaded from Google Fonts and self-hosted)

## Scripts

| Command                           | What it does                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`                     | Development server at http://localhost:3000 (draft cases visible).              |
| `npm run build`                   | Production static export to `out/` + `scripts/postbuild.mjs` checks.            |
| `npm run build:preview`           | Same build under the base path `/kabaninno` (like a GitHub Pages project site). |
| `npm run serve`                   | Serves `out/` at http://localhost:4173/kabaninno/ the way GitHub Pages does.    |
| `npm run lint`                    | ESLint (Next core-web-vitals + TypeScript + Prettier compatibility).            |
| `npm run typecheck`               | `next typegen` (route types) + `tsc --noEmit`.                                  |
| `npm test`                        | Vitest unit tests (`npm run test:watch` for watch mode).                        |
| `npm run test:e2e`                | Playwright e2e tests against `out/` (needs a preview build).                    |
| `npm run e2e:full`                | `build:preview` + `test:e2e`.                                                   |
| `npm run screenshots`             | Screenshots of the key states into `screenshots/<label>/` (needs `out/`).       |
| `npm run audit:a11y`              | axe-core audit summary into `reports/perf-a11y/` (needs `out/`).                |
| `npm run format` / `format:check` | Prettier.                                                                       |
| `npm run check`                   | lint + typecheck + test.                                                        |
| `npm run fonts:report`            | Lists @font-face subsets, preloaded fonts and their total size in `out/`.       |

## Local development

```bash
npm install
npm run dev
# open http://localhost:3000/pl/
```

`/` redirects to `/pl/`. Draft portfolio cases are visible in development only (see
[Environment variables](#environment-variables)).

## Static preview with a base path

GitHub Pages project sites live under `https://<user>.github.io/<repo>/`, so every asset and link
must respect the base path. Check that locally before pushing:

```bash
npm run build:preview   # base path /kabaninno, site URL http://localhost:4173/kabaninno
npm run serve           # http://localhost:4173/kabaninno/
```

The preview server mimics GitHub Pages: directories serve `index.html`, `/kabaninno` redirects to
`/kabaninno/`, and unknown URLs get `out/404.html` with status 404. Options:

- `--base=kabaninno` (the leading slash is optional), or `--base=` for an empty base path (e.g. after
  a plain `npm run build`). Without `--base` the server reads the base path from the build.
- `--port=5000`.
- `--gzip`: compress text responses (HTML, JS, CSS, JSON, SVG…) like GitHub Pages does. Use it for
  Lighthouse runs; uncompressed numbers are several points too low.

**Git Bash on Windows** rewrites arguments that start with `/` into Windows paths
(`--base=/kabaninno` becomes `C:/Program Files/Git/kabaninno`). Write `--base=kabaninno`, or prefix
the command with `MSYS_NO_PATHCONV=1`; the server rejects a rewritten value with that hint.

`scripts/postbuild.mjs` also rewrites the root redirect `out/index.html` into a minimal page (meta
refresh, a one-line script, canonical and language links; no app scripts or fonts) and adds
per-locale font preloads (Polish: Unbounded latin-ext; Ukrainian: the Cyrillic files).

## Browser tests, screenshots and the accessibility audit

All three run Playwright against the static preview build in `out/`, served under the base path
`/kabaninno` by `scripts/serve-out.mjs` (started automatically on ports 4300 / 4301 / 4302).
Locally they use the system Google Chrome (`channel: 'chrome'`, no browser download); WebGL runs on
SwiftShader (`--use-angle=swiftshader --enable-unsafe-swiftshader`), so the 3D scene renders in
headless mode. Set `PW_CHANNEL=chromium` to use Playwright's bundled Chromium instead (CI does,
after `npx playwright install --with-deps chromium`).

```bash
npm run build:preview          # once per code change
npm run test:e2e               # e2e suite (tests/e2e)
npm run screenshots -- --label=M2            # → screenshots/M2/
npm run screenshots -- --label=M2 --only=system --viewport=mobile
npm run audit:a11y             # → reports/perf-a11y/axe-summary.json (--out=…, --strict)
```

- **E2E** (`tests/e2e/`): deep links for every route type in all locales, soft navigation without
  document reloads, one persistent canvas (`canvas[data-scene-instance]`), Back/Forward, root
  redirect (query + hash), 404 at any depth, locale switch keeping the query, Esc → parent, the
  home index, hero reveal and exit fades. A shared fixture (`tests/support/fixtures.ts`) **fails
  any test on console errors, page errors, failed requests or HTTP 4xx/5xx**; a test that expects
  a 404 says so with `issues.allowNotFound(...)`.
- **Screenshots** (`tests/visual/states.ts`): data-driven states at desktop 1440×900 and mobile
  390×844 (universe, node hover via the HTML index, every system, one planet per system,
  portfolio, configurator, 404, the mobile menu, and a transition frame series home → system →
  Back). Files are `d-<state>.png` / `m-<state>.png` plus `manifest.json` (URL, status, scene
  readiness and browser issues per shot). Add a state by appending an entry to `STATES`.
- **axe audit** (`tests/a11y/audit.spec.ts`): home, system, planet, portfolio, configurator, 404 and
  the open mobile menu in pl and uk, desktop and mobile; WCAG 2.2 A/AA + best practices.

Portfolio states and the M5 e2e tests need visible cases, i.e. a preview built with drafts:
`SHOW_DRAFTS=true npm run build:preview` (PowerShell: `$env:SHOW_DRAFTS='true'; npm run build:preview`).
On a production build they skip themselves and only the "coming soon" panel is checked. The stub
cases' gallery images are generated placeholders: `node scripts/portfolio-placeholders.mjs`.

Automation hooks the tests rely on: `canvas[data-scene-instance]` (constant while the canvas
lives), the canvas fade-in, `html[data-scene-flight]` while a camera flight runs,
`html[data-scene-focus]` (the locale-less path the camera settled on), and `data-reveal-reason`
on the home hero and content panels after a client-side navigation. The `E2E` workflow
(`.github/workflows/e2e.yml`) runs the suite on pull requests and on demand; it is independent of the
Pages deploy.

## Deploying to GitHub Pages

Deployment is automated by [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): on every
push to `main` (or a manual run) it installs dependencies, runs lint, typecheck and tests, builds
the static export and publishes `out/` with `actions/upload-pages-artifact` + `actions/deploy-pages`.

One-time setup:

1. Push the repository to GitHub.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Push to `main` (or run the workflow from the Actions tab). The site URL appears in the
   `deploy` job and under Settings → Pages.

The base path and public URL come from `actions/configure-pages` automatically:
`/<repo>` and `https://<user>.github.io/<repo>` for a project site, empty and
`https://<custom-domain>` once a custom domain is configured.

**Custom domain:** set it in **Settings → Pages → Custom domain** (and configure DNS as GitHub
describes). With GitHub Actions deployments GitHub ignores `CNAME` files, so none is required.
If you still want `out/CNAME` (e.g. for mirroring the artifact elsewhere), set the repository
variable `PAGES_CNAME` (Settings → Secrets and variables → Actions → Variables).

After the first deployment, check the site on a real phone (Safari on iOS and Chrome on Android).

`robots.txt` is only honoured at the root of a host, so it takes effect with a custom domain; on
`<user>.github.io/<repo>` crawlers ignore it (the sitemap can be submitted in Search Console).

## Environment variables

| Variable                | Used at           | Purpose                                                                                                                                                                                                             |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_BASE_PATH` | build             | Base path, e.g. `/kabaninno`; empty for a custom domain. Set by the workflow.                                                                                                                                       |
| `NEXT_PUBLIC_SITE_URL`  | build             | Public URL of the site root incl. base path (canonical URLs, hreflang, sitemap). Set by the workflow. Fallback: `https://<domain>` from `site.config.ts` if it is a real domain, otherwise `http://localhost:3000`. |
| `SHOW_DRAFTS`           | build             | `true` includes portfolio cases with `status: 'draft'` in a production build. Drafts are always visible in `npm run dev`.                                                                                           |
| `PAGES_CNAME`           | build (postbuild) | Optional hostname written to `out/CNAME`. In CI it comes from the `PAGES_CNAME` repository variable.                                                                                                                |
| `NEXT_PUBLIC_API_URL`   | build (future)    | Endpoint of the future CRM/API backend used by `ApiSubmitter` instead of the Telegram hand-off. Not used yet.                                                                                                       |

## Placeholders to replace

All studio-wide placeholders live in [`site.config.ts`](site.config.ts):

- `studioName` — `KABANINNO`;
- `telegramUsername` — `[TELEGRAM_USERNAME]` (without `@`), used by the request configurator;
- `domain` — `[ДОМЕН]`, the production domain without protocol (used for absolute URLs when
  `NEXT_PUBLIC_SITE_URL` is not set);
- `currency` — currency of configurator budget ranges (`PLN`).

Texts marked for human review are listed in [`CONTENT_REVIEW.md`](CONTENT_REVIEW.md).

## Project structure

```
content/            Typed content data validated with zod (categories, services, visual DNA, cases)
  schema.ts         Schemas for data and localized texts
  index.ts          Validated accessors (getCategories, getProjects, shouldShowDrafts, …)
messages/<locale>/  next-intl dictionaries: ui.json (interface) and content.json (content texts)
site.config.ts      Studio name, Telegram username, domain, currency
src/app/            Routes (static export)
  layout.tsx        Pass-through root layout (+ global CSS)
  page.tsx          `/` → `/pl/` static redirect
  not-found.tsx     Trilingual 404 (out/404.html)
  sitemap.ts, robots.ts
  [locale]/         Locale layout (HUD, persistent 3D scene, providers) and pages:
                    home, services/[category], services/[category]/[service],
                    portfolio/[[...project]], configurator
src/components/     HUD, content panels, portfolio views, shared UI
src/i18n/           next-intl routing, navigation and server-side dictionaries
src/lib/            Pure helpers: routes, URL → scene state, base path, site URL, metadata, …
src/scene/          React Three Fiber scene (client-only, lazy-loaded)
src/store/          Zustand stores: scene UI state, interface state, request draft (persisted)
scripts/            Node scripts: postbuild, build-preview, serve-out, vitest, font-report,
                    screenshots and audit-a11y (Playwright runners)
tests/unit/         Cross-cutting unit tests (content integrity, scene layout, dictionaries)
tests/e2e/          Playwright e2e specs (playwright.config.ts)
tests/visual/       Screenshot states and capture (own Playwright config)
tests/a11y/         axe-core audit (own Playwright config)
tests/support/      Shared Playwright helpers: server/browser setup, site data, browser guard
```

Unit tests for helpers live next to the code (`src/lib/*.test.ts`).

## Adding a service

_Completed in M7._ In short: add the service (slug, timeline, planet DNA) to
`content/categories.ts` and its texts to `messages/{pl,en,uk}/content.json` under
`services.<category>.<slug>`. The page, sitemap entry and planet appear automatically.

## Adding a case study

_Completed in M7._ In short: add an entry to `content/projects.ts` and its texts under
`projects.<slug>` in every `content.json`. Keep `status: 'draft'` until it is ready; only
`published` cases are part of production builds.

## Adding a language

_Completed in M7._ In short: add the locale to `src/i18n/routing.ts`, create
`messages/<locale>/ui.json` and `content.json` with the same keys, register them in
`src/i18n/messages.ts`, and add its Open Graph locale in `src/lib/metadata.ts`.
