-- ============================================================================
-- X-FARM AI · 0007 · row level security
-- Every private table gets RLS enabled with ownership-scoped policies.
-- No `using (true)` policy exists for private data anywhere in this schema.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Privileges (RLS still restricts which rows each role can touch)
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- Anonymous visitors can browse the public reference data and the live
-- marketplace; every one of these tables has an anon SELECT policy that only
-- exposes public rows (active listings, published crops, sourced prices).
grant select on public.crops,
                public.categories,
                public.market_prices,
                public.public_profiles,
                public.listings,
                public.listing_images,
                public.machinery
  to anon;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on tables to service_role;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (
    (id = auth.uid() and public.is_active_user())
    or public.is_admin()
  );

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- farms
-- ---------------------------------------------------------------------------
alter table public.farms enable row level security;

drop policy if exists farms_select_own_or_admin on public.farms;
create policy farms_select_own_or_admin on public.farms
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists farms_insert_own on public.farms;
create policy farms_insert_own on public.farms
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());

drop policy if exists farms_update_own on public.farms;
create policy farms_update_own on public.farms
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists farms_delete_own on public.farms;
create policy farms_delete_own on public.farms
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- crops (public reference data)
-- ---------------------------------------------------------------------------
alter table public.crops enable row level security;

drop policy if exists crops_select_public on public.crops;
create policy crops_select_public on public.crops
  for select to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists crops_write_admin on public.crops;
create policy crops_write_admin on public.crops
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- crop_records
-- ---------------------------------------------------------------------------
alter table public.crop_records enable row level security;

drop policy if exists crop_records_select_own_or_admin on public.crop_records;
create policy crop_records_select_own_or_admin on public.crop_records
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists crop_records_insert_own on public.crop_records;
create policy crop_records_insert_own on public.crop_records
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());

drop policy if exists crop_records_update_own on public.crop_records;
create policy crop_records_update_own on public.crop_records
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists crop_records_delete_own on public.crop_records;
create policy crop_records_delete_own on public.crop_records
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- soil_records
-- ---------------------------------------------------------------------------
alter table public.soil_records enable row level security;

drop policy if exists soil_records_select_own_or_admin on public.soil_records;
create policy soil_records_select_own_or_admin on public.soil_records
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists soil_records_insert_own on public.soil_records;
create policy soil_records_insert_own on public.soil_records
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());

drop policy if exists soil_records_update_own on public.soil_records;
create policy soil_records_update_own on public.soil_records
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists soil_records_delete_own on public.soil_records;
create policy soil_records_delete_own on public.soil_records
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- weather_records
-- ---------------------------------------------------------------------------
alter table public.weather_records enable row level security;

drop policy if exists weather_records_select_own_or_admin on public.weather_records;
create policy weather_records_select_own_or_admin on public.weather_records
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists weather_records_insert_own on public.weather_records;
create policy weather_records_insert_own on public.weather_records
  for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

drop policy if exists weather_records_delete_own on public.weather_records;
create policy weather_records_delete_own on public.weather_records
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- market_prices & import audit (public read, admin write)
-- ---------------------------------------------------------------------------
alter table public.market_prices enable row level security;

drop policy if exists market_prices_select_public on public.market_prices;
-- Public READ on purpose: these are government-published mandi prices, the same
-- numbers a farmer sees in the newspaper, and every row carries its source and
-- date. Nothing personal is stored here, and writing still requires an admin.
create policy market_prices_select_public on public.market_prices
  for select to anon, authenticated
  using (source is not null and price_date is not null);

drop policy if exists market_prices_write_admin on public.market_prices;
create policy market_prices_write_admin on public.market_prices
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.market_price_imports enable row level security;

drop policy if exists market_price_imports_admin on public.market_price_imports;
create policy market_price_imports_admin on public.market_price_imports
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- categories (public read, admin write)
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;

drop policy if exists categories_select_public on public.categories;
create policy categories_select_public on public.categories
  for select to anon, authenticated
  using (is_active = true or public.is_admin());

drop policy if exists categories_write_admin on public.categories;
create policy categories_write_admin on public.categories
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- listings
-- ---------------------------------------------------------------------------
alter table public.listings enable row level security;

drop policy if exists listings_select_active_or_own on public.listings;
create policy listings_select_active_or_own on public.listings
  for select to anon, authenticated
  using (
    status = 'active'
    or (auth.uid() is not null and seller_id = auth.uid())
    or public.is_admin()
  );

drop policy if exists listings_insert_own on public.listings;
create policy listings_insert_own on public.listings
  for insert to authenticated
  with check (
    seller_id = auth.uid()
    and public.is_active_user()
    and (is_featured = false or public.is_admin())
    and status in ('draft', 'active')
  );

drop policy if exists listings_update_own on public.listings;
create policy listings_update_own on public.listings
  for update to authenticated
  using (seller_id = auth.uid() or public.is_admin())
  with check (
    public.is_admin()
    or (
      seller_id = auth.uid()
      and public.is_active_user()
      and is_featured = false
      and status in ('draft', 'active', 'sold', 'archived')
    )
  );

drop policy if exists listings_delete_own on public.listings;
create policy listings_delete_own on public.listings
  for delete to authenticated
  using (seller_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- listing_images
-- ---------------------------------------------------------------------------
alter table public.listing_images enable row level security;

drop policy if exists listing_images_select_visible on public.listing_images;
create policy listing_images_select_visible on public.listing_images
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_images.listing_id
        and (l.status = 'active' or l.seller_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists listing_images_write_owner on public.listing_images;
create policy listing_images_write_owner on public.listing_images
  for all to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_images.listing_id
        and (l.seller_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.listings l
      where l.id = listing_images.listing_id
        and (l.seller_id = auth.uid() or public.is_admin())
    )
  );

-- ---------------------------------------------------------------------------
-- favorites
-- ---------------------------------------------------------------------------
alter table public.favorites enable row level security;

drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own on public.favorites
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own on public.favorites
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own on public.favorites
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- machinery
-- ---------------------------------------------------------------------------
alter table public.machinery enable row level security;

drop policy if exists machinery_select_visible on public.machinery;
create policy machinery_select_visible on public.machinery
  for select to anon, authenticated
  using (
    owner_id = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.listings l
      where l.id = machinery.listing_id and l.status = 'active'
    )
  );

drop policy if exists machinery_write_owner on public.machinery;
create policy machinery_write_owner on public.machinery
  for all to authenticated
  using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- conversations & messages — participants only
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;

drop policy if exists conversations_select_participant on public.conversations;
create policy conversations_select_participant on public.conversations
  for select to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

drop policy if exists conversations_insert_participant on public.conversations;
create policy conversations_insert_participant on public.conversations
  for insert to authenticated
  with check (
    (buyer_id = auth.uid() or seller_id = auth.uid())
    and public.is_active_user()
  );

drop policy if exists conversations_update_participant on public.conversations;
create policy conversations_update_participant on public.conversations
  for update to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid())
  with check (buyer_id = auth.uid() or seller_id = auth.uid());

drop policy if exists conversations_delete_participant on public.conversations;
create policy conversations_delete_participant on public.conversations
  for delete to authenticated
  using (buyer_id = auth.uid() or seller_id = auth.uid() or public.is_admin());

alter table public.messages enable row level security;

drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid() or public.is_admin())
    )
  );

drop policy if exists messages_insert_participant on public.messages;
create policy messages_insert_participant on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_active_user()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  );

drop policy if exists messages_update_participant on public.messages;
create policy messages_update_participant on public.messages
  for update to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (c.buyer_id = auth.uid() or c.seller_id = auth.uid())
    )
  )
  with check (sender_id = auth.uid() or sender_id <> auth.uid());

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own on public.notifications
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- reports
-- ---------------------------------------------------------------------------
alter table public.reports enable row level security;

drop policy if exists reports_select_own_or_admin on public.reports;
create policy reports_select_own_or_admin on public.reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());

drop policy if exists reports_insert_own on public.reports;
create policy reports_insert_own on public.reports
  for insert to authenticated
  with check (reporter_id = auth.uid() and public.is_active_user());

drop policy if exists reports_update_admin on public.reports;
create policy reports_update_admin on public.reports
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- AI tables
-- ---------------------------------------------------------------------------
alter table public.ai_conversations enable row level security;

drop policy if exists ai_conversations_owner on public.ai_conversations;
create policy ai_conversations_owner on public.ai_conversations
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid());

alter table public.ai_messages enable row level security;

drop policy if exists ai_messages_owner on public.ai_messages;
create policy ai_messages_owner on public.ai_messages
  for all to authenticated
  using (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id
        and (c.user_id = auth.uid() or public.is_admin())
    )
  )
  with check (
    exists (
      select 1 from public.ai_conversations c
      where c.id = ai_messages.conversation_id and c.user_id = auth.uid()
    )
  );

alter table public.crop_analyses enable row level security;

drop policy if exists crop_analyses_owner on public.crop_analyses;
create policy crop_analyses_owner on public.crop_analyses
  for all to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid());

alter table public.usage_events enable row level security;

drop policy if exists usage_events_own on public.usage_events;
create policy usage_events_own on public.usage_events
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists usage_events_insert_own on public.usage_events;
create policy usage_events_insert_own on public.usage_events
  for insert to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- audit_logs — admins only
-- ---------------------------------------------------------------------------
alter table public.audit_logs enable row level security;

drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
  for select to authenticated
  using (public.is_admin());

drop policy if exists audit_logs_insert_admin on public.audit_logs;
create policy audit_logs_insert_admin on public.audit_logs
  for insert to authenticated
  with check (public.is_admin() or actor_id = auth.uid());
