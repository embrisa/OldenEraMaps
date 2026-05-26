drop policy if exists "public can read map preview files" on storage.objects;
drop policy if exists "users can write previews under their own user folder" on storage.objects;
drop policy if exists "users can update previews under their own user folder" on storage.objects;
drop policy if exists "users can delete previews under their own user folder" on storage.objects;

alter table public.maps
  drop column if exists preview_image_path,
  drop column if exists preview_image_url,
  drop column if exists preview_thumbnail_path,
  drop column if exists preview_thumbnail_url,
  drop column if exists preview_image_width,
  drop column if exists preview_image_height,
  drop column if exists preview_thumbnail_height,
  drop column if exists preview_thumbnail_width;
