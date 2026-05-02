begin;

create table if not exists public.client_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid not null references public.clients(id) on delete cascade,
  category text not null default 'general',
  title text not null,
  description text null,
  storage_path text not null unique,
  mime_type text null,
  file_size_bytes bigint null,
  created_at timestamptz not null default now()
);

alter table public.client_documents
  add column if not exists organization_id uuid,
  add column if not exists client_id uuid,
  add column if not exists category text default 'general',
  add column if not exists title text,
  add column if not exists description text,
  add column if not exists storage_path text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists created_at timestamptz default now();

alter table public.client_documents
  alter column organization_id set not null,
  alter column client_id set not null,
  alter column category set default 'general',
  alter column category set not null,
  alter column title set not null,
  alter column storage_path set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.client_documents
  drop constraint if exists client_documents_category_check;

alter table public.client_documents
  add constraint client_documents_category_check
  check (category in ('emergency', 'wifi', 'instructions', 'general'));

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'client_documents_client_id_fkey'
  ) then
    alter table public.client_documents
      add constraint client_documents_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete cascade;
  end if;
end;
$$;

create unique index if not exists client_documents_storage_path_key
  on public.client_documents (storage_path);

create index if not exists client_documents_client_created_idx
  on public.client_documents (client_id, created_at desc);

create index if not exists client_documents_org_idx
  on public.client_documents (organization_id);

alter table public.client_documents enable row level security;

drop policy if exists "permitted users view client documents" on public.client_documents;
create policy "permitted users view client documents"
on public.client_documents
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = client_documents.organization_id
      and (
        p.role in ('admin', 'client')
        or (
          p.role = 'caregiver'
          and exists (
            select 1
            from public.shifts s
            where s.client_id = client_documents.client_id
              and s.caregiver_id = p.id
              and s.organization_id = p.organization_id
          )
        )
      )
  )
);

drop policy if exists "admins and clients create client documents" on public.client_documents;
create policy "admins and clients create client documents"
on public.client_documents
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    join public.clients c
      on c.id = client_documents.client_id
     and c.organization_id = p.organization_id
    where p.id = auth.uid()
      and p.organization_id = client_documents.organization_id
      and p.role in ('admin', 'client')
  )
);

drop policy if exists "admins and clients update client documents" on public.client_documents;
create policy "admins and clients update client documents"
on public.client_documents
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = client_documents.organization_id
      and p.role in ('admin', 'client')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    join public.clients c
      on c.id = client_documents.client_id
     and c.organization_id = p.organization_id
    where p.id = auth.uid()
      and p.organization_id = client_documents.organization_id
      and p.role in ('admin', 'client')
  )
);

drop policy if exists "admins and clients delete client documents" on public.client_documents;
create policy "admins and clients delete client documents"
on public.client_documents
for delete
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = client_documents.organization_id
      and p.role in ('admin', 'client')
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-documents',
  'client-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admins and clients upload client document files" on storage.objects;
create policy "admins and clients upload client document files"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-documents'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'client')
      and p.organization_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "permitted users read client document files" on storage.objects;
create policy "permitted users read client document files"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-documents'
  and exists (
    select 1
    from public.client_documents d
    join public.profiles p
      on p.id = auth.uid()
     and p.organization_id = d.organization_id
    where d.storage_path = storage.objects.name
      and (
        p.role in ('admin', 'client')
        or (
          p.role = 'caregiver'
          and exists (
            select 1
            from public.shifts s
            where s.client_id = d.client_id
              and s.caregiver_id = p.id
              and s.organization_id = p.organization_id
          )
        )
      )
  )
);

drop policy if exists "admins and clients update client document files" on storage.objects;
create policy "admins and clients update client document files"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'client-documents'
  and exists (
    select 1
    from public.client_documents d
    join public.profiles p
      on p.id = auth.uid()
     and p.organization_id = d.organization_id
     and p.role in ('admin', 'client')
    where d.storage_path = storage.objects.name
  )
)
with check (
  bucket_id = 'client-documents'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'client')
      and p.organization_id::text = (storage.foldername(name))[1]
  )
);

drop policy if exists "admins and clients delete client document files" on storage.objects;
create policy "admins and clients delete client document files"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'client-documents'
  and exists (
    select 1
    from public.client_documents d
    join public.profiles p
      on p.id = auth.uid()
     and p.organization_id = d.organization_id
     and p.role in ('admin', 'client')
    where d.storage_path = storage.objects.name
  )
);

commit;
