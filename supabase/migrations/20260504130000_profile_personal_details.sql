begin;

alter table public.profiles
  add column if not exists bio text null,
  add column if not exists vehicle_1_make_model text null,
  add column if not exists vehicle_1_color text null,
  add column if not exists vehicle_2_make_model text null,
  add column if not exists vehicle_2_color text null;

comment on column public.profiles.bio is
  'Optional user-entered profile bio or care-team context.';
comment on column public.profiles.vehicle_1_make_model is
  'Optional caregiver vehicle make/model for family/client identification.';
comment on column public.profiles.vehicle_1_color is
  'Optional caregiver vehicle color for family/client identification.';
comment on column public.profiles.vehicle_2_make_model is
  'Optional second caregiver vehicle make/model.';
comment on column public.profiles.vehicle_2_color is
  'Optional second caregiver vehicle color.';

commit;
