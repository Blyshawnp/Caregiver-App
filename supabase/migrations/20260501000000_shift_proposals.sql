begin;

create table if not exists public.shift_proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  caregiver_id uuid not null references public.profiles(id) on delete cascade,
  client_id uuid null references public.clients(id) on delete set null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz not null,
  notes text null,
  status text not null default 'pending',
  approved_by uuid null references public.profiles(id) on delete set null,
  approved_at timestamptz null,
  rejection_reason text null,
  rejected_by uuid null references public.profiles(id) on delete set null,
  rejected_at timestamptz null,
  canceled_by uuid null references public.profiles(id) on delete set null,
  canceled_at timestamptz null,
  shift_id uuid null unique references public.shifts(id) on delete set null,
  created_by uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shift_proposals_status_check
    check (status in ('pending', 'approved', 'rejected', 'canceled')),
  constraint shift_proposals_time_check
    check (scheduled_end > scheduled_start)
);

alter table public.shift_proposals
  add column if not exists organization_id uuid,
  add column if not exists caregiver_id uuid,
  add column if not exists client_id uuid,
  add column if not exists scheduled_start timestamptz,
  add column if not exists scheduled_end timestamptz,
  add column if not exists notes text,
  add column if not exists status text default 'pending',
  add column if not exists approved_by uuid,
  add column if not exists approved_at timestamptz,
  add column if not exists rejection_reason text,
  add column if not exists rejected_by uuid,
  add column if not exists rejected_at timestamptz,
  add column if not exists canceled_by uuid,
  add column if not exists canceled_at timestamptz,
  add column if not exists shift_id uuid,
  add column if not exists created_by uuid,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

alter table public.shift_proposals
  alter column status set default 'pending',
  alter column created_at set default now(),
  alter column updated_at set default now(),
  alter column status set not null,
  alter column organization_id set not null,
  alter column caregiver_id set not null,
  alter column scheduled_start set not null,
  alter column scheduled_end set not null,
  alter column created_at set not null,
  alter column updated_at set not null;

update public.shift_proposals
set status = 'pending'
where status is null;

update public.shift_proposals
set created_at = now()
where created_at is null;

update public.shift_proposals
set updated_at = now()
where updated_at is null;

update public.shift_proposals
set scheduled_end = scheduled_start + interval '1 hour'
where scheduled_end is null
  and scheduled_start is not null;

alter table public.shift_proposals
  drop constraint if exists shift_proposals_status_check,
  drop constraint if exists shift_proposals_time_check;

alter table public.shift_proposals
  add constraint shift_proposals_status_check
    check (status in ('pending', 'approved', 'rejected', 'canceled')),
  add constraint shift_proposals_time_check
    check (scheduled_end > scheduled_start);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shift_proposals_caregiver_id_fkey'
  ) then
    alter table public.shift_proposals
      add constraint shift_proposals_caregiver_id_fkey
      foreign key (caregiver_id) references public.profiles(id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shift_proposals_client_id_fkey'
  ) then
    alter table public.shift_proposals
      add constraint shift_proposals_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shift_proposals_approved_by_fkey'
  ) then
    alter table public.shift_proposals
      add constraint shift_proposals_approved_by_fkey
      foreign key (approved_by) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shift_proposals_rejected_by_fkey'
  ) then
    alter table public.shift_proposals
      add constraint shift_proposals_rejected_by_fkey
      foreign key (rejected_by) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shift_proposals_canceled_by_fkey'
  ) then
    alter table public.shift_proposals
      add constraint shift_proposals_canceled_by_fkey
      foreign key (canceled_by) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shift_proposals_created_by_fkey'
  ) then
    alter table public.shift_proposals
      add constraint shift_proposals_created_by_fkey
      foreign key (created_by) references public.profiles(id) on delete set null;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'shift_proposals_shift_id_fkey'
  ) then
    alter table public.shift_proposals
      add constraint shift_proposals_shift_id_fkey
      foreign key (shift_id) references public.shifts(id) on delete set null;
  end if;
end
$$;

alter table public.shifts
  alter column client_id drop not null;

alter table public.shifts
  add column if not exists source_proposal_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'shifts_source_proposal_id_fkey'
  ) then
    alter table public.shifts
      add constraint shifts_source_proposal_id_fkey
      foreign key (source_proposal_id) references public.shift_proposals(id) on delete set null;
  end if;
end
$$;

create unique index if not exists shifts_source_proposal_id_uniq
  on public.shifts (source_proposal_id)
  where source_proposal_id is not null;

create index if not exists shift_proposals_org_status_idx
  on public.shift_proposals (organization_id, status, scheduled_start);

create index if not exists shift_proposals_caregiver_status_idx
  on public.shift_proposals (caregiver_id, status, created_at desc);

create index if not exists shift_proposals_client_idx
  on public.shift_proposals (client_id);

alter table public.shift_proposals enable row level security;

drop policy if exists "caregivers create own shift proposals" on public.shift_proposals;
create policy "caregivers create own shift proposals"
on public.shift_proposals
for insert
to authenticated
with check (
  organization_id = current_org_id()
  and caregiver_id = auth.uid()
  and created_by = auth.uid()
  and status = 'pending'
  and approved_by is null
  and approved_at is null
  and rejected_by is null
  and rejected_at is null
  and canceled_by is null
  and canceled_at is null
  and shift_id is null
);

drop policy if exists "caregivers view own shift proposals" on public.shift_proposals;
create policy "caregivers view own shift proposals"
on public.shift_proposals
for select
to authenticated
using (
  caregiver_id = auth.uid()
);

drop policy if exists "caregivers cancel own shift proposals" on public.shift_proposals;
create policy "caregivers cancel own shift proposals"
on public.shift_proposals
for update
to authenticated
using (
  caregiver_id = auth.uid()
  and organization_id = current_org_id()
  and status = 'pending'
)
with check (
  caregiver_id = auth.uid()
  and organization_id = current_org_id()
  and status = 'canceled'
  and canceled_by = auth.uid()
  and canceled_at is not null
  and approved_by is null
  and approved_at is null
  and rejected_by is null
  and rejected_at is null
  and shift_id is null
);

drop policy if exists "admins manage shift proposals in org" on public.shift_proposals;
create policy "admins manage shift proposals in org"
on public.shift_proposals
for all
to authenticated
using (
  is_admin()
  and organization_id = current_org_id()
)
with check (
  is_admin()
  and organization_id = current_org_id()
);

drop function if exists public.approve_shift_proposal(uuid);
create function public.approve_shift_proposal(p_proposal_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal public.shift_proposals%rowtype;
  v_shift_id uuid;
begin
  if auth.uid() is null or not is_admin() then
    raise exception 'Admin access required';
  end if;

  select *
  into proposal
  from public.shift_proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposal not found';
  end if;

  if proposal.organization_id <> current_org_id() then
    raise exception 'Cross-organization proposals are not allowed';
  end if;

  if proposal.status = 'approved' then
    if proposal.shift_id is not null then
      return proposal.shift_id;
    end if;

    select s.id
    into v_shift_id
    from public.shifts s
    where s.source_proposal_id = proposal.id
    limit 1;

    if v_shift_id is null then
      insert into public.shifts (
        organization_id,
        client_id,
        caregiver_id,
        assignment_status,
        scheduled_start,
        scheduled_end,
        notes,
        created_by,
        source_proposal_id
      )
      values (
        proposal.organization_id,
        proposal.client_id,
        proposal.caregiver_id,
        'accepted',
        proposal.scheduled_start,
        proposal.scheduled_end,
        proposal.notes,
        proposal.created_by,
        proposal.id
      )
      on conflict (source_proposal_id) do update
      set source_proposal_id = excluded.source_proposal_id
      returning id into v_shift_id;
    end if;

    update public.shift_proposals
    set shift_id = v_shift_id,
        updated_at = now()
    where id = proposal.id;

    return v_shift_id;
  end if;

  if proposal.status <> 'pending' then
    raise exception 'Only pending proposals can be approved';
  end if;

  select s.id
  into v_shift_id
  from public.shifts s
  where s.source_proposal_id = proposal.id
  limit 1;

  if v_shift_id is null then
    insert into public.shifts (
      organization_id,
      client_id,
      caregiver_id,
      assignment_status,
      scheduled_start,
      scheduled_end,
      notes,
      created_by,
      source_proposal_id
    )
    values (
      proposal.organization_id,
      proposal.client_id,
      proposal.caregiver_id,
      'accepted',
      proposal.scheduled_start,
      proposal.scheduled_end,
      proposal.notes,
      proposal.created_by,
      proposal.id
    )
    on conflict (source_proposal_id) do update
    set source_proposal_id = excluded.source_proposal_id
    returning id into v_shift_id;
  end if;

  update public.shift_proposals
  set status = 'approved',
      approved_by = auth.uid(),
      approved_at = now(),
      rejection_reason = null,
      shift_id = v_shift_id,
      updated_at = now()
  where id = proposal.id;

  return v_shift_id;
end
$$;

drop function if exists public.reject_shift_proposal(uuid, text);
create function public.reject_shift_proposal(
  p_proposal_id uuid,
  p_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  proposal public.shift_proposals%rowtype;
begin
  if auth.uid() is null or not is_admin() then
    raise exception 'Admin access required';
  end if;

  select *
  into proposal
  from public.shift_proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'Proposal not found';
  end if;

  if proposal.organization_id <> current_org_id() then
    raise exception 'Cross-organization proposals are not allowed';
  end if;

  if proposal.status = 'approved' then
    raise exception 'Approved proposals cannot be rejected';
  end if;

  if proposal.status <> 'pending' then
    return false;
  end if;

  update public.shift_proposals
  set status = 'rejected',
      rejected_by = auth.uid(),
      rejected_at = now(),
      rejection_reason = nullif(btrim(coalesce(p_reason, '')), ''),
      updated_at = now()
  where id = proposal.id
    and status = 'pending';

  return true;
end
$$;

grant execute on function public.approve_shift_proposal(uuid) to authenticated;
grant execute on function public.reject_shift_proposal(uuid, text) to authenticated;

commit;
