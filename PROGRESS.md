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

**Проєкт завершено** (2026-11-21). Фінальний звіт — [REPORT.md](REPORT.md).

- Власник перевірив сайт на телефоні й ПК («усе працює добре») і скасував додаткові прогони (e2e, знімки 2D, замір CPU).
- Фінальні ворота: lint, typecheck, 61 файл / 608 юніт-тестів, prettier, `build:preview` (86 сторінок) з guard — без localhost і плейсхолдерів.
- Останні зміни:
  - одна кнопка Telegram (D135);
  - «живий» 2D-режим (D130, D131);
  - URL сайту лише з env Pages (D123);
  - username `wa1demarr` (D122).
- Останні звіти: `reports/{perf-a11y,qa,visual}/F3.md`, `reports/visual/F4.md`.

**Наступний крок (чекає на власника):** публікація на GitHub Pages.

1. ✅ Репозиторій: https://github.com/Kabaninno/kabaninno (remote `origin` додано, `main` запушено 2026-11-21).
2. ✅ Перший запуск «Deploy to GitHub Pages» упав на кроці «Configure GitHub Pages», бо Pages ще не ввімкнені. Код не винен, збірка не стартувала.
3. ✅ Власник увімкнув Pages (Source = GitHub Actions); деплой `73e3f08` пройшов. **Сайт: https://kabaninno.github.io/kabaninno/**
   - Перевірено після деплою (curl + один headless Chrome, `reports/qa/live-check.mjs`):
     - сторінки 200, невідомі шляхи 404;
     - canonical, hreflang, og і twitter, sitemap (84 URL), robots, JSON-LD — на `https://kabaninno.github.io/kabaninno`;
     - 0 входжень localhost, `.invalid` і плейсхолдерів; 19/19 ассетів головної — 200;
     - на 4 сторінках у трьох мовах 0 console errors і 0 невдалих запитів, сцена доходить до `data-scene-ready`;
     - на підсумку конфігуратора одна кнопка `https://t.me/wa1demarr?text=…`.
   - Локальний `build:preview` тепер сам бере `https://kabaninno.github.io/kabaninno` з git remote (D123).
4. Деплой бере `base_url`/`base_path` з `actions/configure-pages` (D123).
5. Домену поки немає (`[ДОМЕН]` у `site.config.ts` лишається). Коли з’явиться: Settings → Pages → Custom domain.

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

- [x] Шари зір із паралаксом, туман, мережа вузлів і ліній з пульсацією та імпульсами даних
- [x] 5 вузлів категорій, вузол портфоліо (скупчення), вузол конфігуратора (маяк)
- [x] Hover і фокус (синхронізація з HTML-навігацією), HTML-лейбли (aria-hidden у canvas)
- [x] CameraControls (інерція, обмеження, touch), автоповорот у спокої (вимкнений при reduced-motion)
- [x] Політ і «занурення» (GSAP, FOV-punch, спалах bloom), postprocessing bloom
- [x] Прогрів (idle, touchstart, hover), debug-хук `?debug=1`
- [x] Playwright: скріншоти станів з out/ під basePath, e2e deep links і «назад», збір console errors
- [x] Ворота, рецензії qa, visual і perf-a11y (цикл 1), легка visual-перевірка, коміт

### M3. Планетарні системи

- [x] Ядра (prism, strata, forge, neural, comet), реєстр форм і матеріалів, кільця, супутники, шлейфи
- [x] Орбіти, hover (підсвічування, сповільнення, назва), фокус камери на планеті
- [x] Панелі послуг (desktop збоку, mobile — bottom sheet), «Додати до запиту», пов'язані кейси
- [x] Стрілки, свайп, Esc, «← Всесвіт»; монтування лише активної системи та системи в прогріві, dispose
- [x] Ворота, легка visual-перевірка, коміт

### M4. Конфігуратор і Telegram

- [x] Схеми кроків (zod), дані функцій за типом, бюджети в PLN (валюта з конфігу), терміни
- [x] Майстер із 7 кроків: прогрес, валідація, перехід на будь-який крок, чернетка в localStorage, передзаповнення
- [x] Реакція сцени на вибір (підсвічування категорій, маяк)
- [x] Генератор повідомлення (чиста функція, тести pl/en/uk, кодування, ліміти)
- [x] LeadSubmitter, TelegramLinkSubmitter, заготовка ApiSubmitter (NEXT_PUBLIC_API_URL); fallback-кнопки копіювання й відкриття чату
- [x] Ворота, легка visual-перевірка, коміт

### M5. Портфоліо

- [x] Скупчення-обсерваторія у сцені, фільтр за категорією, картки-об'єкти
- [x] Сторінка кейсу (задача, рішення, результат, стек, галерея), демо: iframe (lazy), відео, мокап
- [x] Стан «coming soon», коли немає опублікованих кейсів
- [x] Ворота, легка visual-перевірка, коміт

### M6. Мобільні, продуктивність, доступність

- [x] Bottom sheet, hit-зони, touch (обертання, pinch, tap)
- [x] PerformanceMonitor, AdaptiveDpr, рівні якості, DPR не більше 2, frameloop demand
- [x] Простий режим: перемикач у HUD, автоматичне ввімкнення без WebGL, без «блимання»
- [x] Reduced-motion; інтро до 3 с лише при першому візиті з можливістю пропустити; екран завантаження з прогресом
- [x] Виміри (бандли, Lighthouse, TBT); рішення щодо відкладеного 3D у DECISIONS.md
- [x] Ворота, рецензії (включно з perf-a11y), коміт

### M7. SEO, полішинг, фінал

- [x] Метадані, Open Graph (зображення), hreflang, sitemap і robots — фінальна перевірка
- [x] Полішинг за беклогом; README (запуск, деплой, як додати послугу, кейс або мову)
- [x] Повний аудит трьома рецензентами, виправлення, повторний прогін
- [x] REPORT.md і фінальне повідомлення
- [ ] (опційно) ambient-звук — не робили, D128

## Результати останніх перевірок

| Дата       | Блок                                | lint                                                                               | typecheck | test                     | build                                                     | Примітки                                                                                                                                                                                 |
| ---------- | ----------------------------------- | ---------------------------------------------------------------------------------- | --------- | ------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-21 | Фінал (після перевірки власником)   | ✅                                                                                 | ✅        | ✅ 61 файл, 608 тестів   | ✅ build:preview, 86 сторінок, url guard ✅; prettier ✅  | аудит F3: perf-a11y (Lighthouse mobile 70/100/100/100), QA, visual; blocker і major виправлено; останній повний e2e (F4) 87/7 — причини виправлено, повторний прогін скасовано власником |
| 2026-11-21 | M5 (легкий режим, перед комітом)    | ✅                                                                                 | ✅        | ✅ 52 файли, 507 тестів  | ✅ build:preview із SHOW_DRAFTS, 98 сторінок; prettier ✅ | visual M5-light: 0 blocker, 1 major, 6 minor; картки архіву з’являються через 12–30 с у SwiftShader                                                                                      |
| 2026-11-21 | M4 (легкий режим, перед комітом)    | ✅                                                                                 | ✅        | ✅ 48 файлів, 467 тестів | ✅ build:preview, 86 сторінок; prettier ✅                | visual M4-light: 0 blocker, 1 major, 4 minor; 5 станів, оцінки 3–4                                                                                                                       |
| 2026-11-21 | M3 (легкий режим, перед комітом)    | ✅                                                                                 | ✅        | ✅ 44 файли, 439 тестів  | ✅ build:preview, 86 сторінок; prettier ✅                | visual M3-light: 0 blocker, 2 major, 7 minor; 9 станів, оцінки 3–4                                                                                                                       |
| 2026-11-21 | M2 (легкий режим, перед комітом)    | ✅                                                                                 | ✅        | ✅ 31 файл, 328 тестів   | ✅ build:preview, 86 сторінок; prettier ✅                | visual M2-light: 0 blocker, 6/6 станів 4–5. Цикл 1 до легкого режиму: e2e 50/50, axe 0, Lighthouse mobile home 69 (без WebGL 100)                                                        |
| 2026-11-21 | M1 (фінал, цикл 3)                  | ✅                                                                                 | ✅        | ✅ 18 файлів, 219 тестів | ✅ 86 сторінок; preview ✅; prettier ✅                   | QA M1-3: 0/0 (104/104 перевірок N1); visual M1-3: 0/0, усі стани 4/5                                                                                                                     |
| 2026-11-21 | M1 (повний каркас)                  | ✅                                                                                 | ✅        | ✅ 11 файлів, 163 тести  | ✅ 88 сторінок; preview з `/kabaninno` ✅                 | ui-engineer: 81/81 HTTP-перевірок і 32/32 перевірок у headless Chrome; initial JS на `/pl/` ≈ 194 KB gzip; three.js лише в lazy-чанку (941 KB raw); preload шрифтів 88,4 KB              |
| 2026-11-21 | M1 (базова перевірка наявного коду) | ✅ (попередження «Pages directory cannot be found» зникне, коли з'явиться src/app) | ✅        | — (тестів ще немає)      | — (немає src/app)                                         | лише конфіги, content, i18n і lib                                                                                                                                                        |

## Беклог фінального блоку (легкий режим відклав)

- **Пріоритет 1 — V5-01 (major, scene + ui):** картки архіву портфоліо з’являються через 12–30 с після завантаження (SwiftShader), камера перекадровує в цей момент. Готувати картки до кінця польоту (пріоритет компіляції), сигнал `data-archive-ready` і очікування в скриншотах; перевірити, чи це не загальна проблема черги компіляції на слабких пристроях.
- Visual M5-light minor: V5-02 стани кейсів не прокручують до демо (`scrollIntoView`); V5-03 у картках сцени немає назви; V5-04 емблеми CRM («торт») і AI («грудка») — гостріші форми, менше шуму; V5-05 ручка sheet тьмяніє під контентом (суцільна смуга 24 px); V5-06 сусідні картки на портретному кейсі обрізані HUD; V5-07 мокап чату порожній на першому екрані (привітання бота).
- Не перевірено в M5: сплячий стан без кейсів у браузері, 3D-клік по картках, польоти, reduced motion, решта мокапів, iframe після кліку, en/uk.
- Повний прогін e2e (останній повний був до етапного старту). Очікувані зміни: тест no-WebGL має перевіряти «canvas не лишається і немає console errors», а не «чанк сцени не запитується» (D55); перевірити QA-M2-02/03/05, тест воріт панелі, `data-scene-focus` на маршрутах планет.
- Візуально не перевірені зміни M2 (код і юніт-тести є): компактний hero й правило колонки (D58) на 1280/1366/1536/1600/1920; затухання вузлів поза вільною областю; нова розкладка лейблів; поріг 18 px; OKLCH-маяк; ворота панелі 0,35; HUD на всю ширину.
- Повторний Lighthouse (gzip-сервер `serve-out --gzip`) і рішення щодо B2.6 (відкладений 3D на мобільних). До легкого режиму: home 69, без WebGL 100.
- Перемикання medium→low раз за сесію перекомпілює все (≈210 мс при 4×).
- Нестабільне попередження SwiftShader «GPU stall due to ReadPixels» на деяких холодних стартах — стежити, якщо guard почне падати на warnings.
- Повторний axe і набір скриншотів M2-fix1.
- Питання до замовника (фінальний звіт): видимий код мови «UK» чи «UA» (lang/hreflang лишаються `uk`); en «Go to your request» чи «View your request» (CONTENT_REVIEW.md).
- Visual M2-light (minor): L-01 зірка над «SYSTEM» у заголовку індексу схожа на діакритику; L-02 лінія-вказівник на desktop ~110 px за текстом, засічка на орбіті CRM; L-03 на mobile лінк portfolio→web перетинає лейбл; L-04 на 1440×900 мережа притиснута вправо, лівий верхній кут порожній.
- Visual M3-light **major**: MJ1 у фокусі планети ядро категорії завелике й заблизько, перекриває кільце й заливає кадр (зсунути камеру, приглушити ядро ~50 %); MJ2 на телефоні в системі планети ≈5 px з великими ореолами — не розрізнити (наблизити камеру, ×1,8 планети, менші ореоли, hit-зони ≥ 44 px).
- Visual M3-light minor: mn1 орбіта перетинає лейбл планети; mn2 підсвічена орбіта ледь виділяється; mn3 шов кільця на куті обгортання (planet-crm); mn4 білі світлячки на орбітах і «голе» сусіднє ядро на краю; mn5 на mobile sheet автоскролить і ховає «← Wszechświat»; mn6 обрізаний breadcrumb у згорнутому sheet; mn7 подвійна рамка підсвіченої картки.
- Не перевірено в M3: польоти в русі, reduced motion і рівні low/medium, 3D-клік по планеті, `__sceneStats` M3, згладжування safeRect під час анімації sheet, розгорнутий sheet, активний стан «Додати до запиту» й бейдж HUD, uk-локаль.
- Visual M4-light **major** MJ-1 (ui): шапка майстра (заголовок, інтро, прогрес, список кроків у 3 рядки) займає ≈360 px desktop-панелі й увесь перший екран mobile sheet; дії підсумку (textarea, «Kopiuj tekst») поза першим екраном. Інтро лише на кроці 1, H1 ≈28 px, кроки одним рядком чипів, sticky footer із Wstecz/Dalej (і Kopiuj на підсумку), sheet ≈88dvh при deep link.
- Visual M4-light minor: MN-1 чипи кроків переносяться 3+3+1; MN-2 невибраний вузол automation обрізаний низом кадру / визирає з-під sheet; MN-3 колір і форма маяка різні між знімками (перевірити, чи це навмисний цикл); MN-4 кадр конфігуратора підняти на 60–80 px.
- Не перевірено в M4: майстер у браузері (валідація, фокус, кроки 2/4/5/6, uk і mobile 1–6), нижня частина підсумку, копіювання в реальних браузерах, відкриття Telegram на пристроях, рух імпульсів, reduced motion.
- L-04 (мережа притиснута вправо на 1440×900) — спільно scene + ui (safeRect огляду).
- Скриншоти: `--only` матчить повний заголовок Playwright (`[desktop] › … › name`), тож `^` не працює — використовувати `(^|\s)(name1|name2)# PROGRESS

## Беклог (minor і ідеї)

- V2-05 (visual major, відкладено): на no-WebGL головній верхні 55 % порожні, без зірок → M6 (простий режим).
- V2-10: чотири з п’яти ядер систем мають один шейдер, планети — білі заглушки → M3.
- P-09: купа JS після GC +0,9 МБ за 10 циклів (вирівнюється) → перевірити в M3.
- Рішення щодо B2.6 (відкладений 3D на мобільних) — після повторного Lighthouse у циклі 2.

- M1-14: guard `server-only` для серверних модулів. Потрібен пакет і alias у Vitest; зараз нічого не протікає, це перевірено.
- QA N2: дуже мала вільна область на коротких в'юпортах → M6, якщо після N1 ще актуально.
- QA N3 (частина 2, M3): hit-сфера фокусованого вузла в system і planet займає вільну область і перехоплює кліки.
- Visual M3-03: у landscape на 844 і 932 px десктопний HUD на touch має цілі 32–36 px. Збільшити до 44 px для `pointer: coarse` → M6.
- V-12-mobile: на мобільному sheet немає ручки-фону → M6.
- V-17: кутові скоби, лінії-виноски й ретикл уже є в лейблах canvas (M2). Решта — у панелях M3.
- Перевірити збірки з `SHOW_DRAFTS=true` і з порожнім basePath (QA «не перевірено»).

## Відомі проблеми

- ESLint 9 позначений у npm як deprecated (D01). Перейти на 10, щойно eslint-config-next його підтримає.
- `npm ls` показує extraneous wasm-пакети (@emnapi/*, @swc/wasm, @img/sharp-wasm32). Ймовірно, це опційні залежності next. Перевірити після `npm ci` у CI.
