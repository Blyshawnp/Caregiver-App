import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ClockIcon, MapPinIcon, ArrowRightIcon } from "@/components/icons";
import DeleteShiftButton from "./delete-shift-button";
import AcceptDeclineButtons from "./accept-decline-buttons";
import LiveOnShiftCard from "./live-on-shift-card";
import ForceCheckOutButton from "./force-check-out-button";
import AdminTimeAdjuster from "./admin-time-adjuster";
import ReleaseShiftButton from "./release-shift-button";
import ClaimShiftButton from "./claim-shift-button";
import CancelReleaseButton from "./cancel-release-button";
import type { AssignmentStatus, Role } from "@/lib/db-types";

// Force dynamic rendering: this page must always show fresh data
// (check-in status changes mid-session and should reflect immediately)
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ShiftDetail = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  caregiver_id: string | null;
  organization_id: string;
  assignment_status: AssignmentStatus | null;
  bonus_amount: number | null;
  bonus_reason: string | null;
  notes: string | null;
  is_released: boolean | null;
  released_by: string | null;
  release_reason: string | null;
  profiles: { full_name: string } | null;
  clients: { full_name: string; address: string | null } | null;
  shift_types: { name: string; color: string } | null;
  check_ins: Array<{
    id: string;
    check_in_time: string | null;
    check_out_time: string | null;
    total_minutes: number | null;
  }>;
  shift_todos: Array<{
    id: string;
    task_name: string;
    is_completed: boolean;
  }>;
};

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
    .single<{ role: Role; id: string }>();

  const { data: shiftRaw } = await supabase
    .from("shifts")
    .select(
      `
      id,
      scheduled_start,
      scheduled_end,
      caregiver_id,
      organization_id,
      assignment_status,
      bonus_amount,
      bonus_reason,
      notes,
      is_released,
      released_by,
      release_reason,
      profiles:caregiver_id ( full_name ),
      clients ( full_name, address ),
      shift_types ( name, color ),
      check_ins ( id, check_in_time, check_out_time, total_minutes ),
      shift_todos ( id, task_name, is_completed )
    `
    )
    .eq("id", id)
    .single();

  if (!shiftRaw) notFound();

  // Supabase's runtime values match our explicit shape; assert through unknown
  // because Supabase's inferred types nest differently for the same SQL.
  const shift = shiftRaw as unknown as ShiftDetail;

  // If shift is released, fetch the releaser's name for the banner
  let releaserName: string | null = null;
  if (shift.is_released && shift.released_by) {
    const { data: releaser } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", shift.released_by)
      .maybeSingle<{ full_name: string }>();
    releaserName = releaser?.full_name ?? null;
  }

  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);
  const checkIn = shift.check_ins[0];
  const todos = shift.shift_todos;
  const todosDone = todos.filter((t) => t.is_completed).length;

  const canEdit = profile?.role === "admin" || profile?.role === "client";
  const isAssignedCaregiver =
    profile?.role === "caregiver" && profile.id === shift.caregiver_id;
  const isCaregiver = profile?.role === "caregiver";
  const isReleased = !!shift.is_released;
  const iReleasedThis =
    isCaregiver && shift.released_by === profile?.id && isReleased;
  const canClaim = isCaregiver && isReleased && !iReleasedThis;
  // Caregivers can release shifts they're assigned to that haven't started yet
  // and they haven't checked in to.
  const canRelease =
    isAssignedCaregiver &&
    shift.assignment_status === "accepted" &&
    !checkIn?.check_in_time &&
    !isReleased;

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
              backgroundColor: shift.shift_types?.color ?? "#3F6053",
            }}
          />
          <p className="text-xs uppercase tracking-[0.18em] text-ink-500">
            {shift.shift_types?.name ?? "Shift"}
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
      {isReleased ? (
        <div className="bg-terracotta-500 text-cream-50 rounded-2xl px-5 py-4 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-12 -right-10 w-32 h-32 rounded-full bg-cream-50/10 blur-2xl"
          />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.18em] text-cream-50/70 mb-0.5">
              Available
            </p>
            <p className="font-display text-xl leading-tight mb-0.5">
              Up for grabs
            </p>
            <p className="text-xs text-cream-50/80">
              {releaserName ? `Released by ${releaserName}` : "This shift was released"}
              {shift.release_reason ? ` · ${shift.release_reason}` : ""}
            </p>
          </div>
        </div>
      ) : shift.assignment_status === "pending" && isAssignedCaregiver ? (
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
          scheduledEnd={shift.scheduled_end}
        />
      ) : (
        <StatusBanner tone="muted" label="Scheduled" value="Not yet started" />
      )}

      {/* Details */}
      <section className="bg-white rounded-3xl shadow-soft p-5 mt-5 grain-overlay">
        <div className="relative space-y-4">
          <Detail label="Client" value={shift.clients?.full_name} />
          <Detail
            label="Caregiver"
            value={shift.profiles?.full_name ?? "Unassigned"}
          />
          {shift.clients?.address && (
            <DetailIcon Icon={MapPinIcon} label="Location">
              {shift.clients.address}
            </DetailIcon>
          )}
          {shift.bonus_amount != null && shift.bonus_amount > 0 && (
            <Detail
              label="Bonus"
              value={`$${Number(shift.bonus_amount).toFixed(2)}${
                shift.bonus_reason ? ` · ${shift.bonus_reason}` : ""
              }`}
            />
          )}
          {shift.notes && (
            <div>
              <p className="text-xs font-medium text-ink-500 uppercase tracking-wide mb-1">
                Notes
              </p>
              <p className="text-sm text-ink-900 whitespace-pre-wrap">
                {shift.notes}
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
              {todos.slice(0, 5).map((t) => (
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
                  <span
                    className={t.is_completed ? "line-through text-ink-300" : ""}
                  >
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
        {/* Released-shift actions: claim or take back */}
        {canClaim && profile?.id && profile.role === "caregiver" && (
          <ClaimShiftButton
            shiftId={id}
            organizationId={shift.organization_id}
            caregiverId={profile.id}
            caregiverName={
              shift.profiles?.full_name ?? "Caregiver"
            }
            releasedById={shift.released_by}
            shiftStart={shift.scheduled_start}
            clientName={shift.clients?.full_name ?? "Client"}
          />
        )}
        {iReleasedThis && profile?.id && (
          <CancelReleaseButton
            shiftId={id}
            caregiverId={profile.id}
          />
        )}

        {/* Standard caregiver actions when assigned and not released */}
        {!isReleased &&
          isAssignedCaregiver &&
          shift.assignment_status === "pending" && (
            <AcceptDeclineButtons shiftId={id} />
          )}
        {!isReleased &&
          isAssignedCaregiver &&
          shift.assignment_status === "accepted" &&
          !checkIn?.check_in_time && (
            <Link
              href={`/schedule/${id}/check-in`}
              className="block bg-forest-600 hover:bg-forest-700 text-cream-50 py-3.5 rounded-2xl font-medium text-center transition"
            >
              Check in
            </Link>
          )}
        {!isReleased &&
          isAssignedCaregiver &&
          checkIn?.check_in_time &&
          !checkIn?.check_out_time && (
            <Link
              href={`/schedule/${id}/check-out`}
              className="block bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 py-3.5 rounded-2xl font-medium text-center transition"
            >
              Check out
            </Link>
          )}

        {/* Caregiver can release their accepted, not-yet-started shift */}
        {canRelease && profile?.id && (
          <ReleaseShiftButton
            shiftId={id}
            organizationId={shift.organization_id}
            caregiverId={profile.id}
            caregiverName={
              shift.profiles?.full_name ?? "Caregiver"
            }
            shiftStart={shift.scheduled_start}
            clientName={shift.clients?.full_name ?? "Client"}
          />
        )}

        {/* Admin/client can force-check-out a caregiver who's stuck on shift */}
        {canEdit &&
          checkIn?.check_in_time &&
          !checkIn?.check_out_time &&
          checkIn?.id &&
          shift.caregiver_id && (
            <ForceCheckOutButton
              shiftId={id}
              checkInId={checkIn.id}
              caregiverName={shift.profiles?.full_name ?? "the caregiver"}
              organizationId={shift.organization_id}
              caregiverId={shift.caregiver_id}
            />
          )}
        {/* Admin/client can manually create or adjust check-in/out times */}
        {canEdit && shift.caregiver_id && (
          <AdminTimeAdjuster
            shiftId={id}
            caregiverId={shift.caregiver_id}
            caregiverName={shift.profiles?.full_name ?? "the caregiver"}
            organizationId={shift.organization_id}
            scheduledStart={shift.scheduled_start}
            scheduledEnd={shift.scheduled_end}
            existing={
              checkIn
                ? {
                    id: checkIn.id,
                    check_in_time: checkIn.check_in_time,
                    check_out_time: checkIn.check_out_time,
                  }
                : null
            }
          />
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
