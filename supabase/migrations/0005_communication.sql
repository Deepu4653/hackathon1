-- ============================================================================
-- X-FARM AI · 0005 · messaging, notifications, reports, audit log
-- ============================================================================

-- ---------------------------------------------------------------------------
-- conversations — one thread per (listing, buyer, seller)
-- ---------------------------------------------------------------------------
create table if not exists public.conversations (
  id              uuid primary key default gen_random_uuid(),
  listing_id      uuid references public.listings (id) on delete set null,
  buyer_id        uuid not null references public.profiles (id) on delete cascade,
  seller_id       uuid not null references public.profiles (id) on delete cascade,
  subject         text,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (listing_id, buyer_id, seller_id),
  constraint conversations_distinct_participants check (buyer_id <> seller_id)
);

create index if not exists conversations_buyer_idx on public.conversations (buyer_id, last_message_at desc);
create index if not exists conversations_seller_idx on public.conversations (seller_id, last_message_at desc);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null,
  attachment_url  text,
  read_at         timestamptz,
  created_at      timestamptz not null default now(),
  constraint messages_body_length check (char_length(body) between 1 and 4000)
);

create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at);
create index if not exists messages_unread_idx on public.messages (conversation_id) where read_at is null;

-- ---------------------------------------------------------------------------
-- notifications — dedupe_key keeps this useful instead of spammy
-- ---------------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null check (type in
               ('weather_alert', 'marketplace', 'message', 'listing', 'reminder', 'system', 'admin')),
  title      text not null,
  body       text,
  link       text,
  severity   text not null default 'info' check (severity in ('info', 'success', 'warning', 'critical')),
  is_read    boolean not null default false,
  dedupe_key text,
  created_at timestamptz not null default now(),
  read_at    timestamptz,
  unique (user_id, dedupe_key)
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where is_read = false;

-- ---------------------------------------------------------------------------
-- reports — marketplace moderation queue
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  listing_id       uuid references public.listings (id) on delete set null,
  reported_user_id uuid references public.profiles (id) on delete set null,
  reason           text not null check (reason in
                     ('spam', 'fake_listing', 'wrong_price', 'abusive', 'prohibited_item', 'other')),
  details          text,
  status           text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  resolved_by      uuid references public.profiles (id) on delete set null,
  resolution_note  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint reports_details_length check (details is null or char_length(details) <= 2000)
);

create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_listing_idx on public.reports (listing_id);

-- ---------------------------------------------------------------------------
-- audit_logs — privileged actions are recorded server-side
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  entity     text,
  entity_id  uuid,
  meta       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);
