alter table public.profiles
  add column if not exists font_size_preference text not null default 'standard',
  add column if not exists reduce_motion boolean not null default false,
  add column if not exists increase_contrast boolean not null default false,
  add column if not exists larger_buttons boolean not null default false;

alter table public.profiles
  drop constraint if exists profiles_font_size_preference_check;

alter table public.profiles
  add constraint profiles_font_size_preference_check
  check (font_size_preference in ('standard', 'large', 'extra_large')) not valid;
