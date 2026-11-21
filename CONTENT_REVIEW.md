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
| `configurator`                                 | сторінка конфігуратора: назви 7 кроків майстра; `comingSoon` — тимчасова заглушка до M4                                                                                                          | TODO: вичитати | TODO: вичитати | TODO: вичитати |
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

## Глосарій

| Поняття                      | pl                            | en                                            | uk                                       | Примітка                                                                                                                       |
| ---------------------------- | ----------------------------- | --------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Головна CTA                  | Utwórz zapytanie              | Build your request                            | Сформувати запит                         | однаково в HUD, на головній і в конфігураторі                                                                                  |
| Запит                        | zapytanie                     | request                                       | запит                                    | не «zamówienie», не «order»                                                                                                    |
| Додати до запиту             | Dodaj do zapytania            | Add to request                                | Додати до запиту                         | кнопка на планеті                                                                                                              |
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
| Апостроф                     | —                             | `'` у скороченнях (it's, don't)               | `’` (U+2019): Ім’я, з’явиться, пов’язані | D38; в uk не `'` (U+0027, escape-символ ICU) і не `ʼ` (U+02BC, немає гарантії в шрифтах). В en `'` не ставити поруч із `{`/`}` |
