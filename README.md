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

| Command                             | What it does                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `npm run dev`                       | Development server at http://localhost:3000 (draft cases visible).              |
| `npm run build`                     | Production static export to `out/` + `scripts/postbuild.mjs` checks.            |
| `npm run build:preview`             | Same build under the base path `/kabaninno` (like a GitHub Pages project site). |
| `npm run build:preview -- --drafts` | The preview build including draft portfolio cases (`SHOW_DRAFTS=true`).         |
| `npm run serve`                     | Serves `out/` at http://localhost:4173/kabaninno/ the way GitHub Pages does.    |
| `npm run lint`                      | ESLint (Next core-web-vitals + TypeScript + Prettier compatibility).            |
| `npm run typecheck`                 | `next typegen` (route types) + `tsc --noEmit`.                                  |
| `npm test`                          | Vitest unit tests (`npm run test:watch` for watch mode).                        |
| `npm run test:e2e`                  | Playwright e2e tests against `out/` (needs a preview build).                    |
| `npm run e2e:full`                  | `build:preview` + `test:e2e`.                                                   |
| `npm run screenshots`               | Screenshots of the key states into `screenshots/<label>/` (needs `out/`).       |
| `npm run audit:a11y`                | axe-core audit summary into `reports/perf-a11y/` (needs `out/`).                |
| `npm run format` / `format:check`   | Prettier.                                                                       |
| `npm run check`                     | lint + typecheck + test.                                                        |
| `npm run fonts:report`              | Lists @font-face subsets, preloaded fonts and their total size in `out/`.       |
| `npm run og:images`                 | Regenerates the Open Graph images `public/og/<locale>.png` (needs internet).    |

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
npm run build:preview          # once per code change (production content)
npm run test:e2e               # e2e suite (tests/e2e)
npm run screenshots -- --label=M2            # → screenshots/M2/
npm run screenshots -- --label=M2 --only=system --viewport=mobile
npm run screenshots -- --build --label=F2    # build:preview first, then shoot
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

Everything defaults to the **production content** (no draft cases), like the deployed site.
Portfolio case states and the case e2e tests need visible cases, i.e. a preview built with
drafts: `npm run build:preview -- --drafts` (or `npm run screenshots -- --build=drafts`). On a
production build they skip themselves and only the "coming soon" panel is checked; the Playwright
global setup prints which kind of build `out/` holds. A `SHOW_DRAFTS` variable left in the shell
is ignored by `build:preview` (it warns); only `--drafts` includes drafts. The stub cases'
gallery images are generated placeholders: `node scripts/portfolio-placeholders.mjs`.

Tests and screenshots start as a returning visitor: the first-visit intro is marked as seen before
each page loads. Intro tests opt out (`test.use({ introSeen: false })`, or `intro: true` on a
screenshot state).

Automation hooks the tests rely on: `canvas[data-scene-instance]` (constant while the canvas
lives), the canvas fade-in, `html[data-scene-flight]` while a camera flight runs,
`html[data-scene-focus]` (the locale-less path the camera settled on), `html[data-scene-ready]`
(that path once its content is compiled and visible; screenshots wait for it),
`html[data-simple]` (simple mode), `html[data-intro-active]` and `[data-intro-skip]` (the
first-visit intro), `[data-boot-progress]` (the loading indicator) and `data-reveal-reason` on
the home hero and content panels after a client-side navigation. The `E2E` workflow
(`.github/workflows/e2e.yml`) runs the suite on pull requests and on demand; it is independent of the
Pages deploy.

## Simple mode, loading and the first-visit intro

- **Simple (2D) mode** shows the same content without the 3D layer, over a static star field
  and a flat constellation of the services. Visitors switch it in the HUD (the "2D" switch; in
  the mobile menu on phones); the choice is stored in `localStorage`
  (`kabaninno.simpleMode.v1`). Browsers without the WebGL 2 API get it automatically. A tiny
  inline script in `<head>` decides before the first paint (`html[data-simple]`), so nothing
  flashes. Code: `src/lib/simple-mode.ts`, `src/components/layout/{BootState,SimpleBackdrop}.tsx`,
  `src/components/hud/SimpleModeToggle.tsx`; the star tiles in `public/sky/` are generated and
  checked by `src/lib/simple-sky.test.ts` (regenerate with `npm test -- -u`).
- **Loading indicator**: a hairline under the HUD bar fills while the 3D scene boots; the HTML is
  usable all along.
- **First-visit intro** (≤ 3 s): only on the first visit to a home page, never under reduced
  motion or in simple mode. "Skip intro", Esc or any key/click ends it; the visit is then stored
  (`kabaninno.intro.v1`). To see it again, clear that key in the browser's storage.

## SEO

- Every page has a title, description, canonical URL, `hreflang` alternates for pl/en/uk plus
  `x-default`, and Open Graph/Twitter tags with `og:locale` and the alternates
  (`src/lib/metadata.ts`). All URLs are absolute and include the base path.
- **Open Graph images** are static PNGs, one per language: `public/og/<locale>.png`
  (1200×630). They are generated by `npm run og:images` (`scripts/og-images.mjs`: the home
  texts, the category names and colours, the brand fonts) and committed. Re-run it after
  changing those texts or categories. Static files were chosen over a prerendered
  `opengraph-image` route because they behave the same under any base path and need no image
  rendering during the build.
- **Structured data**: the home pages carry schema.org JSON-LD (`Organization` + `WebSite`, with
  the service catalogue from `content/`). No address or contacts are invented; the Telegram link
  is added only once `site.config.ts` has a real username.
- `sitemap.xml` and `robots.txt` are generated statically (`src/app/sitemap.ts`, `robots.ts`).

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
| `SHOW_DRAFTS`           | build             | `true` includes portfolio cases with `status: 'draft'` in `npm run build`. `build:preview` ignores it: use `npm run build:preview -- --drafts`. Drafts are always visible in `npm run dev`.                         |
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
                    og-images, portfolio-placeholders, screenshots and audit-a11y (Playwright runners)
public/             Static files: og/ (Open Graph images), sky/ (simple-mode stars), portfolio/
tests/unit/         Cross-cutting unit tests (content integrity, scene layout, dictionaries)
tests/e2e/          Playwright e2e specs (playwright.config.ts)
tests/visual/       Screenshot states and capture (own Playwright config)
tests/a11y/         axe-core audit (own Playwright config)
tests/support/      Shared Playwright helpers: server/browser setup, site data, browser guard
```

Unit tests for helpers live next to the code (`src/lib/*.test.ts`).

## Adding a service

Content is data: no component or scene code changes.

1. In [`content/categories.ts`](content/categories.ts), add an entry to the category's
   `services`: a URL `slug`, `timelineWeeks: [min, max]` and the planet's look (`planet`: `shape`,
   `material`, `size`, optional `rings`/`moons`/`shell`, and `orbit: { radius, tilt, speed,
phase }`). Reuse the existing shape/material/moon values (listed in `content/schema.ts`) and
   pick an orbit radius that does not collide with the neighbours.
2. Add its texts under `services.<category>.<slug>` in `messages/{pl,en,uk}/content.json`
   (`title`, `summary`, `audience`, `features`, `example`; copy an existing service).
3. Run `npm test`: the content tests fail on a missing text, an unknown value or a duplicate slug.

The service page in all languages, its sitemap entry, the planet in the 3D system, the HUD and
panel links, the configurator's feature list (step 2) and the structured data appear
automatically. A new **category** works the same way (an entry with `id`, `order`, `dna:
{ color, glow, core }` and its services, plus `categories.<id>` texts); run `npm run og:images`
afterwards so the Open Graph images show it.

## Adding a case study

1. Add an entry to [`content/projects.ts`](content/projects.ts): `slug`, `status`, `year`,
   `categories` and `services` (existing ids), `stack`, optional `gallery` (images in
   `public/portfolio/<slug>/` with their `width`/`height`) and an optional `demo`: `{ type:
'iframe', url, aspectRatio? }`, `{ type: 'video', src, poster? }` or `{ type: 'mockup',
variant }`.
2. Add its texts under `projects.<slug>` in every `content.json` (`title`, `client`, `industry`,
   `summary`, `task`, `solution`, `result`).
3. Keep `status: 'draft'` while preparing it: it is visible in `npm run dev` and in
   `npm run build:preview -- --drafts`. Switch to `'published'` to ship it; the first published
   case replaces the "coming soon" state. The case page, filter chip, archive card in the scene and
   sitemap entry follow from the data.

## Adding a language

1. Add the code to `locales` in [`src/i18n/routing.ts`](src/i18n/routing.ts).
2. Create `messages/<locale>/ui.json` and `content.json` with exactly the same keys as `pl`
   (the dictionary tests check parity and ICU syntax), including `hud.languageNames.<locale>` in
   every language.
3. Import both files in [`src/i18n/messages.ts`](src/i18n/messages.ts) and add the Open Graph
   locale (e.g. `de_DE`) to `OG_LOCALE` in [`src/lib/metadata.ts`](src/lib/metadata.ts).
   TypeScript points at anything else that is keyed by locale.
4. If the language needs another script (e.g. Greek), check that the fonts in `src/app/fonts.ts`
   cover it, and consider a preload entry in `scripts/postbuild.mjs` (`LOCALE_FONT_PRELOADS`).
5. Run `npm run og:images` for its Open Graph image, then `npm test` and a preview build.

URLs, the language switcher, `hreflang`, the sitemap and the root redirect's language links pick
the new locale up automatically.
