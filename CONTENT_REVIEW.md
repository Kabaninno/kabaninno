# Вичитка контенту

Усі тексти в `messages/*/content.json` (категорії, послуги, кейси) і `messages/*/ui.json` (інтерфейс) — **чернетки, згенеровані AI**. Перед публікацією їх має вичитати людина, бажано носій кожної мови.

- **Кейси портфоліо вигадані.** Клієнти, задачі й результати — заглушки. У даних вони мають `status: "draft"` і не потрапляють у продакшн-збірку. Перед публікацією кейс замінюють реальним і ставлять `status: "published"`.
- **Цифр немає навмисно.** У результатах кейсів немає статистики, бо будь-які числа мають бути реальними.
- **Назви вигаданих клієнтів** («Kłosek», «Uśmiech+», «Vistula Cargo», «Studio Pulse») можуть випадково збігатися з реальними компаніями. Якщо кейси колись публікуватимуться як приклади, ці назви треба перевірити або замінити.

Статуси: `TODO: вичитати` → `OK` (або коментар із правкою).

## Категорії

| Ключ                    | pl             | en             | uk             |
| ----------------------- | -------------- | -------------- | -------------- |
| `categories.web`        | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `categories.crm`        | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `categories.automation` | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `categories.ai`         | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `categories.telegram`   | TODO: вичитати | TODO: вичитати | TODO: вичитати |

## Послуги

### Web (`services.web.*`)

| Ключ                 | pl             | en             | uk             |
| -------------------- | -------------- | -------------- | -------------- |
| `corporate-websites` | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `online-stores`      | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `landing-pages`      | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `web-apps`           | TODO: вичитати | TODO: вичитати | TODO: вичитати |

### CRM (`services.crm.*`)

| Ключ                 | pl             | en             | uk             |
| -------------------- | -------------- | -------------- | -------------- |
| `crm-implementation` | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `custom-crm`         | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `sales-funnels`      | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `reports-dashboards` | TODO: вичитати | TODO: вичитати | TODO: вичитати |

### Автоматизація (`services.automation.*`)

| Ключ                      | pl             | en             | uk             |
| ------------------------- | -------------- | -------------- | -------------- |
| `api-integrations`        | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `document-automation`     | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `notifications-reminders` | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `data-processing`         | TODO: вичитати | TODO: вичитати | TODO: вичитати |

### AI (`services.ai.*`)

| Ключ                     | pl             | en             | uk             |
| ------------------------ | -------------- | -------------- | -------------- |
| `ai-assistants`          | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `ai-document-processing` | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `content-generation`     | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `ai-analytics`           | TODO: вичитати | TODO: вичитати | TODO: вичитати |

### Telegram (`services.telegram.*`)

| Ключ               | pl             | en             | uk             |
| ------------------ | -------------- | -------------- | -------------- |
| `sales-orders`     | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `booking`          | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `customer-support` | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `mini-apps`        | TODO: вичитати | TODO: вичитати | TODO: вичитати |

## Кейси (`projects.*`, усі `draft`)

| Ключ                      | pl             | en             | uk             |
| ------------------------- | -------------- | -------------- | -------------- |
| `bakery-telegram-orders`  | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `dental-clinic-crm`       | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `logistics-document-ai`   | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `fitness-studio-platform` | TODO: вичитати | TODO: вичитати | TODO: вичитати |

## Терміни й формулювання, у яких я не впевнений

**Назви категорій і послуг.** Вони ж є підписами в 3D-сцені, тому мають бути короткими.

- pl `categories.web.name` = «Strony i aplikacje». Альтернативи: «Strony WWW» (коротше, але без застосунків) або «Web development».
- pl «Boty Telegram». Альтернативи: «Boty w Telegramie», «Boty telegramowe».
- pl «Landing page» лишив англійською, бо так говорять у галузі. Альтернатива «Strona docelowa» звучить штучно.
- pl «Lejki sprzedażowe» замість «Ścieżka sprzedaży»: «lejek» поширеніший у малому бізнесі, «ścieżka» звучить м’якше.
- pl `services.ai.ai-document-processing.title`: у M1 змінено «Przetwarzanie dokumentów AI» на «Przetwarzanie dokumentów z AI» (29 знаків із 32; так само сказано в seoDescription). Якщо для 3D-підпису треба коротше: «AI do dokumentów» або «Odczyt dokumentów z AI».
- en «Reports & Dashboards», «Notifications & Reminders», «Bookings & Appointments»: перевірити, чи підходить стиль з амперсандом.
- uk «Веброзробка» (разом, за правописом 2019) і «Лендінги». Альтернатива «посадкові сторінки» майже не вживається.

**Mini Apps.**

- Скрізь лишив офіційну назву «Telegram Mini Apps» / «Mini App», бо її використовує сам Telegram.
- Альтернативи: pl «mini aplikacje Telegram», uk «міні-застосунки Telegram».
- Граматика: pl «Mini App» у жіночому роді («w której»), uk у чоловічому («Mini App з меню»). Узгодити.

**Англіцизми.**

- pl: «follow-upy», «leady», «dashboardy», «copywriter», «barber shop», «salony beauty».
- uk: «лід», «follow-up», «дашборди», «барбершоп», «івент-агенція».
- Варто вирішити, чи лишати їх, чи замінити: uk «потенційний клієнт», «повторний контакт», «інформаційні панелі»; pl «kontakty sprzedażowe», «przypomnienia o kontakcie».

**Польські реалії в en/uk.**

- «BLIK» лишив у всіх мовах, бо сайт орієнтований на ринок Польщі.
- «paczkomaty»: en «parcel lockers», uk «поштомати». Українці в Польщі часто кажуть «пачкомати».
- uk «ставки VAT»: лишив VAT, бо мова про польський податок. Альтернатива «ставки ПДВ».
- CMR: uk «міжнародні транспортні накладні CMR», en «CMR consignment notes», pl «listy przewozowe CMR».

**Інше.**

- pl «protokoły» (protokół wydania/odbioru) → en «handover forms», uk «акти». Перевірити відповідність.
- uk «кабінети» в значенні pl «gabinety»: у M1 замінено на «клініки» в полях `audience` (як en «clinics»). «Кабінет клієнта» (особистий кабінет, client portal) лишився без змін. Якщо цільова аудиторія — саме приватні кабінети (стоматолог, косметолог, психолог), можна написати «приватні практики».
- uk «кожна десята кава безкоштовно»: можна «кожна десята кава — у подарунок».
- pl: звертання «Ty / Twoja firma» скрізь з великої літери. Узгодити зі стилем бренду, бо в сучасному вебі часто пишуть з малої.
- Апостроф в українських текстах: типографський `’` (U+2019), рішення D38. Причини: це типографічно правильний знак; він гарантовано є в шрифтах сайту (Manrope, Unbounded), а `ʼ` (U+02BC) — ні; прямий `'` (U+0027) у синтаксисі ICU (next-intl) є escape-символом і поруч із `{`/`}` ламає повідомлення. У M1 замінено всі 15 апострофів в uk-словниках (`ui.json` — 3, `content.json` — 12). В en апострофи (скорочення на кшталт «it's», «don't») лишаються прямими: жоден із них не стоїть поруч із `{` або `}`. У pl-словниках апострофів немає.
- en: британський правопис (catalogue, organise, recognise, analyse, tyre, enrolment, programme). Якщо потрібен американський, замінити глобально.

### Дрібні правки content.json під час вичитки M1

Тексти не переписувались, виправлено лише явні огріхи.

**pl**

- `services.web.landing-pages.example`: «trafia do arkusza i na Telegram menedżera» → «trafia do arkusza i do menedżera na Telegramie» (природніша конструкція).
- `services.ai.ai-document-processing.title`: «Przetwarzanie dokumentów AI» → «Przetwarzanie dokumentów z AI».

**en**

- `services.web.landing-pages.example`: «every application goes to a spreadsheet and the manager's Telegram» → «every sign-up goes to a spreadsheet and to the manager on Telegram».
- `services.ai.ai-document-processing.example`: «before booking» → «before the invoices are posted». На сайті «booking» означає бронювання, а тут ішлося про проведення рахунків у бухгалтерії.
- `services.telegram.mini-apps` (`features`, `seoDescription`): «loyalty program(s)» → «loyalty programme(s)», британський правопис, як у решті en-текстів.

**uk**

- `audience` у `services.web.corporate-websites`, `services.automation.notifications-reminders`, `services.telegram.booking`: «кабінетів» → «клінік».
- `services.crm.crm-implementation.audience`: «клієнтів в Excel» → «клієнтів у Excel» (милозвучність: попереднє слово закінчується на «в»).
- `services.crm.custom-crm.audience`: «задорогі в масштабі» (калька з «at scale») → «стають задорогими, коли команда росте».
- `services.crm.custom-crm.features[1]`: «телефона» → «телефону» (родовий відмінок за орфографічним словником).
- `services.crm.reports-dashboards.features[3]`: «Окремі види» → «Окремі екрани». Слово «вид» тут неоднозначне: «тип» чи «view».
- `services.automation.notifications-reminders.summary`: «дедлайни» → «терміни», як у списку функцій цієї ж послуги.

## UI-рядки (messages/*/ui.json)

Рядки інтерфейсу: HUD, заголовки панелей, підписи розділів, метадані сторінок, сторінка 404 і екрани помилок. Чернетку склав оркестратор, у M1 її вичитав content-writer (спершу польську). Структура ключів фіксована, від неї залежать компоненти. Під час вичитки міняються лише значення. Плейсхолдери `{studio}`, `{index}`, `{total}`, `{min}`, `{max}` лишаються як є.

| Простір імен                                   | Де видно                                                                                                                                                                                         | pl             | en             | uk             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | -------------- | -------------- |
| `meta`                                         | `<title>` і description сторінок (пошук, Open Graph)                                                                                                                                             | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `common`                                       | посилання пропуску навігації («Перейти до основного вмісту»), перший пункт хлібних крихт «← Всесвіт», aria-мітка хлібних крихт                                                                   | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `hud`                                          | верхня панель: лого, меню «Послуги», «Портфоліо», «Конфігуратор», перемикач мови, CTA; aria-мітки                                                                                                | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `home`                                         | перший екран: надзаголовок, слоган, лід, CTA, список категорій; `explore` — підказка у всесвіті (з’явиться в M2)                                                                                 | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `system`                                       | панель категорії: надзаголовок «System 01 / 05», заголовок списку послуг                                                                                                                         | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `service`                                      | панель послуги: заголовки розділів, терміни (з множиною), «Додати до запиту», навігація між послугами                                                                                            | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `portfolio`                                    | список кейсів, сторінка кейсу, стан «Незабаром»; бейдж «Чернетка» видно лише в dev-збірці або з `SHOW_DRAFTS=true`                                                                               | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `configurator`                                 | сторінка конфігуратора: надзаголовок, заголовок, лід, назви 7 кроків майстра (`steps`); решту ключів майстра описано в розділі «Нові ключі M4, M5 і фінального блоку»                            | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `notFound`                                     | сторінка 404, показує всі три мови одразу                                                                                                                                                        | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `portfolio.emptyCta`, `portfolio.emptyExplore` | порожнє портфоліо: кнопка CTA під «Незабаром» і заголовок над списком категорій (нові ключі, M1)                                                                                                 | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `error`                                        | екран помилки: панель замість вмісту сторінки (HUD і 3D лишаються) і повноекранна заглушка, якщо впав увесь layout (`global-error.tsx`, тексти вбудовуються під час збірки, D34); нові ключі, M1 | TODO: вичитати | TODO: вичитати | TODO: вичитати |

### Що змінено під час вичитки M1

**pl**

- `meta.configuratorDescription`, `configurator.lead`: «na Telegramie» → «przez Telegram» (Telegram як канал відправлення; однаково в обох місцях). «Kilka kroków» → «Kilka prostych kroków».
- `common.breadcrumbs`: «Ścieżka nawigacji» → «Ścieżka nawigacyjna» (усталена назва).
- `home.explore`: «aby go zbadać» → «by go zbadać» (коротше для підказки).
- `service.timeline`: «Orientacyjny czas» → «Orientacyjny czas realizacji» (повна усталена фраза).
- `service.siblings`: «Inne usługi w tym systemie» → «Usługi w tym systemie». Список містить і поточну послугу (вона позначена як активна), тож «інші» було неточно. Так само в en і uk.
- `portfolio.emptyBody`: прибрано англіцизм «case studies» → «Właśnie opisujemy pierwsze realizacje. Zajrzyj tu niedługo.»
- `configurator.comingSoon`: «jest w przygotowaniu» → «pojawi się tu wkrótce».
- `notFound.body`: «Nie znaleźliśmy tej strony.» → «Ta strona nie istnieje albo została przeniesiona.» (пояснює причину і не залежить від граматичного роду).

**en**

- «automations» → «automation» (`meta.homeTitle` уже так, `meta.homeDescription`, `home.lead`): в англійській це незлічуваний іменник.
- `meta.configuratorDescription`, `configurator.lead`: «on Telegram» → «via Telegram»; лід перебудовано: «A few quick steps, and you'll have a ready-made message…».
- `common.breadcrumbs`: «Breadcrumbs» → «Breadcrumb» (як у прикладах WAI-ARIA).
- `home.eyebrow`: «small business» → «small companies», щоб не повторювати «business» у слогані одразу під ним.
- `home.title`: «We connect your business into one system» → «We bring your business together in one system» («connect into» звучить неприродно).
- `home.explore`: «Pick a system to explore it» → «Pick a system to explore».
- `service.audience`: «Who it is for» → «Who it's for»; `service.timeline`: «Indicative timeline» → «Estimated timeline».
- `portfolio.stack`: «Stack» → «Tech stack»; `meta.portfolioDescription` так само.
- `portfolio.emptyBody`: «We're preparing our first case studies. Check back shortly.» («soon» уже є в заголовку «Coming soon»).
- `configurator.steps.type`: «Type of solution» → «Solution type» (коротше для індикатора прогресу).
- `notFound.body`: «This page doesn't exist or has moved.»

**uk**

- «автоматизації» → «автоматизація» (`meta.homeTitle`, `home.lead`), у `meta.homeDescription` — «автоматизація процесів». Множина тут звучить штучно.
- `common.skipToContent`: «Перейти до змісту» → «Перейти до основного вмісту». «Зміст» — це перелік розділів або суть, а посилання веде до вмісту сторінки.
- `hud.primaryNav`: «Головна навігація» → «Основна навігація», щоб не плутати з «головною сторінкою». `hud.homeLabel`: «головна» → «головна сторінка».
- `home.eyebrow`: «для малого бізнесу» → «для невеликих компаній», щоб не повторювати «бізнес» у слогані одразу під ним.
- `home.title`: «в одну систему» → «в єдину систему» (усталене поєднання).
- `home.lead`: «спроєктовані, щоб працювати разом» → «спроєктовані так, щоб працювати разом».
- `home.explore`: «щоб дослідити її» → «щоб її дослідити» (природніший порядок слів).
- `meta.portfolioDescription`, `portfolio.lead`: «проєкти» → «кейси», щоб збігалося з «Пов’язані кейси» і «Усі кейси». «Проєкт» лишився там, де йдеться про проєкт клієнта («Опишіть свій проєкт»).
- `meta.configuratorDescription`: «…терміни — і надішліть» → «…терміни, а потім надішліть» (без подвійного «і»).
- `portfolio.emptyBody`: «Перші кейси вже в роботі. Зазирніть сюди трохи згодом.»
- `configurator.lead`: «Кілька кроків» → «Кілька простих кроків»; `configurator.comingSoon`: «готується» → «з’явиться тут незабаром».
- `notFound.body`: «Такої сторінки не знайдено.» → «Такої сторінки немає або її перенесли.»

### Нові ключі `portfolio.empty*` і `error.*` (чернетка ui-engineer, вичитано content-writer)

**Усі мови**

- `portfolio.emptyCta` = головна CTA без змін: «Utwórz zapytanie» / «Build your request» / «Сформувати запит».
- `portfolio.emptyExplore`: додано «nasze / our / наші», бо без займенника заголовок над списком категорій звучить як сухий наказ. pl «Tymczasem poznaj nasze usługi», en «Meanwhile, explore the services» → «In the meantime, explore our services», uk «Тим часом перегляньте наші послуги».
- `error.body`: «цю частину сторінки» → «цю сторінку». Ті самі тексти показує і повноекранна заглушка `global-error.tsx`, де замінено всю сторінку, тож «частина» там була б неточною. Дії подано по черзі: спершу спробувати ще раз, а якщо це не допоможе, повернутися до всесвіту.
  - pl «Nie udało się wyświetlić tej strony. Spróbuj ponownie, a jeśli to nie pomoże, wróć do wszechświata.»
  - en «This page couldn't be displayed. Try again, and if that doesn't help, go back to the universe.»
  - uk «Не вдалося показати цю сторінку. Спробуйте ще раз, а якщо це не допоможе, поверніться до всесвіту.»
- `error.eyebrow`, `error.title`, `error.retry`, `error.home` лишились без змін. `error.home` дослівно збігається з `notFound.home`.

### Нові ключі M3: запит і нижня панель (чернетка ui-engineer, вичитано content-writer)

| Ключ                           | pl             | en             | uk             |
| ------------------------------ | -------------- | -------------- | -------------- |
| `hud.requestCount`             | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `service.addedToRequest`       | ключ прибрано  | ключ прибрано  | ключ прибрано  |
| `service.requestAddedStatus`   | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `service.requestRemovedStatus` | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `service.goToRequest`          | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `panel.sheetToggle`            | TODO: вичитати | TODO: вичитати | TODO: вичитати |

**Де видно**

- `hud.requestCount` на екрані не показується. Коли в запиті є послуги, код дописує його до назви посилання «Конфігуратор» у HUD і мобільному меню для екранних читачів: «Konfigurator, 2 usługi w zapytaniu» / «Configurator, 2 services in your request» / «Конфігуратор, 2 послуги в запиті». На екрані видно лише значок із числом. Форми множини: pl і uk — one/few/many/other (1 usługa, 2 usługi, 5 usług; 1 послуга, 2 послуги, 5 послуг), en — one/other. Форма `other` потрібна лише для дробових чисел і на практиці не трапляється.
- `service.addedToRequest` — колишній напис на кнопці після додавання послуги. У M4 кнопка стала перемикачем (`RequestToggle`): напис «Dodaj do zapytania» / «Add to request» / «Додати до запиту» не змінюється, а стан «додано» показує сам перемикач. Ключа в словниках більше немає.
- `service.requestAddedStatus`, `service.requestRemovedStatus` — невидимі оголошення для екранних читачів після натискання кнопки. `{service}` — назва послуги. Вона стоїть після двокрапки в називному відмінку, тож у pl і uk не треба її відмінювати.
- `service.goToRequest` — друге посилання поруч із кнопкою, веде в конфігуратор. З’являється, поки послуга є в запиті.
- `panel.sheetToggle` — доступна назва ручки нижньої панелі на телефоні. Стан («розгорнуто» / «згорнуто») екранний читач оголошує сам, тому в назві лише іменник, без дієслова.

**Що змінено в чернетці**

- `panel.sheetToggle`: «Panel z opisem» / «Details panel» / «Панель з описом» → «Panel treści» / «Content panel» / «Панель вмісту». Та сама панель є на сторінках категорії, послуги, портфоліо, кейсу й конфігуратора, а «опис» пасує лише до частини з них. uk «вміст» — як у «Перейти до основного вмісту».
- uk `hud.requestCount`: «у запиті» перенесено всередину кожної форми множини, щоб дотримати милозвучності: «1 послуга в запиті», «2 послуги в запиті», але «5 послуг у запиті».
- Решту чернетки лишено без змін. uk «Вилучено із запиту»: «із» перед «з» (милозвучність).

**Доступна назва перемикача мови («Polski, PL»)**

- Код складає її з `hud.languageNames` і коду мови: «Polski, PL», «English, EN», «Українська, UK». Читається мовою самого посилання (атрибут `lang`). Формат природний у всіх трьох мовах, змін не пропоную: спершу зрозуміла назва мови, потім видимий код, потрібний для голосового керування («натиснути PL»).
- Відкрите питання щодо видимого коду «UK» — див. «Відкриті питання UI».

### Нові ключі M4, M5 і фінального блоку (чернетка ui-engineer, вичитано content-writer)

| Ключі                                                 | pl             | en             | uk             |
| ----------------------------------------------------- | -------------- | -------------- | -------------- |
| `configurator.hints.*`, `progress`, `stepsNav`        | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `configurator.nav.*`, `fields.*`, `yes`, `no`         | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `configurator.extras.*`                               | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `configurator.industries.*`, `sizes.*`, `timelines.*` | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `configurator.budget.*`                               | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `configurator.errors.*`                               | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `configurator.prefilled`                              | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `configurator.summary.*`                              | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `lead.*`                                              | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `portfolio.filterLabel`, `filterAll`, `resultCount`   | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `portfolio.previous`, `next`, `siblingsNav`           | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `portfolio.gallery`, `galleryImage`                   | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `portfolio.demo*`, `newTab`                           | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `portfolio.mockups.*`                                 | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `hud.simpleMode`, `hud.simpleModeForced`              | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `hud.skipIntro`                                       | TODO: вичитати | TODO: вичитати | TODO: вичитати |
| `meta.ogImageAlt`                                     | TODO: вичитати | TODO: вичитати | TODO: вичитати |

**Де видно**

- `configurator.hints.*`, `progress`, `stepsNav`: підказка під заголовком кроку майстра; «Krok 3 z 7»; aria-мітка рядка кроків.
- `configurator.nav.*`, `fields.*`, `yes`, `no`: кнопки «Назад / Далі / До підсумку», «Змінити» в підсумку, «Почати заново» з підтвердженням; підписи й підказки полів.
- `configurator.extras.*`: 16 додаткових функцій у кроці «Функції», в одному списку з назвами послуг із `content.json`.
- `configurator.industries.*`, `sizes.*`, `timelines.*`: варіанти відповідей у кроках «Ваш бізнес» і «Терміни». Ті самі слова потрапляють у повідомлення.
- `configurator.budget.*`: варіанти бюджету. Суми й валюту підставляє код: «5 000–15 000 PLN», «PLN 5,000–15,000».
- `configurator.errors.*`: помилки під полями; ліміти з формами множини («2 znaki», «80 characters», «1000 символів»).
- `configurator.prefilled`: примітка, коли послуги, додані кнопкою «Додати до запиту», уже позначені в майстрі.
- `configurator.summary.*`: крок «Підсумок»: кнопки, статуси копіювання й надсилання, примітки про скорочений текст і неналаштований Telegram.
- `lead.*`: текст повідомлення, яке відвідувач надсилає студії в Telegram (приклад нижче).
- `portfolio.filterLabel`, `filterAll`, `resultCount`: фільтр кейсів за категорією і лічильник під ним.
- `portfolio.previous`, `next`, `siblingsNav`: навігація між кейсами внизу сторінки кейсу.
- `portfolio.gallery`, `galleryImage`: галерея кейсу; alt зображень («Назва кейсу: ilustracja 2 z 4»).
- `portfolio.demo*`, `newTab`: блок демо на сторінці кейсу: iframe (вантажиться лише після кліку), відео, мокап.
- `portfolio.mockups.*`: тексти інтерактивних мокапів: чат-бот, дашборд, бронювання, магазин.
- `hud.simpleMode`, `hud.simpleModeForced`: перемикач «2D» у HUD і рядок у мобільному меню; пояснення, чому 3D недоступне (для екранного читача і як підказка при наведенні).
- `hud.skipIntro`: кнопка під час інтро першого візиту.
- `meta.ogImageAlt`: alt картинки Open Graph (прев’ю посилання в месенджерах і соцмережах).

**Як виглядає повідомлення в Telegram** (pl, повний формат; приклад відповідей):

```
Zapytanie ze strony KABANINNO

Obszary: Strony i aplikacje, Boty Telegram
Funkcje:
• Sklepy internetowe
• Płatności online
Firma: Gastronomia, 1 osoba
Ma stronę WWW: nie · Korzysta z CRM: nie
Budżet: 5 000–15 000 PLN
Termin: Do miesiąca
Imię: Anna

Komentarz:
(власні слова відвідувача)
```

- Код лише складає підписи з `lead.*` і відповіді з `configurator.*` та `content.json`. Тому кожен варіант відповіді має добре читатися і в майстрі, і після двокрапки в повідомленні.
- Якщо текст не вміщується в посилання Telegram (ліміт довжини URL), код переходить на компактний формат: кожен розділ в один рядок, а коментар за потреби скорочується. Повний текст завжди можна скопіювати. Польські літери з діакритикою й кирилиця в посиланні займають більше місця, ніж латиниця, тож підписи `lead.*` навмисно короткі.

**Що змінено в чернетці**

Усі мови:

- `lead.website`, `lead.crm`: рядок «Strona WWW: tak · CRM: nie» був двозначним: сайт уже є чи його треба зробити? Тепер «Ma stronę WWW: nie · Korzysta z CRM: tak» / «Has a website: no · Uses a CRM: yes» / «Має сайт: ні · Користується CRM: так». Дієслова в теперішньому часі не мають роду (D14).
- `timelines.flexible`: у повідомленні виходив повтор «Termin: Termin jest elastyczny» / «Терміни: Гнучкі терміни». Тепер pl «Bez pośpiechu», uk «Без поспіху»: це ще й відповідь на питання кроку «Kiedy…? / Коли…?». en «Flexible» без змін.
- `industries.other`: «Inna / Other / Інша» → «Inna branża / Other industry / Інша галузь». У повідомленні рядок «Firma: Inna, 2–10 osób» був незрозумілим.
- `sizes.solo`: «Jednoosobowa / One-person business / Одна особа» → «1 osoba / 1 person / 1 особа», у тому самому стилі, що й «2–10 osób». В en зник повтор «Business: …, One-person business».
- `errors.requiredText`: додано «lub nazwę firmy / or company name / або назву компанії», бо підказка поля дозволяє вписати назву компанії.
- ~~`summary.openChat`~~ — ключ видалено: кнопки Telegram об’єднано в одну (REPORT.md, D135). Новий ключ для вичитки: `summary.sendHint` (підказка під кнопкою «Надіслати в Telegram»).
- `summary.unconfigured`: технічне «czat nie jest skonfigurowany» → «Wysyłka przez Telegram nie jest jeszcze dostępna. Skopiuj tekst i wyślij go nam w inny sposób.» (en, uk так само).
- `hud.simpleModeForced` узагальнено: тепер він охоплює не лише браузери без WebGL 2, а й ті, де WebGL є, але не працює (GPU в чорному списку, WebGL вимкнено). pl «Grafika 3D jest niedostępna w tej przeglądarce, dlatego strona działa w trybie prostym 2D.», en «3D is not available in this browser, so the site runs in simple 2D mode.», uk «У цьому браузері 3D-графіка недоступна, тому сайт працює в простому режимі 2D.»
- `meta.ogImageAlt`: alt тепер передає текст на самій картинці: назву студії, слоган (`home.title`) і назви категорій із чипів. Наприклад, pl «KABANINNO. Łączymy Twój biznes w jeden system: strony i aplikacje, CRM, automatyzacja, AI i boty Telegram». Якщо зміниться `home.title` або назви категорій, alt треба оновити разом із картинками (`npm run og:images`).

pl:

- `fields.hasWebsite`, `fields.hasCrm`: «Czy firma…» → «Czy Twoja firma…», як у назві кроку «Twoja firma».
- `extras`: «Panel do edycji treści» → «Panel do edycji treści (CMS)», за зразком «Pozycjonowanie (SEO)». «Obsługa głosowa» → «Komunikacja głosowa»: «obsługa» читається як обслуговування клієнтів. «Przekazanie rozmowy do człowieka» → «Przekazanie rozmowy człowiekowi» (граматично точніше; «konsultantowi» — чоловічий рід). «Wysyłka komunikatów» → «Wysyłka wiadomości do klientów»: «komunikat» звучить канцелярськи.
- `summary.send`: «Wyślij w Telegramie» → «Wyślij przez Telegram» (глосарій: Telegram як канал — «przez Telegram»).
- `summary.truncated`: «wklej go w czacie» → «wklej go na czacie» (усталене поєднання).
- `summary.sendFailed`: «inną drogą» → «w inny sposób», як в `unconfigured`.

en:

- `extras` у Title Case, як назви послуг у тому самому списку («Company Websites», «Online Stores»). «Voice support» → «Voice Interaction»: «support» читається як служба підтримки. «Handover to a person» → «Handover to a Human».
- `industries.beauty-health`: «Beauty and health» → «Health and beauty» (усталений порядок).
- `nav.toSummary`: «To the summary» → «Go to summary».
- `fields.hasWebsite`, `fields.hasCrm`: «the business» → «your business».
- `lead.business`: «Business» → «Company», як у «Company size».
- `summary.copied` → «Copied to clipboard.», `copyFailed` → «Couldn't copy. Select the text and copy it manually.», `sendFailed` → «Your request could not be sent. …».
- `portfolio.demoMockupHint`: «An interactive mockup: …» → «Interactive mockup: …» (це підпис, артикль зайвий).

uk:

- `hints.budget`: «Можна обрати й…» → «Можна також обрати…».
- `hints.summary`: «через Telegram» → «у Telegram», як у глосарії.
- `nav.startOver`: «Почати спочатку» (плеоназм) → «Почати заново»; так само `portfolio.mockups.chat.reset` → «Почати розмову заново».
- `fields.hasWebsite` → «Чи вже є у вашої компанії сайт?», `fields.hasCrm` → «Чи ваша компанія вже користується CRM?» (звертання до відвідувача і природніший порядок слів).
- `extras`: «Кілька мов» → «Мовні версії» (як pl «Wersje językowe»); додано «(CMS)»; «Онлайн-оплати» → «Онлайн-оплата»; «Електронні рахунки» → «Електронні рахунки-фактури», бо «рахунок» без уточнення легко сплутати з банківським.
- `industries`: «Краса і здоров’я» → «Краса й здоров’я» (милозвучність). «Гастрономія» → «Ресторани й кафе»: українською «гастрономія» — це радше кулінарія чи делікатеси, а в значенні галузі це полонізм.
- `errors.tooShort`: «Щонайменше …» → «Введіть щонайменше …» (повне речення, як у pl і en).
- `summary.restoreDefault`: «Повернути стандартний текст» → «Повернути початковий текст».
- `lead.business`: «Бізнес» → «Компанія», як у «Розмір компанії».
- `portfolio.demoMockupHint`: «спробуйте кнопки» (калька) → «спробуйте натиснути кнопки».
- `portfolio.mockups`: «Зробити замовлення» → «Оформити замовлення»; «буде приблизно за 30 хвилин» → «прибуде приблизно за 30 хвилин»; `booking.time` «Година» → «Час» (поле вибору часу; «година» тут звучить як одиниця виміру).

Без змін: `progress`, `stepsNav`, `budget.*`, `prefilled`, `lead.title`, `hud.skipIntro`, решта ключів `nav`, `hints`, `fields`, `extras`, `industries`, `timelines`, `summary` і `portfolio.*`. `hud.simpleMode` («Tryb prosty 2D» / «Simple 2D mode» / «Простий режим 2D») теж без змін: він містить видимий підпис «2D», тож доступна назва перемикача збігається з тим, що видно на екрані.

**Рядки, закріплені тестами.** Їх можна змінити лише разом із тестами (це робота ui-engineer):

- `lead.title` у pl і uk (перший рядок повідомлення);
- `configurator.progress` у pl і uk («Krok 3 z 7», «Крок 7 з 7»);
- `configurator.errors.tooShort` і `tooLong` у pl, `tooLong` в en («Wpisz co najmniej 2 znaki.», «Maksymalnie 1000 znaków.», «Up to 80 characters.»);
- `configurator.budget.*` у pl і en («15 000–40 000 PLN», «up to PLN 5,000»).

**Що перевірити носієві мови**

- Повідомлення в Telegram цілком, у кожній мові: чи читається воно як звичайний ввічливий запит від клієнта.
- Форми множини. `errors.tooShort` і `tooLong`: pl «2 znaki», «5 znaków»; uk «2 символи», «5 символів». `portfolio.resultCount`: pl «1 realizacja», «2 realizacje», «5 realizacji»; uk «1 кейс», «2 кейси», «5 кейсів»; при нулі — окреме речення.
- Назви 16 додаткових функцій поруч із назвами послуг: чи не дублюють вони одна одну і чи зрозумілі власнику малого бізнесу.
- Тексти мокапів (чат-бот, дашборд, бронювання, магазин). Це демонстраційні вигадані дані, а не обіцянки студії.

### Відкриті питання M4–фінал

- **Вітання в повідомленні.** Зараз повідомлення починається із заголовка «Zapytanie ze strony KABANINNO» / «Request from the KABANINNO website» / «Запит із сайту KABANINNO», далі йдуть відповіді. Можна додати ввічливе вітання: «Dzień dobry! Zapytanie ze strony KABANINNO» / «Hello! Request from the KABANINNO website» / «Добрий день! Запит із сайту KABANINNO». Заголовок закріплений тестами, тому для цієї зміни потрібна правка тестів (або окремий ключ `lead.greeting` і правка генератора). Посилання стане довшим приблизно на 10–25 символів у pl і en і приблизно на 70 в uk (кирилиця в URL займає більше місця).
- **Бюджет: нетто чи брутто?** У малому бізнесі в Польщі суми зазвичай називають нетто. Можна уточнити підказку: «Orientacyjna kwota netto w PLN».
- **E-faktury і KSeF.** Для польських компаній актуальна система KSeF (Krajowy System e-Faktur). Варіант: «E-faktury (KSeF)» / «E-Invoicing (KSeF)» / «Електронні рахунки-фактури (KSeF)».
- **«Bez pośpiechu» / «Без поспіху»** чи «Elastyczny termin» / «Гнучкі терміни»? Обрано перший варіант, щоб у повідомленні не повторювалося слово «termin/терміни».
- **en: Title Case для додаткових функцій** узгоджено з назвами послуг. Якщо назви послуг колись перейдуть на sentence case («Company websites»), функції треба змінити так само.
- **«W inny sposób» / «another way» / «іншим способом»** (`summary.unconfigured`, `summary.sendFailed`). Іншого контакту на сайті зараз немає. `unconfigured` з’являється лише доти, доки в конфігу не вказано Telegram-акаунт студії, а `sendFailed` — лише для майбутньої відправки через API. Чи додати на сайт e-mail або телефон як запасний канал?
- **Інтро:** pl «Pomiń intro» чи «Pomiń wstęp»; uk «Пропустити інтро» чи «Пропустити вступ». Поки що залишено «intro/інтро» як коротке і звичне слово.
- **pl «Tryb prosty 2D»** чи «Tryb uproszczony 2D»? Обидва природні, «uproszczony» трохи формальніший.
- **uk «Ресторани й кафе»** чи «Заклади харчування»? en «Food and hospitality» охоплює ще й готелі, pl «Gastronomia» — ні.
- **pl «1 osoba»** чи «Jednoosobowa działalność» (JDG)? Цифра узгоджена з рештою варіантів («2–10 osób»), а JDG — юридична форма, яка не завжди збігається з кількістю людей.
- **pl «Przekazanie rozmowy człowiekowi»** — нейтральний варіант. Звичніше в галузі «…konsultantowi», але це чоловічий рід (D14).

### Нотатки щодо термінів UI

- **CTA** однаковий скрізь (HUD, головна, заголовок конфігуратора, `meta.configuratorTitle`): «Utwórz zapytanie» / «Build your request» / «Сформувати запит». Не змінювався.
- **«Wszechświat» / «Universe» / «Всесвіт»** (`common.backToUniverse`) — короткий підпис першого пункту хлібних крихт. Стрілку «←» додає компонент, тому в тексті її немає. На сторінці 404 повна фраза: «Wróć do wszechświata» / «Back to the universe» / «Повернутися до всесвіту».
- **«System 01 / 05»** (`system.eyebrow`) — надзаголовок панелі категорії. Номери з нулем підставляє код (`{index}`, `{total}`). Набирається основним шрифтом великими літерами, тому кирилиця («Система 01 / 05») відображається коректно. Слово «system» — частина метафори «категорія = планетарна система».
- **«Obserwatorium» / «Observatory» / «Обсерваторія»** (`portfolio.eyebrow`) — надзаголовок портфоліо, відповідає «скупченню-архіву» у всесвіті. Заголовок сторінки лишається звичним: «Portfolio» / «Портфоліо».
- **Терміни виконання** (`service.timelineValue`): діапазон тижнів, множина узгоджується з другим числом. pl: «1–3 tygodnie», «2–6 tygodni»; uk: «1–3 тижні», «2–6 тижнів»; en: «1–3 weeks». Категорія `other` у pl і uk (`tygodnia`, `тижня`) потрібна лише для дробових чисел і в поточних даних не трапляється.
- **`hud.languageNames`** — назви мов їхніми ж мовами (Polski, English, Українська), однакові в усіх словниках. Не перекладаються.
- **`home.explore`** зараз ніде не показується. Ключ залишено для підказки у всесвіті в M2, тому текст короткий.
- **Telegram як канал:** pl «przez Telegram», en «via Telegram», uk «в/у Telegram» (за милозвучністю).
- **Екран помилки (`error`).** Тема «Signal Cosmos» є лише в надзаголовку: «Sygnał utracony» / «Signal lost» / «Сигнал втрачено». Заголовок і текст навмисно прості й спокійні, без метафор, щоб людина одразу зрозуміла, що робити. Кнопки: pl і en у наказовому способі («Spróbuj ponownie», «Try again»), uk в інфінітиві («Спробувати ще раз»), як і решта кнопок у кожній мові. Текст `body` повторює назву кнопки, щоб дія була очевидною.

### Відкриті питання UI

- pl `home.title` «Łączymy Twój biznes w jeden system»: лишив «biznes», бо надзаголовок над ним уже містить «firm». Альтернатива: «Cała Twoja firma w jednym systemie».
- pl `configurator.steps.timeline` «Termin» — короткий підпис для майбутнього індикатора прогресу. Альтернатива: «Czas realizacji».
- pl `portfolio.result` «Efekt» чи «Rezultat»? Обрано «Efekt» як живіше.
- en «Build your request» — узгоджений CTA. Якщо захочеться звичнішого варіанта, можна «Start your request», але тоді треба міняти скрізь.
- uk `portfolio.task` «Задача» чи «Завдання»? Обидва нормативні. Обрано «задача», як у брифі.
- pl `error.eyebrow` «Sygnał utracony» чи «Brak sygnału»? «Brak sygnału» звичніший (так пише телевізор), але означає «сигналу немає», а не «сигнал зник». Лишив «Sygnał utracony», як в en і uk.
- uk `error.title` «Щось пішло не так» — поширене формулювання в інтерфейсах, хоча дехто вважає його калькою. Нейтральна альтернатива: «Сталася помилка».
- Видимий код української в перемикачі мови «UK» (за брифом «PL / EN / UK»; це код мови за ISO 639-1). Англомовні відвідувачі можуть прочитати його як United Kingdom, тобто британську англійську. Багато українських сайтів показують «UA» (код країни). Атрибути `lang` і `hreflang` у будь-якому разі лишаються `uk`. Рішення за замовником; змінювати треба код, не словники.
- en `service.goToRequest` «Go to your request»: альтернатива «View your request». Лишив «Go to», як pl «Przejdź do zapytania» і uk «Перейти до запиту».

## Глосарій

| Поняття                      | pl                            | en                                            | uk                                       | Примітка                                                                                                                       |
| ---------------------------- | ----------------------------- | --------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Головна CTA                  | Utwórz zapytanie              | Build your request                            | Сформувати запит                         | однаково в HUD, на головній і в конфігураторі                                                                                  |
| Запит                        | zapytanie                     | request                                       | запит                                    | не «zamówienie», не «order»                                                                                                    |
| Додати до запиту             | Dodaj do zapytania            | Add to request                                | Додати до запиту                         | кнопка на планеті                                                                                                              |
| Додано до запиту             | Dodano do zapytania           | Added to request                              | Додано до запиту                         | лише в оголошенні для екранних читачів (`service.requestAddedStatus`); на кнопці стан показує галочка                          |
| Перейти до запиту            | Przejdź do zapytania          | Go to your request                            | Перейти до запиту                        | посилання в конфігуратор поруч із кнопкою                                                                                      |
| Панель вмісту                | Panel treści                  | Content panel                                 | Панель вмісту                            | ручка нижньої панелі на телефоні (aria-мітка)                                                                                  |
| Головна (3D)                 | Wszechświat                   | Universe                                      | Всесвіт                                  | підпис «←»-посилання                                                                                                           |
| Категорія послуг у 3D        | system                        | system                                        | система                                  | «System 01 / 05»                                                                                                               |
| Послуга                      | usługa                        | service                                       | послуга                                  |                                                                                                                                |
| Елемент портфоліо            | realizacja                    | project; у тексті про підготовку — case study | кейс                                     |                                                                                                                                |
| Портфоліо (надзаголовок)     | Obserwatorium                 | Observatory                                   | Обсерваторія                             |                                                                                                                                |
| Конфігуратор / майстер       | konfigurator / kreator        | configurator / wizard                         | конфігуратор / майстер                   |                                                                                                                                |
| Орієнтовні терміни           | orientacyjny czas realizacji  | estimated timeline                            | орієнтовні терміни                       |                                                                                                                                |
| Задача / рішення / результат | zadanie / rozwiązanie / efekt | task / solution / result                      | задача / рішення / результат             | сторінка кейсу                                                                                                                 |
| Технології                   | technologie                   | tech stack                                    | технології                               |                                                                                                                                |
| Галузь                       | branża                        | industry                                      | галузь                                   |                                                                                                                                |
| Чернетка                     | szkic                         | draft                                         | чернетка                                 | бейдж кейсів-чернеток, у продакшн-збірці його немає                                                                            |
| Втрата сигналу (помилка)     | Sygnał utracony               | Signal lost                                   | Сигнал втрачено                          | надзаголовок екрана помилки                                                                                                    |
| Спробувати ще раз            | Spróbuj ponownie              | Try again                                     | Спробувати ще раз                        | кнопка на екрані помилки                                                                                                       |
| Повернутися до всесвіту      | Wróć do wszechświata          | Back to the universe                          | Повернутися до всесвіту                  | 404 і екран помилки                                                                                                            |
| Звертання                    | Ty, Twoja firma (з великої)   | you                                           | ви (з малої)                             | гендерно-нейтрально (D14)                                                                                                      |
| Сфера проєкту (крок 1)       | obszar                        | area                                          | сфера                                    | категорія послуг у майстрі й у повідомленні                                                                                    |
| Підсумок (крок 7)            | Podsumowanie                  | Summary                                       | Підсумок                                 | «Do podsumowania» / «Go to summary» / «До підсумку»                                                                            |
| Почати заново                | Zacznij od nowa               | Start over                                    | Почати заново                            | очищення майстра з підтвердженням                                                                                              |
| Надіслати в Telegram         | Wyślij przez Telegram         | Send via Telegram                             | Надіслати в Telegram                     | головна дія підсумку                                                                                                           |
| Скопіювати текст             | Skopiuj tekst                 | Copy text                                     | Скопіювати текст                         | запасна дія підсумку                                                                                                           |
| Живе демо                    | demo na żywo                  | live demo                                     | живе демо                                | iframe на сторінці кейсу                                                                                                       |
| Інтерактивний макет          | interaktywna makieta          | interactive mockup                            | інтерактивний макет                      | демо-мокап на сторінці кейсу                                                                                                   |
| Простий режим 2D             | Tryb prosty 2D                | Simple 2D mode                                | Простий режим 2D                         | перемикач «2D» у HUD; назва має містити «2D»                                                                                   |
| Пропустити інтро             | Pomiń intro                   | Skip intro                                    | Пропустити інтро                         | кнопка під час інтро першого візиту                                                                                            |
| Апостроф                     | —                             | `'` у скороченнях (it's, don't)               | `’` (U+2019): Ім’я, з’явиться, пов’язані | D38; в uk не `'` (U+0027, escape-символ ICU) і не `ʼ` (U+02BC, немає гарантії в шрифтах). В en `'` не ставити поруч із `{`/`}` |
