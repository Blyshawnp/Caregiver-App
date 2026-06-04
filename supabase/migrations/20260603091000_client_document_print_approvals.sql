alter table public.client_documents
  add column if not exists requires_print_approval boolean not null default false;

create table if not exists public.client_document_print_requests (
  id uuid primary key default gen_random_uuid(),
  client_document_id uuid not null references public.client_documents(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  reviewed_by uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'denied')),
  reason text null,
  constraint client_document_print_requests_unique unique (client_document_id, requested_by)
);

create index if not exists client_document_print_requests_doc_idx
  on public.client_document_print_requests (client_document_id, status);

alter table public.client_document_print_requests enable row level security;

drop policy if exists "users view own client document print requests" on public.client_document_print_requests;
create policy "users view own client document print requests"
on public.client_document_print_requests
for select
using (
  requested_by = auth.uid()
  or exists (
    select 1
    from public.profiles p
    join public.client_documents d on d.id = client_document_print_requests.client_document_id
    where p.id = auth.uid()
      and p.organization_id = d.organization_id
      and p.role in ('admin', 'client')
  )
);

drop policy if exists "users create own client document print requests" on public.client_document_print_requests;
create policy "users create own client document print requests"
on public.client_document_print_requests
for insert
with check (requested_by = auth.uid());

drop policy if exists "admins review client document print requests" on public.client_document_print_requests;
create policy "admins review client document print requests"
on public.client_document_print_requests
for update
using (
  exists (
    select 1
    from public.profiles p
    join public.client_documents d on d.id = client_document_print_requests.client_document_id
    where p.id = auth.uid()
      and p.organization_id = d.organization_id
      and p.role in ('admin', 'client')
  )
);
