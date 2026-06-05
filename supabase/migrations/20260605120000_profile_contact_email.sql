begin;

alter table public.profiles
  add column if not exists contact_email text null;

comment on column public.profiles.contact_email is
  'Optional contact email managed separately from the Supabase Auth login email.';

commit;
