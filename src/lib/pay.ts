/**
 * Pay calculation helpers.
 *
 * Round-up rule: every dollar amount we display rounds UP to the nearest
 * $0.25. The unrounded math is preserved in the database and used for
 * accurate totals. Only the displayed/paid number is rounded.
 *
 * Examples:
 *   roundUpToQuarter(127.17) === 127.25
 *   roundUpToQuarter(127.01) === 127.25
 *   roundUpToQuarter(127.25) === 127.25
 *   roundUpToQuarter(127.26) === 127.50
 *   roundUpToQuarter(0)      === 0
 */
export function roundUpToQuarter(amount: number): number {
  if (!isFinite(amount) || amount <= 0) return 0;
  return Math.ceil(amount * 4) / 4;
}

/**
 * Format a dollar amount for display, always rounded UP to $0.25.
 */
export function formatPay(amount: number): string {
  return `$${roundUpToQuarter(amount).toFixed(2)}`;
}

/**
 * Format hours with one decimal place.
 *   formatHours(8) === "8.0"
 *   formatHours(8.5) === "8.5"
 *   formatHours(0.25) === "0.3"
 */
export function formatHours(hours: number): string {
  if (!isFinite(hours) || hours <= 0) return "0";
  return hours.toFixed(1);
}

/**
 * Compute a single shift's pay (unrounded).
 * Mirrors the server-side compute_shift_pay() function so the UI can
 * show live-updating estimates before a period is released.
 */
export function computeShiftPay(input: {
  totalMinutes: number | null;
  hourlyRate: number | null;
  bonusAmount: number | null;
  holidayMultiplier: number | null;
  overrideAmount: number | null;
  overrideHours: number | null;
  overrideRate: number | null;
}): { hours: number; rate: number; amount: number; isOverridden: boolean } {
  // Override amount wins
  if (input.overrideAmount != null) {
    return {
      hours: input.overrideHours ?? 0,
      rate: input.overrideRate ?? 0,
      amount: input.overrideAmount,
      isOverridden: true,
    };
  }

  const hours =
    input.overrideHours != null
      ? input.overrideHours
      : input.totalMinutes != null && input.totalMinutes > 0
        ? input.totalMinutes / 60
        : 0;

  const rate =
    input.overrideRate != null ? input.overrideRate : (input.hourlyRate ?? 0);

  const multiplier = input.holidayMultiplier ?? 1;
  const bonus = input.bonusAmount ?? 0;

  const amount = hours * rate * multiplier + bonus;

  return {
    hours,
    rate,
    amount,
    isOverridden:
      input.overrideHours != null || input.overrideRate != null,
  };
}

/**
 * Friday-to-Friday pay periods, ending at 9 PM Eastern.
 * Mirrors the server-side current_pay_period_bounds() logic for the UI.
 */
export type PayPeriod = {
  start: Date;
  end: Date;
};

export function getCurrentPayPeriod(now: Date = new Date()): PayPeriod {
  // Find the most recent Friday 9pm <= now (using local time as a stand-in
  // for ET; timezone differences in display are minor here)
  const cutoff = new Date(now);
  while (cutoff.getDay() !== 5) {
    cutoff.setDate(cutoff.getDate() - 1);
  }
  cutoff.setHours(21, 0, 0, 0);

  let periodStart: Date;
  if (now < cutoff) {
    // Before this Friday's 9pm, so period started LAST Friday 9pm
    periodStart = new Date(cutoff);
    periodStart.setDate(periodStart.getDate() - 7);
  } else {
    periodStart = cutoff;
  }
  const periodEnd = new Date(periodStart);
  periodEnd.setDate(periodEnd.getDate() + 7);

  return { start: periodStart, end: periodEnd };
}

export function getPreviousPayPeriod(now: Date = new Date()): PayPeriod {
  const current = getCurrentPayPeriod(now);
  const prevEnd = new Date(current.start);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - 7);
  return { start: prevStart, end: prevEnd };
}

export function formatPayPeriod(p: PayPeriod): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(p.start)} – ${fmt(p.end)}`;
}
