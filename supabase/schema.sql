-- ============================================================================
-- Блок 4: боевая SQL-схема Supabase (реверс-инжиниринг из адаптеров)
-- Источники: src/lib/adapters/supabase/{events,auth}.ts,
--            src/lib/adapters/mock/{events,auth}.ts,
--            src/types/{event,user}.ts
-- Выполнить целиком в Supabase SQL Editor на пустом проекте.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles
-- Нужна для src/lib/adapters/supabase/auth.ts: signInAnonymous() после
-- auth.signInAnonymously() поллит эту таблицу (до 3 раз/300мс), ожидая
-- строку — значит строка должна появляться сама, через триггер на auth.users.
-- Поля — по toProfile()/UserProfile (src/types/user.ts).
-- ----------------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null default 'Водитель',
  avatar_url    text,
  phone         text,
  is_anonymous  boolean not null default true,
  is_admin      boolean not null default false,
  created_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- getCurrentUser()/signInAnonymous(): select .eq("id", user.id) — только своя строка.
create policy profiles_select_own
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- updateProfile(): update .eq("id", user.id) — только своя строка.
-- ВАЖНО: is_admin намеренно не входит в список разрешённых для UPDATE колонок —
-- column-level grant ниже физически не даёт клиенту выставить его себе напрямую
-- через .from("profiles").update(...), даже с id = auth.uid() и валидным RLS.
-- is_admin можно поменять только через RPC become_admin() (SECURITY DEFINER,
-- пароль проверяется исключительно на сервере).
create policy profiles_update_own
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

revoke update on public.profiles from authenticated;
grant update (display_name, phone, avatar_url) on public.profiles to authenticated;

-- Прямых INSERT/DELETE-политик нет: строка создаётся только триггером ниже.

-- Триггер: при создании auth-пользователя (в проекте — только анонимные,
-- signInAnonymously()) сразу создаём профиль, чтобы поллинг в auth.ts не упёрся
-- в пустоту.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, is_anonymous)
  values (new.id, 'Водитель', coalesce(new.is_anonymous, true));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ----------------------------------------------------------------------------
-- 2. road_events
-- Столбцы — по toEvent()/RoadEvent (после фикса events.ts в этом блоке) +
-- недостающие heading/end_lat/end_lng/zone_limit_kmh (расхождение Блока 2).
-- ----------------------------------------------------------------------------
create table public.road_events (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references auth.users(id) on delete cascade,
  type            text not null check (type in ('camera','police','accident','repair','danger','speed_zone')),
  lat             double precision not null,
  lng             double precision not null,
  description     text,
  positive_votes  integer not null default 0,
  negative_votes  integer not null default 0,
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now(),
  -- Направление автора (0-360, null = направление неизвестно → алерт всем)
  heading         double precision,
  -- Зона средней скорости (только type = 'speed_zone')
  end_lat         double precision,
  end_lng         double precision,
  zone_limit_kmh  double precision
);

create index road_events_bounds_idx on public.road_events (lat, lng);
create index road_events_expires_idx on public.road_events (expires_at);

alter table public.road_events enable row level security;

-- getEventsInBounds()/subscribeToEvents(): select без auth-фильтра — читать
-- может кто угодно, даже анонимный по publishable-ключу.
create policy road_events_select_all
  on public.road_events for select
  to anon, authenticated
  using (true);

-- Прямых INSERT/UPDATE/DELETE-политик для anon/authenticated нет умышленно:
-- запись только через RPC ниже (SECURITY DEFINER), т.к. anon-ключ публичный
-- и TTL/подсчёт голосов должны считаться на бэкенде, а не приходить от клиента.


-- ----------------------------------------------------------------------------
-- 3. event_votes
-- В коде адаптера (supabase/events.ts) явно не читается/не пишется напрямую —
-- добавлена как опора для RPC vote_on_event, чтобы соблюсти "RPC с проверками"
-- из ТЗ (п.2) и не дать одному auth.uid() голосовать за одно событие дважды —
-- аналогично поведению votesStore в mock-адаптере (mock/events.ts).
-- RLS без policy = anon/authenticated доступа к таблице напрямую не имеют,
-- читает/пишет её только SECURITY DEFINER функция ниже.
-- ----------------------------------------------------------------------------
create table public.event_votes (
  event_id  uuid not null references public.road_events(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  vote      boolean not null, -- true = "yes", false = "no" (см. VoteValue)
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_votes enable row level security;
-- Политик нет намеренно — таблица закрыта для прямого доступа.


-- ----------------------------------------------------------------------------
-- 4. RPC create_road_event
-- Вызывается из createEvent() (supabase/events.ts) с параметрами
-- p_type/p_lat/p_lng/p_description (+ p_heading/p_end_lat/p_end_lng/
-- p_zone_limit_kmh после фикса в этом блоке).
-- TTL — CASE по типу, значения продублированы из EVENT_TYPE_CONFIG
-- (src/types/event.ts) буквально, чтобы не разойтись с фронтендом:
--   camera 180 / police 60 / accident 90 / repair 480 / danger 45 /
--   speed_zone 1440 (минуты).
-- ----------------------------------------------------------------------------
create function public.create_road_event(
  p_type            text,
  p_lat             double precision,
  p_lng             double precision,
  p_description     text default null,
  p_heading         double precision default null,
  p_end_lat         double precision default null,
  p_end_lng         double precision default null,
  p_zone_limit_kmh  double precision default null
)
returns public.road_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ttl_mins integer;
  v_row public.road_events;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_type not in ('camera','police','accident','repair','danger','speed_zone') then
    raise exception 'Unknown event type: %', p_type;
  end if;

  -- Значения ttlMins из src/types/event.ts EVENT_TYPE_CONFIG — держать в синхроне.
  v_ttl_mins := case p_type
    when 'camera'     then 180
    when 'police'     then 60
    when 'accident'   then 90
    when 'repair'     then 480
    when 'danger'     then 45
    when 'speed_zone' then 1440
  end;

  insert into public.road_events (
    author_id, type, lat, lng, description,
    positive_votes, negative_votes, expires_at,
    heading, end_lat, end_lng, zone_limit_kmh
  ) values (
    auth.uid(), p_type, p_lat, p_lng, p_description,
    0, 0, now() + (v_ttl_mins || ' minutes')::interval,
    p_heading, p_end_lat, p_end_lng, p_zone_limit_kmh
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_road_event(
  text, double precision, double precision, text,
  double precision, double precision, double precision, double precision
) to authenticated;


-- ----------------------------------------------------------------------------
-- 5. RPC become_admin
-- Дополнение к Блоку 4 (по прямому указанию Alex): режим "админ" для
-- неограниченного голосования. Пароль сверяется ИСКЛЮЧИТЕЛЬНО здесь, внутри
-- SECURITY DEFINER функции — на фронтенде (в JS/бандле) пароль нигде не
-- хранится и не проверяется, только передаётся строкой в RPC-вызов.
--
-- ВНИМАНИЕ — заведомо слабый пароль '321' (3 цифры, перебирается мгновенно
-- brute-force'ом по RPC). Это осознанный выбор Alex для личного проекта
-- на раннем этапе (см. AGENT_LOG.md, Блок 4 — дополнение). Если проект
-- начнёт расти/выйдет за пределы личного использования — заменить на
-- длинную случайную строку и обязательно добавить rate-limit на вызовы
-- become_admin (сейчас его нет — ничего не мешает перебирать пароль
-- скриптом через анонимный ключ).
-- ----------------------------------------------------------------------------
create function public.become_admin(p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Пароль захардкожен только здесь, на сервере. Ошибка намеренно без деталей —
  -- не подтверждает и не опровергает, что именно было неверно.
  if p_password is distinct from '321' then
    raise exception 'Invalid request';
  end if;

  update public.profiles set is_admin = true where id = auth.uid();
end;
$$;

grant execute on function public.become_admin(text) to authenticated;


-- ----------------------------------------------------------------------------
-- 6. RPC vote_on_event
-- Вызывается из voteOnEvent() (supabase/events.ts): p_event_id/p_vote
-- (p_vote = true → positive, false → negative, см. events.ts:
-- vote === "yes" -> p_vote: true).
--
-- Обычный пользователь: один auth.uid() — один голос за событие
-- (event_votes PK), повторный голос молча игнорируется (как в mock-адаптере).
--
-- Админ (profiles.is_admin = true, выставляется только через become_admin()):
-- уникальность голоса не проверяется — каждый вызов увеличивает счётчик,
-- даже если это тот же auth.uid() и то же событие (по прямому указанию Alex,
-- Блок 4 — дополнение). Строка в event_votes для админа при этом
-- перезаписывается (ON CONFLICT DO UPDATE) — таблица хранит последний голос
-- для справки, но НЕ отражает реальное количество голосов админа, т.к.
-- счётчик в road_events растёт при каждом вызове независимо от конфликта.
-- ----------------------------------------------------------------------------
create function public.vote_on_event(
  p_event_id uuid,
  p_vote     boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_admin boolean;
  v_pos integer;
  v_neg integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select coalesce(is_admin, false) into v_is_admin
  from public.profiles where id = auth.uid();

  if v_is_admin then
    -- Админ: неограниченное голосование, уникальность не проверяется.
    insert into public.event_votes (event_id, user_id, vote, created_at)
    values (p_event_id, auth.uid(), p_vote, now())
    on conflict (event_id, user_id) do update set vote = excluded.vote, created_at = now();

    if p_vote then
      update public.road_events set positive_votes = positive_votes + 1 where id = p_event_id;
    else
      update public.road_events set negative_votes = negative_votes + 1 where id = p_event_id
        returning positive_votes, negative_votes into v_pos, v_neg;
      -- Порог -3 — держать в синхроне с mock-адаптером (mock/events.ts:
      -- if (ev.positiveVotes - ev.negativeVotes <= -3) удаляет событие).
      if v_pos - v_neg <= -3 then
        delete from public.road_events where id = p_event_id;
      end if;
    end if;
    return;
  end if;

  -- Обычный пользователь: один голос на событие.
  insert into public.event_votes (event_id, user_id, vote)
  values (p_event_id, auth.uid(), p_vote)
  on conflict (event_id, user_id) do nothing;

  if not found then
    return; -- уже голосовал за это событие — без изменений
  end if;

  if p_vote then
    update public.road_events set positive_votes = positive_votes + 1 where id = p_event_id;
  else
    update public.road_events set negative_votes = negative_votes + 1 where id = p_event_id
      returning positive_votes, negative_votes into v_pos, v_neg;
    -- Порог -3 — держать в синхроне с mock-адаптером (см. комментарий выше).
    if v_pos - v_neg <= -3 then
      delete from public.road_events where id = p_event_id;
    end if;
  end if;
end;
$$;

grant execute on function public.vote_on_event(uuid, boolean) to authenticated;


-- ----------------------------------------------------------------------------
-- 7. Realtime: публикация таблицы road_events
-- Без этой команды postgres_changes-подписка в subscribeToEvents()
-- (src/lib/adapters/supabase/events.ts) НЕ получает события — ни insert
-- своего события, ни изменения от других пользователей (голоса, delete
-- при отрицательном score из п.6). Изначально причина, по которой события
-- не появлялись в реальном времени без ручной перезагрузки вкладки.
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table public.road_events;
