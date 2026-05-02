begin;

alter table public.profiles
  add column if not exists avatar_url text null,
  add column if not exists avatar_color text null;

create or replace function public.default_avatar_color(profile_id uuid)
returns text
language sql
immutable
as $$
  select (array[
    '#3F6053',
    '#B75F45',
    '#5B6F95',
    '#8A6A3F',
    '#6A7B45',
    '#8B5C7E',
    '#4D7C7A',
    '#9A6B4F'
  ])[1 + ((
    ascii(substr(md5(profile_id::text), 1, 1)) +
    ascii(substr(md5(profile_id::text), 2, 1)) +
    ascii(substr(md5(profile_id::text), 3, 1)) +
    ascii(substr(md5(profile_id::text), 4, 1))
  ) % 8)];
$$;

update public.profiles
set avatar_color = public.default_avatar_color(id)
where avatar_color is null;

alter table public.profiles
  alter column avatar_color drop default;

alter table public.profiles
  drop constraint if exists profiles_avatar_color_hex_check;

alter table public.profiles
  add constraint profiles_avatar_color_hex_check
  check (avatar_color is null or avatar_color ~ '^#[0-9A-Fa-f]{6}$');

create or replace function public.set_profile_avatar_color()
returns trigger
language plpgsql
as $$
begin
  if new.avatar_color is null then
    new.avatar_color := public.default_avatar_color(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists set_profile_avatar_color on public.profiles;
create trigger set_profile_avatar_color
before insert on public.profiles
for each row
execute function public.set_profile_avatar_color();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatar images are publicly readable" on storage.objects;
create policy "avatar images are publicly readable"
on storage.objects
for select
to public
using (bucket_id = 'avatars');

drop policy if exists "users upload own avatar images" on storage.objects;
create policy "users upload own avatar images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "users update own avatar images" on storage.objects;
create policy "users update own avatar images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
)
with check (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "users delete own avatar images" on storage.objects;
create policy "users delete own avatar images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and auth.uid()::text = (storage.foldername(name))[1]
);

commit;
