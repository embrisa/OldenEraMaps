create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    'Anonymous Cartographer',
    null
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

update public.profiles
set avatar_url = null;

update public.profiles as profiles
set display_name = 'Anonymous Cartographer'
from auth.users as users
where profiles.id = users.id
  and profiles.display_name in (
    nullif(users.raw_user_meta_data ->> 'full_name', ''),
    nullif(users.raw_user_meta_data ->> 'name', ''),
    nullif(users.raw_user_meta_data ->> 'user_name', '')
  );
