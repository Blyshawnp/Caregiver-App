/**
 * Date formatting helpers for server-rendered pages.
 *
 * The bug we're fixing: when Next.js server-renders a page on Vercel,
 * `date.toLocaleTimeString()` runs in the server's timezone (UTC).
 * That makes "5 PM Eastern" display as "9 PM" because the ISO string
 * stores 21:00 UTC.
 *
 * These helpers explicitly format in America/New_York so server and
 * client render identically, and the times the user sees match what
 * they entered when creating the shift.
 *
 * If we ever support multiple timezones, we'll change this helper to
 * read from the org's timezone setting.
 */

const APP_TIMEZONE = "America/New_York";

export function formatTimeInTz(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", {
    timeZone: APP_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDateInTz(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDateInTz(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    timeZone: APP_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatRelativeDayInTz(d: Date | string, now?: Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const reference = now ?? new Date();
  if (isNaN(date.getTime())) return "";

  // Compare year/month/day in app timezone
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dateKey = fmt.format(date);
  const todayKey = fmt.format(reference);
  const tomorrow = new Date(reference);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = fmt.format(tomorrow);

  if (dateKey === todayKey) return "Today";
  if (dateKey === tomorrowKey) return "Tomorrow";
  return formatShortDateInTz(date);
}

/**
 * Day key for grouping shifts by day in the app's timezone.
 * Returns "YYYY-MM-DD" using America/New_York calendar day.
 */
export function dayKeyInTz(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
