# PROGRESS

Пам'ять проєкту. Оновлюється після кожного блоку. Якщо сесія перервалась або контекст стиснувся, продовжувати з розділу «Поточний блок».

- Специфікація: [docs/BRIEF.md](docs/BRIEF.md). План: [docs/PLAN.md](docs/PLAN.md). Рішення: [DECISIONS.md](DECISIONS.md).
- Команда агентів: `.claude/agents/`. Ролі: scene-engineer, ui-engineer, content-writer, qa-reviewer, visual-reviewer, perf-a11y-auditor.
- Цикл якості після кожного блоку (BRIEF C3):
  1. Ворота: build, lint, typecheck, test.
  2. qa-reviewer і visual-reviewer, плюс perf-a11y-auditor для блоків зі сценою, мобільною версією і на фіналі.
  3. Виправлення blocker і major, максимум 3 цикли.
  4. Коміт і оновлення цього файлу.

## Поточний блок

**M2. Всесвіт** (починається). M1 закомічено.

Підсумок M1:

- Три цикли рецензій.
- Фінальні звіти: `reports/qa/M1-3.md`, `reports/visual/M1-3.md` — 0 blocker, 0 major.
- Скріншоти: `screenshots/M1-3/`.

План M2:

- **scene-engineer:** справжній всесвіт.
  - Мережа вузлів, лінії з пульсацією, імпульси даних, дрейф.
  - Ядра в кольорі ДНК (V-07), мінімальний розмір від 28 px (N-07, M3-04).
  - Лейбли з виносками, ретикл.
  - CameraControls з інерцією, обмеженнями й touch; автоповорот.
  - GSAP-політ, FOV-punch, bloom; `flightProgress` у store.
  - Прогрів, оновлення hover після польоту (N3a).
- **ui-engineer:**
  - Playwright через системний Chrome: скріншоти й e2e (deep links, back, постійний canvas, console errors).
  - @axe-core/playwright.
  - Hero за прогресом польоту (N-04), fade-out (N-03).
  - Esc → батьківський стан (D27).
  - Посилання на вузли портфоліо й конфігуратора в індексі.
  - Тест апострофів.
  - Помилка home-link на головній (C3-1), `hero-scrim` (C3-2).
- **Потім:** ворота, qa, visual, perf-a11y, виправлення, коміт.

## Чекліст

### M0. Підготовка

- [x] Аналіз брифу, план і арт-дирекшн затверджені замовником
- [x] Версії пакетів перевірено (2026-11-21); документацію Telegram deep links перевірено
- [x] `git init -b main`, `npm install`
- [x] docs/BRIEF.md, docs/PLAN.md, DECISIONS.md (арт-дирекшн, D01–D19), PROGRESS.md
- [x] Команда агентів у `.claude/agents/`

### M1. Каркас

- [x] Конфіги:
  - next.config.ts: export, trailingSlash, images.unoptimized, basePath з env, next-intl plugin;
  - tsconfig (strict), ESLint 9 flat, Prettier, PostCSS (Tailwind 4), Vitest.
- [x] site.config.ts (KABANINNO; Telegram і домен — плейсхолдери)
- [x] content/:
  - schema.ts (zod: ДНК, планети, кейси, текстові схеми);
  - categories.ts (5 категорій × 4 послуги з ДНК);
  - projects.ts (4 чернетки);
  - index.ts (валідація, перехресні посилання, `shouldShowDrafts`).
- [x] messages/*/content.json для pl, en, uk (чернетки) і CONTENT_REVIEW.md. Розділ UI-рядків ще не заповнений.
- [x] messages/*/ui.json для pl, en, uk (чернетки)
- [x] src/i18n: routing, navigation, messages (серверні словники, pickMessages), request; src/types/next-intl.d.ts
- [x] src/lib: base-path, site-url, routes, route-state, content-text, metadata, analytics, storage, webgl, scene-manifest
- [x] src/scene: types, layout, random; src/store/scene.ts
- [x] src/app/globals.css (токени Tailwind 4, glass, eyebrow, reduced-motion), fonts.ts (variable, subsets; стратегія preload — D21)
- [x] src/app:
  - кореневий layout (passthrough + CSS);
  - `/` — redirect-сторінка (meta refresh, JS, canonical);
  - not-found (404.html, три мови).
- [x] src/app/[locale]:
  - layout (html lang, шрифти, NextIntlClientProvider з вибраними просторами імен, skip link, HUD, SceneRoot, main);
  - сторінки home, category, service, портфоліо (опційний catch-all, D20), configurator з generateStaticParams і metadata.
- [x] sitemap.ts і robots.ts (force-static, hreflang)
- [x] HUD: лого, Послуги (disclosure), Портфоліо, Конфігуратор, PL/EN/UK, CTA, мобільне меню (`<dialog>`)
- [x] SceneRoot (dynamic, ssr:false, детекція WebGL) і заглушка Experience (зорі, вузли, камера з URL, пауза в прихованій вкладці, маркер `data-scene-instance`, `?debug=1`)
- [x] scripts (плюс `vitest.mjs`, D23, і обхід бага експорту Next на Windows, D22):
  - postbuild (.nojekyll, CNAME з PAGES_CNAME, перевірка out/);
  - build-preview (basePath `/kabaninno`);
  - serve-out (статичний сервер під basePath, 404.html).
- [x] .github/workflows/deploy.yml (configure-pages → build → upload-pages-artifact → deploy-pages) і README (запуск, деплой, увімкнення Pages)
- [x] Тести: route-state, base-path, site-url, metadata, nav, content integrity (схеми, тексти для всіх сутностей, паритет ключів між мовами), layout, плюс тести сцени (goals, damp, model, node-ids)
- [x] Ворота зелені; out/ перевірено з basePath (404, sitemap, robots, redirect, ассети)
- [x] Рецензії qa і visual (3 цикли); виправлення; коміт

### M2. Всесвіт

- [ ] Шари зір із паралаксом, туман, мережа вузлів і ліній з пульсацією та імпульсами даних
- [ ] 5 вузлів категорій, вузол портфоліо (скупчення), вузол конфігуратора (маяк)
- [ ] Hover і фокус (синхронізація з HTML-навігацією), HTML-лейбли (aria-hidden у canvas)
- [ ] CameraControls (інерція, обмеження, touch), автоповорот у спокої (вимкнений при reduced-motion)
- [ ] Політ і «занурення» (GSAP, FOV-punch, спалах bloom), postprocessing bloom
- [ ] Прогрів (idle, touchstart, hover), debug-хук `?debug=1`
- [ ] Playwright: скріншоти станів з out/ під basePath, e2e deep links і «назад», збір console errors
- [ ] Ворота, рецензії qa, visual і perf-a11y, коміт

### M3. Планетарні системи

- [ ] Ядра (prism, strata, forge, neural, comet), реєстр форм і матеріалів, кільця, супутники, шлейфи
- [ ] Орбіти, hover (підсвічування, сповільнення, назва), фокус камери на планеті
- [ ] Панелі послуг (desktop збоку, mobile — bottom sheet), «Додати до запиту», пов'язані кейси
- [ ] Стрілки, свайп, Esc, «← Всесвіт»; монтування лише активної системи та системи в прогріві, dispose
- [ ] Ворота, рецензії, коміт

### M4. Конфігуратор і Telegram

- [ ] Схеми кроків (zod), дані функцій за типом, бюджети в PLN (валюта з конфігу), терміни
- [ ] Майстер із 7 кроків: прогрес, валідація, перехід на будь-який крок, чернетка в localStorage, передзаповнення
- [ ] Реакція сцени на вибір (підсвічування категорій, маяк)
- [ ] Генератор повідомлення (чиста функція, тести pl/en/uk, кодування, ліміти)
- [ ] LeadSubmitter, TelegramLinkSubmitter, заготовка ApiSubmitter (NEXT_PUBLIC_API_URL); fallback-кнопки копіювання й відкриття чату
- [ ] Ворота, рецензії, коміт

### M5. Портфоліо

- [ ] Скупчення-обсерваторія у сцені, фільтр за категорією, картки-об'єкти
- [ ] Сторінка кейсу (задача, рішення, результат, стек, галерея), демо: iframe (lazy), відео, мокап
- [ ] Стан «coming soon», коли немає опублікованих кейсів
- [ ] Ворота, рецензії, коміт

### M6. Мобільні, продуктивність, доступність

- [ ] Bottom sheet, hit-зони, touch (обертання, pinch, tap)
- [ ] PerformanceMonitor, AdaptiveDpr, рівні якості, DPR не більше 2, frameloop demand
- [ ] Простий режим: перемикач у HUD, автоматичне ввімкнення без WebGL, без «блимання»
- [ ] Reduced-motion; інтро до 3 с лише при першому візиті з можливістю пропустити; екран завантаження з прогресом
- [ ] Виміри (бандли, Lighthouse, TBT); рішення щодо відкладеного 3D у DECISIONS.md
- [ ] Ворота, рецензії (включно з perf-a11y), коміт

### M7. SEO, полішинг, фінал

- [ ] Метадані, Open Graph (зображення), hreflang, sitemap і robots — фінальна перевірка
- [ ] Полішинг за беклогом; README (запуск, деплой, як додати послугу, кейс або мову)
- [ ] Повний аудит трьома рецензентами, виправлення, повторний прогін
- [ ] REPORT.md і фінальне повідомлення
- [ ] (опційно) ambient-звук

## Результати останніх перевірок

| Дата       | Блок                                | lint                                                                               | typecheck | test                     | build                                     | Примітки                                                                                                                                                                    |
| ---------- | ----------------------------------- | ---------------------------------------------------------------------------------- | --------- | ------------------------ | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-21 | M1 (фінал, цикл 3)                  | ✅                                                                                 | ✅        | ✅ 18 файлів, 219 тестів | ✅ 86 сторінок; preview ✅; prettier ✅   | QA M1-3: 0/0 (104/104 перевірок N1); visual M1-3: 0/0, усі стани 4/5                                                                                                        |
| 2026-11-21 | M1 (повний каркас)                  | ✅                                                                                 | ✅        | ✅ 11 файлів, 163 тести  | ✅ 88 сторінок; preview з `/kabaninno` ✅ | ui-engineer: 81/81 HTTP-перевірок і 32/32 перевірок у headless Chrome; initial JS на `/pl/` ≈ 194 KB gzip; three.js лише в lazy-чанку (941 KB raw); preload шрифтів 88,4 KB |
| 2026-11-21 | M1 (базова перевірка наявного коду) | ✅ (попередження «Pages directory cannot be found» зникне, коли з'явиться src/app) | ✅        | — (тестів ще немає)      | — (немає src/app)                         | лише конфіги, content, i18n і lib                                                                                                                                           |

## Беклог (minor і ідеї)

- M1-14: guard `server-only` для серверних модулів. Потрібен пакет і alias у Vitest; зараз нічого не протікає, це перевірено.
- V-07: відтінок ядер вигоряє до білого, усі ядра мають один шейдер → M2/M3.
- Visual N-03: UI зникає різко → M2 (fade-out 150 мс або View Transitions).
- Visual N-04: hero з'являється за фіксованою затримкою 800 мс → M2, прив'язати до прогресу польоту (≥ 0,6). Можливо, потрібне нове поле store `flightProgress`.
- Visual N-07: на desktop вузли всесвіту замалі (ядра близько 16 px) → M2, ціль від 28 px; використати й смугу над hero.
- QA N2: дуже мала вільна область на коротких в'юпортах → M6, якщо після N1 ще актуально.
- QA N3: hover і курсор лишаються після польоту під нерухомим вказівником (M2). Hit-сфера фокусованого вузла в system і planet займає вільну область і перехоплює кліки (M3).
- QA nit: `STAR_COLORS` у `PortfolioCluster.tsx` дублює літерали `PALETTE.portfolio`.
- Visual M3-01: на 404 CSS-зірки повторюються сіткою 233 px. Взяти розміри плиток без спільних множників.
- Visual M3-02: на 404 зірки просвічують крізь картки. Потрібне скло, як у HUD: blur 12px на заливці `rgb(10 14 28 / .72)`.
- Visual M3-03: у landscape на 844 і 932 px десктопний HUD на touch має цілі 32–36 px. Збільшити до 44 px для `pointer: coarse` → M6.
- Visual M3-04: у landscape мережа дрібна, ядра сіруваті → M2 разом із N-07 (мінімальний екранний розмір ядра, яскравість).
- Тест: в українських словниках не має бути U+0027 і U+02BC, а в жодній мові — `'` поруч із `{`/`}` → M2 (ui-engineer).
- V-12-mobile: на мобільному sheet немає ручки-фону → M6.
- V-16: замість запланованого easing камери поки згасання → M2 (GSAP).
- V-17: мотиви «кутові скоби», «лінії-виноски», «ретикл» → M2/M3.
- M1-13: ключ `home.explore` не використовується. Він потрібен для підказки у всесвіті в M2.
- Перевірити збірки з `SHOW_DRAFTS=true` і з порожнім basePath (QA «не перевірено»).

## Відомі проблеми

- C3-1 (minor): якщо помилка сталася на головній, посилання «до всесвіту» в error-панелі веде на ту саму сторінку й нічого не робить (Retry працює) → M2.
- C3-2 (nit): `.hero-scrim` на портретних телефонах виходить на 96 px за frame (невидимо) → M2.

- ESLint 9 позначений у npm як deprecated (D01). Перейти на 10, щойно eslint-config-next його підтримає.
- `npm ls` показує extraneous wasm-пакети (@emnapi/*, @swc/wasm, @img/sharp-wasm32). Ймовірно, це опційні залежності next. Перевірити після `npm ci` у CI.
