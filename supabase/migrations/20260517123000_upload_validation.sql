alter table public.maps
add column if not exists upload_warnings jsonb not null default '[]'::jsonb,
add column if not exists factual_metadata jsonb not null default '{}'::jsonb;

create unique index if not exists maps_owner_template_sha256_unique_idx
on public.maps (owner_id, template_sha256);

drop policy if exists "users can insert their own maps" on public.maps;

insert into public.tags (slug, label, kind, category)
values
  ('direct-roads-present', 'Direct roads present', 'factual', 'connectivity'),
  ('portal-connections-present', 'Portal connections present', 'factual', 'connectivity'),
  ('isolated-player-starts', 'Isolated player starts', 'factual', 'connectivity'),
  ('ring', 'Ring topology', 'factual', 'topology'),
  ('chain', 'Chain topology', 'factual', 'topology'),
  ('hub-spoke', 'Hub/spoke topology', 'factual', 'topology'),
  ('shared-web', 'Shared web topology', 'factual', 'topology'),
  ('random-scattered', 'Random/scattered topology', 'factual', 'topology'),
  ('balanced-concentric', 'Balanced/concentric topology', 'factual', 'topology'),
  ('low-neutral-zone-mix', 'Low neutral zone mix', 'factual', 'content'),
  ('medium-neutral-zone-mix', 'Medium neutral zone mix', 'factual', 'content'),
  ('high-neutral-zone-mix', 'High neutral zone mix', 'factual', 'content'),
  ('neutral-zones-with-castles', 'Neutral zones with castles', 'factual', 'content'),
  ('remote-foothold-usage', 'Remote foothold usage', 'factual', 'content'),
  ('unusually-high-guard-or-resource-values', 'Unusually high guard or resource values', 'factual', 'content')
on conflict (slug) do nothing;
