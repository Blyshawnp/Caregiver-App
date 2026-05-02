"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ListIcon, GridIcon, PlusIcon, ArrowRightIcon } from "@/components/icons";
import type { ScheduleShift } from "./page";

type View = "list" | "calendar";

export default function ScheduleView({
  shifts,
  role,
}: {
  shifts: ScheduleShift[];
  role: "admin" | "client" | "caregiver" | "family";
}) {
  const [view, setView] = useState<View>("list");
  const canCreate = role === "admin" || role === "client";

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="flex items-end justify-between mb-5">
        <div>
          <h1 className="font-display text-3xl text-ink-900 leading-tight">
            Schedule
          </h1>
          <p className="text-ink-500 text-sm">
            {shifts.length} shift{shifts.length === 1 ? "" : "s"} · next 60 days
          </p>
          {canCreate && (
            <div className="flex gap-2 mt-2">
              <Link
                href="/schedule/new"
                className="text-xs text-forest-600 hover:underline"
              >
                New shift
              </Link>
              {role === "admin" && (
                <Link
                  href="/schedule/recurring"
                  className="text-xs text-forest-600 hover:underline"
                >
                  Recurring templates
                </Link>
              )}
              <Link
                href="/schedule/proposals"
                className="text-xs text-forest-600 hover:underline"
              >
                Shift proposals
              </Link>
            </div>
          )}
          {role === "caregiver" && !canCreate && (
            <div className="flex gap-2 mt-2">
              <Link
                href="/schedule/proposals"
                className="text-xs text-forest-600 hover:underline"
              >
                Propose shift
              </Link>
            </div>
          )}
        </div>

        {/* View toggle */}
        <div className="bg-white rounded-2xl p-1 flex shadow-soft">
          <ToggleBtn
            active={view === "list"}
            onClick={() => setView("list")}
            label="List"
            Icon={ListIcon}
          />
          <ToggleBtn
            active={view === "calendar"}
            onClick={() => setView("calendar")}
            label="Calendar"
            Icon={GridIcon}
          />
        </div>
      </header>

      {view === "list" ? (
        <ListView shifts={shifts} />
      ) : (
        <CalendarView shifts={shifts} />
      )}

      {canCreate && (
        <Link
          href="/schedule/new"
          className="fixed bottom-28 right-5 z-20 w-14 h-14 rounded-full bg-forest-600 hover:bg-forest-700 text-cream-50 shadow-lifted grid place-items-center transition active:scale-95"
          aria-label="Create new shift"
        >
          <PlusIcon size={24} />
        </Link>
      )}
    </main>
  );
}

function ToggleBtn({
  active,
  onClick,
  label,
  Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  Icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition ${
        active ? "bg-forest-600 text-cream-50" : "text-ink-500 hover:text-ink-900"
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

/* ========== LIST VIEW ========== */

function ListView({ shifts }: { shifts: ScheduleShift[] }) {
  const grouped = useMemo(() => groupByDay(shifts), [shifts]);

  if (shifts.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-10 shadow-soft text-center grain-overlay">
        <div className="relative">
          <p className="font-display text-xl text-ink-900 mb-1">
            No shifts yet
          </p>
          <p className="text-ink-500 text-sm">
            Tap the + button to create your first shift.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {grouped.map(({ dateKey, label, items }) => (
        <section key={dateKey}>
          <h2 className="font-display text-sm uppercase tracking-[0.18em] text-ink-500 mb-2 px-1">
            {label}
          </h2>
          <ul className="space-y-2">
            {items.map((s) => (
              <li key={s.id}>
                <ShiftCard shift={s} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ShiftCard({ shift }: { shift: ScheduleShift }) {
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);
  const accent = shift.shift_type_color ?? "#3F6053";
  const timingLabel = shift.is_released
    ? "Up for grabs"
    : shift.is_open
      ? "Open to claim"
      : shift.caregiver_name
        ? shift.caregiver_name
        : "Unassigned";
  const clientLabel = shift.client_name ?? "General availability";

  return (
    <Link
      href={`/schedule/${shift.id}`}
      className="flex items-stretch gap-4 bg-white rounded-2xl p-4 shadow-soft hover:bg-cream-50 transition active:scale-[0.99]"
    >
      <div
        className="w-1 rounded-full shrink-0"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="font-medium text-ink-900 truncate">
            {shift.shift_type_name ?? "Shift"}
          </p>
          {shift.is_complete && (
            <span className="text-[10px] uppercase tracking-wider text-forest-600 font-medium bg-forest-100 px-1.5 py-0.5 rounded">
              Done
            </span>
          )}
          {shift.has_check_in && !shift.is_complete && (
            <span className="text-[10px] uppercase tracking-wider text-terracotta-600 font-medium bg-terracotta-400/15 px-1.5 py-0.5 rounded">
              On shift
            </span>
          )}
          {shift.is_released && (
            <span className="text-[10px] uppercase tracking-wider text-cream-50 font-medium bg-terracotta-500 px-1.5 py-0.5 rounded">
              Available
            </span>
          )}
          {shift.is_open && (
            <span className="text-[10px] uppercase tracking-wider text-forest-700 font-medium bg-forest-100 px-1.5 py-0.5 rounded">
              Open
            </span>
          )}
          {!shift.has_check_in &&
            !shift.is_released &&
            shift.assignment_status === "pending" && (
              <span className="text-[10px] uppercase tracking-wider text-terracotta-600 font-medium bg-terracotta-400/15 px-1.5 py-0.5 rounded">
                Pending
              </span>
            )}
        </div>
        <p className="text-xs text-ink-500">
          {formatTime(start)} – {formatTime(end)} · {timingLabel} · {clientLabel}
        </p>
      </div>
      <ArrowRightIcon size={16} className="text-ink-300 self-center" />
    </Link>
  );
}

/* ========== CALENDAR VIEW ========== */

function CalendarView({ shifts }: { shifts: ScheduleShift[] }) {
  const [monthOffset, setMonthOffset] = useState(0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const viewMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthLabel = viewMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const days = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
  const shiftsByDay = useMemo(() => {
    const map = new Map<string, ScheduleShift[]>();
    for (const s of shifts) {
      const k = dayKey(new Date(s.scheduled_start));
      const arr = map.get(k) ?? [];
      arr.push(s);
      map.set(k, arr);
    }
    return map;
  }, [shifts]);

  const [selectedKey, setSelectedKey] = useState<string>(dayKey(today));
  const selectedShifts = shiftsByDay.get(selectedKey) ?? [];

  return (
    <div>
      {/* Month header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          onClick={() => setMonthOffset((o) => o - 1)}
          className="w-9 h-9 rounded-xl hover:bg-cream-200 grid place-items-center text-ink-700 transition"
          aria-label="Previous month"
        >
          ‹
        </button>
        <p className="font-display text-lg text-ink-900">{monthLabel}</p>
        <button
          onClick={() => setMonthOffset((o) => o + 1)}
          className="w-9 h-9 rounded-xl hover:bg-cream-200 grid place-items-center text-ink-700 transition"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-1.5 px-0.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div
            key={i}
            className="text-[10px] uppercase tracking-wider text-ink-500 text-center"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-3xl p-2 shadow-soft mb-5">
        <div className="grid grid-cols-7 gap-0.5">
          {days.map(({ date, inMonth }) => {
            const k = dayKey(date);
            const dayShifts = shiftsByDay.get(k) ?? [];
            const isToday = k === dayKey(today);
            const isSelected = k === selectedKey;

            return (
              <button
                key={k}
                onClick={() => setSelectedKey(k)}
                className={`relative aspect-square rounded-xl flex flex-col items-center justify-center transition ${
                  isSelected
                    ? "bg-forest-600 text-cream-50"
                    : isToday
                      ? "bg-cream-200 text-ink-900"
                      : inMonth
                        ? "text-ink-900 hover:bg-cream-100"
                        : "text-ink-300 hover:bg-cream-50"
                }`}
              >
                <span className="text-sm leading-none">{date.getDate()}</span>
                {dayShifts.length > 0 && (
                  <span className="flex gap-0.5 absolute bottom-1.5">
                    {dayShifts.slice(0, 3).map((s, i) => (
                      <span
                        key={i}
                        className="w-1 h-1 rounded-full"
                        style={{
                          backgroundColor: isSelected
                            ? "#FCFAF5"
                            : (s.shift_type_color ?? "#3F6053"),
                        }}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day shifts */}
      <div>
        <h3 className="font-display text-sm uppercase tracking-[0.18em] text-ink-500 mb-2 px-1">
          {formatLongDate(parseKey(selectedKey))}
        </h3>
        {selectedShifts.length === 0 ? (
          <div className="bg-white rounded-2xl p-6 text-center shadow-soft">
            <p className="text-ink-500 text-sm">No shifts on this day.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {selectedShifts.map((s) => (
              <li key={s.id}>
                <ShiftCard shift={s} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ========== HELPERS ========== */

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function parseKey(k: string) {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function buildMonthGrid(monthStart: Date) {
  const firstOfMonth = new Date(monthStart);
  firstOfMonth.setDate(1);
  // Roll back to Sunday
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());
  // 6 rows × 7 days = 42
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return { date: d, inMonth: d.getMonth() === monthStart.getMonth() };
  });
}

function groupByDay(shifts: ScheduleShift[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const groups = new Map<string, ScheduleShift[]>();
  for (const s of shifts) {
    const k = dayKey(new Date(s.scheduled_start));
    const arr = groups.get(k) ?? [];
    arr.push(s);
    groups.set(k, arr);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, items]) => ({
      dateKey,
      label: relativeDayLabel(parseKey(dateKey), today),
      items,
    }));
}

function relativeDayLabel(d: Date, today: Date) {
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7)
    return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatLongDate(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}
