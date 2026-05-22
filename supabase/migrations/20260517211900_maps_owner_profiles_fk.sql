-- Add a direct FK from maps.owner_id to profiles.id so PostgREST can resolve
-- the `profiles(display_name)` embedded select in browse queries.
-- profiles.id already mirrors auth.users(id) via the trigger, so this is safe.
alter table public.maps
  add constraint maps_owner_id_profiles_fkey
  foreign key (owner_id) references public.profiles(id) on delete cascade;
