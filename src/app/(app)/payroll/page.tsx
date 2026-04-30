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

const PAGE_SIZE = 12;

export default async function PayrollPage({
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

  if (!profile || (profile.role === "caregiver" || profile.role === "family")) redirect("/me");

  // Current open period: real-time totals per caregiver
  const currentPeriod = getCurrentPayPeriod(new Date());
  const { data: currentRows } = await supabase
    .from("shift_pay_details")
    .select(
      "caregiver_id, hours_worked, total_pay, scheduled_start, check_in_time, shift_id"
    )
    .gte("scheduled_start", currentPeriod.start.toISOString())
    .lte("scheduled_start", currentPeriod.end.toISOString())
    .not("hours_worked", "is", null);

  type CurrentRow = {
    caregiver_id: string;
    hours_worked: number | null;
    total_pay: number | null;
    scheduled_start: string;
    check_in_time: string | null;
    shift_id: string;
  };

  const liveTotals = new Map<
    string,
    { hours: number; pay: number; shifts: number }
  >();
  for (const r of (currentRows ?? []) as CurrentRow[]) {
    const ref = new Date(r.check_in_time ?? r.scheduled_start);
    if (ref < currentPeriod.start || ref >= currentPeriod.end) continue;
    const cur = liveTotals.get(r.caregiver_id) ?? {
      hours: 0,
      pay: 0,
      shifts: 0,
    };
    cur.hours += Number(r.hours_worked ?? 0);
    cur.pay += Number(r.total_pay ?? 0);
    cur.shifts += 1;
    liveTotals.set(r.caregiver_id, cur);
  }

  // Get caregiver names
  const caregiverIds = Array.from(liveTotals.keys());
  const { data: caregiverProfiles } = caregiverIds.length
    ? await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", caregiverIds)
    : { data: [] };

  const namesById = new Map<string, string>();
  for (const p of caregiverProfiles ?? []) {
    namesById.set(p.id, p.full_name);
  }

  // Total of current period (across all caregivers, rounded up at the end)
  let liveOrgTotal = 0;
  let liveOrgHours = 0;
  for (const v of liveTotals.values()) {
    liveOrgTotal += v.pay;
    liveOrgHours += v.hours;
  }

  // Locked periods (paginated)
  const offset = (page - 1) * PAGE_SIZE;
  const { data: lockedRaw, count: totalLocked } = await supabase
    .from("pay_periods")
    .select("id, period_start, period_end, total_amount, total_hours, released_at", {
      count: "exact",
    })
    .eq("organization_id", profile.organization_id)
    .eq("is_locked", true)
    .order("period_start", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  type LockedPeriod = {
    id: string;
    period_start: string;
    period_end: string;
    total_amount: number | null;
    total_hours: number | null;
    released_at: string | null;
  };
  const locked = (lockedRaw ?? []) as LockedPeriod[];
  const totalPages = Math.ceil((totalLocked ?? 0) / PAGE_SIZE);

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href="/me"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back
        </Link>
        <h1 className="font-display text-3xl text-ink-900">Payroll</h1>
        <p className="text-ink-500 text-sm">
          Live current-period view, plus all locked invoices.
        </p>
      </header>

      {/* Current open period */}
      <section className="bg-forest-600 text-cream-50 rounded-3xl p-5 mb-4 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-cream-50/10 blur-2xl"
        />
        <div className="relative">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-xs uppercase tracking-[0.2em] text-cream-50/70">
              Current period (live)
            </p>
            <span className="text-[10px] uppercase tracking-wider bg-cream-50/15 px-1.5 py-0.5 rounded font-medium">
              Locks Fri 9 PM
            </span>
          </div>
          <p className="font-display text-3xl">
            ${roundUpToQuarter(liveOrgTotal).toFixed(2)}
          </p>
          <p className="text-xs text-cream-50/80 mt-0.5">
            {liveOrgHours.toFixed(1)} hrs · {liveTotals.size} caregiver
            {liveTotals.size === 1 ? "" : "s"}
          </p>
          <p className="text-xs text-cream-50/70 mt-2">
            {formatPayPeriod(currentPeriod)}
          </p>
        </div>
      </section>

      {/* Per-caregiver live breakdown */}
      {liveTotals.size > 0 && (
        <section className="bg-white rounded-3xl shadow-soft p-5 mb-4 grain-overlay">
          <div className="relative">
            <h2 className="font-display text-base mb-3">By caregiver</h2>
            <ul className="divide-y divide-cream-200">
              {Array.from(liveTotals.entries())
                .sort(([, a], [, b]) => b.pay - a.pay)
                .map(([caregiverId, totals]) => (
                  <li key={caregiverId} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3 mb-0.5">
                      <p className="font-medium text-ink-900">
                        {namesById.get(caregiverId) ?? "Caregiver"}
                      </p>
                      <p className="font-display text-sm">
                        ${roundUpToQuarter(totals.pay).toFixed(2)}
                      </p>
                    </div>
                    <p className="text-xs text-ink-500">
                      {totals.hours.toFixed(1)} hrs · {totals.shifts} shift
                      {totals.shifts === 1 ? "" : "s"}
                    </p>
                  </li>
                ))}
            </ul>
          </div>
        </section>
      )}

      {/* Locked periods */}
      <h2 className="font-display text-base text-ink-900 mb-2 px-1">
        Locked invoices
      </h2>
      {locked.length === 0 && page === 1 ? (
        <div className="bg-white rounded-3xl p-8 shadow-soft text-center grain-overlay">
          <div className="relative">
            <p className="text-sm text-ink-500">
              No locked periods yet. Periods auto-release every Friday at 9 PM.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {locked.map((p) => {
            const start = new Date(p.period_start);
            const end = new Date(p.period_end);
            return (
              <li key={p.id}>
                <Link
                  href={`/payroll/${p.id}`}
                  className="flex items-center gap-3 bg-white hover:bg-cream-50 px-4 py-3 rounded-2xl shadow-soft transition active:scale-[0.99]"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-ink-900">
                      ${Number(p.total_amount ?? 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-ink-500">
                      {formatPayPeriod({ start, end })} ·{" "}
                      {Number(p.total_hours ?? 0).toFixed(1)} hrs
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
              href={`/payroll?page=${page - 1}`}
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
              href={`/payroll?page=${page + 1}`}
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
