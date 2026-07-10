# Лог работы над ТЗ: навигация + антирадар

## Статус
Текущий блок: Блок 4 — выполнен (переход в боевой режим Supabase)
Последнее обновление: 2026-07-09 (заход 4)

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

**⚠️ TODO после диагностики и решения проблемы**: убрать все 4 правки
(баннер, alert'ы, TEMP DIAG-комментарии) — grep по `TEMP DIAG` в репозитории
покажет все места.

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

## История изменений
(сюда после каждого блока дописывать: что сделано, какие файлы менялись,
какие решения принял агент и почему, какие проблемы возникли)

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
