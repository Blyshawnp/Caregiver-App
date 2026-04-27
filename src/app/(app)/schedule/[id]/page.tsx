import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClockIcon, MapPinIcon, ArrowRightIcon } from "@/components/icons";
import DeleteShiftButton from "./delete-shift-button";
import AcceptDeclineButtons from "./accept-decline-buttons";
import LiveOnShiftCard from "./live-on-shift-card";

// Force dynamic rendering: this page must always show fresh data
// (check-in status changes mid-session and should reflect immediately)
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ShiftDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, id")
    .eq("id", user.id)
    .single<{ role: "admin" | "client" | "caregiver"; id: string }>();

  const { data: shift } = await supabase
    .from("shifts")
    .select(
      `
      id,
      scheduled_start,
      scheduled_end,
      caregiver_id,
      assignment_status,
      bonus_amount,
      bonus_reason,
      notes,
      profiles:caregiver_id ( full_name ),
      clients ( full_name, address ),
      shift_types ( name, color ),
      check_ins ( check_in_time, check_out_time, total_minutes ),
      shift_todos ( id, task_name, is_completed )
    `
    )
    .eq("id", id)
    .single();

  if (!shift) notFound();

  const start = new Date((shift as any).scheduled_start);
  const end = new Date((shift as any).scheduled_end);
  const checkIn = (shift as any).check_ins?.[0];
  const todos = (shift as any).shift_todos ?? [];
  const todosDone = todos.filter((t: any) => t.is_completed).length;

  const canEdit = profile?.role === "admin" || profile?.role === "client";
  const isAssignedCaregiver =
    profile?.role === "caregiver" && profile.id === (shift as any).caregiver_id;

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <Link
        href="/schedule"
        className="text-sm text-forest-600 hover:underline mb-3 inline-block"
      >
        ← Back to schedule
      </Link>

      {/* Header */}
      <header className="mb-5">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: (shift as any).shift_types?.color ?? "#3F6053",
            }}
          />
          <p className="text-xs uppercase tracking-[0.18em] text-ink-500">
            {(shift as any).shift_types?.name ?? "Shift"}
          </p>
        </div>
        <h1 className="font-display text-3xl text-ink-900 leading-tight">
          {formatDate(start)}
        </h1>
        <p className="text-ink-500 text-sm">
          {formatTime(start)} – {formatTime(end)}
        </p>
      </header>

      {/* Status card */}
      {(shift as any).assignment_status === "pending" && isAssignedCaregiver ? (
        <StatusBanner
          tone="terracotta"
          label="Awaiting your response"
          value="Accept or decline this shift below"
        />
      ) : checkIn?.check_out_time ? (
        <StatusBanner
          tone="forest"
          label="Completed"
          value={`${formatHours(checkIn.total_minutes)} worked`}
        />
      ) : checkIn?.check_in_time ? (
        <LiveOnShiftCard
          checkInTime={checkIn.check_in_time}
          scheduledEnd={(shift as any).scheduled_end}
        />
      ) : (
        <StatusBanner tone="muted" label="Scheduled" value="Not yet started" />
      )}

      {/* Details */}
      <section className="bg-white rounded-3xl shadow-soft p-5 mt-5 grain-overlay">
        <div className="relative space-y-4">
          <Detail label="Client" value={(shift as any).clients?.full_name} />
          <Detail
            label="Caregiver"
            value={(shift as any).profiles?.full_name ?? "Unassigned"}
          />
          {(shift as any).clients?.address && (
            <DetailIcon Icon={MapPinIcon} label="Location">
              {(shift as any).clients.address}
            </DetailIcon>
          )}
          {(shift as any).bonus_amount > 0 && (
            <Detail
              label="Bonus"
              value={`$${Number((shift as any).bonus_amount).toFixed(2)}${
                (shift as any).bonus_reason ? ` · ${(shift as any).bonus_reason}` : ""
              }`}
            />
          )}
          {(shift as any).notes && (
            <div>
              <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
                Notes
              </p>
              <p className="text-sm text-ink-900 whitespace-pre-wrap">
                {(shift as any).notes}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Todos summary */}
      {todos.length > 0 && (
        <section className="bg-white rounded-3xl shadow-soft p-5 mt-4 grain-overlay">
          <div className="relative">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-display text-base">Tasks</h2>
              <span className="text-sm text-ink-500">
                {todosDone} / {todos.length}
              </span>
            </div>
            <ul className="space-y-1.5">
              {todos.slice(0, 5).map((t: any) => (
                <li
                  key={t.id}
                  className="flex items-center gap-2.5 text-sm text-ink-700"
                >
                  <span
                    className={`w-4 h-4 rounded border-2 grid place-items-center shrink-0 ${
                      t.is_completed
                        ? "bg-forest-500 border-forest-500"
                        : "border-cream-200"
                    }`}
                  >
                    {t.is_completed && (
                      <svg
                        className="w-3 h-3 text-cream-50"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </span>
                  <span className={t.is_completed ? "line-through text-ink-300" : ""}>
                    {t.task_name}
                  </span>
                </li>
              ))}
            </ul>
            {todos.length > 5 && (
              <p className="text-xs text-ink-500 mt-2">
                + {todos.length - 5} more
              </p>
            )}
          </div>
        </section>
      )}

      {/* Actions */}
      <div className="space-y-2 mt-6">
        {isAssignedCaregiver &&
          (shift as any).assignment_status === "pending" && (
            <AcceptDeclineButtons shiftId={id} />
          )}
        {isAssignedCaregiver &&
          (shift as any).assignment_status === "accepted" &&
          !checkIn?.check_in_time && (
            <Link
              href={`/schedule/${id}/check-in`}
              className="block bg-forest-600 hover:bg-forest-700 text-cream-50 py-3.5 rounded-2xl font-medium text-center transition"
            >
              Check in
            </Link>
          )}
        {isAssignedCaregiver &&
          checkIn?.check_in_time &&
          !checkIn?.check_out_time && (
            <Link
              href={`/schedule/${id}/check-out`}
              className="block bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 py-3.5 rounded-2xl font-medium text-center transition"
            >
              Check out
            </Link>
          )}
        {canEdit && (
          <>
            <Link
              href={`/schedule/${id}/edit`}
              className="flex items-center justify-between bg-white hover:bg-cream-50 px-5 py-3.5 rounded-2xl shadow-soft text-ink-900 font-medium transition"
            >
              Edit shift
              <ArrowRightIcon size={16} className="text-ink-300" />
            </Link>
            <DeleteShiftButton shiftId={id} />
          </>
        )}
      </div>
    </main>
  );
}

function StatusBanner({
  tone,
  label,
  value,
}: {
  tone: "forest" | "terracotta" | "muted";
  label: string;
  value: string;
}) {
  const styles = {
    forest: "bg-forest-600 text-cream-50",
    terracotta: "bg-terracotta-500 text-cream-50",
    muted: "bg-white text-ink-900 shadow-soft",
  };
  return (
    <div className={`rounded-2xl px-5 py-4 ${styles[tone]} flex items-center gap-4`}>
      <ClockIcon
        size={22}
        className={tone === "muted" ? "text-forest-500" : "opacity-80"}
      />
      <div>
        <p
          className={`text-[10px] uppercase tracking-[0.18em] ${
            tone === "muted" ? "text-ink-500" : "text-cream-50/70"
          }`}
        >
          {label}
        </p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-xs font-medium text-ink-500 uppercase tracking-wide shrink-0">
        {label}
      </span>
      <span className="text-sm text-ink-900 text-right">{value ?? "—"}</span>
    </div>
  );
}

function DetailIcon({
  Icon,
  label,
  children,
}: {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 items-start">
      <span className="w-8 h-8 rounded-lg bg-cream-100 grid place-items-center text-forest-500 shrink-0 mt-0.5">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-500 uppercase tracking-wide">
          {label}
        </p>
        <p className="text-sm text-ink-900">{children}</p>
      </div>
    </div>
  );
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatHours(minutes: number | null) {
  if (!minutes) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
