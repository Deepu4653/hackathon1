-- ============================================================================
-- X-FARM AI · 0004 · market prices, AI conversations, crop analysis, usage
-- ============================================================================

-- ---------------------------------------------------------------------------
-- market_prices — only ever populated from a real, named source.
-- `source` is NOT NULL on purpose: X-FARM AI never fabricates a mandi price.
-- ---------------------------------------------------------------------------
create table if not exists public.market_prices (
  id                  uuid primary key default gen_random_uuid(),
  crop_name           text not null,
  variety             text,
  market_name         text not null,
  district            text,
  state               text,
  price_per_quintal   numeric(12, 2) not null check (price_per_quintal >= 0),
  min_price           numeric(12, 2) check (min_price is null or min_price >= 0),
  max_price           numeric(12, 2) check (max_price is null or max_price >= 0),
  unit                text not null default 'INR/quintal',
  price_date          date not null,
  source              text not null,
  source_url          text,
  is_verified         boolean not null default false,
  imported_by         uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (crop_name, market_name, price_date, source),
  constraint market_prices_bounds check (
    min_price is null or max_price is null or min_price <= max_price
  ),
  -- A price row is worthless without an attributable origin, so blank names or
  -- a blank "source" are rejected outright rather than stored as unknowns.
  constraint market_prices_source_present check (length(btrim(source)) > 0),
  constraint market_prices_crop_present check (length(btrim(crop_name)) > 0),
  constraint market_prices_market_present check (length(btrim(market_name)) > 0)
);

create index if not exists market_prices_crop_date_idx on public.market_prices (crop_name, price_date desc);
create index if not exists market_prices_market_idx on public.market_prices (state, district, market_name);
create index if not exists market_prices_date_idx on public.market_prices (price_date desc);

-- ---------------------------------------------------------------------------
-- market_price_imports — audit trail for every official price import
-- ---------------------------------------------------------------------------
create table if not exists public.market_price_imports (
  id          uuid primary key default gen_random_uuid(),
  imported_by uuid references public.profiles (id) on delete set null,
  source      text not null,
  source_url  text,
  price_date  date,
  row_count   integer not null default 0,
  status      text not null default 'success' check (status in ('success', 'partial', 'failed')),
  message     text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ai_conversations / ai_messages — persisted AI farming assistant history
-- ---------------------------------------------------------------------------
create table if not exists public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  farm_id    uuid references public.farms (id) on delete set null,
  title      text not null default 'New conversation',
  language   text not null default 'en' check (language in ('en', 'te', 'hi')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_conversations_user_idx on public.ai_conversations (user_id, updated_at desc);

create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  model           text,
  latency_ms      integer,
  created_at      timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx on public.ai_messages (conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- crop_analyses — Gemini vision results for an uploaded crop photo
-- ---------------------------------------------------------------------------
create table if not exists public.crop_analyses (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  farm_id          uuid references public.farms (id) on delete set null,
  crop_record_id   uuid references public.crop_records (id) on delete set null,
  crop_name        text,
  image_url        text,
  storage_path     text,
  status           text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  possible_problem text,
  severity         text check (severity is null or severity in ('low', 'moderate', 'high', 'unknown')),
  confidence       text check (confidence is null or confidence in ('low', 'medium', 'high')),
  visible_symptoms jsonb not null default '[]'::jsonb,
  next_steps       jsonb not null default '[]'::jsonb,
  prevention       jsonb not null default '[]'::jsonb,
  uncertainty_note text,
  model            text,
  raw              jsonb,
  error_message    text,
  created_at       timestamptz not null default now()
);

create index if not exists crop_analyses_user_idx on public.crop_analyses (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- usage_events — real per-user rate limiting + admin AI usage statistics
-- ---------------------------------------------------------------------------
create table if not exists public.usage_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('ai_chat', 'ai_vision', 'ai_recommendation', 'weather_fetch', 'soil_lookup')),
  created_at timestamptz not null default now()
);

create index if not exists usage_events_user_kind_idx on public.usage_events (user_id, kind, created_at desc);
