begin;

-- Create documents table
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  client_id uuid null references public.clients(id) on delete set null,
  user_id uuid null references public.profiles(id) on delete set null, -- caregiver/user_id
  title text not null check (char_length(btrim(title)) > 0),
  description text null,
  storage_path text not null check (char_length(btrim(storage_path)) > 0),
  document_type text not null check (document_type in ('care_plan', 'caregiver_agreement', 'emergency_plan', 'pet_instructions', 'policy', 'invoice_supporting', 'insurance', 'other')),
  visibility text not null check (visibility in ('admin_only', 'caregiver_visible', 'client_visible', 'family_visible', 'assigned_caregivers_only', 'specific_user_only')),
  requires_acknowledgment boolean not null default false,
  requires_print_approval boolean not null default false,
  expiration_date date null,
  uploaded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create document acknowledgments table
create table if not exists public.document_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  acknowledged_by uuid not null references public.profiles(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  version text null,
  constraint document_acknowledgments_unique unique (document_id, acknowledged_by)
);

-- Create document print requests table
create table if not exists public.document_print_requests (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  requested_at timestamptz not null default now(),
  reviewed_by uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null,
  status text not null default 'requested' check (status in ('requested', 'approved', 'denied', 'printed', 'downloaded')),
  reason text null, -- denial reason
  constraint document_print_requests_unique unique (document_id, requested_by)
);

-- Create indexes
create index if not exists documents_org_idx on public.documents(organization_id);
create index if not exists documents_client_idx on public.documents(client_id);
create index if not exists documents_user_idx on public.documents(user_id);
create index if not exists document_acknowledgments_doc_idx on public.document_acknowledgments(document_id);
create index if not exists document_print_requests_doc_idx on public.document_print_requests(document_id);

-- Enable RLS
alter table public.documents enable row level security;
alter table public.document_acknowledgments enable row level security;
alter table public.document_print_requests enable row level security;

-- Policies for documents
drop policy if exists "members can view documents" on public.documents;
create policy "members can view documents"
on public.documents
for select
to authenticated
using (
  organization_id = current_org_id()
  and (
    -- Admins see everything
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.organization_id = documents.organization_id
    )
    -- Specific user visibility
    or (visibility = 'specific_user_only' and user_id = auth.uid())
    -- Admin only block
    or (visibility <> 'admin_only' and visibility <> 'specific_user_only' and (
      -- caregiver_visible
      (visibility = 'caregiver_visible' and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'caregiver'
      ))
      -- client_visible
      or (visibility = 'client_visible' and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'client'
      ))
      -- family_visible
      or (visibility = 'family_visible' and exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'family'
      ))
      -- assigned_caregivers_only
      or (visibility = 'assigned_caregivers_only' and exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role = 'caregiver'
          and exists (
            select 1 from public.shifts s
            where s.client_id = documents.client_id
              and s.caregiver_id = p.id
          )
      ))
    ))
  )
);

drop policy if exists "admins can insert documents" on public.documents;
create policy "admins can insert documents"
on public.documents
for insert
to authenticated
with check (
  organization_id = current_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.organization_id = documents.organization_id
  )
);

drop policy if exists "admins can update documents" on public.documents;
create policy "admins can update documents"
on public.documents
for update
to authenticated
using (
  organization_id = current_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.organization_id = documents.organization_id
  )
)
with check (
  organization_id = current_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.organization_id = documents.organization_id
  )
);

drop policy if exists "admins can delete documents" on public.documents;
create policy "admins can delete documents"
on public.documents
for delete
to authenticated
using (
  organization_id = current_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.organization_id = documents.organization_id
  )
);

-- Policies for document acknowledgments
drop policy if exists "users can view own acknowledgments" on public.document_acknowledgments;
create policy "users can view own acknowledgments"
on public.document_acknowledgments
for select
to authenticated
using (
  acknowledged_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "users can insert own acknowledgments" on public.document_acknowledgments;
create policy "users can insert own acknowledgments"
on public.document_acknowledgments
for insert
to authenticated
with check (
  acknowledged_by = auth.uid()
);

-- Policies for document print requests
drop policy if exists "users can view own print requests" on public.document_print_requests;
create policy "users can view own print requests"
on public.document_print_requests
for select
to authenticated
using (
  requested_by = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists "users can insert own print requests" on public.document_print_requests;
create policy "users can insert own print requests"
on public.document_print_requests
for insert
to authenticated
with check (
  requested_by = auth.uid()
);

drop policy if exists "admins can update print requests" on public.document_print_requests;
create policy "admins can update print requests"
on public.document_print_requests
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

commit;
