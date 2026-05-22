-- ---------------------------------------------------------------------------
-- RPC: rate_map
-- Validates auth, rejects owner self-rating, upserts rating.
-- Aggregate refresh is handled by the existing ratings_refresh_map_stats trigger.
-- ---------------------------------------------------------------------------

create or replace function public.rate_map(p_map_id uuid, p_value int)
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

-- ---------------------------------------------------------------------------
-- RPC: record_download
-- Validates map is published and public, inserts download event.
-- Aggregate refresh is handled by the existing downloads_refresh_map_stats trigger.
-- Basic rate-limiting: max 10 downloads per anonymous_id or user per map per day.
-- ---------------------------------------------------------------------------

create or replace function public.record_download(p_map_id uuid, p_anonymous_id text default null)
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

  -- Basic rate limit: max 10 downloads per identity per map per day
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

-- ---------------------------------------------------------------------------
-- RPC: get_viewer_rating
-- Returns the current user's rating for a map, or null if not rated.
-- ---------------------------------------------------------------------------

create or replace function public.get_viewer_rating(p_map_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select value
    from public.ratings
   where map_id = p_map_id
     and user_id = auth.uid();
$$;

-- Grant execute to authenticated and anon roles
grant execute on function public.rate_map(uuid, int) to authenticated;
grant execute on function public.record_download(uuid, text) to authenticated, anon;
grant execute on function public.get_viewer_rating(uuid) to authenticated;
