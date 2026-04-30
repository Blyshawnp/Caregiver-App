import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentPayPeriod,
  formatPayPeriod,
  roundUpToQuarter,
} from "@/lib/pay";
import { ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 12; // Show 12 weeks per page

export default async function CaregiverInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single<{
      id: string;
      role: "admin" | "client" | "caregiver" | "family";
      organization_id: string;
    }>();

  if (!profile) redirect("/login");

  // Pull all snapshots for this caregiver, paginated
  const offset = (page - 1) * PAGE_SIZE;
  const { data: snapshotsRaw, count: totalSnapshots } = await supabase
    .from("pay_period_snapshots")
    .select(
      `
      id,
      total_hours,
      total_amount,
      shift_count,
      created_at,
      pay_period_id,
      pay_periods ( period_start, period_end, is_locked, released_at )
    `,
      { count: "exact" }
    )
    .eq("caregiver_id", profile.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  type SnapshotRow = {
    id: string;
    total_hours: number;
    total_amount: number;
    shift_count: number;
    created_at: string;
    pay_period_id: string;
    pay_periods: {
      period_start: string;
      period_end: string;
      is_locked: boolean;
      released_at: string | null;
    } | null;
  };

  const snapshots = (snapshotsRaw ?? []) as unknown as SnapshotRow[];

  // Also compute the CURRENT open period (live estimate)
  const currentPeriod = getCurrentPayPeriod(new Date());
  const { data: currentRows } = await supabase
    .from("shift_pay_details")
    .select("hours_worked, total_pay, scheduled_start, check_in_time, shift_id")
    .eq("caregiver_id", profile.id)
    .gte("scheduled_start", currentPeriod.start.toISOString())
    .lte("scheduled_start", currentPeriod.end.toISOString())
    .not("hours_worked", "is", null);

  type CurrentRow = {
    hours_worked: number | null;
    total_pay: number | null;
    scheduled_start: string;
    check_in_time: string | null;
    shift_id: string;
  };

  let currentHours = 0;
  let currentTotal = 0;
  let currentShifts = 0;
  for (const r of (currentRows ?? []) as CurrentRow[]) {
    const ref = new Date(r.check_in_time ?? r.scheduled_start);
    if (ref >= currentPeriod.start && ref < currentPeriod.end) {
      currentHours += Number(r.hours_worked ?? 0);
      currentTotal += Number(r.total_pay ?? 0);
      currentShifts += 1;
    }
  }

  const totalPages = Math.ceil((totalSnapshots ?? 0) / PAGE_SIZE);

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href="/me"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back
        </Link>
        <h1 className="font-display text-3xl text-ink-900">Invoices</h1>
        <p className="text-ink-500 text-sm">
          Pay periods run Friday – Friday, locking at 9 PM.
        </p>
      </header>

      {/* Current period (live estimate) */}
      {currentShifts > 0 && page === 1 && (
        <section className="bg-forest-600 text-cream-50 rounded-3xl p-5 mb-4 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-cream-50/10 blur-2xl"
          />
          <div className="relative">
            <div className="flex items-baseline justify-between mb-1">
              <p className="text-xs uppercase tracking-[0.2em] text-cream-50/70">
                Current period (running)
              </p>
              <span className="text-[10px] uppercase tracking-wider bg-cream-50/15 px-1.5 py-0.5 rounded font-medium">
                In progress
              </span>
            </div>
            <p className="font-display text-3xl">
              ${roundUpToQuarter(currentTotal).toFixed(2)}
            </p>
            <p className="text-xs text-cream-50/80 mt-0.5">
              {currentHours.toFixed(1)} hrs · {currentShifts} shift
              {currentShifts === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-cream-50/70 mt-2">
              {formatPayPeriod(currentPeriod)}. Locks Friday at 9 PM.
            </p>
          </div>
        </section>
      )}

      {/* Locked invoices */}
      {snapshots.length === 0 && page === 1 ? (
        <div className="bg-white rounded-3xl p-10 shadow-soft text-center grain-overlay">
          <div className="relative">
            <p className="font-display text-lg mb-1">No locked invoices yet</p>
            <p className="text-sm text-ink-500">
              Once a pay period ends, your invoice will appear here.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {snapshots.map((s) => {
            const periodStart = s.pay_periods?.period_start
              ? new Date(s.pay_periods.period_start)
              : null;
            const periodEnd = s.pay_periods?.period_end
              ? new Date(s.pay_periods.period_end)
              : null;
            return (
              <li key={s.id}>
                <Link
                  href={`/me/invoices/${s.pay_period_id}`}
                  className="flex items-center gap-3 bg-white hover:bg-cream-50 px-4 py-3 rounded-2xl shadow-soft transition active:scale-[0.99]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink-900">
                      $
                      {Number(s.total_amount).toFixed(2)}
                    </p>
                    <p className="text-xs text-ink-500">
                      {periodStart && periodEnd
                        ? formatPayPeriod({
                            start: periodStart,
                            end: periodEnd,
                          })
                        : "Period"}{" "}
                      · {s.shift_count} shift
                      {s.shift_count === 1 ? "" : "s"} ·{" "}
                      {Number(s.total_hours).toFixed(1)} hrs
                    </p>
                  </div>
                  <ArrowRightIcon size={14} className="text-ink-300 shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-between mt-5 text-sm">
          {page > 1 ? (
            <Link
              href={`/me/invoices?page=${page - 1}`}
              className="text-forest-600 hover:underline font-medium"
            >
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          <span className="text-ink-500">
            Page {page} of {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/me/invoices?page=${page + 1}`}
              className="text-forest-600 hover:underline font-medium"
            >
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </main>
  );
}
