"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ClockIcon,
  MapPinIcon,
  CheckSquareIcon,
  ArrowRightIcon,
  CalendarIcon,
  MessageIcon,
  StarOfLifeIcon,
} from "@/components/icons";
import UrgentIncidentBanner from "@/components/urgent-incident-banner";
import type { ShiftRow } from "./page";
import type { ActiveShift } from "./page";
import { getShiftStatus } from "@/lib/shift-status";

type State =
  | { kind: "checked_in"; shift: ShiftRow }
  | { kind: "starting_soon"; shift: ShiftRow }
  | { kind: "upcoming"; shift: ShiftRow }
  | { kind: "no_shifts" };

function pickState(shifts: ShiftRow[], now: Date): State {
  const active = shifts.find(
    (s) =>
      getShiftStatus(
        s,
        { check_in_time: s.check_in_time, check_out_time: s.check_out_time },
        now
      ).kind === "active_checked_in"
  );
  if (active) return { kind: "checked_in", shift: active };

  const next = shifts.find((s) => {
    const status = getShiftStatus(
      s,
      { check_in_time: s.check_in_time, check_out_time: s.check_out_time },
      now
    );
    return status.kind === "ready_to_check_in" || status.kind === "upcoming";
  });
  if (!next) return { kind: "no_shifts" };

  const status = getShiftStatus(
    next,
    { check_in_time: next.check_in_time, check_out_time: next.check_out_time },
    now
  );
  if (status.kind === "ready_to_check_in") {
    return { kind: "starting_soon", shift: next };
  }
  return { kind: "upcoming", shift: next };
}

export default function HomeContent({
  role,
  organizationId,
  shifts,
  activeShifts,
}: {
  role: "admin" | "client" | "caregiver" | "family";
  organizationId: string;
  userId: string;
  shifts: ShiftRow[];
  activeShifts: ActiveShift[];
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const state = useMemo(() => pickState(shifts, now), [shifts, now]);
  
  const upcomingList = useMemo(
    () =>
      shifts
        .filter((s) => {
          const status = getShiftStatus(
            s,
            {
              check_in_time: s.check_in_time,
              check_out_time: s.check_out_time,
            },
            now
          );
          return (
            status.kind === "active_checked_in" ||
            status.kind === "ready_to_check_in" ||
            status.kind === "upcoming"
          );
        })
        .slice(0, 4),
    [shifts, now]
  );

  const pendingShifts = useMemo(
    () =>
      role === "caregiver"
        ? shifts.filter((s) => s.assignment_status === "pending")
        : [],
    [shifts, role]
  );

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <UrgentIncidentBanner organizationId={organizationId} />

      {/* Active right now (admin/client only) */}
      {role !== "caregiver" && activeShifts.length > 0 && (
        <ActivePanel activeShifts={activeShifts} now={now} />
      )}

      {/* Pending shifts notice (caregivers only) */}
      {pendingShifts.length > 0 && (
        <Link
          href="/schedule"
          className="block bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 rounded-2xl px-5 py-4 mb-4 transition active:scale-[0.99]"
        >
          <p className="text-xs uppercase tracking-[0.18em] text-cream-50/70 mb-0.5">
            Action needed
          </p>
          <p className="font-medium">
            {pendingShifts.length} shift
            {pendingShifts.length === 1 ? "" : "s"} waiting for your response
          </p>
          <p className="text-xs text-cream-50/80 mt-0.5">
            Tap to review and accept
          </p>
        </Link>
      )}

      {/* Primary card */}
      {state.kind === "checked_in" && (
        <CheckedInCard shift={state.shift} now={now} />
      )}
      {state.kind === "starting_soon" && (
        <StartingSoonCard shift={state.shift} now={now} role={role} />
      )}
      {state.kind === "upcoming" && (
        <UpcomingCard shift={state.shift} now={now} role={role} />
      )}
      {state.kind === "no_shifts" && <NoShiftsCard role={role} />}

      {/* Quick links */}
      <section className="grid grid-cols-2 gap-3 mt-5">
        <QuickLink href="/schedule" label="Schedule" Icon={CalendarIcon} />
        <QuickLink href="/tasks" label="Tasks" Icon={CheckSquareIcon} />
        <QuickLink href="/messages" label="Messages" Icon={MessageIcon} />
        <QuickLink href="/incidents" label="Incidents" Icon={StarOfLifeIcon} />
        <QuickLink href="/emergency" label="Emergency" Icon={MapPinIcon} />
        <QuickLink href="/me" label="Account" Icon={ClockIcon} />
      </section>

      {/* Upcoming list */}
      {upcomingList.length > 1 && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between mb-3 px-1">
            <h2 className="font-display text-xl text-ink-900">Coming up</h2>
            <Link
              href="/schedule"
              className="text-xs text-forest-600 font-medium hover:underline"
            >
              See all
            </Link>
          </div>
          <ul className="space-y-2">
            {upcomingList.slice(state.kind === "no_shifts" ? 0 : 1).map((s) => (
              <UpcomingRow key={s.id} shift={s} now={now} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/* ========== CARDS ========== */

function CheckedInCard({ shift, now }: { shift: ShiftRow; now: Date }) {
  const startedAt = new Date(shift.check_in_time!);
  const scheduledEnd = new Date(shift.scheduled_end);
  const elapsedMin = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 60000));
  const hours = Math.floor(elapsedMin / 60);
  const mins = elapsedMin % 60;
  const isOvertime = now > scheduledEnd;

  const progress =
    shift.todo_total === 0
      ? 0
      : Math.round((shift.todo_done / shift.todo_total) * 100);

  return (
    <Link
      href={`/schedule/${shift.id}`}
      className="block bg-terracotta-500 text-cream-50 rounded-3xl p-6 shadow-lifted relative overflow-hidden transition hover:bg-terracotta-600 active:scale-[0.99]"
    >
      <div
        aria-hidden
        className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-cream-50/10 blur-2xl"
      />
      <div className="relative">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-cream-50 animate-pulse" />
          <p className="text-xs uppercase tracking-[0.2em] text-cream-50/70">
            On shift right now
          </p>
        </div>

        <p className="font-display text-5xl leading-none mb-1">
          {hours > 0 ? `${hours}h ${mins}m` : `${mins} min`}
        </p>
        <p className="text-cream-50/80 text-sm mb-6">
          elapsed · started {formatTime(startedAt)}
          {isOvertime && (
            <span className="ml-2 bg-cream-50/15 px-1.5 py-0.5 rounded font-medium">
              Overtime
            </span>
          )}
        </p>

        {shift.todo_total > 0 ? (
          <div className="bg-cream-50/10 rounded-2xl p-4 mb-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-cream-50/80">Tasks</span>
              <span className="font-medium">
                {shift.todo_done} / {shift.todo_total}
              </span>
            </div>
            <div className="h-1.5 bg-cream-50/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-terracotta-400 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="bg-cream-50/15 rounded-2xl py-3 px-4 font-medium text-sm flex items-center justify-between">
          <span>Tap to check out</span>
          <ArrowRightIcon size={16} />
        </div>
      </div>
    </Link>
  );
}

function StartingSoonCard({
  shift,
  now,
  role,
}: {
  shift: ShiftRow;
  now: Date;
  role: "admin" | "client" | "caregiver" | "family";
}) {
  const startsAt = new Date(shift.scheduled_start);
  const minsUntil = Math.max(
    0,
    Math.floor((startsAt.getTime() - now.getTime()) / 60000)
  );
  const startedAlready = minsUntil === 0;

  return (
    <article className="bg-white rounded-3xl p-6 shadow-soft grain-overlay">
      <div className="relative">
        <p className="text-xs uppercase tracking-[0.2em] text-terracotta-600 mb-2 font-medium">
          {startedAlready ? "Shift started" : "Starting soon"}
        </p>
        <h2 className="font-display text-3xl text-ink-900 leading-tight mb-1">
          {startedAlready
            ? "It's time"
            : minsUntil < 60
              ? `In ${minsUntil} min`
              : `In ${Math.floor(minsUntil / 60)}h ${minsUntil % 60}m`}
        </h2>
        <p className="text-ink-500 text-sm mb-5">
          {formatTime(startsAt)} · {shift.shift_type_name ?? "Shift"}
          for {shift.client_name ?? "General availability"}
        </p>

        {shift.client_address && (
          <p className="flex items-start gap-2 text-sm text-ink-700 mb-5">
            <MapPinIcon size={16} className="mt-0.5 shrink-0 text-forest-500" />
            <span>{shift.client_address}</span>
          </p>
        )}

        {role === "caregiver" ? (
          <Link
            href={`/schedule/${shift.id}/check-in`}
            className="block w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3.5 rounded-2xl font-medium text-center transition active:scale-[0.99]"
          >
            Check in
          </Link>
        ) : (
          <Link
            href={`/schedule/${shift.id}`}
            className="block w-full bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-3.5 rounded-2xl font-medium text-center transition active:scale-[0.99]"
          >
            View shift
          </Link>
        )}
      </div>
    </article>
  );
}

function UpcomingCard({
  shift,
  now,
  role,
}: {
  shift: ShiftRow;
  now: Date;
  role: "admin" | "client" | "caregiver" | "family";
}) {
  const startsAt = new Date(shift.scheduled_start);

  return (
    <article className="bg-white rounded-3xl p-6 shadow-soft grain-overlay">
      <div className="relative">
        <p className="text-xs uppercase tracking-[0.2em] text-ink-500 mb-2">
          Next shift
        </p>
        <h2 className="font-display text-3xl text-ink-900 leading-tight mb-1">
          {formatRelativeDay(startsAt, now)}
        </h2>
        <p className="text-ink-500 text-sm mb-5">
          {formatTime(startsAt)} – {formatTime(new Date(shift.scheduled_end))} ·{" "}
          {shift.shift_type_name ?? "Shift"}
        </p>

        {shift.caregiver_name && (
          <div className="flex items-center gap-2.5 mb-5">
            <span className="w-8 h-8 rounded-full bg-forest-100 text-forest-600 grid place-items-center font-display text-sm">
              {shift.caregiver_name[0]}
            </span>
            <span className="text-sm text-ink-700">{shift.caregiver_name}</span>
          </div>
        )}

        <Link
          href={`/schedule/${shift.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-forest-600 hover:gap-2 transition-all"
        >
          View details <ArrowRightIcon size={14} />
        </Link>
      </div>
    </article>
  );
}

function NoShiftsCard({
  role,
}: {
  role: "admin" | "client" | "caregiver" | "family";
}) {
  return (    <article className="bg-white rounded-3xl p-8 shadow-soft text-center grain-overlay">
      <div className="relative">
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-cream-200 grid place-items-center text-ink-500">
          <CalendarIcon size={26} />
        </div>
        <h2 className="font-display text-2xl text-ink-900 mb-1.5">
          Nothing scheduled
        </h2>
        <p className="text-ink-500 text-sm mb-5">
          {role === "caregiver"
            ? "You don't have any upcoming shifts."
            : "No shifts in the next two weeks."}
        </p>
        {role !== "caregiver" && (
          <Link
            href="/schedule"
            className="inline-block bg-forest-600 hover:bg-forest-700 text-cream-50 px-5 py-2.5 rounded-2xl font-medium text-sm transition"
          >
            Add a shift
          </Link>
        )}
      </div>
    </article>
  );
}

/* ========== SMALLER PIECES ========== */

function QuickLink({
  href,
  label,
  Icon,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <Link
      href={href}
      className="bg-white hover:bg-white/70 transition rounded-2xl p-4 shadow-soft flex items-center gap-3 active:scale-[0.99]"
    >
      <span className="w-9 h-9 rounded-xl bg-forest-100 text-forest-600 grid place-items-center">
        <Icon size={18} />
      </span>
      <span className="text-sm font-medium text-ink-900">{label}</span>
    </Link>
  );
}

function UpcomingRow({ shift, now }: { shift: ShiftRow; now: Date }) {
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);

  return (
    <Link
      href={`/schedule/${shift.id}`}
      className="flex items-center gap-4 bg-white rounded-2xl p-4 shadow-soft hover:bg-cream-50 transition"
    >
      <div className="text-center w-12 shrink-0">
        <p className="text-[10px] uppercase tracking-wide text-ink-500">
          {start.toLocaleDateString(undefined, { month: "short" })}
        </p>
        <p className="font-display text-2xl leading-none">
          {start.getDate()}
        </p>
      </div>
      <div
        className="w-1 self-stretch rounded-full"
        style={{ backgroundColor: shift.shift_type_color ?? "#3F6053" }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-900 truncate">
          {shift.shift_type_name ?? "Shift"}{" "}
          <span className="text-ink-500 font-normal">
            · {formatRelativeDay(start, now)}
          </span>
        </p>
        <p className="text-xs text-ink-500">
          {formatTime(start)} – {formatTime(end)}
          {shift.caregiver_name ? ` · ${shift.caregiver_name}` : ""}
          {shift.client_name ? ` · ${shift.client_name}` : " · General availability"}
        </p>
      </div>
      <ArrowRightIcon size={16} className="text-ink-300" />
    </Link>
  );
}

/* ========== HELPERS ========== */

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRelativeDay(d: Date, now: Date) {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDate = new Date(d);
  startOfDate.setHours(0, 0, 0, 0);
  const diffDays = Math.round(
    (startOfDate.getTime() - startOfToday.getTime()) / 86_400_000
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays > 1 && diffDays < 7)
    return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function ActivePanel({
  activeShifts,
  now,
}: {
  activeShifts: ActiveShift[];
  now: Date;
}) {
  return (
    <section className="bg-terracotta-500 text-cream-50 rounded-3xl p-5 mb-4 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-cream-50/10 blur-2xl"
      />
      <div className="relative">
        <p className="text-[10px] uppercase tracking-[0.2em] text-cream-50/70 mb-2 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cream-50 animate-pulse" />
          On shift right now
        </p>
        <ul className="space-y-2">
          {activeShifts.map((s) => {
            const start = new Date(s.check_in_time);
            const elapsed = Math.max(
              0,
              Math.floor((now.getTime() - start.getTime()) / 60_000)
            );
            const hours = Math.floor(elapsed / 60);
            const mins = elapsed % 60;
            return (
              <li key={s.shift_id}>
                <Link
                  href={`/schedule/${s.shift_id}`}
                  className="flex items-center gap-3 bg-cream-50/10 hover:bg-cream-50/15 rounded-2xl px-4 py-3 transition active:scale-[0.99]"
                >
                  <span className="w-9 h-9 rounded-full bg-cream-50/15 grid place-items-center font-display text-base shrink-0">
                    {s.caregiver_name[0]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {s.caregiver_name}
                    </p>
                    <p className="text-xs text-cream-50/80">
                      {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`} ·
                      since {formatTime(start)}
                      {s.flagged && (
                        <span className="ml-1.5 text-[10px] uppercase font-medium bg-cream-50/15 px-1 py-0.5 rounded">
                          Flagged
                        </span>
                      )}
                      {s.past_scheduled_end && (
                        <span className="ml-1.5 text-[10px] uppercase font-medium bg-cream-50/15 px-1 py-0.5 rounded">
                          Overtime
                        </span>
                      )}
                    </p>
                  </div>
                  <ArrowRightIcon size={14} className="text-cream-50/60" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
