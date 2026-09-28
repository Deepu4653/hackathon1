-- ============================================================================
-- X-FARM AI · 0003 · marketplace (categories, listings, images, favourites,
--                                machinery)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- categories — marketplace taxonomy, translated for all three UI languages
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name_en    text not null,
  name_te    text,
  name_hi    text,
  kind       text not null check (kind in ('produce', 'input', 'machinery', 'service')),
  icon       text,
  sort_order integer not null default 100,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists categories_kind_idx on public.categories (kind, sort_order);

-- ---------------------------------------------------------------------------
-- listings — produce, farm inputs, machinery and services
-- ---------------------------------------------------------------------------
create table if not exists public.listings (
  id                 uuid primary key default gen_random_uuid(),
  seller_id          uuid not null references public.profiles (id) on delete cascade,
  kind               text not null check (kind in ('produce', 'input', 'machinery', 'service')),
  category_id        uuid references public.categories (id) on delete set null,
  title              text not null,
  description        text,
  crop_name          text,
  quantity           numeric(12, 2) check (quantity is null or quantity >= 0),
  unit               text,
  price_per_unit     numeric(12, 2) check (price_per_unit is null or price_per_unit >= 0),
  is_negotiable      boolean not null default true,
  min_order_quantity numeric(12, 2) check (min_order_quantity is null or min_order_quantity >= 0),
  village            text,
  district           text,
  state              text default 'Andhra Pradesh',
  pincode            text,
  latitude           double precision check (latitude is null or (latitude between -90 and 90)),
  longitude          double precision check (longitude is null or (longitude between -180 and 180)),
  harvest_date       date,
  available_from     date,
  available_until    date,
  status             text not null default 'active'
                     check (status in ('draft', 'active', 'sold', 'archived', 'removed')),
  is_featured        boolean not null default false,
  views_count        integer not null default 0 check (views_count >= 0),
  contact_phone      text,
  search_document    tsvector generated always as (
                       to_tsvector('simple',
                         coalesce(title, '') || ' ' || coalesce(description, '') || ' ' ||
                         coalesce(crop_name, '') || ' ' || coalesce(district, '') || ' ' ||
                         coalesce(village, ''))
                     ) stored,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint listings_title_length check (char_length(title) between 4 and 140),
  constraint listings_description_length check (description is null or char_length(description) <= 4000),
  constraint listings_availability_order
    check (available_from is null or available_until is null or available_until >= available_from)
);

create index if not exists listings_seller_idx on public.listings (seller_id, created_at desc);
create index if not exists listings_status_idx on public.listings (status, created_at desc);
create index if not exists listings_kind_idx on public.listings (kind, status);
create index if not exists listings_category_idx on public.listings (category_id);
create index if not exists listings_district_idx on public.listings (state, district);
create index if not exists listings_search_idx on public.listings using gin (search_document);
create index if not exists listings_price_idx on public.listings (price_per_unit);
create index if not exists listings_geo_idx on public.listings (latitude, longitude);

-- ---------------------------------------------------------------------------
-- listing_images — Supabase Storage metadata, ordered
-- ---------------------------------------------------------------------------
create table if not exists public.listing_images (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references public.listings (id) on delete cascade,
  url          text not null,
  storage_path text,
  alt          text,
  sort_order   integer not null default 0,
  file_size    integer,
  mime_type    text,
  created_at   timestamptz not null default now()
);

create index if not exists listing_images_listing_idx on public.listing_images (listing_id, sort_order);

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
create table if not exists public.favorites (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, listing_id)
);

create index if not exists favorites_user_idx on public.favorites (user_id, created_at desc);
create index if not exists favorites_listing_idx on public.favorites (listing_id);

-- ---------------------------------------------------------------------------
-- machinery — rental detail attached 1:1 to a machinery listing
-- ---------------------------------------------------------------------------
create table if not exists public.machinery (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references public.profiles (id) on delete cascade,
  listing_id            uuid not null unique references public.listings (id) on delete cascade,
  machine_type          text not null check (machine_type in
                          ('tractor', 'harvester', 'power_tiller', 'sprayer', 'seeder',
                           'thresher', 'rotavator', 'trailer', 'irrigation_pump', 'other')),
  brand                 text,
  model                 text,
  manufacture_year      integer check (manufacture_year is null or (manufacture_year between 1950 and 2100)),
  horsepower            numeric(6, 2) check (horsepower is null or horsepower > 0),
  rental_price_per_day  numeric(10, 2) check (rental_price_per_day is null or rental_price_per_day >= 0),
  rental_price_per_hour numeric(10, 2) check (rental_price_per_hour is null or rental_price_per_hour >= 0),
  rental_price_per_acre numeric(10, 2) check (rental_price_per_acre is null or rental_price_per_acre >= 0),
  with_operator         boolean not null default true,
  service_radius_km     numeric(6, 2) check (service_radius_km is null or service_radius_km >= 0),
  availability_start    date,
  availability_end      date,
  status                text not null default 'available'
                        check (status in ('available', 'booked', 'maintenance', 'inactive')),
  description           text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint machinery_has_a_price check (
    rental_price_per_day is not null or rental_price_per_hour is not null or rental_price_per_acre is not null
  ),
  constraint machinery_availability_order check (
    availability_start is null or availability_end is null or availability_end >= availability_start
  )
);

create index if not exists machinery_owner_idx on public.machinery (owner_id);
create index if not exists machinery_type_idx on public.machinery (machine_type, status);
