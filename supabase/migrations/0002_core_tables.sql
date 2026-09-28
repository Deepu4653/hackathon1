-- ============================================================================
-- X-FARM AI · 0002 · identity, farms, crops, soil, weather
-- ============================================================================

-- ---------------------------------------------------------------------------
-- profiles — one row per authenticated user (mirrors auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  email              text,
  full_name          text not null default '',
  phone              text,
  village            text,
  district           text,
  state              text default 'Andhra Pradesh',
  preferred_language text not null default 'en'
                     check (preferred_language in ('en', 'te', 'hi')),
  role               text not null default 'farmer'
                     check (role in ('farmer', 'seller', 'buyer', 'distributor', 'machine_owner', 'admin')),
  avatar_url         text,
  bio                text,
  simple_mode        boolean not null default true,
  is_blocked         boolean not null default false,
  last_seen_at       timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint profiles_phone_format
    check (phone is null or phone ~ '^[0-9+()\- ]{6,20}$'),
  constraint profiles_full_name_length
    check (char_length(full_name) <= 120)
);

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_district_idx on public.profiles (district);

-- ---------------------------------------------------------------------------
-- public_profiles — the ONLY profile surface exposed to other users.
-- Column projection keeps email / phone private while still powering seller
-- profiles inside the marketplace. Runs with owner rights (not security_invoker)
-- so it can read rows that plain RLS would hide.
-- ---------------------------------------------------------------------------
create or replace view public.public_profiles as
  select
    p.id,
    p.full_name,
    p.avatar_url,
    p.village,
    p.district,
    p.state,
    p.role,
    p.bio,
    p.created_at
  from public.profiles p
  where p.is_blocked = false;

-- ---------------------------------------------------------------------------
-- farms
-- ---------------------------------------------------------------------------
create table if not exists public.farms (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  name              text not null,
  size_acres        numeric(10, 2) check (size_acres is null or (size_acres >= 0 and size_acres <= 100000)),
  soil_type         text,
  irrigation_source text,
  village           text,
  district          text,
  state             text default 'Andhra Pradesh',
  pincode           text,
  latitude          double precision check (latitude is null or (latitude between -90 and 90)),
  longitude         double precision check (longitude is null or (longitude between -180 and 180)),
  is_primary        boolean not null default false,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint farms_name_length check (char_length(name) between 1 and 120)
);

create index if not exists farms_user_id_idx on public.farms (user_id, created_at desc);
create index if not exists farms_location_idx on public.farms (district, state);
create unique index if not exists farms_one_primary_per_user
  on public.farms (user_id) where is_primary;

-- ---------------------------------------------------------------------------
-- crops — reference catalogue (not user data)
-- ---------------------------------------------------------------------------
create table if not exists public.crops (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  name_en        text not null,
  name_te        text,
  name_hi        text,
  category       text,
  seasons        text[] not null default '{}',
  duration_days  integer check (duration_days is null or duration_days between 1 and 3650),
  water_need     text,
  soil_types     text[] not null default '{}',
  sowing_months  integer[] not null default '{}',
  notes          text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists crops_category_idx on public.crops (category);

-- ---------------------------------------------------------------------------
-- crop_records — what a farmer is actually growing
-- ---------------------------------------------------------------------------
create table if not exists public.crop_records (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles (id) on delete cascade,
  farm_id               uuid references public.farms (id) on delete cascade,
  crop_id               uuid references public.crops (id) on delete set null,
  crop_name             text not null,
  season                text not null default 'kharif'
                        check (season in ('kharif', 'rabi', 'zaid', 'perennial', 'other')),
  variety               text,
  area_acres            numeric(10, 2) check (area_acres is null or area_acres >= 0),
  sowing_date           date,
  expected_harvest_date date,
  actual_harvest_date   date,
  status                text not null default 'planned'
                        check (status in ('planned', 'sown', 'growing', 'harvested', 'failed')),
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint crop_records_harvest_after_sowing
    check (sowing_date is null or expected_harvest_date is null or expected_harvest_date >= sowing_date)
);

create index if not exists crop_records_user_idx on public.crop_records (user_id, created_at desc);
create index if not exists crop_records_farm_idx on public.crop_records (farm_id);
create index if not exists crop_records_status_idx on public.crop_records (status);

-- ---------------------------------------------------------------------------
-- soil_records — manual entries, lab reports, or clearly labelled dataset rows
-- ---------------------------------------------------------------------------
create table if not exists public.soil_records (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  farm_id            uuid references public.farms (id) on delete cascade,
  soil_type          text,
  ph                 numeric(4, 2) check (ph is null or (ph >= 0 and ph <= 14)),
  nitrogen           numeric(10, 2) check (nitrogen is null or nitrogen >= 0),
  phosphorus         numeric(10, 2) check (phosphorus is null or phosphorus >= 0),
  potassium          numeric(10, 2) check (potassium is null or potassium >= 0),
  moisture_pct       numeric(5, 2) check (moisture_pct is null or (moisture_pct >= 0 and moisture_pct <= 100)),
  organic_matter_pct numeric(5, 2) check (organic_matter_pct is null or (organic_matter_pct >= 0 and organic_matter_pct <= 100)),
  electrical_conductivity numeric(8, 3),
  source             text not null default 'manual'
                     check (source in ('manual', 'lab_report', 'dataset', 'estimate')),
  dataset_name       text,
  dataset_reference  text,
  measured_at        date,
  village            text,
  district           text,
  state              text,
  latitude           double precision check (latitude is null or (latitude between -90 and 90)),
  longitude          double precision check (longitude is null or (longitude between -180 and 180)),
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- dataset-derived rows must always carry their provenance
  constraint soil_records_dataset_provenance
    check (source <> 'dataset' or dataset_name is not null)
);

create index if not exists soil_records_user_idx on public.soil_records (user_id, created_at desc);
create index if not exists soil_records_farm_idx on public.soil_records (farm_id);

-- ---------------------------------------------------------------------------
-- weather_records — snapshots fetched from Open-Meteo (never invented)
-- ---------------------------------------------------------------------------
create table if not exists public.weather_records (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid references public.profiles (id) on delete set null,
  farm_id              uuid references public.farms (id) on delete cascade,
  latitude             double precision not null,
  longitude            double precision not null,
  observed_at          timestamptz not null,
  temperature_c        numeric(5, 2),
  humidity_pct         numeric(5, 2),
  wind_kph             numeric(6, 2),
  wind_direction_deg   integer check (wind_direction_deg is null or (wind_direction_deg between 0 and 360)),
  rain_probability_pct numeric(5, 2) check (rain_probability_pct is null or (rain_probability_pct between 0 and 100)),
  precipitation_mm     numeric(7, 2),
  condition_code       text,
  condition_text       text,
  source               text not null default 'open-meteo',
  alerts               jsonb not null default '[]'::jsonb,
  raw                  jsonb,
  created_at           timestamptz not null default now(),
  unique (farm_id, observed_at, source)
);

create index if not exists weather_records_farm_idx on public.weather_records (farm_id, observed_at desc);
create index if not exists weather_records_user_idx on public.weather_records (user_id, observed_at desc);
