-- Pin trigger helper search paths so they cannot resolve objects through a
-- caller-controlled search_path.
alter function public.set_updated_at()
set search_path = public;

alter function public.prevent_direct_map_metadata_update()
set search_path = public;

-- Trigger-only SECURITY DEFINER functions should not be callable through RPC
-- or by inherited PUBLIC execute privileges.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.refresh_map_rating_stats() from public, anon, authenticated;
revoke execute on function public.refresh_map_download_stats() from public, anon, authenticated;

-- Keep elevated implementations out of the exposed API schema. The public RPC
-- functions below are SECURITY INVOKER wrappers so PostgREST does not expose
-- SECURITY DEFINER functions directly.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

create or replace function private.public_browse_maps()
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
    coalesce(nullif(btrim(maps.author_name), ''), 'Anonymous Cartographer') as author_name,
    coalesce(tag_rows.tags, '[]'::jsonb) as tags
  from public.maps
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
security invoker
set search_path = public
as $$
  select * from private.public_browse_maps();
$$;

create or replace function private.public_map_detail(p_map_id uuid)
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
    coalesce(nullif(btrim(maps.author_name), ''), 'Anonymous Cartographer') as author_name,
    coalesce(tag_rows.tags, '[]'::jsonb) as tags
  from public.maps
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
security invoker
set search_path = public
as $$
  select * from private.public_map_detail(p_map_id);
$$;

create or replace function private.rate_map(p_map_id uuid, p_value int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_map_owner_id uuid;
  v_map_status text;
  v_map_visibility text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required to rate maps.'
      using errcode = 'PGRST';
  end if;

  if p_value < 1 or p_value > 5 then
    raise exception 'Rating value must be between 1 and 5.'
      using errcode = 'PGRST';
  end if;

  select owner_id, status, visibility
    into v_map_owner_id, v_map_status, v_map_visibility
    from public.maps
   where id = p_map_id;

  if not found then
    raise exception 'Map not found.'
      using errcode = 'PGRST';
  end if;

  if v_map_status <> 'published'
     or v_map_visibility not in ('public', 'unlisted') then
    raise exception 'Only published visible maps can be rated.'
      using errcode = 'PGRST';
  end if;

  if v_user_id = v_map_owner_id then
    raise exception 'You cannot rate your own map.'
      using errcode = 'PGRST';
  end if;

  insert into public.ratings (map_id, user_id, value)
  values (p_map_id, v_user_id, p_value)
  on conflict (map_id, user_id)
  do update set value = excluded.value, updated_at = now();
end;
$$;

create or replace function public.rate_map(p_map_id uuid, p_value int)
returns void
language sql
security invoker
set search_path = public
as $$
  select private.rate_map(p_map_id, p_value);
$$;

create or replace function public.get_viewer_rating(p_map_id uuid)
returns int
language sql
stable
security invoker
set search_path = public
as $$
  select value
    from public.ratings
   where map_id = p_map_id
     and user_id = auth.uid();
$$;

create or replace function private.record_download(p_map_id uuid, p_anonymous_id text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_map_status text;
  v_map_visibility text;
  v_recent_count int;
begin
  v_user_id := auth.uid();

  if v_user_id is null and (p_anonymous_id is null or p_anonymous_id = '') then
    raise exception 'Either sign in or provide an anonymous id to record a download.'
      using errcode = 'PGRST';
  end if;

  select status, visibility
    into v_map_status, v_map_visibility
    from public.maps
   where id = p_map_id;

  if not found then
    raise exception 'Map not found.'
      using errcode = 'PGRST';
  end if;

  if v_map_status <> 'published' or v_map_visibility <> 'public' then
    raise exception 'Only published public maps can be downloaded.'
      using errcode = 'PGRST';
  end if;

  if v_user_id is not null then
    select count(*) into v_recent_count
      from public.downloads
     where map_id = p_map_id
       and user_id = v_user_id
       and created_at > now() - interval '1 day';
  else
    select count(*) into v_recent_count
      from public.downloads
     where map_id = p_map_id
       and anonymous_id = p_anonymous_id
       and created_at > now() - interval '1 day';
  end if;

  if v_recent_count >= 10 then
    raise exception 'Download rate limit exceeded. Try again later.'
      using errcode = 'PGRST';
  end if;

  insert into public.downloads (map_id, user_id, anonymous_id)
  values (
    p_map_id,
    v_user_id,
    case when v_user_id is null then p_anonymous_id else null end
  );
end;
$$;

create or replace function public.record_download(p_map_id uuid, p_anonymous_id text default null)
returns void
language sql
security invoker
set search_path = public
as $$
  select private.record_download(p_map_id, p_anonymous_id);
$$;

revoke execute on function private.public_browse_maps() from public;
revoke execute on function private.public_map_detail(uuid) from public;
revoke execute on function private.rate_map(uuid, int) from public;
revoke execute on function private.record_download(uuid, text) from public;

revoke execute on function public.public_browse_maps() from public;
revoke execute on function public.public_map_detail(uuid) from public;
revoke execute on function public.rate_map(uuid, int) from public, anon;
revoke execute on function public.get_viewer_rating(uuid) from public, anon;
revoke execute on function public.record_download(uuid, text) from public;

grant execute on function private.public_browse_maps() to anon, authenticated;
grant execute on function private.public_map_detail(uuid) to anon, authenticated;
grant execute on function private.rate_map(uuid, int) to authenticated;
grant execute on function private.record_download(uuid, text) to anon, authenticated;

grant execute on function public.public_browse_maps() to anon, authenticated;
grant execute on function public.public_map_detail(uuid) to anon, authenticated;
grant execute on function public.rate_map(uuid, int) to authenticated;
grant execute on function public.get_viewer_rating(uuid) to authenticated;
grant execute on function public.record_download(uuid, text) to anon, authenticated;
