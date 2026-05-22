create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider_name text;
begin
  provider_name = coalesce(new.raw_app_meta_data ->> 'provider', 'oauth');

  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'user_name', ''),
      'Cartographer'
    ),
    null
  )
  on conflict (id) do update
  set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url;

  return new;
end;
$$;

create trigger auth_users_create_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create table public.maps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text not null,
  visibility text not null check (visibility in ('public', 'unlisted', 'private')),
  status text not null check (status in ('draft', 'published', 'hidden', 'rejected')),
  map_width integer not null,
  map_height integer not null,
  player_count integer not null,
  zone_count integer not null,
  connection_count integer not null,
  win_condition text not null,
  terrain_theme text,
  template_name text not null,
  template_json jsonb not null,
  design_json jsonb,
  template_sha256 text not null,
  preview_image_path text,
  preview_image_url text,
  preview_thumbnail_path text,
  preview_thumbnail_url text,
  preview_image_width integer,
  preview_image_height integer,
  preview_thumbnail_width integer,
  preview_thumbnail_height integer,
  download_count integer not null default 0,
  rating_count integer not null default 0,
  rating_average numeric(3,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  kind text not null check (kind in ('factual', 'descriptive')),
  category text not null,
  constraints jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.map_tags (
  map_id uuid not null references public.maps(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  source text not null check (source in ('factual', 'descriptive')),
  primary key (map_id, tag_id)
);

create table public.ratings (
  map_id uuid not null references public.maps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value integer not null check (value between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (map_id, user_id)
);

create table public.downloads (
  id uuid primary key default gen_random_uuid(),
  map_id uuid not null references public.maps(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id text,
  created_at timestamptz not null default now()
);

create index maps_status_visibility_created_at_idx on public.maps (status, visibility, created_at desc);
create index maps_owner_created_at_idx on public.maps (owner_id, created_at desc);
create index maps_template_sha256_idx on public.maps (template_sha256);
create index maps_search_idx on public.maps using gin (to_tsvector('simple', title || ' ' || description || ' ' || template_name));
create index map_tags_tag_id_map_id_idx on public.map_tags (tag_id, map_id);
create index ratings_map_id_idx on public.ratings (map_id);
create index downloads_map_id_created_at_idx on public.downloads (map_id, created_at desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger maps_set_updated_at
before update on public.maps
for each row execute function public.set_updated_at();

create or replace function public.prevent_direct_map_metadata_update()
returns trigger
language plpgsql
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' or pg_trigger_depth() > 1 then
    return new;
  end if;

  if new.map_width is distinct from old.map_width
    or new.map_height is distinct from old.map_height
    or new.player_count is distinct from old.player_count
    or new.zone_count is distinct from old.zone_count
    or new.connection_count is distinct from old.connection_count
    or new.win_condition is distinct from old.win_condition
    or new.terrain_theme is distinct from old.terrain_theme
    or new.template_name is distinct from old.template_name
    or new.template_json is distinct from old.template_json
    or new.template_sha256 is distinct from old.template_sha256
    or new.download_count is distinct from old.download_count
    or new.rating_count is distinct from old.rating_count
    or new.rating_average is distinct from old.rating_average then
    raise exception 'Derived map metadata can only be updated through validated server-side operations.';
  end if;

  return new;
end;
$$;

create trigger maps_prevent_direct_metadata_update
before update on public.maps
for each row execute function public.prevent_direct_map_metadata_update();

create trigger ratings_set_updated_at
before update on public.ratings
for each row execute function public.set_updated_at();

create or replace function public.refresh_map_rating_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_map_id uuid;
begin
  affected_map_id = coalesce(new.map_id, old.map_id);

  update public.maps
  set
    rating_count = stats.rating_count,
    rating_average = stats.rating_average
  from (
    select
      affected_map_id as map_id,
      count(*)::integer as rating_count,
      coalesce(round(avg(value)::numeric, 2), 0)::numeric(3,2) as rating_average
    from public.ratings
    where map_id = affected_map_id
  ) as stats
  where maps.id = stats.map_id;

  return coalesce(new, old);
end;
$$;

create trigger ratings_refresh_map_stats
after insert or update or delete on public.ratings
for each row execute function public.refresh_map_rating_stats();

create or replace function public.refresh_map_download_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_map_id uuid;
begin
  affected_map_id = coalesce(new.map_id, old.map_id);

  update public.maps
  set download_count = (
    select count(*)::integer
    from public.downloads
    where downloads.map_id = affected_map_id
  )
  where maps.id = affected_map_id;

  return coalesce(new, old);
end;
$$;

create trigger downloads_refresh_map_stats
after insert or delete on public.downloads
for each row execute function public.refresh_map_download_stats();

alter table public.profiles enable row level security;
alter table public.maps enable row level security;
alter table public.tags enable row level security;
alter table public.map_tags enable row level security;
alter table public.ratings enable row level security;
alter table public.downloads enable row level security;

create policy "public can read profiles for published public maps"
on public.profiles
for select
using (
  exists (
    select 1 from public.maps
    where maps.owner_id = profiles.id
      and maps.status = 'published'
      and maps.visibility = 'public'
  )
  or id = auth.uid()
);

create policy "users can insert their own profile"
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy "users can update their own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "public can read published public maps"
on public.maps
for select
using (status = 'published' and visibility = 'public');

create policy "users can read their own maps"
on public.maps
for select
to authenticated
using (owner_id = auth.uid());

create policy "users can insert their own maps"
on public.maps
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "users can update their own maps"
on public.maps
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "users can delete their own draft maps"
on public.maps
for delete
to authenticated
using (owner_id = auth.uid() and status = 'draft');

create policy "public can read tags"
on public.tags
for select
using (true);

create policy "public can read tags on published public maps"
on public.map_tags
for select
using (
  exists (
    select 1 from public.maps
    where maps.id = map_tags.map_id
      and maps.status = 'published'
      and maps.visibility = 'public'
  )
);

create policy "users can read tags on their own maps"
on public.map_tags
for select
to authenticated
using (
  exists (
    select 1 from public.maps
    where maps.id = map_tags.map_id
      and maps.owner_id = auth.uid()
  )
);

create policy "users can add tags to their own maps"
on public.map_tags
for insert
to authenticated
with check (
  source = 'descriptive'
  and exists (
    select 1 from public.maps
    where maps.id = map_tags.map_id
      and maps.owner_id = auth.uid()
  )
  and exists (
    select 1 from public.tags
    where tags.id = map_tags.tag_id
      and tags.kind = 'descriptive'
  )
);

create policy "users can remove tags from their own maps"
on public.map_tags
for delete
to authenticated
using (
  exists (
    select 1 from public.maps
    where maps.id = map_tags.map_id
      and maps.owner_id = auth.uid()
  )
);

create policy "users can read their own ratings"
on public.ratings
for select
to authenticated
using (user_id = auth.uid());

create policy "users can rate published visible maps"
on public.ratings
for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.maps
    where maps.id = ratings.map_id
      and maps.status = 'published'
      and maps.visibility in ('public', 'unlisted')
  )
);

create policy "users can update their own ratings"
on public.ratings
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "users can delete their own ratings"
on public.ratings
for delete
to authenticated
using (user_id = auth.uid());

create policy "users can read download events for their own maps"
on public.downloads
for select
to authenticated
using (
  exists (
    select 1 from public.maps
    where maps.id = downloads.map_id
      and maps.owner_id = auth.uid()
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'map-previews',
  'map-previews',
  true,
  1048576,
  array['image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "public can read map preview files"
on storage.objects
for select
using (
  bucket_id = 'map-previews'
  and exists (
    select 1 from public.maps
    where maps.status = 'published'
      and maps.visibility = 'public'
      and (
        maps.preview_image_path = storage.objects.name
        or maps.preview_thumbnail_path = storage.objects.name
      )
  )
);

create policy "users can write previews under their own user folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'map-previews'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "users can update previews under their own user folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'map-previews'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'map-previews'
  and split_part(name, '/', 1) = auth.uid()::text
);

create policy "users can delete previews under their own user folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'map-previews'
  and split_part(name, '/', 1) = auth.uid()::text
);
