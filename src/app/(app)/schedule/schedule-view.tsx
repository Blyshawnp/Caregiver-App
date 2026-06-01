"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ListIcon, GridIcon, PlusIcon, ArrowRightIcon } from "@/components/icons";
import type { ScheduleShift } from "./page";
import { getShiftStatus } from "@/lib/shift-status";
import UserAvatar from "@/components/user-avatar";
import { useRouter } from "next/navigation";
import { BulkDeleteModal, BulkAddTaskModal, BulkAddSummaryModal } from "@/components/bulk-modals";

type View = "list" | "calendar";

export default function ScheduleView({
  shifts,
  role,
  archiveMode,
}: {
  shifts: ScheduleShift[];
  role: "admin" | "client" | "caregiver" | "family";
  archiveMode?: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState<View>("list");
  const [now, setNow] = useState(() => new Date());
  const canCreate = role === "admin" || role === "client";

  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<string>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [bulkSummary, setBulkSummary] = useState<{ shiftsUpdated: number; tasksAdded: number; duplicatesSkipped: number } | null>(null);

  const isBulkAllowed = role === "admin" || role === "client";

  const handleToggleSelect = (id: string) => {
    setSelectedShiftIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const selectedShiftsList = useMemo(() => {
    return shifts.filter((s) => selectedShiftIds.has(s.id));
  }, [shifts, selectedShiftIds]);

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="flex items-end justify-between mb-5">
        <div>
          <h1 className="font-display text-3xl text-ink-900 leading-tight">
            Schedule
          </h1>
          <p className="text-ink-500 text-sm">
            {shifts.length} shift{shifts.length === 1 ? "" : "s"} · {archiveMode ? "archive" : "active schedule"}
          </p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Link
              href="/schedule"
              className={`text-xs hover:underline ${!archiveMode ? "text-forest-700 font-medium" : "text-forest-600"}`}
            >
              Active
            </Link>
            <Link
              href="/schedule?view=archive"
              className={`text-xs hover:underline ${archiveMode ? "text-forest-700 font-medium" : "text-forest-600"}`}
            >
              Archive
            </Link>
            {isBulkAllowed && (
              <button
                onClick={() => {
                  setIsMultiSelectMode(!isMultiSelectMode);
                  setSelectedShiftIds(new Set());
                }}
                className={`text-xs font-medium hover:underline ${
                  isMultiSelectMode ? "text-terracotta-600" : "text-forest-600"
                }`}
              >
                {isMultiSelectMode ? "Exit multi-select" : "Bulk actions"}
              </button>
            )}
          </div>
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
              <Link
                href="/schedule/shift-types"
                className="text-xs text-forest-600 hover:underline"
              >
                Shift types
              </Link>
              {role === "admin" && (
                <Link
                  href="/schedule/trades"
                  className="text-xs text-forest-600 hover:underline"
                >
                  Shift trades
                </Link>
              )}
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

      {role === "caregiver" && (
        <div className="mb-5 grid gap-2">
          <Link
            href="/schedule/proposals"
            className="flex items-center justify-between bg-forest-600 hover:bg-forest-700 text-cream-50 rounded-2xl px-5 py-4 shadow-soft transition active:scale-[0.99]"
          >
            <span>
              <span className="block font-medium">Propose shift</span>
              <span className="block text-xs text-cream-50/80">
                Send availability or a client-specific request for admin approval
              </span>
            </span>
            <PlusIcon size={20} className="shrink-0" />
          </Link>
          <Link
            href="/schedule/trades"
            className="flex items-center justify-between bg-white hover:bg-cream-50 text-ink-900 rounded-2xl px-5 py-4 shadow-soft transition active:scale-[0.99]"
          >
            <span>
              <span className="block font-medium">Shift trades</span>
              <span className="block text-xs text-ink-500">
                Pick up available shifts or track shifts you offered
              </span>
            </span>
            <ArrowRightIcon size={18} className="text-ink-300 shrink-0" />
          </Link>
        </div>
      )}
      {view === "list" ? (
        <ListView
          shifts={shifts}
          now={now}
          isMultiSelectMode={isMultiSelectMode}
          selectedShiftIds={selectedShiftIds}
          onToggleSelect={handleToggleSelect}
        />
      ) : (
        <CalendarView
          shifts={shifts}
          now={now}
          isMultiSelectMode={isMultiSelectMode}
          selectedShiftIds={selectedShiftIds}
          onToggleSelect={handleToggleSelect}
        />
      )}

      {canCreate && !isMultiSelectMode && (
        <Link
          href="/schedule/new"
          className="fixed bottom-28 right-5 z-20 w-14 h-14 rounded-full bg-forest-600 hover:bg-forest-700 text-cream-50 shadow-lifted grid place-items-center transition active:scale-95"
          aria-label="Create new shift"
        >
          <PlusIcon size={24} />
        </Link>
      )}

      {isMultiSelectMode && selectedShiftIds.size > 0 && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 bg-white border border-cream-200 shadow-lifted rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4 max-w-sm w-[90%] animate-in fade-in slide-in-from-bottom-5">
          <span className="text-xs font-semibold text-ink-900">
            {selectedShiftIds.size} selected
          </span>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => setShowAddTaskModal(true)}
              className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
            >
              Add Tasks
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 px-3 py-1.5 rounded-xl text-xs font-semibold transition"
            >
              Delete/Cancel
            </button>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <BulkDeleteModal
          selectedShifts={selectedShiftsList}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => {
            setShowDeleteModal(false);
            setIsMultiSelectMode(false);
            setSelectedShiftIds(new Set());
            router.refresh();
          }}
        />
      )}

      {showAddTaskModal && (
        <BulkAddTaskModal
          selectedShifts={selectedShiftsList}
          onClose={() => setShowAddTaskModal(false)}
          onAdded={(summary) => {
            setShowAddTaskModal(false);
            setBulkSummary(summary);
          }}
        />
      )}

      {bulkSummary && (
        <BulkAddSummaryModal
          summary={bulkSummary}
          onClose={() => {
            setBulkSummary(null);
            setIsMultiSelectMode(false);
            setSelectedShiftIds(new Set());
            router.refresh();
          }}
        />
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
function ListView({
  shifts,
  now,
  isMultiSelectMode,
  selectedShiftIds,
  onToggleSelect,
}: {
  shifts: ScheduleShift[];
  now: Date;
  isMultiSelectMode: boolean;
  selectedShiftIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
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
                <ShiftCard
                  shift={s}
                  now={now}
                  isMultiSelectMode={isMultiSelectMode}
                  selectedShiftIds={selectedShiftIds}
                  onToggleSelect={onToggleSelect}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ShiftCard({
  shift,
  now,
  isMultiSelectMode,
  selectedShiftIds,
  onToggleSelect,
}: {
  shift: ScheduleShift;
  now: Date;
  isMultiSelectMode?: boolean;
  selectedShiftIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);
  const accent = shift.shift_type_color ?? "#0D6587";
  const status = getShiftStatus(
    shift,
    {
      check_in_time: shift.check_in_time,
      check_out_time: shift.check_out_time,
    },
    now
  );
  const isPastDimmed =
    status.kind === "completed" ||
    status.kind === "past_unchecked" ||
    status.kind === "open_expired";
  const timingLabel =
    status.kind === "open_expired"
      ? "Expired"
      : shift.is_released
        ? "Up for grabs"
        : shift.is_open
          ? "Open to claim"
          : shift.caregiver_name
            ? shift.caregiver_name
            : "Unassigned";
  const clientLabel = shift.client_name ?? "Client scheduled";
  const activeStart = shift.check_in_time ? new Date(shift.check_in_time) : null;
  const elapsedMin = activeStart
    ? Math.max(0, Math.floor((now.getTime() - activeStart.getTime()) / 60_000))
    : 0;
  const activeElapsed =
    elapsedMin >= 60
      ? `${Math.floor(elapsedMin / 60)}h ${elapsedMin % 60}m`
      : `${elapsedMin}m`;

  return (
    <article
      className={`flex items-stretch gap-4 rounded-2xl p-4 shadow-soft transition active:scale-[0.99] ${
        status.kind === "active_checked_in"
          ? "bg-terracotta-500 text-cream-50 hover:bg-terracotta-600"
          : isPastDimmed
            ? "bg-white opacity-55 hover:opacity-80 hover:bg-cream-50"
            : "bg-white hover:bg-cream-50"
      }`}
    >
      {isMultiSelectMode && onToggleSelect && selectedShiftIds && (
        <input
          type="checkbox"
          checked={selectedShiftIds.has(shift.id)}
          onChange={() => onToggleSelect(shift.id)}
          className="w-5 h-5 accent-forest-600 self-center shrink-0 cursor-pointer mr-1"
        />
      )}
      <Link
        href={`/schedule/${shift.id}`}
        onClick={(e) => {
          if (isMultiSelectMode && onToggleSelect) {
            e.preventDefault();
            onToggleSelect(shift.id);
          }
        }}
        className="flex items-stretch gap-4 flex-1 min-w-0"
      >
        <div
          className={`w-1 rounded-full shrink-0`}
          style={{
            backgroundColor:
              status.kind === "active_checked_in" ? "#FFF" : accent,
          }}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p
              className={`font-medium truncate ${
                status.kind === "active_checked_in"
                  ? "text-cream-50"
                  : isPastDimmed
                    ? "text-ink-500 line-through"
                    : "text-ink-900"
              }`}
            >
              {shift.shift_type_name ?? "Shift"}
            </p>
            {status.kind === "completed" && (
              <span className="text-[10px] uppercase tracking-wider text-forest-600 font-medium bg-forest-100 px-1.5 py-0.5 rounded">
                Done
              </span>
            )}
            {status.kind === "active_checked_in" && (
              <span className="text-[10px] uppercase tracking-wider text-terracotta-600 font-medium bg-cream-50 px-1.5 py-0.5 rounded">
                ON SHIFT NOW
              </span>
            )}
            {shift.is_released && status.kind !== "open_expired" && (
              <span className="text-[10px] uppercase tracking-wider text-cream-50 font-medium bg-terracotta-500 px-1.5 py-0.5 rounded">
                Available
              </span>
            )}
            {status.kind === "open_available" && (
              <span className="text-[10px] uppercase tracking-wider text-forest-700 font-medium bg-forest-100 px-1.5 py-0.5 rounded">
                Open
              </span>
            )}
            {status.kind === "open_expired" && (
              <span className="text-[10px] uppercase tracking-wider text-ink-500 font-medium bg-cream-200 px-1.5 py-0.5 rounded">
                Expired
              </span>
            )}
            {status.kind === "past_unchecked" && (
              <span className="text-[10px] uppercase tracking-wider text-ink-500 font-medium bg-cream-200 px-1.5 py-0.5 rounded">
                Missed
              </span>
            )}
            {status.kind !== "active_checked_in" &&
              !shift.has_check_in &&
              !shift.is_released &&
              shift.assignment_status === "pending" && (
                <span className="text-[10px] uppercase tracking-wider text-terracotta-600 font-medium bg-terracotta-400/15 px-1.5 py-0.5 rounded">
                  Pending
                </span>
              )}
          </div>
          <p
            className={`text-xs ${
              status.kind === "active_checked_in"
                ? "text-cream-50/85"
                : isPastDimmed
                  ? "text-ink-400 line-through"
                  : "text-ink-500"
            }`}
          >
            {status.kind === "active_checked_in" && activeStart
              ? `${activeElapsed} elapsed · started ${formatTime(activeStart)}`
              : `${formatTime(start)} – ${formatTime(end)} · ${timingLabel} · ${clientLabel}`}
            {status.kind === "active_checked_in" && (
              <span className="ml-1">
                · {clientLabel}
                {now > end ? " · Overtime" : ""}
              </span>
            )}
          </p>
        </div>
        <ArrowRightIcon
          size={16}
          className={`self-center shrink-0 ${
            status.kind === "active_checked_in" ? "text-cream-50/70" : "text-ink-300"
          }`}
        />
      </Link>
      {shift.caregiver_name ? (
        <UserAvatar
          person={{
            id: shift.caregiver_profile_id ?? undefined,
            full_name: shift.caregiver_name,
            avatar_url: shift.caregiver_avatar_url,
            avatar_color: shift.caregiver_avatar_color,
          }}
          size="sm"
          className="self-center"
        />
      ) : (
        <span className="self-center w-9 h-9 rounded-full border border-dashed border-ink-300/50 text-ink-400 grid place-items-center text-xs font-display shrink-0">
          ?
        </span>
      )}
    </article>
  );
}

/* ========== CALENDAR VIEW ========== */
function CalendarView({
  shifts,
  now,
  isMultiSelectMode,
  selectedShiftIds,
  onToggleSelect,
}: {
  shifts: ScheduleShift[];
  now: Date;
  isMultiSelectMode: boolean;
  selectedShiftIds: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
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
                className={`relative min-h-16 rounded-xl flex flex-col items-start justify-start p-1.5 transition ${
                  isSelected
                    ? "bg-forest-600 text-cream-50"
                    : isToday
                      ? "bg-cream-200 text-ink-900"
                      : inMonth
                        ? "text-ink-900 hover:bg-cream-100"
                        : "text-ink-300 hover:bg-cream-50"
                }`}
              >
                <span className="text-xs leading-none">{date.getDate()}</span>
                {dayShifts.length > 0 && (
                  <span className="mt-1 flex w-full flex-wrap gap-0.5">
                    {dayShifts.slice(0, 3).map((s) => (
                      <MiniShiftAvatar key={s.id} shift={s} selected={isSelected} />
                    ))}
                    {dayShifts.length > 3 && (
                      <span
                        className={`text-[9px] leading-none ${
                          isSelected ? "text-cream-50/80" : "text-ink-500"
                        }`}
                      >
                        +{dayShifts.length - 3}
                      </span>
                    )}
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
                <ShiftCard
                  shift={s}
                  now={now}
                  isMultiSelectMode={isMultiSelectMode}
                  selectedShiftIds={selectedShiftIds}
                  onToggleSelect={onToggleSelect}
                />
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

function MiniShiftAvatar({
  shift,
  selected,
}: {
  shift: ScheduleShift;
  selected: boolean;
}) {
  if (!shift.caregiver_name) {
    return (
      <span
        className={`h-4 w-4 rounded-full border border-dashed grid place-items-center text-[8px] leading-none ${
          selected
            ? "border-cream-50/70 text-cream-50"
            : "border-ink-300 text-ink-400"
        }`}
        title="Open shift"
      >
        +
      </span>
    );
  }

  const initials = shift.caregiver_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  if (shift.caregiver_avatar_url) {
    return (
      <img
        src={shift.caregiver_avatar_url}
        alt=""
        className={`h-4 w-4 rounded-full object-cover ring-1 ${
          selected ? "ring-cream-50/70" : "ring-black/10"
        }`}
        loading="lazy"
      />
    );
  }

  return (
    <span
      className={`h-4 w-4 rounded-full grid place-items-center text-[7px] font-display leading-none ${
        selected ? "text-forest-700 bg-cream-50" : "text-cream-50"
      }`}
      style={{
        backgroundColor: selected
          ? undefined
          : shift.caregiver_avatar_color ?? shiftDisplayColor(shift),
      }}
      title={shift.caregiver_name}
    >
      {initials || "?"}
    </span>
  );
}

function shiftDisplayColor(shift: ScheduleShift) {
  const status = getShiftStatus(shift, {
    check_in_time: shift.check_in_time,
    check_out_time: shift.check_out_time,
  });

  if (status.kind === "active_checked_in") return "#B75F45";
  if (status.kind === "completed") return "#6A7B45";
  if (status.kind === "open_available" || shift.is_released) return "#4D7C7A";
  if (shift.assignment_status === "pending") return "#8A6A3F";
  if (status.kind === "past_unchecked" || status.kind === "open_expired") {
    return "#9CA3AF";
  }
  return shift.shift_type_color ?? "#0D6587";
}
