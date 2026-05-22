drop policy if exists "public can insert download events for published public maps" on public.downloads;
drop policy if exists "public can read published public maps" on public.maps;

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
    avatar_url = null;

  return new;
end;
$$;

update public.profiles
set avatar_url = null;

create or replace function public.public_browse_maps()
returns table (
  id uuid,
  owner_id uuid,
  slug text,
  title text,
  description text,
  visibility text,
  map_width integer,
  map_height integer,
  player_count integer,
  zone_count integer,
  connection_count integer,
  win_condition text,
  template_name text,
  preview_design_json jsonb,
  preview_renderer_version integer,
  download_count integer,
  rating_count integer,
  rating_average numeric,
  created_at timestamptz,
  updated_at timestamptz,
  author_name text,
  tags jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    maps.id,
    case when maps.owner_id = auth.uid() then maps.owner_id else null end as owner_id,
    maps.slug,
    maps.title,
    maps.description,
    maps.visibility,
    maps.map_width,
    maps.map_height,
    maps.player_count,
    maps.zone_count,
    maps.connection_count,
    maps.win_condition,
    maps.template_name,
    maps.preview_design_json,
    maps.preview_renderer_version,
    maps.download_count,
    maps.rating_count,
    maps.rating_average,
    maps.created_at,
    maps.updated_at,
    coalesce(nullif(btrim(profiles.display_name), ''), 'Anonymous Cartographer') as author_name,
    coalesce(tag_rows.tags, '[]'::jsonb) as tags
  from public.maps
  left join public.profiles on profiles.id = maps.owner_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'slug', tags.slug,
        'label', tags.label,
        'kind', tags.kind,
        'category', tags.category
      )
      order by tags.kind, tags.category, tags.label
    ) as tags
    from public.map_tags
    join public.tags on tags.id = map_tags.tag_id
    where map_tags.map_id = maps.id
  ) as tag_rows on true
  where maps.status = 'published'
    and maps.visibility = 'public';
$$;

create or replace function public.public_map_detail(p_map_id uuid)
returns table (
  id uuid,
  owner_id uuid,
  slug text,
  title text,
  description text,
  visibility text,
  map_width integer,
  map_height integer,
  player_count integer,
  zone_count integer,
  connection_count integer,
  win_condition text,
  template_name text,
  template_json jsonb,
  design_json jsonb,
  preview_design_json jsonb,
  preview_renderer_version integer,
  download_count integer,
  rating_count integer,
  rating_average numeric,
  created_at timestamptz,
  updated_at timestamptz,
  author_name text,
  tags jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    maps.id,
    case when maps.owner_id = auth.uid() then maps.owner_id else null end as owner_id,
    maps.slug,
    maps.title,
    maps.description,
    maps.visibility,
    maps.map_width,
    maps.map_height,
    maps.player_count,
    maps.zone_count,
    maps.connection_count,
    maps.win_condition,
    maps.template_name,
    maps.template_json,
    maps.design_json,
    maps.preview_design_json,
    maps.preview_renderer_version,
    maps.download_count,
    maps.rating_count,
    maps.rating_average,
    maps.created_at,
    maps.updated_at,
    coalesce(nullif(btrim(profiles.display_name), ''), 'Anonymous Cartographer') as author_name,
    coalesce(tag_rows.tags, '[]'::jsonb) as tags
  from public.maps
  left join public.profiles on profiles.id = maps.owner_id
  left join lateral (
    select jsonb_agg(
      jsonb_build_object(
        'slug', tags.slug,
        'label', tags.label,
        'kind', tags.kind,
        'category', tags.category
      )
      order by tags.kind, tags.category, tags.label
    ) as tags
    from public.map_tags
    join public.tags on tags.id = map_tags.tag_id
    where map_tags.map_id = maps.id
  ) as tag_rows on true
  where maps.id = p_map_id
    and maps.status = 'published'
    and maps.visibility = 'public';
$$;

grant execute on function public.public_browse_maps() to anon, authenticated;
grant execute on function public.public_map_detail(uuid) to anon, authenticated;
