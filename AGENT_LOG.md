# Лог работы над ТЗ: навигация + антирадар

## Статус
Текущий блок: Блок 1 — выполнен
Последнее обновление: 2026-07-09 (заход 2)

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
- updateProgress, checkDeviation, fetchRoutes и их сигнатуры не менялись

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

## Блок 3: OSM-зоны контроля средней скорости
Статус: заблокирован (ждёт Блок 1)
Файлы: новый src/hooks/useOsmSpeedZones.ts, src/screens/LocationScreen.tsx

## История изменений
(сюда после каждого блока дописывать: что сделано, какие файлы менялись,
какие решения принял агент и почему, какие проблемы возникли)

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
