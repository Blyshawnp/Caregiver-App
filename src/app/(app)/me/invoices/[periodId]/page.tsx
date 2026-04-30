import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { roundUpToQuarter } from "@/lib/pay";
import {
  formatTimeInTz,
  formatShortDateInTz,
} from "@/lib/datetime";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type BreakdownItem = {
  shift_id: string;
  scheduled_start: string;
  scheduled_end: string;
  check_in_time: string | null;
  check_out_time: string | null;
  client_name: string | null;
  hours: number | string;
  rate: number | string;
  amount: number | string;
  bonus_amount: number | string | null;
  bonus_reason: string | null;
  is_overridden: boolean;
  override_reason: string | null;
};

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ periodId: string }>;
}) {
  const { periodId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single<{ id: string; role: "admin" | "client" | "caregiver" | "family" }>();

  if (!profile) redirect("/login");

  // Snapshot for this caregiver + period
  const { data: snapRaw } = await supabase
    .from("pay_period_snapshots")
    .select(
      `
      id,
      total_hours,
      total_amount,
      shift_count,
      breakdown,
      caregiver_id,
      pay_periods ( period_start, period_end, released_at )
    `
    )
    .eq("pay_period_id", periodId)
    .eq("caregiver_id", profile.id)
    .maybeSingle();

  if (!snapRaw) notFound();

  type Snap = {
    id: string;
    total_hours: number;
    total_amount: number;
    shift_count: number;
    breakdown: BreakdownItem[] | null;
    caregiver_id: string;
    pay_periods: {
      period_start: string;
      period_end: string;
      released_at: string | null;
    } | null;
  };

  const snap = snapRaw as unknown as Snap;
  const items = snap.breakdown ?? [];
  const periodStart = snap.pay_periods?.period_start
    ? new Date(snap.pay_periods.period_start)
    : null;
  const periodEnd = snap.pay_periods?.period_end
    ? new Date(snap.pay_periods.period_end)
    : null;

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href="/me/invoices"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← All invoices
        </Link>
        <h1 className="font-display text-3xl text-ink-900">
          {periodStart && periodEnd ? (
            <>
              {formatShortDateInTz(periodStart).split(", ").slice(1).join(", ")} –{" "}
              {formatShortDateInTz(periodEnd).split(", ").slice(1).join(", ")}
            </>
          ) : (
            "Invoice"
          )}
        </h1>
        <p className="text-ink-500 text-sm">
          Locked{" "}
          {snap.pay_periods?.released_at &&
            new Date(snap.pay_periods.released_at).toLocaleDateString(
              "en-US",
              { timeZone: "America/New_York" }
            )}
        </p>
      </header>

      {/* Total card */}
      <section className="bg-forest-600 text-cream-50 rounded-3xl p-5 mb-4 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-cream-50/10 blur-2xl"
        />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.2em] text-cream-50/70 mb-1">
            Total pay
          </p>
          <p className="font-display text-4xl">
            ${Number(snap.total_amount).toFixed(2)}
          </p>
          <p className="text-xs text-cream-50/80 mt-1">
            {Number(snap.total_hours).toFixed(1)} hours · {snap.shift_count}{" "}
            shift{snap.shift_count === 1 ? "" : "s"}
          </p>
        </div>
      </section>

      {/* Per-shift breakdown */}
      <section className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
        <div className="relative">
          <h2 className="font-display text-base mb-3">Shifts</h2>
          {items.length === 0 ? (
            <p className="text-sm text-ink-500">No shifts in this period.</p>
          ) : (
            <ul className="divide-y divide-cream-200">
              {items.map((item, idx) => {
                const start = new Date(item.scheduled_start);
                const end = new Date(item.scheduled_end);
                const amount = Number(item.amount);
                const hours = Number(item.hours);
                const rate = Number(item.rate);
                return (
                  <li key={idx} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-baseline justify-between gap-3 mb-0.5">
                      <p className="font-medium text-ink-900">
                        {formatShortDateInTz(start)}
                      </p>
                      <p className="font-display text-sm">
                        ${roundUpToQuarter(amount).toFixed(2)}
                      </p>
                    </div>
                    <p className="text-xs text-ink-500">
                      {formatTimeInTz(start)} – {formatTimeInTz(end)}
                      {item.client_name && ` · ${item.client_name}`}
                    </p>
                    <p className="text-xs text-ink-500 mt-0.5">
                      {hours.toFixed(2)} hrs × ${rate.toFixed(2)}/hr
                      {Number(item.bonus_amount) > 0 && (
                        <>
                          {" "}
                          + ${Number(item.bonus_amount).toFixed(2)} bonus
                          {item.bonus_reason && ` (${item.bonus_reason})`}
                        </>
                      )}
                    </p>
                    {item.is_overridden && item.override_reason && (
                      <p className="text-[11px] text-terracotta-600 mt-1 italic">
                        Adjusted: {item.override_reason}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      <p className="text-[10px] text-ink-400 text-center mt-4">
        Amounts displayed are rounded up to the nearest $0.25.
      </p>
    </main>
  );
}
