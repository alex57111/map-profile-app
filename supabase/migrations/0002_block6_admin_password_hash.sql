-- ============================================================================
-- Блок 6, п.4 (добивание): вынос admin-пароля из кода become_admin
--
-- ПРИМЕНЯТЬ ВРУЧНУЮ в Supabase SQL Editor на живой БД, ПОВЕРХ текущей
-- боевой схемы (после 0001_block6_ttl_antifraud.sql). Итоговое состояние
-- синхронизировано с supabase/schema.sql — если разворачиваете проект с
-- нуля, используйте schema.sql целиком, эта миграция не нужна.
--
-- Что делает:
--   1. Включает pgcrypto (нужен для crypt()/gen_salt() — сравнение по
--      bcrypt-хэшу, не в открытом виде).
--   2. Создаёт закрытую таблицу admin_config (без RLS-политик снаружи —
--      доступна только вручную через SQL Editor и SECURITY DEFINER
--      функции become_admin()).
--   3. Переопределяет become_admin(): вместо сравнения с захардкоженной
--      строкой '321' — сверяет crypt(введённый_пароль, хэш_из_admin_config).
--
-- Пароль '321' в открытом виде из кода/базы убирается полностью. Пока вы
-- не выполните ШАГ 2 ниже — become_admin() будет отклонять любой пароль
-- (admin_config пуста → v_hash IS NULL) — это безопасное поведение по
-- умолчанию, не баг.
-- ============================================================================

-- --- ШАГ 1: применить это целиком в SQL Editor -----------------------------

create extension if not exists pgcrypto;

create table if not exists public.admin_config (
  id            integer primary key default 1,
  password_hash text not null,
  updated_at    timestamptz not null default now(),
  constraint admin_config_singleton check (id = 1)
);

alter table public.admin_config enable row level security;
-- Политик нет намеренно.

create or replace function public.become_admin(p_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select password_hash into v_hash from public.admin_config where id = 1;

  if v_hash is null or p_password is null or crypt(p_password, v_hash) is distinct from v_hash then
    raise exception 'Invalid request';
  end if;

  update public.profiles set is_admin = true where id = auth.uid();
end;
$$;

grant execute on function public.become_admin(text) to authenticated;


-- --- ШАГ 2: задать свой пароль (выполнить ОТДЕЛЬНО, после ШАГА 1) ----------
--
-- Замените плейсхолдер ниже на свой реальный пароль прямо в SQL Editor —
-- хэш считает сам Postgres (gen_salt('bf') = bcrypt), пароль в открытом
-- виде никуда, кроме этого запроса, не попадает и нигде не сохраняется.
--
-- insert into public.admin_config (id, password_hash)
-- values (1, crypt('ВАШ_НОВЫЙ_ПАРОЛЬ_СЮДА', gen_salt('bf')))
-- on conflict (id) do update
--   set password_hash = excluded.password_hash, updated_at = now();
--
-- Чтобы сменить пароль позже — выполнить тот же INSERT ... ON CONFLICT
-- ещё раз с новым паролём в плейсхолдере.
