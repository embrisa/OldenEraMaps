drop policy if exists "users can delete their own draft maps" on public.maps;

create policy "users can delete their own maps"
on public.maps
for delete
to authenticated
using (owner_id = auth.uid());