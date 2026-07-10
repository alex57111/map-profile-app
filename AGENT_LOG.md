# Лог работы над ТЗ: навигация + антирадар

## Статус
Текущий блок: Блок 4 выполнен + ряд точечных фиксов после (auth, realtime,
голосование) — см. "История изменений" внизу для полного списка заходов
Последнее обновление: 2026-07-10 (заход 10)

## Правила работы (соблюдать всегда)
- Не переписывать файлы целиком — только точечные правки (patch/точечные замены)
- Новые поля — только опциональные, новые типы — только через union
- Не менять сигнатуры существующих функций/хуков
- После каждого блока — обязательный npm run build, только потом переход дальше
- Не трогать: fetchRoutes/parseOsrmRoute, useEventsAhead/eventsAhead, useSpeedLimit,
  adapter-паттерн (AuthAdapter/EventsAdapter), типы EventType/RoadEvent/EVENT_TYPE_CONFIG
  без явного указания в конкретном блоке

## Блок 1: Голос по шагам + osrm-text-instructions
Статус: выполнен
Файлы: package.json, package-lock.json, src/hooks/useRoute.ts,
новый src/types/osrm-text-instructions.d.ts

Что уже было сделано ДО этого захода (проверено и не трогалось):
- currentStepIndexRef, updateProgress с порогами 250м/50м в useRoute.ts
- Подключение updateProgress в LocationScreen.tsx рядом с checkDeviation
  (строки 62-63)

Что сделано в этом заходе:
- npm install osrm-text-instructions (добавлен в package.json/package-lock.json)
- В parseOsrmRoute instruction теперь формируется через
  osrmTextInstructions.compile("ru", s, { legIndex: 0, legCount }),
  куда передаётся весь объект step из ответа OSRM (не только type/modifier) —
  за счёт этого в тексте появляется название улицы (name из step)
- MANEUVER_RU и parseManeuver удалены — проверено, что нигде больше
  не используются (grep по src/ дал совпадения только в useRoute.ts)
- Поле maneuver в RouteStep не тронуто, используется как раньше для
  внутренней логики (isLastStep в updateProgress)
- Добавлен src/types/osrm-text-instructions.d.ts — у пакета нет
  собственных типов, минимальная декларация под compile()
- npm run build — прошёл успешно
Заметка на будущее (тестирование): реальный эндпоинт router.project-osrm.org
недоступен из песочницы агента (хост не в network allowlist). Замена
parseManeuver проверялась на mock-объекте step в точном формате ответа OSRM
(поля maneuver/name/mode и т.д.), а не через живой e2e-запрос. Если понадобится
e2e-тест голосовых инструкций на реальном маршруте — либо добавить
router.project-osrm.org в allowlist окружения агента, либо тестировать вручную
на устройстве (Alex тестирует на iPhone).

## Блок 2: Направленные события + пользовательские зоны
Статус: выполнен, кроме supabase-адаптера
Файлы: src/types/event.ts, src/hooks/useEventsAhead.ts,
src/lib/adapters/interface.ts, src/lib/adapters/mock/events.ts,
src/hooks/useAverageSpeedZone.ts

Что реализовано (проверено чтением кода на 2026-07-09):
- `src/types/event.ts`: EventType включает speed_zone; RoadEvent содержит
  heading?, endLat?, endLng?, zoneLimitKmh?; EVENT_TYPE_CONFIG и
  CreateEventPayload соответствуют.
- `src/hooks/useEventsAhead.ts`: фильтр по направлению события реализован
  (angleDiff, HEADING_FILTER_DEG = 45°), speed_zone исключён из обычных алертов.
- `src/hooks/useAverageSpeedZone.ts`: файл существует, полностью реализован —
  вход/выход из зоны, накопление пройденного пути, расчёт средней скорости,
  голосовые оповещения через speechSynthesis.
- `src/lib/adapters/interface.ts`: EventsAdapter типизирован через
  CreateEventPayload, включающий новые поля.
- `src/lib/adapters/mock/events.ts`: содержит speed_zone-событие,
  обрабатывает heading в createEvent.
- Подключение в UI подтверждено: `src/screens/LocationScreen.tsx`
  импортирует и вызывает useEventsAhead (строка 43) и useAverageSpeedZone
  (строка 51).

Известное расхождение — `src/lib/adapters/supabase/events.ts`:
- `toEvent()` не мапит heading, endLat, endLng, zoneLimitKmh из строки БД —
  только базовые поля (id, authorId, type, lat, lng, description,
  positiveVotes, negativeVotes, expiresAt, createdAt).
- `createEvent()` при вызове RPC `create_road_event` передаёт только
  p_type/p_lat/p_lng/p_description — heading/endLat/endLng/zoneLimitKmh
  никуда не отправляются.
- Требует правки, не выполнялась (по инструкции — не исправлять сейчас,
  только зафиксировать).

## Блок 4: переход в боевой режим (Supabase)
Статус: выполнен
Файлы: новый supabase/schema.sql, src/lib/adapters/supabase/events.ts

Проверено перед стартом (реальный код, не только по логу):
- Расхождение из Блока 2 подтверждено дословно чтением events.ts: toEvent()
  не мапил heading/endLat/endLng/zoneLimitKmh, createEvent() слал в RPC
  только p_type/p_lat/p_lng/p_description.
- src/lib/supabase.ts — обычный createClient(url, anonKey), без специфики
  под формат ключа.
- @supabase/supabase-js в package.json — 2.45.0. Ключ формата
  sb_publishable_... совместим с клиентскими библиотеками любой версии
  (подтверждено по официальной документации Supabase на 2026-07-09) —
  апгрейд пакета не требовался, supabase.ts не менялся.
- src/lib/adapters/index.ts — переключение по VITE_USE_SUPABASE корректно,
  не трогалось.
- Обнаружена зависимость, не описанная явно в ТЗ, но необходимая для
  сквозной работы: src/lib/adapters/supabase/auth.ts::signInAnonymous()
  после auth.signInAnonymously() поллит таблицу profiles (3 попытки,
  300мс), ожидая появления строки — без триггера на auth.users
  supabase-адаптер аутентификации не заработал бы вообще. Включено в схему.

Что сделано:
- supabase/schema.sql (новый, полный текст — в репозитории):
  - Таблица profiles (id/display_name/avatar_url/phone/is_anonymous/
    created_at) — под auth.ts::toProfile(). RLS: select/update только
    своей строки (id = auth.uid()). Прямого insert нет — строка создаётся
    триггером on_auth_user_created (SECURITY DEFINER) при регистрации
    в auth.users.
  - Таблица road_events — столбцы по toEvent() + heading/end_lat/end_lng/
    zone_limit_kmh (фикс расхождения). RLS: select открыт всем
    (anon, authenticated), прямых insert/update/delete-грантов нет —
    запись только через RPC.
  - Таблица event_votes (event_id, user_id, vote) — не читается/не
    пишется напрямую из адаптера, добавлена как опора для RPC
    vote_on_event, чтобы один auth.uid() не мог проголосовать за одно
    событие дважды (аналог votesStore в mock-адаптере). RLS включен,
    policy нет — доступ только через SECURITY DEFINER функцию.
  - RPC create_road_event(p_type, p_lat, p_lng, p_description, p_heading,
    p_end_lat, p_end_lng, p_zone_limit_kmh) — SECURITY DEFINER, требует
    auth.uid(), TTL вычисляется через CASE по типу, значения (в минутах)
    захардкожены дословно по EVENT_TYPE_CONFIG (src/types/event.ts):
    camera 180, police 60, accident 90, repair 480, danger 45,
    speed_zone 1440. Сверено построчно с event.ts перед коммитом.
  - RPC vote_on_event(p_event_id, p_vote) — SECURITY DEFINER, требует
    auth.uid(), инкремент positive/negative_votes через event_votes
    с уникальным ключом (event_id, user_id); повторный голос того же
    пользователя молча игнорируется.
  - GRANT EXECUTE на обе RPC — только роли authenticated (anon не может
    вызывать напрямую без сессии от signInAnonymously()).
  - SQL не выполнялся агентом (доступа к реальной БД нет) — Alex вставит
    вручную в Supabase SQL Editor.
- src/lib/adapters/supabase/events.ts:
  - toEvent() — добавлен мапинг heading/endLat/endLng/zoneLimitKmh из
    row.heading/row.end_lat/row.end_lng/row.zone_limit_kmh (только если
    не null/undefined — опциональные поля).
  - createEvent() — в вызов RPC create_road_event добавлены
    p_heading/p_end_lat/p_end_lng/p_zone_limit_kmh (?? null).
  - Имена RPC-параметров согласованы 1:1 со схемой в schema.sql.
  - voteOnEvent()/getEventsInBounds()/subscribeToEvents() не менялись.
- npm run build — прошёл успешно (879 KB бандл, предупреждение о размере
  чанка — не новое, не относится к этому блоку).

Известные ограничения (не проверялось, доступа к реальной БД нет):
- schema.sql не был выполнен и не тестировался на реальном Supabase-проекте
  агентом — только реверс-инжиниринг из кода + ручная проверка логики SQL
  чтением. Alex должен применить схему сам и протестировать сквозной сценарий
  (signInAnonymously → создание профиля триггером → createEvent → RPC →
  voteOnEvent) вручную на iPhone.
- Ограничение из Блока 3 (клик по OSM-зоне → голосование по несуществующему
  event_id "osm-zone-N" в supabase-режиме) не устранялось — RPC vote_on_event
  в этом случае вернёт ошибку (FK-нарушение на event_votes.event_id), т.к.
  вне области этого блока.

### Дополнение к Блоку 4: режим "админ" (неограниченное голосование)
Статус: выполнено (только SQL, фронтенд не трогался — не запрашивался)
Файлы: supabase/schema.sql

По прямому указанию Alex:
- `profiles.is_admin boolean not null default false` — новая колонка.
- Новая RPC `become_admin(p_password text)` (SECURITY DEFINER) — пароль
  сверяется ИСКЛЮЧИТЕЛЬНО внутри функции на сервере, на фронтенде нигде не
  хранится и не проверяется. При совпадении — `profiles.is_admin = true`
  для `auth.uid()`. При несовпадении — `raise exception 'Invalid request'`
  без деталей (не подтверждает/не опровергает, что именно неверно).
- `vote_on_event` дополнен веткой для `is_admin = true`: проверка
  уникальности голоса (`event_votes` PK) пропускается, счётчик
  positive/negative_votes увеличивается при каждом вызове независимо от
  повторов; строка в `event_votes` при этом перезаписывается через
  `ON CONFLICT ... DO UPDATE` (таблица хранит последний голос для справки,
  не отражает фактическое число голосов админа — это осознанное
  поведение по требованию).
- **ВНИМАНИЕ — технический долг, заведомо зафиксированный по прямому
  указанию Alex**: пароль `'321'` — 3 цифры, перебирается мгновенно
  brute-force'ом через RPC (rate-limit на `become_admin` не добавлялся,
  ничего не мешает перебору с анонимным ключом). Изначально агент предлагал
  `nav-admin-2026`, Alex настоял на `321`, риск осознан и принят для личного
  проекта на текущем этапе. **Если проект начнёт расти за пределы личного
  использования — это первое, что нужно поменять**: длинный случайный
  пароль + rate-limit/лимит попыток на `become_admin`.
- Безопасность именно `is_admin`-флага (не пароля) закрыта отдельно: даже
  с корректной RLS-политикой `profiles_update_own` (own-row) фронтенд не
  может напрямую выставить `is_admin = true` через `.update()` — колонка
  не входит в `grant update (display_name, phone, avatar_url)`, изменить
  её может только `become_admin()` через `SECURITY DEFINER`.
- Фронтенд (UI для ввода пароля, localStorage-флаг "уже админ", кнопка
  вызова `become_admin`) НЕ реализован в этом заходе — Alex запросил
  только SQL/безопасность, явно ограничив список задач (schema.sql, diff,
  build, лог, коммит/пуш). Ждёт отдельного ТЗ на UI.
- npm run build — прошёл успешно (SQL на сборку не влияет, проверка на
  отсутствие регрессий в TS-коде).
- SQL не выполнялся (нет доступа к реальной БД).

### Временная диагностика (Блок 4): событие пропадает после перезагрузки вкладки
Статус: диагностика добавлена, ⚠️ ВРЕМЕННО — убрать после решения проблемы
Файлы: src/lib/adapters/index.ts, src/screens/LocationScreen.tsx,
src/hooks/useMapEvents.ts, src/lib/adapters/supabase/events.ts

Симптом: после настройки Supabase (SQL выполнен, env добавлены в Cloudflare,
деплой прошёл) добавленное событие пропадает после закрытия/открытия вкладки,
ошибок на экране нет. Это классическое поведение mock-адаптера
(in-memory store, сбрасывается при перезагрузке JS) — подозрение, что
`VITE_USE_SUPABASE` не подхватывается на билде Cloudflare (Vite инлайнит
`import.meta.env.VITE_*` во время сборки, а не в рантайме — если переменная
была добавлена в Cloudflare Pages после последнего билда, или в неверный
scope (Preview вместо Production), собранный бандл её не увидит).

Добавлено (все правки помечены `// TEMP DIAG`, легко найти grep'ом):
- `src/lib/adapters/index.ts` — экспортированы `DEBUG_VITE_USE_SUPABASE_RAW`
  (сырое значение `import.meta.env.VITE_USE_SUPABASE` строкой) и
  `DEBUG_USE_SUPABASE` (результат сравнения `=== 'true'`, то самое, что
  реально решает mock/supabase).
- `src/screens/LocationScreen.tsx` — мелкий баннер в левом верхнем углу
  экрана (zeleный монотекст на чёрном), показывает оба значения. Плюс
  `handleCreateEvent` обёрнут в try/catch — при ошибке sheet не закрывается
  (раньше закрывался всегда, включая случай ошибки).
- `src/hooks/useMapEvents.ts` — `createEvent` теперь ловит ошибку, показывает
  `alert()` с текстом и перебрасывает её дальше (throw), поведение для
  успешного пути не изменилось.
- `src/lib/adapters/supabase/events.ts` — `subscribeToEvents` раньше
  деструктурировал только `data` из ответа Supabase, игнорируя `error`
  (молча проглатывал сбой, вызывая `onUpdate([])`). Теперь при наличии
  `error` — временный `alert()` с текстом ошибки. Сама логика
  (что происходит при отсутствии ошибки) не менялась.

npm run build — успешно.

**⚠️ TODO после диагностики и решения проблемы**: убрать все правки
(баннер, alert'ы, TEMP DIAG-комментарии, файл src/components/DebugBanner.tsx) —
grep по `TEMP DIAG` в репозитории покажет все места.

### Продолжение диагностики: разбор кодовой части (RAW=undefined подтверждён)
Alex подтвердил баннером: `RAW=undefined | USE_SUPABASE=false` — переменная
не попадает в бандл, хотя в Cloudflare Pages Dashboard задана (проверено
скриншотом, три Plaintext-переменные, имена верные).

Проверено на стороне кода — везде чисто, причина НЕ здесь:
- `vite.config.ts` — минимальный, никакого `envPrefix` или фильтрации env
  нет (значит используется дефолтный префикс `VITE_`, всё как надо).
- `.env`/`.env.production`/`.env.local` в репозитории НЕ закоммичены —
  `git ls-files`/`find` подтверждают, есть только `.env.example` (не
  участвует в сборке) и `.env.local` в `.gitignore` (значит даже если у
  кого-то локально есть файл, в репозиторий он не попадёт и не мог
  затенить переменные на Cloudflare).
- `public/` — нет `_headers`/`_redirects`/`functions/`, которые могли бы
  что-то переопределять.
- `package.json` → `"build": "vite build"` — обычная команда без доп. флагов.
- `.node-version` = 20 — актуальная LTS, не причина.

Вывод: раз ДАЖЕ `VITE_USE_SUPABASE` (простейшая булева строка) не долетает
до бандла, дело не в конкретной переменной и не в коде проекта — проблема
на стороне того, ЧТО и КАК Cloudflare Pages реально собирает и
деплоит.

**Агент не смог продолжить диагностику дальше самостоятельно**: нет доступа
к Cloudflare Pages в этой сессии — MCP-инструменты Cloudflare, которые
удалось загрузить (`Cloudflare Developer Platform`), покрывают только
Workers/D1/R2/KV/Hyperdrive, инструмента для Pages (Settings → Builds,
Environment Variables, история деплоев) там нет, отдельного Cloudflare API
токена в этой сессии тоже не было передано (только GitHub PAT для репо).

Нужно от Alex (любое из двух):
1. Прислать текстом/скриншотом Settings → Builds & deployments: значение
   полей **Build command** и **Build output directory** — совпадают ли с
   `npm run build`/`dist`, которые тестируются здесь.
2. ИЛИ прислать Cloudflare API-токен с доступом к Pages (Zone/Account:
   Pages Read или выше) — тогда агент проверит конфиг и последние деплои
   сам через Cloudflare API.

Наиболее вероятные версии (для сверки Alex-ом, без доступа к панели —
только гипотезы, не подтверждено):
1. **Deploy = "Retry deployment" на старом билде**, а не новый деплой —
   известное поведение Cloudflare Pages: Retry переиспользует снэпшот
   env-переменных ИЗ МОМЕНТА того старого билда, не подхватывает
   переменные, добавленные после. Нужен новый commit/push или явный
   "Create deployment", а не Retry.
2. **Переменные заданы для окружения "Preview", а раздаётся "Production"**
   (или наоборот) — в Cloudflare Pages переменные скоупятся по
   Production/Preview отдельно, нужно смотреть, для какого именно
   окружения проставлены значения на скриншоте и с каким URL Alex
   тестирует.
3. Деплой в реальности идёт НЕ через Git-интеграцию Cloudflare (где
   Cloudflare сам клонирует репо и запускает Build command из настроек),
   а через **прямую заливку уже собранного `dist/`** (Direct Upload/
   Wrangler CLI) — в этом случае Dashboard-переменные из Settings → Builds
   в принципе не участвуют в сборке, т.к. сборка происходит не на стороне
   Cloudflare. Это стоит исключить в первую очередь: если деплой шёл через
   `wrangler pages deploy`/аналогичный API-вызов с уже готовой папкой
   `dist`, а не через push в GitHub с последующей автосборкой Cloudflare —
   вот и причина.

### Фикс: анонимный вход не запускался, если пользователь не заходил в профиль
Статус: выполнено
Файлы: src/hooks/useAuth.tsx (переименован из .ts), src/App.tsx,
src/screens/LocationScreen.tsx, src/components/DebugBanner.tsx (мелкий фикс типов)

Найденная причина ошибки "Not authenticated" при создании события: `useAuth()`
был обычным хуком с собственным `useState`/`useEffect` внутри — каждый
компонент, который его вызывал, запускал СВОЙ независимый цикл
`getCurrentUser() → signInAnonymous()`. Он вызывался только в
`ProfileScreen.tsx`. `LocationScreen.tsx` (где реально создаются события)
`useAuth()` не вызывал вообще — значит анонимный вход никогда не стартовал,
если пользователь не открывал вкладку "Профиль" first.

Что сделано:
- `useAuth.ts` → `useAuth.tsx`, переписан на React Context
  (`AuthProvider`/`useAuth()`, по образцу уже существующего
  `AdaptersProvider`/`useAdapters()` из `useAdapters.tsx`). Вся логика входа
  (getCurrentUser/signInAnonymous/updateProfile) осталась той же, но теперь
  выполняется ОДИН раз на уровне провайдера, а не в каждом компоненте,
  который вызывает `useAuth()`.
- `App.tsx`: `AuthProvider` подключён в `export default App()`, оборачивает
  `AppContent` (внутри `AdaptersProvider`, т.к. `AuthProvider` нужен
  `auth`-адаптер через `useAdapters()`). Сам `AppContent()` вызывает
  `useAuth()` один раз и прокидывает `authStatus` пропом в `LocationScreen`
  — вход теперь стартует сразу при загрузке приложения, независимо от того,
  какая вкладка открыта первой.
- `ProfileScreen.tsx` — **не менялся**: сигнатура `useAuth()` та же, теперь
  он просто читает общий контекст вместо создания своего независимого
  состояния — дублирования входа больше нет.
- `LocationScreen.tsx` — принимает проп `authStatus: AuthState['status']`.
  Пока не `'authenticated'` (loading или unauthenticated):
  `handleFABPress`/`handleMapClick` не открывают `AddEventSheet` (ранний
  return), кнопка создания события заменяется на некликабельный индикатор
  (⏳ во время loading, 🔒 если вход не удался) вместо активного FAB.
- Попутно найденная и исправленная мелкая ошибка типов в
  `src/components/DebugBanner.tsx` (`.then().catch()` на `PromiseLike` —
  `tsc --noEmit` ругался, `vite build` эту ошибку не ловил, т.к. не делает
  полную проверку типов) — переписано на `async`/`try-catch`. Не влияет
  на функциональность, чисто типы.

`npm run build` и `npx tsc --noEmit` — оба чисто.

### Фикс: тап по карте не открывал окно создания события (устаревшее замыкание)
Статус: выполнено
Файлы: src/components/map/LeafletMap.tsx

Причина (найдена Alex-ом): `map.on("click", (e) => onMapClick(...))`
подключался один раз при инициализации Leaflet-карты (внутри `useEffect` с
пустыми/ограниченными зависимостями) и захватывал `onMapClick` в замыкании
на тот момент. `onEventClick`/`onRouteClick` от этой же проблемы были уже
защищены через `useRef` (`onEventClickRef`/`onRouteClickRef`, обновляются
каждый рендер, обработчики вызывают их через `.current`) — `onMapClick`
такой защиты не получил. В связке с прошлым фиксом auth (см. выше) это
давало эффект "навсегда залипшего" `authStatus === 'loading'`: обработчик
клика по карте был создан на первом рендере, когда `LocationScreen` ещё не
получил актуальный `authStatus === 'authenticated'`, и с тех пор всегда
использовал ту старую версию `handleMapClick` с ранним `return`.
Кнопка `+` (`AddEventFAB`) работала, т.к. её `onPress` — обычный React
`onClick`, переподписывается на каждый рендер сам по себе, в отличие от
императивной Leaflet-подписки через `map.on(...)`.

Фикс: добавлен `onMapClickRef` по образцу `onEventClickRef`/`onRouteClickRef`
— `useRef(onMapClick)`, обновляется на каждый рендер (`onMapClickRef.current
= onMapClick`), обработчик клика по карте теперь вызывает
`onMapClickRef.current(...)` вместо захваченного значения.

`npm run build` и `npx tsc --noEmit` — оба чисто.

### Две точечные правки schema.sql: delete по отрицательному score + realtime
Статус: выполнено в коде, **ТРЕБУЕТ ручного применения в Supabase**
Файлы: supabase/schema.sql

Диагноз получен от Alex, сверен с реальным кодом на GitHub (main) перед
правкой — оба расхождения подтверждены дословно.

**Проблема 1 — события не удалялись при накоплении отрицательных голосов.**
`vote_on_event` в schema.sql после инкремента `negative_votes` никак не
проверял итоговый score — в отличие от `mock/events.ts`, где
`if (ev.positiveVotes - ev.negativeVotes <= -3)` удаляет событие. Порог
`-3` подтверждён построчным чтением mock-адаптера, менять не стал —
сохранён 1:1.
Правка (точечная, функция не переписывалась целиком): после `update ...
negative_votes = negative_votes + 1` добавлен `returning positive_votes,
negative_votes into v_pos, v_neg`, затем `if v_pos - v_neg <= -3 then
delete from public.road_events where id = p_event_id; end if;` — в ОБЕИХ
ветках (админ и обычный пользователь). Позитивный голос score никогда не
понижает, поэтому проверка после `positive_votes + 1` не нужна.
`event_votes` при этом удалится каскадно — `on delete cascade` на FK
`event_id` уже был в схеме, отдельно ничего добавлять не потребовалось.
Клиент (`subscribeToEvents` в supabase/events.ts) уже рефетчит полный
список активных событий на любое `postgres_changes`-событие (включая
`DELETE`) — удалённое событие само пропадёт из ответа `SELECT *`, правок
на фронте не потребовалось (проверил, подтверждаю вывод из диагноза).

**Проблема 2 — события не приходили в реальном времени без перезагрузки.**
Таблица `public.road_events` не была добавлена в publication
`supabase_realtime` — `postgres_changes`-подписка в `subscribeToEvents()`
физически не могла получать insert/update/delete по этой таблице ни от
своих, ни от чужих действий. Добавлена команда:
```sql
alter publication supabase_realtime add table public.road_events;
```
в конец `schema.sql` (секция 7), с комментарием.

**⚠️ ТРЕБУЕТ РУЧНОГО ДЕЙСТВИЯ В SUPABASE** (как и весь остальной
`schema.sql` — агент SQL не выполняет):
- Обе правки нужно применить, вставив актуальный `schema.sql` целиком (или
  точечно — новую версию `vote_on_event` через `create or replace function`
  и отдельно команду `alter publication`) в Supabase SQL Editor.
- `alter publication supabase_realtime add table public.road_events;`
  можно применить и через Dashboard → Database → Replication — включить
  тумблер для `road_events` — это эквивалентно этой SQL-команде, делать
  оба варианта одновременно не нужно.
- Без этого шага realtime по-прежнему не заработает — правка в репозитории
  сама по себе ничего не активирует в реальной БД.

npm run build + npx tsc --noEmit — оба чисто (изменения только в .sql,
TS-код не трогался).

Расхождений сверх этих двух задач при сверке не найдено — если появятся
в следующих заходах, фиксировать в лог отдельно, не исправлять молча.

### Фикс: EventDetailSheet не закрывался сам + чужие голоса не были видны live
Статус: выполнено
Файлы: src/screens/LocationScreen.tsx

Причина (диагноз Alex, подтверждён чтением кода): `selectedEvent` хранился
как `useState<RoadEvent | null>` — "замороженный" снимок объекта на момент
клика по маркеру (`handleEventClick`), никак не связанный с реальным
`events`/`combinedEvents` (который уже обновлялся через realtime). Из-за
этого: а) если событие удалялось на сервере (см. фикс delete по score
выше), открытая карточка не узнавала об этом и продолжала показывать
несуществующее событие; б) чужие голоса не подтягивались в открытую
карточку, только свой локальный оптимистичный инкремент.

Правка (точечная, компонент не переписывался):
- `selectedEvent` (RoadEvent) → `selectedEventId` (string | null).
  `selectedEvent` теперь деривация: `combinedEvents.find(e => e.id ===
  selectedEventId) ?? null` — тот же массив, что уже рисует маркеры на
  карте и обновляется через `useMapEvents`/postgres_changes.
- `handleEventClick`: `setSelectedEventId(ev.id)` вместо `setSelectedEvent(ev)`.
- `onClose` у `EventDetailSheet`: `setSelectedEventId(null)`.
- `handleVote`: убран блок ручной оптимистичной мутации счётчика после
  `await voteOnEvent(...)` — счётчик и факт удаления события теперь
  подтягиваются сами через деривацию, как только `useMapEvents` перефетчит
  `events` по `postgres_changes`.
- `EventDetailSheet.tsx` проверен — `if (!event) return null` уже был,
  ничего доделывать не потребовалось: как только `combinedEvents.find`
  вернёт `undefined` после рефетча (событие удалено), `selectedEvent`
  станет `null` и карточка закроется сама.
- Остальной код `LocationScreen.tsx` не трогался — везде, где раньше
  использовалась переменная `selectedEvent` (алерты, JSX), она читает ту
  же деривацию без дополнительных правок.

### Синхронизация порога удаления события: -3 → -1 (mock + schema.sql)
Статус: выполнено полностью — расхождение закрыто

По прямому указанию Alex: боевой порог в `vote_on_event` был вручную
изменён на `<= -1` в самой Supabase (в предыдущей сессии, не агентом —
правка сделана напрямую в БД, вне репозитория). Синхронизировано в двух
местах:
- `src/lib/adapters/mock/events.ts`: `<= -1` вместо `<= -3` (сделано
  раньше в этом же заходе).
- `supabase/schema.sql`: **было найдено и осознанно НЕ исправлено сразу**
  (см. ниже) — `vote_on_event` в репозитории всё ещё содержал `<= -3` в
  обеих ветках (админ и обычный пользователь), разойдясь с живой БД (`-1`)
  и с mock (`-1`). Alex дал добро на правку отдельным сообщением —
  исправлено: обе ветки и оба комментария теперь `<= -1`, с явной пометкой
  в комментарии, что было `-3`, изменено вручную в БД, теперь
  синхронизировано.

Итог: все три места (живая БД, `schema.sql`, `mock/events.ts`) теперь
согласованы на `-1`. `schema.sql` снова корректный источник правды — если
его заново применят на чистом проекте, порог будет `-1`, как в бою.

npm run build + npx tsc --noEmit — оба чисто (правка только в .sql, но
проверено по правилу проекта).

### Фикс: кнопки голосования в EventDetailSheet оставались активными после голоса
Статус: выполнено
Файлы: src/components/map/EventDetailSheet.tsx

Симптом: тап "Да"/"Нет" в карточке события (открывается тапом по маркеру)
→ сервер молча блокирует повторный голос того же юзера (ожидаемо, одно
правило на событие в `vote_on_event`), но кнопки оставались активными и
кликабельными — выглядело как баг, хотя на сервере всё было корректно.
`EventAheadAlert.tsx` (алерт при приближении к событию) от этой же
проблемы был уже защищён — оттуда и взят паттерн.

Правка (точечная, компонент не переписывался):
- Добавлен `const [voted, setVoted] = useState(false)`.
- `useEffect` сброса `voted` в `false` по `event?.id` (по аналогии со
  сбросом в `EventAheadAlert` по `alerts[0]?.event.id`) — **добавлен до
  раннего `return null`**, т.к. hooks не могут идти после условного
  return (правило React) — `if (!event) return null` в этом компоненте
  стоял раньше любых хуков, пришлось переставить порядок.
- Кнопки "Да"/"Нет": `disabled={voted}`, приглушённый стиль при
  `voted === true` (`COLORS.bgElevated`/`COLORS.border`/`COLORS.textDisabled`
  вместо цветных success/error) — визуально идентично `EventAheadAlert`.
- `handleVote` внутри компонента: ранний `return` если уже `voted`; после
  `await onVote(...)` — `setVoted(true)`. (Порядок именно "await, потом
  setVoted" — по прямому указанию Alex; отличается от `EventAheadAlert`,
  где `setVoted(true)` ставится ДО await, чтобы мгновенно блокировать
  повторный тап во время сетевой задержки. Здесь сознательно оставлено
  как попросили — при быстром двойном тапе до завершения первого запроса
  возможен второй RPC-вызов, но сервер его всё равно проигнорирует
  уникальным ограничением на голос, вреда не будет, просто лишний запрос.)
- Никаких текстовых пояснений ("вы уже голосовали") не добавлялось — по
  решению Alex, только визуальное приглушение.
- Счётчики голосов (`👍 Да (N)` / `👎 Нет (N)`) — в этом компоненте они
  встроены прямо в текст кнопок (не отдельным блоком, как в
  `EventAheadAlert`), не трогались — остаются видимыми и после `voted`
  (кнопка просто гаснет, число никуда не пропадает).
- Учтено уже существующее поведение: `event` — деривация из
  `combinedEvents` (см. прошлый фикс `selectedEventId`), если событие
  удалится по итогам голоса (порог -1), компонент и так размонтируется
  через `if (!event) return null` — `voted` тут скорее подстраховка на
  случай задержки между тапом и рефетчем, не единственная защита.

npm run build + npx tsc --noEmit — оба чисто.

## Блок 3: OSM-зоны контроля средней скорости
Статус: выполнен
Файлы: новый src/hooks/useOsmSpeedZones.ts, src/screens/LocationScreen.tsx

Проверено перед стартом (реальный код, не только по ТЗ/логу):
- В проекте уже был Overpass-запрос по enforcement=maxspeed, но точечный —
  useOsmCameras.ts (node[enforcement=maxspeed](around:...)), для отдельных
  камер на карте (OsmCamera[], не RoadEvent). Запроса по
  enforcement=average_speed с геометрией зоны (from/to) не было нигде.
- useEventsAhead(gps.position, events) и useAverageSpeedZone(gps.position,
  events) в LocationScreen.tsx получали events напрямую из useMapEvents —
  osmCameras туда не подмешивались.

Что сделано:
- src/hooks/useOsmSpeedZones.ts (новый): Overpass-запрос
  relation["enforcement"="average_speed"](around:15000,lat,lng) + `>; out
  geom qt;` — отдельный от useSpeedLimit.ts и от useOsmCameras.ts запрос,
  ничего существующее не менялось.
  - Парсинг members с ролями from/to (геометрия way через out geom),
    фолбэк на пары role=device, если from/to нет.
  - Зона без тега maxspeed на relation — пропускается (нет данных о лимите).
  - Результат приводится к RoadEvent (type: "speed_zone", authorId: "osm",
    description: "OSM" — визуальная пометка «из OSM» согласно уточнению),
    zoneLimitKmh/endLat/endLng заполнены, expiresAt — на год вперёд (не
    протухает как обычное событие).
  - Кэш по bbox (округление до ~1км, ключ от mapCenter) с TTL 10 минут —
    чтобы не долбить Overpass при каждом смещении карты.
  - Сетевые ошибки/пустой ответ проглатываются молча — экран не падает.
- src/screens/LocationScreen.tsx:
  - const osmZones = useOsmSpeedZones(mapCenter)
  - const combinedEvents = [...events, ...osmZones]
  - useEventsAhead(gps.position, combinedEvents) — было events
  - useAverageSpeedZone(gps.position, combinedEvents) — было events
  - <LeafletMap events={combinedEvents} .../> — было events (чтобы зоны
    из OSM отображались на карте, п. критериев приёмки)
  - MapHUD eventsCount={events.length} НЕ трогал — остаётся счётчиком
    только пользовательских событий (осознанное решение, не было явного
    требования включать туда OSM-зоны)
- npm run build — прошёл успешно
- useSpeedLimit.ts, useOsmCameras.ts, useEventsAhead.ts,
  useAverageSpeedZone.ts, типы RoadEvent/EventType — не менялись

Известное ограничение (не исправлялось, не входило в критерии приёмки):
- Клик по маркеру OSM-зоны на карте открывает тот же UI голосования
  (EventDetailSheet), что и для пользовательских событий. Голос через
  voteOnEvent(id, vote) для id вида "osm-zone-N" в mock-адаптере безопасен
  (eventsStore.find вернёт undefined → тихий return), в supabase-адаптере
  не проверялось — RPC может вернуть ошибку на несуществующий event_id.

### Доработка debug-баннера (по запросу Alex — раз он всё равно временный)
Вынесен в отдельный файл `src/components/DebugBanner.tsx` (весь целиком
TEMP DIAG, удалить вместе с импортом в LocationScreen.tsx).
- Текст теперь в `<pre>` с `userSelect: "text"` — выделяется на мобильном.
- Кнопка "Copy" — `navigator.clipboard.writeText()`, с фолбэком через
  скрытый `<textarea>` + `document.execCommand("copy")` для браузеров без
  Clipboard API/вне HTTPS-контекста.
- Состав диагностической информации расширен: `MODE` (import.meta.env.MODE),
  `VITE_SUPABASE_URL` (значение — не секрет, был явно передан Alex-ом в
  тексте ТЗ ранее), `VITE_SUPABASE_ANON_KEY` — только true/false наличия
  (сам ключ не выводится), и результат ping-запроса напрямую через
  supabase-клиент (`select("id", {head:true})` к road_events) — успех
  с числом строк или текст ошибки. Ping идёт независимо от того, какой
  адаптер выбран (mock/supabase) — тестирует именно связность/валидность
  env, а не текущий режим приложения.

## История изменений
(сюда после каждого блока дописывать: что сделано, какие файлы менялись,
какие решения принял агент и почему, какие проблемы возникли)

### 2026-07-10 (заход 13) — EventDetailSheet: блокировка повторного голоса
- Перенесён паттерн voted-стейта из EventAheadAlert.tsx: useState(false) +
  useEffect сброса по event?.id (хуки переставлены перед ранним return —
  их там раньше не было, return null стоял первой строкой).
- Кнопки disabled={voted} + приглушённый стиль, handleVote — await потом
  setVoted(true) (по прямому указанию, не как в EventAheadAlert).
- npm run build + npx tsc --noEmit — оба чисто.

### 2026-07-10 (заход 12) — schema.sql: закрыто расхождение порога -3/-1
- Alex дал добро — поправил supabase/schema.sql: -3 → -1 в обеих ветках
  vote_on_event (админ/обычный), комментарии обновлены.
- Все три места (живая БД, schema.sql, mock/events.ts) теперь на -1.
- npm run build + npx tsc --noEmit — оба чисто.

### 2026-07-10 (заход 11) — selectedEvent → деривация id + синхронизация порога
- LocationScreen.tsx: selectedEvent(RoadEvent) → selectedEventId(string|null)
  + деривация из combinedEvents. Чинит и авто-закрытие карточки при удалении
  события, и live-обновление счётчика голосов от других пользователей —
  одним фиксом, как и предполагалось в задаче.
- handleVote: убрана ручная оптимистичная мутация счётчика — больше не
  нужна, всё подтягивается деривацией.
- mock/events.ts: порог удаления -3 → -1, синхронизирован с боевым
  vote_on_event (изменён вручную в Supabase Alex-ом в этой сессии).
- ⚠️ НАЙДЕНО, не исправлено молча: supabase/schema.sql в репозитории
  всё ещё содержит -3 — разошёлся с живой БД (-1) и с mock (-1) после
  этого захода. Нужно решение Alex, править ли schema.sql.
- npm run build + npx tsc --noEmit — оба чисто.

### 2026-07-10 (заход 10) — schema.sql: delete по score <= -3 + realtime publication
- Проблема 1: vote_on_event не удалял событие при score <= -3 (в отличие
  от mock/events.ts) — добавлена точечная проверка после инкремента
  negative_votes в обеих ветках (админ/обычный), порог -3 сверен построчно
  с mock и не менялся.
- Проблема 2: road_events не была в publication supabase_realtime —
  добавлена alter publication supabase_realtime add table
  public.road_events;
- Обе правки — ⚠️ ТРЕБУЮТ ручного применения в Supabase SQL Editor (или
  Dashboard → Replication для publication) — сами по себе в репозитории
  не активны.
- Клиентский код (events.ts/useMapEvents.ts) проверен — уже рефетчит
  список на любое postgres_changes-событие, правок не потребовалось.
- npm run build + npx tsc --noEmit — оба чисто.

### 2026-07-09 (заход 9) — Фикс: тап по карте не открывал создание события
- Причина (найдена Alex-ом): map.on("click", ...) в LeafletMap.tsx
  захватывал onMapClick в замыкании при инициализации карты, не был
  обёрнут в useRef (в отличие от onEventClick/onRouteClick) — навсегда
  запомнил старую версию handleMapClick с authStatus === 'loading' из
  прошлого фикса auth.
- Добавлен onMapClickRef по тому же паттерну, обработчик клика вызывает
  .current.
- npm run build + npx tsc --noEmit — оба чисто.

### 2026-07-09 (заход 8) — Фикс корневого auth: единый вход на всё приложение
- Найдена причина "Not authenticated": useAuth() вызывался только в
  ProfileScreen.tsx как независимый хук с собственным useEffect — если
  пользователь не заходил на вкладку профиля, анонимный вход не стартовал.
- useAuth.ts → useAuth.tsx, переписан на Context (AuthProvider/useAuth()) —
  по образцу useAdapters.tsx. Один вход на всё дерево вместо N независимых.
- App.tsx: AuthProvider подключён в App() вокруг AppContent (внутри
  AdaptersProvider). AppContent вызывает useAuth() один раз, authStatus
  пропом уходит в LocationScreen.
- ProfileScreen.tsx не менялся — использует тот же useAuth(), теперь через
  общий контекст.
- LocationScreen.tsx: принимает authStatus проп, блокирует
  handleFABPress/handleMapClick пока не 'authenticated', FAB заменяется на
  индикатор (⏳/🔒).
- Попутно пофикшен мелкий type error в DebugBanner.tsx (.then().catch()).
- npm run build + npx tsc --noEmit — оба чисто.

### 2026-07-09 (заход 7) — Разбор причины RAW=undefined + расширение баннера
- Alex подтвердил баннером: переменная не в бандле, хотя в Cloudflare
  Dashboard задана верно.
- Проверил vite.config.ts/.env*/public/_headers/.node-version/package.json —
  всё чисто, причина не в коде проекта.
- Доступа к Cloudflare Pages в сессии нет (MCP покрывает только Workers/D1/
  R2/KV/Hyperdrive, API-токена для Pages не передавали) — запросил у Alex
  Settings → Builds или Cloudflare API-токен, привёл 3 наиболее вероятные
  гипотезы (Retry deployment на старом снэпшоте env / Production-Preview
  mismatch / деплой идёт Direct Upload мимо Cloudflare-сборки).
- Вынес DebugBanner в src/components/DebugBanner.tsx: copy-кнопка,
  выделяемый текст, MODE, presence VITE_SUPABASE_ANON_KEY, значение
  VITE_SUPABASE_URL, ping-запрос к Supabase напрямую через клиент.
- npm run build — успешно.

### 2026-07-09 (заход 6) — ВРЕМЕННАЯ диагностика supabase-режима
- Debug-баннер в LocationScreen.tsx (VITE_USE_SUPABASE raw + boolean).
- alert() при ошибках createEvent (useMapEvents.ts) и subscribeToEvents
  (supabase/events.ts — там же вскрылось, что error из ответа Supabase
  ранее вообще не проверялся).
- Все правки помечены `// TEMP DIAG` — убрать после диагностики.
- npm run build — успешно.

### 2026-07-09 (заход 5) — Дополнение к Блоку 4: режим "админ"
- Добавлена profiles.is_admin, RPC become_admin(p_password) (пароль '321',
  захардкожен только на сервере, по прямому указанию Alex — риск слабого
  пароля осознан и принят), vote_on_event дополнен веткой для админа
  (голосование без ограничения по уникальности).
- Column-level grant на profiles (UPDATE только display_name/phone/
  avatar_url) — is_admin нельзя выставить через обычный .update() с
  фронтенда, только через become_admin().
- npm run build — успешно (SQL не влияет на сборку).
- Фронтенд (UI ввода пароля/локальный флаг) не делался — не запрашивался
  в этом заходе.

### 2026-07-09 (заход 4) — Блок 4 выполнен
- Прочитан TZ-block4-supabase.md, сверен с реальным кодом (supabase.ts,
  supabase/events.ts, supabase/auth.ts, adapters/index.ts, types/event.ts,
  types/user.ts) — расхождение из Блока 2 подтверждено дословно, лог не
  разошёлся с кодом.
- Создан supabase/schema.sql: profiles + триггер on_auth_user_created,
  road_events (с heading/end_lat/end_lng/zone_limit_kmh), event_votes,
  RPC create_road_event и vote_on_event (SECURITY DEFINER), RLS-политики
  (select всем на road_events, только через RPC на запись; own-row на
  profiles; event_votes без прямого доступа).
- TTL в create_road_event сверены построчно с EVENT_TYPE_CONFIG по прямому
  указанию Alex перед стартом кодирования.
- Пофикшено расхождение в events.ts: toEvent()/createEvent() теперь
  мапят/передают heading/endLat/endLng/zoneLimitKmh.
- npm run build — успешно.
- SQL не выполнялся (нет доступа к реальной БД) — сохранён в репозитории,
  Alex применяет вручную в Supabase SQL Editor.

### 2026-07-09 (заход 3) — Блок 3 выполнен
- Прочитан загруженный TZ-navigation-antiradar.md целиком, сверен с реальным
  кодом — расхождений с уже выполненными Блок 1/2 не найдено (в отличие от
  первого загруженного файла TZ_Karta_Profil.md, который оказался другим,
  устаревшим документом и не использовался).
- Создан useOsmSpeedZones.ts, подключён в LocationScreen.tsx через
  [...events, ...osmZones] в useEventsAhead/useAverageSpeedZone/LeafletMap.
- npm run build — успешно.


### 2026-07-09 (заход 2) — Блок 1 выполнен
- Установлен osrm-text-instructions.
- parseManeuver заменён на osrmTextInstructions.compile("ru", s, {legIndex, legCount})
  с передачей полного step-объекта — в тексте появляются названия улиц.
- MANEUVER_RU и parseManeuver удалены (не использовались больше нигде).
- Добавлена декларация типов src/types/osrm-text-instructions.d.ts.
- npm run build — успешно.
- Протестировано на реалистичных mock OSRM step-объектах (прямой доступ к
  router.project-osrm.org из песочницы недоступен — хост не в allowlist):
  "Поверните направо" → "Поверните направо на Настасьинский переулок" и т.п.

### 2026-07-09 — Подготовительный шаг
- Проверено состояние репозитория перед стартом ТЗ.
- osrm-text-instructions в package.json отсутствует — подтверждено.
- Обнаружено расхождение с исходным описанием задачи: EventType/RoadEvent
  уже содержат speed_zone и связанные поля (часть Блока 2 была выполнена
  ранее, до постановки этого ТЗ).
- Дополнительной проверкой установлено, что Блок 2 фактически выполнен
  почти полностью, включая хуки и mock-адаптер, за исключением
  supabase-адаптера (см. описание выше).
- Код ТЗ не менялся, только чтение и фиксация состояния в этом логе.
