-- ============================================================================
-- Блок 6: TTL событий + updated_at + антифрод на голосованиях
-- (замена admin-пароля НЕ входит — по прямому указанию Alex оставлено как
-- есть, см. AGENT_LOG.md заход 16).
--
-- ПРИМЕНЯТЬ ВРУЧНУЮ в Supabase SQL Editor на живой БД (как и предыдущие
-- блоки — см. историю в AGENT_LOG.md). Рассчитана на однократное
-- применение ПОВЕРХ текущей боевой схемы (после Блока 4 + правок из
-- заходов 10-13). Итоговое состояние синхронизировано с
-- supabase/schema.sql — если разворачиваете проект с нуля, используйте
-- schema.sql целиком, эта миграция не нужна.
-- ============================================================================

-- 1. road_events: expires_at → nullable, + updated_at, + negative_streak
alter table public.road_events
  alter column expires_at drop not null;

alter table public.road_events
  add column if not exists updated_at timestamptz not null default now();

alter table public.road_events
  add column if not exists negative_streak integer not null default 0;


-- 2. create_road_event: новые TTL из ТЗ Блока 6 (заменяют старые значения
--    EVENT_TYPE_CONFIG) + запись updated_at при создании.
--    accident 180 / repair 1440 / police 120 / camera NULL (не истекает,
--    переиспользован как camera_stationary) / danger,speed_zone 360
--    ("остальные типы", 6 часов по умолчанию).
create or replace function public.create_road_event(
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

  v_ttl_mins := case p_type
    when 'camera'     then null
    when 'police'     then 120
    when 'accident'   then 180
    when 'repair'     then 1440
    when 'danger'     then 360
    when 'speed_zone' then 360
  end;

  insert into public.road_events (
    author_id, type, lat, lng, description,
    positive_votes, negative_votes, expires_at, updated_at,
    heading, end_lat, end_lng, zone_limit_kmh
  ) values (
    auth.uid(), p_type, p_lat, p_lng, p_description,
    0, 0,
    case when v_ttl_mins is null then null else now() + (v_ttl_mins || ' minutes')::interval end,
    now(),
    p_heading, p_end_lat, p_end_lng, p_zone_limit_kmh
  )
  returning * into v_row;

  return v_row;
end;
$$;


-- 3. Новый RPC: «Подтвердить, что событие всё ещё актуально».
--    Продлевает expires_at на тот же TTL заново, обновляет updated_at,
--    сбрасывает negative_streak.
create or replace function public.confirm_event_relevant(p_event_id uuid)
returns public.road_events
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
  v_ttl_mins integer;
  v_row public.road_events;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select type into v_type from public.road_events where id = p_event_id;
  if v_type is null then
    raise exception 'Event not found';
  end if;

  v_ttl_mins := case v_type
    when 'camera'     then null
    when 'police'     then 120
    when 'accident'   then 180
    when 'repair'     then 1440
    when 'danger'     then 360
    when 'speed_zone' then 360
  end;

  update public.road_events
  set
    expires_at = case when v_ttl_mins is null then null else now() + (v_ttl_mins || ' minutes')::interval end,
    updated_at = now(),
    negative_streak = 0
  where id = p_event_id
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.confirm_event_relevant(uuid) to authenticated;


-- 4. Антифрод: rate-limit журнал (append-only, каждая попытка голоса).
create table if not exists public.vote_rate_log (
  id         bigserial primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists vote_rate_log_user_time_idx on public.vote_rate_log (user_id, created_at);

alter table public.vote_rate_log enable row level security;
-- Политик нет намеренно — таблица закрыта для прямого доступа.

-- UNIQUE на голоса уже обеспечена PRIMARY KEY (event_id, user_id) в
-- event_votes с Блока 4 — доп. constraint не требуется.


-- 5. vote_on_event: rate-limit (20 голосов / 10 минут на user_id) +
--    замена старого score-based DELETE на streak-based hide (порог 1
--    подряд идущий голос "нет", по прямому указанию Alex).
create or replace function public.vote_on_event(
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
  v_recent_votes integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select count(*) into v_recent_votes
  from public.vote_rate_log
  where user_id = auth.uid() and created_at > now() - interval '10 minutes';

  if v_recent_votes >= 20 then
    raise exception 'Too many votes, try again later';
  end if;

  insert into public.vote_rate_log (user_id) values (auth.uid());

  select coalesce(is_admin, false) into v_is_admin
  from public.profiles where id = auth.uid();

  if v_is_admin then
    insert into public.event_votes (event_id, user_id, vote, created_at)
    values (p_event_id, auth.uid(), p_vote, now())
    on conflict (event_id, user_id) do update set vote = excluded.vote, created_at = now();

    if p_vote then
      update public.road_events set positive_votes = positive_votes + 1, negative_streak = 0
        where id = p_event_id;
    else
      update public.road_events
        set negative_votes = negative_votes + 1, negative_streak = negative_streak + 1
        where id = p_event_id;
      update public.road_events set expires_at = now() - interval '1 minute'
        where id = p_event_id and negative_streak >= 1;
    end if;
    return;
  end if;

  insert into public.event_votes (event_id, user_id, vote)
  values (p_event_id, auth.uid(), p_vote)
  on conflict (event_id, user_id) do nothing;

  if not found then
    return;
  end if;

  if p_vote then
    update public.road_events set positive_votes = positive_votes + 1, negative_streak = 0
      where id = p_event_id;
  else
    update public.road_events
      set negative_votes = negative_votes + 1, negative_streak = negative_streak + 1
      where id = p_event_id;
    update public.road_events set expires_at = now() - interval '1 minute'
      where id = p_event_id and negative_streak >= 1;
  end if;
end;
$$;

grant execute on function public.vote_on_event(uuid, boolean) to authenticated;

-- Готово. become_admin() не менялся — пароль остаётся захардкоженным
-- (по прямому указанию Alex, см. AGENT_LOG.md заход 16).
