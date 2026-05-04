import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ArrowRightIcon, ClockIcon } from "@/components/icons";
import UserAvatar from "@/components/user-avatar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Role = "admin" | "client" | "caregiver" | "family";
type TradeShift = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  released_by: string | null;
  release_reason: string | null;
  clients: { full_name: string | null } | null;
  shift_types: { name: string | null; color: string | null } | null;
  releaser?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    avatar_color: string | null;
  } | null;
};

export default async function ShiftTradesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single<{ id: string; role: Role; organization_id: string }>();

  if (!profile || profile.role === "client" || profile.role === "family") {
    redirect("/schedule");
  }

  const { data: rows } = await supabase
    .from("shifts")
    .select(
      `
      id,
      scheduled_start,
      scheduled_end,
      released_by,
      release_reason,
      clients ( full_name ),
      shift_types ( name, color )
    `
    )
    .eq("organization_id", profile.organization_id)
    .eq("is_released", true)
    .is("caregiver_id", null)
    .gte("scheduled_end", new Date().toISOString())
    .order("scheduled_start", { ascending: true })
    .limit(80);

  const rawShifts = (rows ?? []) as unknown as TradeShift[];
  const releaserIds = Array.from(new Set(rawShifts.flatMap((shift) => shift.released_by ? [shift.released_by] : [])));
  let releasers = new Map<string, NonNullable<TradeShift["releaser"]>>();

  if (releaserIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, avatar_color")
      .in("id", releaserIds);

    releasers = new Map(
      ((profiles ?? []) as NonNullable<TradeShift["releaser"]>[]).map((person) => [
        person.id,
        person,
      ])
    );
  }

  const shifts = rawShifts.map((shift) => ({
    ...shift,
    releaser: shift.released_by ? releasers.get(shift.released_by) ?? null : null,
  }));
  const available = shifts.filter((shift) => shift.released_by !== profile.id);
  const mine = shifts.filter((shift) => shift.released_by === profile.id);

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link href="/schedule" className="text-sm text-forest-600 hover:underline mb-2 inline-block">
          ← Back to schedule
        </Link>
        <h1 className="font-display text-3xl text-ink-900">Shift trades</h1>
        <p className="text-ink-500 text-sm">
          Pick up available teammate shifts or track shifts you offered.
        </p>
      </header>

      <section className="space-y-3 mb-7">
        <SectionHeader title={profile.role === "admin" ? "Open trade board" : "Available to pick up"} />
        {available.length === 0 ? (
          <EmptyState text="No available shift trades right now." />
        ) : (
          available.map((shift) => <TradeCard key={shift.id} shift={shift} viewerRole={profile.role} />)
        )}
      </section>

      {profile.role === "caregiver" && (
        <section className="space-y-3">
          <SectionHeader title="Offered by me" />
          {mine.length === 0 ? (
            <EmptyState text="You have not offered any shifts for trade." />
          ) : (
            mine.map((shift) => <TradeCard key={shift.id} shift={shift} viewerRole={profile.role} />)
          )}
        </section>
      )}
    </main>
  );
}

function TradeCard({ shift, viewerRole }: { shift: TradeShift; viewerRole: Role }) {
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);
  return (
    <Link
      href={`/schedule/${shift.id}`}
      className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-soft hover:bg-cream-50 transition active:scale-[0.99]"
    >
      {shift.releaser ? (
        <UserAvatar person={shift.releaser} size="sm" linkToProfile={false} />
      ) : (
        <span className="w-9 h-9 rounded-full bg-cream-200 text-ink-500 grid place-items-center shrink-0">
          <ClockIcon size={16} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: shift.shift_types?.color ?? "#B75F45" }} />
          <p className="font-medium text-ink-900 truncate">
            {shift.shift_types?.name ?? "Shift"} · {shift.clients?.full_name ?? "Client"}
          </p>
        </div>
        <p className="text-xs text-ink-500 truncate">
          {formatDate(start)} · {formatTime(start)}-{formatTime(end)}
          {shift.releaser?.full_name ? ` · offered by ${shift.releaser.full_name}` : ""}
        </p>
        {shift.release_reason && (
          <p className="text-xs text-terracotta-600 truncate mt-0.5">{shift.release_reason}</p>
        )}
      </div>
      <span className="text-xs font-medium text-forest-600 shrink-0">
        {viewerRole === "admin" ? "Review" : "Open"}
      </span>
      <ArrowRightIcon size={16} className="text-ink-300 shrink-0" />
    </Link>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs uppercase tracking-[0.18em] text-ink-500 px-1">
      {title}
    </h2>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-soft text-center grain-overlay">
      <p className="text-sm text-ink-500">{text}</p>
    </div>
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(date: Date) {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
