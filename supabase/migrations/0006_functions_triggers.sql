-- ============================================================================
-- X-FARM AI · 0006 · business functions & triggers
-- ============================================================================

-- ---------------------------------------------------------------------------
-- handle_new_user(): mirror every new auth user into public.profiles.
-- Role requested at signup is whitelisted — 'admin' can never be self-assigned.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  requested_role text;
  safe_role      text;
  meta           jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  requested_lang text;
  safe_lang      text;
begin
  requested_role := meta ->> 'role';
  safe_role := case
    when requested_role in ('farmer', 'seller', 'buyer', 'distributor', 'machine_owner')
      then requested_role
    else 'farmer'
  end;

  requested_lang := meta ->> 'preferred_language';
  safe_lang := case when requested_lang in ('en', 'te', 'hi') then requested_lang else 'en' end;

  insert into public.profiles (
    id, email, full_name, phone, village, district, state, preferred_language, role, simple_mode
  )
  values (
    new.id,
    new.email,
    coalesce(nullif(trim(meta ->> 'full_name'), ''), split_part(coalesce(new.email, ''), '@', 1)),
    nullif(trim(meta ->> 'phone'), ''),
    nullif(trim(meta ->> 'village'), ''),
    nullif(trim(meta ->> 'district'), ''),
    coalesce(nullif(trim(meta ->> 'state'), ''), 'Andhra Pradesh'),
    safe_lang,
    safe_role,
    coalesce((meta ->> 'simple_mode')::boolean, true)
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- prevent_role_escalation(): a user may edit their own profile, but only an
-- administrator (or a trusted server context) may change role / block status.
-- ---------------------------------------------------------------------------
create or replace function public.prevent_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  is_privileged boolean;
begin
  is_privileged := public.is_admin()
    or public.jwt_role() = 'service_role';

  if not is_privileged and (
       new.role is distinct from old.role
       or new.is_blocked is distinct from old.is_blocked
     ) then
    raise exception 'Only administrators can change role or blocked status';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_prevent_role_escalation on public.profiles;
create trigger profiles_prevent_role_escalation
  before update on public.profiles
  for each row execute function public.prevent_role_escalation();

-- ---------------------------------------------------------------------------
-- touch_listing_on_new_message(): keep conversation ordering honest
-- ---------------------------------------------------------------------------
create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.conversations
     set last_message_at = new.created_at
   where id = new.conversation_id;

  return new;
end;
$$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- ---------------------------------------------------------------------------
-- notify_on_message(): the other participant gets a notification (server-side,
-- so it cannot be forged by the client).
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  con      public.conversations;
  recipient uuid;
  sender_name text;
begin
  select * into con from public.conversations where id = new.conversation_id;
  if con.id is null then
    return new;
  end if;

  recipient := case when new.sender_id = con.buyer_id then con.seller_id else con.buyer_id end;

  select coalesce(nullif(full_name, ''), 'A user') into sender_name
    from public.profiles where id = new.sender_id;

  insert into public.notifications (user_id, type, title, body, link, severity, dedupe_key)
  values (
    recipient,
    'message',
    'New message from ' || sender_name,
    left(new.body, 140),
    '/messages/' || con.id::text,
    'info',
    null -- every message is a distinct, wanted notification
  );

  return new;
end;
$$;

drop trigger if exists messages_notify_recipient on public.messages;
create trigger messages_notify_recipient
  after insert on public.messages
  for each row execute function public.notify_on_message();

-- ---------------------------------------------------------------------------
-- bump_listing_views(): anon-safe view counter that touches exactly one row.
-- ---------------------------------------------------------------------------
create or replace function public.bump_listing_views(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.listings
     set views_count = views_count + 1
   where id = p_listing_id
     and status = 'active';
end;
$$;

grant execute on function public.bump_listing_views(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- notify_admins(): used by reports and moderation flows
-- ---------------------------------------------------------------------------
create or replace function public.notify_admins(
  p_title text,
  p_body  text,
  p_link  text,
  p_severity text default 'info',
  p_dedupe_prefix text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.notifications (user_id, type, title, body, link, severity, dedupe_key)
  select p.id,
         'admin',
         p_title,
         p_body,
         p_link,
         p_severity,
         case when p_dedupe_prefix is null then null else p_dedupe_prefix || ':' || p.id::text end
  from public.profiles p
  where p.role = 'admin' and p.is_blocked = false
  on conflict (user_id, dedupe_key) do nothing;
end;
$$;

-- ---------------------------------------------------------------------------
-- notify_on_report(): moderation queue alert for admins
-- ---------------------------------------------------------------------------
create or replace function public.notify_on_report()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform public.notify_admins(
    'New marketplace report',
    'A ' || new.reason || ' report was submitted and needs review.',
    '/admin/reports',
    'warning',
    'report:' || new.id::text
  );
  return new;
end;
$$;

drop trigger if exists reports_notify_admins on public.reports;
create trigger reports_notify_admins
  after insert on public.reports
  for each row execute function public.notify_on_report();

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  tables text[] := array[
    'profiles', 'farms', 'crop_records', 'soil_records', 'listings', 'machinery',
    'market_prices', 'ai_conversations', 'reports'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists %I on public.%I', t || '_touch_updated_at', t);
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      t || '_touch_updated_at', t
    );
  end loop;
end $$;
