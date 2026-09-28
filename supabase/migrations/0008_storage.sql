-- ============================================================================
-- X-FARM AI · 0008 · Supabase Storage buckets + access policies
-- Guarded so the identical migration file can run on the local reference
-- database (which provisions a compatible `storage` schema shim).
-- ============================================================================

do $storage$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'storage' and table_name = 'buckets'
  ) then
    raise notice 'storage schema not present - skipping bucket provisioning';
    return;
  end if;

  -- -------------------------------------------------------------------------
  -- Buckets. Server-side limits are the last line of defence; the application
  -- validates type + size before every upload as well.
  -- -------------------------------------------------------------------------
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    ('avatars', 'avatars', true, 2097152,
      array['image/jpeg', 'image/png', 'image/webp']),
    ('listing-images', 'listing-images', true, 5242880,
      array['image/jpeg', 'image/png', 'image/webp']),
    ('crop-images', 'crop-images', false, 10485760,
      array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- -------------------------------------------------------------------------
  -- Public read for the two public buckets.
  -- -------------------------------------------------------------------------
  execute 'drop policy if exists "x_farm_public_read" on storage.objects';
  execute $p$
    create policy "x_farm_public_read" on storage.objects
      for select to anon, authenticated
      using (bucket_id in ('avatars', 'listing-images'))
  $p$;

  -- -------------------------------------------------------------------------
  -- Owners write only inside their own <bucket>/<user-id>/... folder.
  -- -------------------------------------------------------------------------
  execute 'drop policy if exists "x_farm_owner_insert" on storage.objects';
  execute $p$
    create policy "x_farm_owner_insert" on storage.objects
      for insert to authenticated
      with check (
        bucket_id in ('avatars', 'listing-images', 'crop-images')
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  $p$;

  execute 'drop policy if exists "x_farm_owner_update" on storage.objects';
  execute $p$
    create policy "x_farm_owner_update" on storage.objects
      for update to authenticated
      using (
        bucket_id in ('avatars', 'listing-images', 'crop-images')
        and (storage.foldername(name))[1] = auth.uid()::text
      )
      with check (
        bucket_id in ('avatars', 'listing-images', 'crop-images')
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  $p$;

  execute 'drop policy if exists "x_farm_owner_delete" on storage.objects';
  execute $p$
    create policy "x_farm_owner_delete" on storage.objects
      for delete to authenticated
      using (
        bucket_id in ('avatars', 'listing-images', 'crop-images')
        and (storage.foldername(name))[1] = auth.uid()::text
      )
  $p$;

  -- -------------------------------------------------------------------------
  -- Private crop photos: owners (and admins) may read their own objects.
  -- -------------------------------------------------------------------------
  execute 'drop policy if exists "x_farm_crop_owner_read" on storage.objects';
  execute $p$
    create policy "x_farm_crop_owner_read" on storage.objects
      for select to authenticated
      using (
        bucket_id = 'crop-images'
        and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
      )
  $p$;

  execute 'drop policy if exists "x_farm_storage_admin_all" on storage.objects';
  execute $p$
    create policy "x_farm_storage_admin_all" on storage.objects
      for all to authenticated
      using (public.is_admin())
      with check (public.is_admin())
  $p$;
end
$storage$;
