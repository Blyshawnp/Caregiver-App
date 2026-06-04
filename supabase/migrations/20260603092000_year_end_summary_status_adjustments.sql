alter table public.year_end_summaries
  add column if not exists status text not null default 'active',
  add column if not exists voided_at timestamptz null,
  add column if not exists voided_by uuid null references public.profiles(id) on delete set null,
  add column if not exists void_reason text null,
  add column if not exists correction_note text null,
  add column if not exists adjusted_total_hours numeric null,
  add column if not exists adjusted_total_pay numeric null,
  add column if not exists adjusted_total_bonus numeric null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'year_end_summaries_status_check'
  ) then
    alter table public.year_end_summaries
      add constraint year_end_summaries_status_check
      check (status in ('active', 'voided', 'deleted', 'corrected'));
  end if;
end $$;
