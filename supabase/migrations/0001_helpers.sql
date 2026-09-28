-- ============================================================================
-- X-FARM AI · 0001 · helpers
-- Shared by Supabase (production) and the local PGlite runtime (dev fallback).
-- No extensions are required: gen_random_uuid() is core since PostgreSQL 13,
-- and every helper below is plain SQL / PLpgSQL.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- is_admin(): true when the caller's profile has the admin role.
-- SECURITY DEFINER so it can look up profiles without tripping profile RLS
-- (avoids infinite recursion in policies on public.profiles).
-- ---------------------------------------------------------------------------
-- NOTE: PLpgSQL (not SQL) so the body is resolved on first call. The profiles
-- table is created by 0002, and migrations must apply in order on a database
-- that has never seen this schema.
create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.is_blocked = false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- is_blocked_user(): cheap guard used by write policies.
-- ---------------------------------------------------------------------------
create or replace function public.is_active_user()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  return exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_blocked = false
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- jwt_role(): the role carried by the current request's JWT.
-- Works on Supabase (PostgREST sets request.jwt.claims) and in the local
-- PGlite runtime (the data layer sets the same GUC before every statement).
-- ---------------------------------------------------------------------------
create or replace function public.jwt_role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    'anon'
  );
$$;

-- ---------------------------------------------------------------------------
-- touch_updated_at(): generic updated_at maintenance.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
