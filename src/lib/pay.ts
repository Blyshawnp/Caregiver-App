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
  return formatCurrency(roundUpToQuarter(amount));
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount == null) return "$0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(num);
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
 * Computed in America/New_York regardless of server timezone, so server-side
 * rendering produces the same boundaries as a browser in ET would.
 */
export type PayPeriod = {
  start: Date;
  end: Date;
};

const APP_TZ = "America/New_York";

/**
 * Get the components (year/month/day/hour/dow) of a Date as observed in
 * America/New_York. Uses Intl.DateTimeFormat with formatToParts so it works
 * correctly across DST transitions and on UTC servers.
 */
function getEasternComponents(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(d);
  const o: Record<string, string> = {};
  for (const p of parts) o[p.type] = p.value;
  const dowMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: parseInt(o.year, 10),
    month: parseInt(o.month, 10),
    day: parseInt(o.day, 10),
    hour: parseInt(o.hour === "24" ? "0" : o.hour, 10),
    minute: parseInt(o.minute, 10),
    dow: dowMap[o.weekday] ?? 0,
  };
}

/**
 * Convert a "wall clock" time in America/New_York to a UTC timestamp.
 * Approach: build a UTC date from the components, then adjust by the
 * difference between that UTC date's ET-rendered components and the target.
 * This handles DST transitions correctly.
 */
function easternWallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number = 0
): Date {
  // First guess: treat the components as UTC
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  // Find what those UTC instants render as in ET
  const c = getEasternComponents(guess);
  // Compute the offset between what we wanted (year/month/...) and what guess produced
  const targetMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const guessRenderedMs = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, 0);
  const diff = targetMs - guessRenderedMs;
  return new Date(guess.getTime() + diff);
}

export function getCurrentPayPeriod(now: Date = new Date()): PayPeriod {
  const c = getEasternComponents(now);

  // Find the most recent Friday 9 PM ET that is <= now.
  // c.dow: Sun=0..Sat=6. Friday = 5.
  // If today is Friday and time is past 9 PM (21:00), use today's 9 PM.
  // Otherwise, walk back to the most recent past Friday's 9 PM.
  let daysBack = 0;
  if (c.dow === 5) {
    daysBack = c.hour < 21 ? 7 : 0;
  } else {
    // Days since last Friday: e.g. Sat=1, Sun=2, ..., Thu=6
    daysBack = (c.dow + 2) % 7;
  }

  const target = new Date(
    Date.UTC(c.year, c.month - 1, c.day) - daysBack * 86_400_000
  );
  const t = getEasternComponents(target);
  const periodStart = easternWallTimeToUtc(t.year, t.month, t.day, 21, 0);

  // Period end = period start + 7 days
  const t2 = getEasternComponents(
    new Date(target.getTime() + 7 * 86_400_000)
  );
  const periodEnd = easternWallTimeToUtc(t2.year, t2.month, t2.day, 21, 0);

  return { start: periodStart, end: periodEnd };
}

export function getPreviousPayPeriod(now: Date = new Date()): PayPeriod {
  const current = getCurrentPayPeriod(now);
  const prevEnd = new Date(current.start);
  const prevStart = new Date(prevEnd.getTime() - 7 * 86_400_000);
  return { start: prevStart, end: prevEnd };
}

export function formatPayPeriod(p: PayPeriod): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      month: "short",
      day: "numeric",
    });
  return `${fmt(p.start)} – ${fmt(p.end)}`;
}

export function formatEnumLabel(val: string | null | undefined): string {
  if (!val) return "";
  const mapping: Record<string, string> = {
    early_afternoon: "Early Afternoon",
    late_afternoon: "Late Afternoon",
    not_needed: "Not needed this shift",
    needs_follow_up: "Needs follow-up",
    client_declined: "Client declined",
    admin_forced: "Admin assigned",
    agency_company: "Agency / Company",
    personal_family: "Personal / Family Care",
    solo_caregiver: "Solo Caregiver",
    client_directed_care: "Client-Directed Care",
    pending: "Pending",
    completed: "Completed",
    skipped: "Skipped",
    low: "Low",
    medium: "Medium",
    high: "High",
    critical: "Critical",
    unscheduled: "Unscheduled",
    time_of_day: "Time of day",
    exact_time: "Exact time",
    morning: "Morning",
    evening: "Evening",
    bedtime: "Bedtime",
    admin: "Admin",
    client: "Client",
    caregiver: "Caregiver",
    family: "Family",
  };
  
  if (mapping[val]) return mapping[val];
  if (mapping[val.toLowerCase()]) return mapping[val.toLowerCase()];
  
  // fallback: replace underscores with spaces and capitalize words
  return val
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

