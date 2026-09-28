-- ============================================================================
-- X-FARM AI · LOCAL RUNTIME SHIM  (applied ONLY in local mode)
-- ----------------------------------------------------------------------------
-- The local reference database runs real PostgreSQL (PGlite) with the same
-- migrations as production. This file adds the small pieces that Supabase
-- normally owns: the `auth` schema (users + JWT claim helpers) and a `storage`
-- schema that mirrors storage.buckets / storage.objects so the storage
-- migration and app queries behave identically in both environments.
--
-- It is NOT part of `supabase/migrations` and is never applied to Supabase.
-- ============================================================================

create schema if not exists auth;
create schema if not exists storage;

-- ---------------------------------------------------------------------------
-- auth.users — Supabase-compatible core columns
-- ---------------------------------------------------------------------------
create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text not null,
  encrypted_password  text,
  raw_user_meta_data  jsonb not null default '{}'::jsonb,
  email_confirmed_at  timestamptz,
  confirmation_token  text,
  recovery_token      text,
  last_sign_in_at     timestamptz,
  banned_until        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists auth_users_email_key on auth.users (lower(email));

-- Sessions (access + refresh tokens) — local equivalent of Supabase's
-- auth.sessions / auth.refresh_tokens pair.
create table if not exists auth.sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  refresh_token text not null unique,
  user_agent    text,
  ip            text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  revoked_at    timestamptz
);

create index if not exists auth_sessions_user_idx on auth.sessions (user_id);

-- Single-use password reset tokens (hashed at rest).
create table if not exists auth.password_reset_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_reset_user_idx on auth.password_reset_tokens (user_id);

-- ---------------------------------------------------------------------------
-- JWT claim helpers — byte-for-byte the same contract the app uses on Supabase
-- ---------------------------------------------------------------------------
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ),
    ''
  )::uuid;
$$;

create or replace function auth.role()
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

create or replace function auth.email()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email'
  );
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.role(), auth.email() to anon, authenticated, service_role;
grant select, insert, update, delete on all tables in schema auth to service_role;

-- ---------------------------------------------------------------------------
-- storage shim — same shape as Supabase Storage for the columns we touch
-- ---------------------------------------------------------------------------
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id         uuid primary key default gen_random_uuid(),
  bucket_id  text not null references storage.buckets (id) on delete cascade,
  name       text not null,
  owner      uuid,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, name)
);

create index if not exists storage_objects_bucket_idx on storage.objects (bucket_id, name);

-- storage.foldername(): first path segment, used by the shared RLS policies
create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/');
$$;

-- The local runtime connects as `postgres` and switches into these roles, so
-- they must exist with the same names Supabase uses.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema storage to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated;
grant select, insert, update, delete on storage.objects to authenticated, service_role;
