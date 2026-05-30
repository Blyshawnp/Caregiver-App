begin;

create table if not exists public.caregiver_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  caregiver_id uuid null references public.profiles(id) on delete set null,
  shift_id uuid null references public.shifts(id) on delete set null,
  client_id uuid null references public.clients(id) on delete set null,
  feedback_type text not null check (feedback_type in ('commendation', 'appreciation', 'concern', 'complaint', 'safety_issue', 'scheduling_issue', 'other')),
  message text not null check (char_length(btrim(message)) > 0),
  rating integer null check (rating >= 1 and rating <= 5),
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'submitted' check (status in ('submitted', 'reviewed', 'shared_with_caregiver', 'resolved', 'dismissed')),
  reviewed_by uuid null references public.profiles(id) on delete set null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists caregiver_feedback_org_created_at_idx
  on public.caregiver_feedback (organization_id, created_at desc);
create index if not exists caregiver_feedback_caregiver_idx
  on public.caregiver_feedback (caregiver_id);
create index if not exists caregiver_feedback_submitted_by_idx
  on public.caregiver_feedback (submitted_by);

alter table public.caregiver_feedback enable row level security;

drop policy if exists "members can view feedback" on public.caregiver_feedback;
create policy "members can view feedback"
on public.caregiver_feedback
for select
to authenticated
using (
  organization_id = current_org_id()
  and (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
        and p.organization_id = caregiver_feedback.organization_id
    )
    or submitted_by = auth.uid()
    or (
      caregiver_id = auth.uid()
      and status = 'shared_with_caregiver'
    )
  )
);

drop policy if exists "members can create feedback" on public.caregiver_feedback;
create policy "members can create feedback"
on public.caregiver_feedback
for insert
to authenticated
with check (
  organization_id = current_org_id()
  and submitted_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = caregiver_feedback.organization_id
      and p.role in ('admin', 'client', 'family')
  )
);

drop policy if exists "admins can update feedback" on public.caregiver_feedback;
create policy "admins can update feedback"
on public.caregiver_feedback
for update
to authenticated
using (
  organization_id = current_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = caregiver_feedback.organization_id
      and p.role = 'admin'
  )
)
with check (
  organization_id = current_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = caregiver_feedback.organization_id
      and p.role = 'admin'
  )
);

commit;
