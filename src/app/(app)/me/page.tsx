import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowRightIcon, UserIcon, MapPinIcon } from "@/components/icons";
import SignOutButton from "./sign-out-button";

export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, email, phone, organizations(name)")
    .eq("id", user.id)
    .single<{
      id: string;
      full_name: string;
      role: "admin" | "client" | "caregiver";
      email: string;
      phone: string | null;
      organizations: { name: string } | null;
    }>();

  // Pay period: Friday → next Friday. Cutoff at 8pm on Friday.
  // A shift checked in before Friday 8pm goes in the period ending that Friday.
  // We bucket by check-in time (or scheduled_start if not checked in yet).
  const periods = computePayPeriods(new Date());

  let currentTotal = 0;
  let currentHours = 0;
  let previousTotal = 0;
  let previousHours = 0;

  if (profile) {
    let q = supabase
      .from("shift_pay_details")
      .select(
        "shift_id, hours_worked, total_pay, scheduled_start, check_in_time, caregiver_id"
      )
      .gte("scheduled_start", periods.previous.start.toISOString())
      .lte("scheduled_start", periods.current.end.toISOString())
      .not("hours_worked", "is", null);

    if (profile.role === "caregiver") {
      q = q.eq("caregiver_id", profile.id);
    }

    const { data: payRows } = await q;

    for (const r of (payRows ?? []) as any[]) {
      // Use check_in_time if present, else scheduled_start
      const referenceTime = new Date(
        r.check_in_time ?? r.scheduled_start
      );
      const hours = Number(r.hours_worked ?? 0);
      const pay = Number(r.total_pay ?? 0);

      if (
        referenceTime >= periods.current.start &&
        referenceTime < periods.current.end
      ) {
        currentHours += hours;
        currentTotal += pay;
      } else if (
        referenceTime >= periods.previous.start &&
        referenceTime < periods.previous.end
      ) {
        previousHours += hours;
        previousTotal += pay;
      }
    }
  }

  const roleCopy: Record<string, string> = {
    admin: "Administrator",
    client: "Client",
    caregiver: "Caregiver",
  };

  const showPay = currentHours > 0 || previousHours > 0;

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">Me</h1>
        <p className="text-ink-500 text-sm">Account & preferences</p>
      </header>

      <section className="bg-white rounded-3xl shadow-soft p-6 mb-4 grain-overlay">
        <div className="relative flex items-center gap-4 mb-5">
          <span className="w-14 h-14 rounded-full bg-forest-600 text-cream-50 grid place-items-center font-display text-2xl">
            {profile?.full_name?.[0] ?? "?"}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl text-ink-900 truncate">
              {profile?.full_name}
            </h2>
            <p className="text-sm text-forest-600">
              {roleCopy[profile?.role ?? ""] ?? profile?.role}
            </p>
          </div>
        </div>

        <dl className="divide-y divide-cream-200 text-sm">
          <Row label="Email" value={profile?.email} />
          <Row label="Phone" value={profile?.phone || "Not set"} />
          <Row
            label="Organization"
            value={profile?.organizations?.name ?? "—"}
          />
        </dl>
      </section>

      {/* Pay period card */}
      {showPay && (
        <section className="bg-forest-600 text-cream-50 rounded-3xl p-6 mb-4 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-cream-50/10 blur-2xl"
          />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.2em] text-cream-50/70 mb-3">
              {profile?.role === "caregiver" ? "Pay" : "Payroll"}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-cream-50/70 mb-0.5">
                  This pay period
                </p>
                <p className="font-display text-3xl">
                  ${currentTotal.toFixed(2)}
                </p>
                <p className="text-xs text-cream-50/70">
                  {currentHours.toFixed(1)} hrs
                </p>
                <p className="text-[10px] text-cream-50/60 mt-1.5 leading-tight">
                  {formatRange(periods.current)}
                </p>
              </div>
              <div>
                <p className="text-xs text-cream-50/70 mb-0.5">Last period</p>
                <p className="font-display text-3xl">
                  ${previousTotal.toFixed(2)}
                </p>
                <p className="text-xs text-cream-50/70">
                  {previousHours.toFixed(1)} hrs
                </p>
                <p className="text-[10px] text-cream-50/60 mt-1.5 leading-tight">
                  {formatRange(periods.previous)}
                </p>
              </div>
            </div>
            <p className="text-xs text-cream-50/70 mt-4 pt-3 border-t border-cream-50/15">
              Pay periods run Friday to Friday, ending 8 PM.
            </p>
          </div>
        </section>
      )}

      {/* Admin actions */}
      {profile?.role === "admin" && (
        <section className="space-y-2 mb-4">
          <NavLink href="/team" label="Manage team" Icon={UserIcon} />
          <NavLink
            href="/clients"
            label="Clients & geofence"
            Icon={MapPinIcon}
          />
        </section>
      )}

      <SignOutButton />
    </main>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between py-3 first:pt-0 last:pb-0">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-ink-900 font-medium text-right">{value ?? "—"}</dd>
    </div>
  );
}

function NavLink({
  href,
  label,
  Icon,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 bg-white hover:bg-cream-50 px-5 py-4 rounded-2xl shadow-soft transition active:scale-[0.99]"
    >
      <span className="w-9 h-9 rounded-xl bg-forest-100 text-forest-600 grid place-items-center shrink-0">
        <Icon size={18} />
      </span>
      <span className="flex-1 font-medium text-ink-900">{label}</span>
      <ArrowRightIcon size={16} className="text-ink-300" />
    </Link>
  );
}

/**
 * Friday → Friday pay periods, ending at 8 PM local time.
 * "Current" is the period that includes "now".
 * "Previous" is the period before that.
 */
function computePayPeriods(now: Date) {
  // Find the last Friday at 8 PM that is ≤ now
  const cutoff = new Date(now);
  // Move backwards day by day until we hit Friday (5)
  while (cutoff.getDay() !== 5) {
    cutoff.setDate(cutoff.getDate() - 1);
  }
  cutoff.setHours(20, 0, 0, 0);

  // If now is BEFORE this Friday's 8pm cutoff, the current period
  // ends at this cutoff. Else (after 8pm Friday), current period ends
  // at next Friday's 8pm cutoff.
  let currentEnd: Date;
  if (now < cutoff) {
    currentEnd = cutoff;
  } else {
    currentEnd = new Date(cutoff);
    currentEnd.setDate(currentEnd.getDate() + 7);
  }
  const currentStart = new Date(currentEnd);
  currentStart.setDate(currentStart.getDate() - 7);

  const previousEnd = new Date(currentStart);
  const previousStart = new Date(previousEnd);
  previousStart.setDate(previousStart.getDate() - 7);

  return {
    current: { start: currentStart, end: currentEnd },
    previous: { start: previousStart, end: previousEnd },
  };
}

function formatRange(p: { start: Date; end: Date }) {
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(p.start)} – ${fmt(p.end)}`;
}
