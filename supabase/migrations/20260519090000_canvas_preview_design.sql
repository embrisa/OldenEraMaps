alter table public.maps
  add column if not exists preview_design_json jsonb,
  add column if not exists preview_renderer_version integer not null default 1;

update public.maps
set preview_renderer_version = 1
where preview_renderer_version is distinct from 1;