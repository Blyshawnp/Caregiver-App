-- Migration: Fix pay period notification currency formatting source
-- Created: 2026-06-09
-- Convention: YYYYMMDDHHMMSS_fix_pay_period_notification_currency_format.sql

-- ====================================================
-- DOCUMENTATION & CONTEXT
-- ====================================================
-- * PostgreSQL numeric values can render with many decimal places when concatenated as raw text.
-- * Notification text should use to_char(round(..., 2), 'FM999999999990.00') or a shared SQL equivalent to format correctly.
-- * App display formatting still exists as a safety layer (via formatCurrencyInText in next.js), but source text should be stored cleanly.

-- ====================================================
-- TEST / VALIDATION EXAMPLES
-- ====================================================
-- Input: 360                   -> Expected: $360.00
-- Input: 360.000000000000000000 -> Expected: $360.00
-- Input: 180.5                 -> Expected: $180.50
-- Input: 0                     -> Expected: $0.00
--
-- Safe SELECT validation query:
-- SELECT
--   '$' || to_char(round(360::numeric, 2), 'FM999999999990.00') AS test_360,
--   '$' || to_char(round(360.000000000000000000::numeric, 2), 'FM999999999990.00') AS test_decimal,
--   '$' || to_char(round(180.5::numeric, 2), 'FM999999999990.00') AS test_float,
--   '$' || to_char(round(0::numeric, 2), 'FM999999999990.00') AS test_zero;

-- ====================================================
-- PREVIEW / READ-ONLY SECTION
-- ====================================================
-- Target Function: public.auto_release_pay_periods
-- Problematic lines:
--   ' is ready: $' || public.round_up_quarter(v_total_amount)::text
--   ' locked. Total: $' || v_org_total_amount::text
--
-- Replaced with:
--   ' is ready: $' || to_char(round(coalesce(public.round_up_quarter(v_total_amount), 0)::numeric, 2), 'FM999999999990.00')
--   ' locked. Total: $' || to_char(round(coalesce(v_org_total_amount, 0)::numeric, 2), 'FM999999999990.00')

begin;

create or replace function public.auto_release_pay_periods()
returns integer
language plpgsql
security definer
as $$
declare
  v_org record;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_period_id uuid;
  v_snapshot_count integer := 0;
  v_caregiver record;
  v_shift record;
  v_total_hours numeric;
  v_total_amount numeric;
  v_shift_count integer;
  v_breakdown jsonb;
  v_org_total_amount numeric;
  v_org_total_hours numeric;
begin
  -- For each organization, figure out the period that JUST ended.
  -- That's the period whose end <= now.
  for v_org in select id from public.organizations loop
    -- Find the most recent period boundary <= now
    select cb.period_start, cb.period_end
      into v_period_start, v_period_end
    from public.current_pay_period_bounds(now()) cb;

    -- That returned the CURRENT period. We want the PREVIOUS one (just ended).
    v_period_end := v_period_start;
    v_period_start := v_period_end - interval '7 days';

    -- Skip if already locked
    if exists (
      select 1 from public.pay_periods
      where organization_id = v_org.id
        and period_start = v_period_start
        and is_locked = true
    ) then
      continue;
    end if;

    -- Insert or get the period record
    insert into public.pay_periods (
      organization_id, period_start, period_end, is_locked, released_at
    ) values (
      v_org.id, v_period_start, v_period_end, true, now()
    )
    on conflict (organization_id, period_start) do update
      set is_locked = true,
          released_at = now(),
          period_end = excluded.period_end
    returning id into v_period_id;

    v_org_total_amount := 0;
    v_org_total_hours := 0;

    -- For each caregiver, snapshot their pay
    for v_caregiver in
      select distinct s.caregiver_id
      from public.shifts s
      where s.organization_id = v_org.id
        and s.caregiver_id is not null
        and (
          (s.scheduled_start >= v_period_start and s.scheduled_start < v_period_end)
          or exists (
            select 1 from public.check_ins ci
            where ci.shift_id = s.id
              and ci.check_in_time >= v_period_start
              and ci.check_in_time < v_period_end
          )
        )
    loop
      v_total_hours := 0;
      v_total_amount := 0;
      v_shift_count := 0;
      v_breakdown := '[]'::jsonb;

      for v_shift in
        select
          s.id as shift_id,
          s.scheduled_start,
          s.scheduled_end,
          s.bonus_amount,
          s.bonus_reason,
          s.pay_override_reason,
          c.full_name as client_name,
          ci.check_in_time,
          ci.check_out_time,
          (public.compute_shift_pay(s.id)).*
        from public.shifts s
        left join public.clients c on c.id = s.client_id
        left join public.check_ins ci on ci.shift_id = s.id
        where s.organization_id = v_org.id
          and s.caregiver_id = v_caregiver.caregiver_id
          and (
            (s.scheduled_start >= v_period_start and s.scheduled_start < v_period_end)
            or (ci.check_in_time >= v_period_start and ci.check_in_time < v_period_end)
          )
        order by s.scheduled_start
      loop
        v_total_hours := v_total_hours + coalesce(v_shift.hours, 0);
        v_total_amount := v_total_amount + coalesce(v_shift.amount, 0);
        v_shift_count := v_shift_count + 1;

        v_breakdown := v_breakdown || jsonb_build_object(
          'shift_id', v_shift.shift_id,
          'scheduled_start', v_shift.scheduled_start,
          'scheduled_end', v_shift.scheduled_end,
          'check_in_time', v_shift.check_in_time,
          'check_out_time', v_shift.check_out_time,
          'client_name', v_shift.client_name,
          'hours', v_shift.hours,
          'rate', v_shift.rate,
          'amount', v_shift.amount,
          'bonus_amount', v_shift.bonus_amount,
          'bonus_reason', v_shift.bonus_reason,
          'is_overridden', v_shift.is_overridden,
          'override_reason', v_shift.pay_override_reason
        );
      end loop;

      -- Snapshot this caregiver
      insert into public.pay_period_snapshots (
        pay_period_id,
        caregiver_id,
        organization_id,
        total_hours,
        total_amount,
        shift_count,
        breakdown
      ) values (
        v_period_id,
        v_caregiver.caregiver_id,
        v_org.id,
        v_total_hours,
        public.round_up_quarter(v_total_amount),
        v_shift_count,
        v_breakdown
      )
      on conflict (pay_period_id, caregiver_id) do update
        set total_hours = excluded.total_hours,
            total_amount = excluded.total_amount,
            shift_count = excluded.shift_count,
            breakdown = excluded.breakdown;

      v_snapshot_count := v_snapshot_count + 1;
      v_org_total_amount := v_org_total_amount + public.round_up_quarter(v_total_amount);
      v_org_total_hours := v_org_total_hours + v_total_hours;

      -- Notify caregiver
      insert into public.notifications (
        organization_id,
        recipient_id,
        kind,
        title,
        body,
        link
      ) values (
        v_org.id,
        v_caregiver.caregiver_id,
        'invoice_released',
        'Invoice released',
        'Your invoice for ' ||
          to_char(v_period_start at time zone 'America/New_York', 'Mon DD') ||
          ' - ' ||
          to_char(v_period_end at time zone 'America/New_York', 'Mon DD') ||
          ' is ready: $' || to_char(round(coalesce(public.round_up_quarter(v_total_amount), 0)::numeric, 2), 'FM999999999990.00'),
        '/me/invoices'
      );
    end loop;

    -- Update period totals
    update public.pay_periods
    set total_amount = v_org_total_amount,
        total_hours = v_org_total_hours
    where id = v_period_id;

    -- Notify admins and clients in this org
    insert into public.notifications (
      organization_id, recipient_id, kind, title, body, link
    )
    select
      v_org.id,
      p.id,
      'invoice_released',
      'Invoices released',
      'Pay period ' ||
        to_char(v_period_start at time zone 'America/New_York', 'Mon DD') ||
        ' - ' ||
        to_char(v_period_end at time zone 'America/New_York', 'Mon DD') ||
        ' locked. Total: $' || to_char(round(coalesce(v_org_total_amount, 0)::numeric, 2), 'FM999999999990.00'),
      '/payroll'
    from public.profiles p
    where p.organization_id = v_org.id
      and p.role in ('admin', 'client')
      and p.is_active = true;
  end loop;

  return v_snapshot_count;
end;
$$;

commit;
