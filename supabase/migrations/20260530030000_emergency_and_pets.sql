begin;

-- Create client_emergency_guides table
create table if not exists public.client_emergency_guides (
  client_id uuid primary key references public.clients(id) on delete cascade,
  organization_id uuid not null,
  enabled boolean not null default false,
  visible_to_caregivers boolean not null default true,
  visible_to_family boolean not null default true,
  requires_acknowledgment boolean not null default false,
  medical_emergency_plan text null,
  fall_plan text null,
  fire_evacuation_plan text null,
  severe_weather_plan text null,
  power_outage_plan text null,
  pet_evacuation_plan text null,
  supplies_location text null,
  backup_contact_instructions text null,
  mobility_equipment text null,
  oxygen_fire_risk text null,
  access_notes text null,
  hospital_preference text null,
  other_instructions text null,
  updated_at timestamptz not null default now()
);

-- Create client_pets table
create table if not exists public.client_pets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  organization_id uuid not null,
  name text not null check (char_length(btrim(name)) > 0),
  pet_type text not null check (pet_type in ('Dog', 'Cat', 'Bird', 'Fish', 'Reptile', 'Small mammal', 'Rabbit', 'Ferret', 'Horse', 'Farm animal', 'Other')),
  sex text null check (sex in ('Male', 'Female', 'Unknown')),
  spayed_neutered text null check (spayed_neutered in ('Yes', 'No', 'Unknown')),
  photo_url text null,
  feeding_instructions text null,
  medication_instructions text null,
  behavior_notes text null,
  emergency_notes text null,
  supplies_location text null,
  vet_name text null,
  vet_phone text null,
  emergency_vet_phone text null,
  microchip_number text null,
  vaccine_info text null,
  show_to_caregivers boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes
create index if not exists client_pets_client_idx on public.client_pets(client_id);
create index if not exists client_pets_org_idx on public.client_pets(organization_id);

-- Enable RLS
alter table public.client_emergency_guides enable row level security;
alter table public.client_pets enable row level security;

-- SELECT policies: accessible to users in the same organization
drop policy if exists "members can view client emergency guides" on public.client_emergency_guides;
create policy "members can view client emergency guides"
on public.client_emergency_guides
for select
to authenticated
using (
  organization_id = current_org_id()
  and (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = client_emergency_guides.organization_id
        and (
          p.role = 'admin'
          or (p.role = 'caregiver' and visible_to_caregivers)
          or (p.role = 'family' and visible_to_family)
          or p.role = 'client'
        )
    )
  )
);

drop policy if exists "members can view client pets" on public.client_pets;
create policy "members can view client pets"
on public.client_pets
for select
to authenticated
using (
  organization_id = current_org_id()
  and (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.organization_id = client_pets.organization_id
        and (
          p.role = 'admin'
          or (p.role = 'caregiver' and show_to_caregivers)
          or p.role in ('client', 'family')
        )
    )
  )
);

-- INSERT/UPDATE/DELETE: Admins and clients can modify
drop policy if exists "admins and clients modify guides" on public.client_emergency_guides;
create policy "admins and clients modify guides"
on public.client_emergency_guides
for all
to authenticated
using (
  organization_id = current_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'client')
      and p.organization_id = client_emergency_guides.organization_id
  )
)
with check (
  organization_id = current_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'client')
      and p.organization_id = client_emergency_guides.organization_id
  )
);

drop policy if exists "admins and clients modify pets" on public.client_pets;
create policy "admins and clients modify pets"
on public.client_pets
for all
to authenticated
using (
  organization_id = current_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'client')
      and p.organization_id = client_pets.organization_id
  )
)
with check (
  organization_id = current_org_id()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'client')
      and p.organization_id = client_pets.organization_id
  )
);

commit;
