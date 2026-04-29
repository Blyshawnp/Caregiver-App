import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { roundUpToQuarter, formatPayPeriod } from "@/lib/pay";
import { ArrowRightIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PayrollPeriodPage({
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
    .select("role, organization_id")
    .eq("id", user.id)
    .single<{ role: "admin" | "client" | "caregiver"; organization_id: string }>();

  if (!profile || profile.role === "caregiver") redirect("/me");

  const { data: period } = await supabase
    .from("pay_periods")
    .select(
      "id, period_start, period_end, total_amount, total_hours, released_at, is_locked"
    )
    .eq("id", periodId)
    .eq("organization_id", profile.organization_id)
    .single<{
      id: string;
      period_start: string;
      period_end: string;
      total_amount: number | null;
      total_hours: number | null;
      released_at: string | null;
      is_locked: boolean;
    }>();

  if (!period) notFound();

  // All caregiver snapshots for this period
  const { data: snapsRaw } = await supabase
    .from("pay_period_snapshots")
    .select(
      `
      id,
      caregiver_id,
      total_hours,
      total_amount,
      shift_count,
      profiles:caregiver_id ( full_name )
    `
    )
    .eq("pay_period_id", periodId)
    .order("total_amount", { ascending: false });

  type SnapRow = {
    id: string;
    caregiver_id: string;
    total_hours: number;
    total_amount: number;
    shift_count: number;
    profiles: { full_name: string } | null;
  };

  const snapshots = (snapsRaw ?? []) as unknown as SnapRow[];

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href="/payroll"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← All payroll
        </Link>
        <h1 className="font-display text-3xl text-ink-900">
          {formatPayPeriod({
            start: new Date(period.period_start),
            end: new Date(period.period_end),
          })}
        </h1>
        <p className="text-ink-500 text-sm">
          Locked{" "}
          {period.released_at &&
            new Date(period.released_at).toLocaleDateString()}
        </p>
      </header>

      {/* Org total */}
      <section className="bg-forest-600 text-cream-50 rounded-3xl p-5 mb-4 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-cream-50/10 blur-2xl"
        />
        <div className="relative">
          <p className="text-xs uppercase tracking-[0.2em] text-cream-50/70 mb-1">
            Total payroll
          </p>
          <p className="font-display text-4xl">
            ${Number(period.total_amount ?? 0).toFixed(2)}
          </p>
          <p className="text-xs text-cream-50/80 mt-1">
            {Number(period.total_hours ?? 0).toFixed(1)} hours ·{" "}
            {snapshots.length} caregiver{snapshots.length === 1 ? "" : "s"}
          </p>
        </div>
      </section>

      {/* Per-caregiver breakdown */}
      <section className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
        <div className="relative">
          <h2 className="font-display text-base mb-3">By caregiver</h2>
          {snapshots.length === 0 ? (
            <p className="text-sm text-ink-500">
              No caregiver activity in this period.
            </p>
          ) : (
            <ul className="divide-y divide-cream-200">
              {snapshots.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/payroll/${periodId}?caregiver=${s.caregiver_id}`}
                    className="flex items-center justify-between py-3 first:pt-0 last:pb-0 hover:bg-cream-50 -mx-2 px-2 rounded transition"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-ink-900">
                        {s.profiles?.full_name ?? "Caregiver"}
                      </p>
                      <p className="text-xs text-ink-500">
                        {Number(s.total_hours).toFixed(1)} hrs ·{" "}
                        {s.shift_count} shift{s.shift_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="font-display text-sm">
                        ${Number(s.total_amount).toFixed(2)}
                      </p>
                      <ArrowRightIcon size={14} className="text-ink-300" />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="text-[10px] text-ink-400 text-center mt-4">
        All amounts rounded up to nearest $0.25.
      </p>
    </main>
  );
}
