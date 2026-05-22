delete from public.maps
where preview_design_json is null
  or jsonb_typeof(preview_design_json) <> 'object'
  or jsonb_typeof(template_json) <> 'object'
  or (design_json is not null and jsonb_typeof(design_json) <> 'object');

alter table public.maps
  alter column preview_design_json set not null;

alter table public.maps
  drop constraint if exists maps_template_json_not_string,
  drop constraint if exists maps_design_json_not_string,
  drop constraint if exists maps_preview_design_json_not_string,
  drop constraint if exists maps_template_json_object,
  drop constraint if exists maps_design_json_object,
  drop constraint if exists maps_preview_design_json_object;

alter table public.maps
  add constraint maps_template_json_object
    check (jsonb_typeof(template_json) = 'object'),
  add constraint maps_design_json_object
    check (design_json is null or jsonb_typeof(design_json) = 'object'),
  add constraint maps_preview_design_json_object
    check (jsonb_typeof(preview_design_json) = 'object');
