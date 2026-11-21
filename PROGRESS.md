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

**M1. Каркас** (в роботі).

Агентів створено й закомічено, але поточна сесія їх не бачить: агенти завантажуються лише під час старту Claude Code. Замовника попрошено перезапустити сесію (`claude --continue`).

Після «продовжуй» робимо таке:
1. Перевірити, що агенти доступні: `subagent_type: ui-engineer` тощо.
2. Паралельно:
   - **ui-engineer:** globals.css, fonts, кореневі app-файли (layout, redirect, not-found), `[locale]`-layout і сторінки, HUD, sitemap і robots, scripts (postbuild, build-preview, serve-out), workflow, README (деплой), тести.
   - **scene-engineer:** SceneRoot і заглушка Experience (вимоги в пункті M1 нижче).
   - **content-writer:** розділ UI-рядків у CONTENT_REVIEW.md, вичитка ui.json.
3. Ворота, потім qa-reviewer і visual-reviewer, виправлення, коміт M1.

Незакомічений код M1 лежить у робочій копії. Його закомічу, коли ворота стануть зеленими.

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
- [ ] src/app/globals.css (токени Tailwind 4, glass, eyebrow, reduced-motion), fonts.ts (variable, subsets)
- [ ] src/app:
  - кореневий layout (passthrough + CSS);
  - `/` — redirect-сторінка (meta refresh, JS, canonical);
  - not-found (404.html, три мови).
- [ ] src/app/[locale]:
  - layout (html lang, шрифти, NextIntlClientProvider з вибраними просторами імен, skip link, HUD, SceneRoot, main);
  - сторінки home, category, service, portfolio, project, configurator з generateStaticParams і metadata.
- [ ] sitemap.ts і robots.ts (force-static, hreflang)
- [ ] HUD: лого, Послуги (disclosure), Портфоліо, Конфігуратор, PL/EN/UK, CTA, мобільне меню
- [ ] SceneRoot (dynamic, ssr:false, детекція WebGL) і заглушка Experience (зорі, вузли, камера з URL, пауза в прихованій вкладці, маркер `data-scene-instance`)
- [ ] scripts:
  - postbuild (.nojekyll, CNAME з PAGES_CNAME, перевірка out/);
  - build-preview (basePath `/kabaninno`);
  - serve-out (статичний сервер під basePath, 404.html).
- [ ] .github/workflows/deploy.yml (configure-pages → build → upload-pages-artifact → deploy-pages) і README (запуск, деплой, увімкнення Pages)
- [ ] Тести: route-state, base-path, site-url, content integrity (схеми, тексти для всіх сутностей, паритет ключів між мовами), layout
- [ ] Ворота зелені; out/ перевірено з basePath (404, sitemap, robots, redirect, ассети)
- [ ] Рецензії qa і visual; виправлення; коміт

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

| Дата | Блок | lint | typecheck | test | build | Примітки |
|---|---|---|---|---|---|---|
| 2026-11-21 | M1 (базова перевірка наявного коду) | ✅ (попередження «Pages directory cannot be found» зникне, коли з'явиться src/app) | ✅ | — (тестів ще немає) | — (немає src/app) | лише конфіги, content, i18n і lib |

## Беклог (minor і ідеї)
- (порожньо)

## Відомі проблеми
- ESLint 9 позначений у npm як deprecated (D01). Перейти на 10, щойно eslint-config-next його підтримає.
- `npm ls` показує extraneous wasm-пакети (@emnapi/*, @swc/wasm, @img/sharp-wasm32). Ймовірно, це опційні залежності next. Перевірити після `npm ci` у CI.
