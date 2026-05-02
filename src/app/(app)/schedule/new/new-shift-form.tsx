"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { sendNotificationEvent } from "@/lib/notify-client";

type Caregiver = { id: string; full_name: string };
type ShiftType = { id: string; name: string; color: string };
type Client = { id: string; full_name: string };

type Mode = "single" | "bulk";

export default function NewShiftForm({
  caregivers,
  shiftTypes,
  clients,
  organizationId,
  currentUserId,
}: {
  caregivers: Caregiver[];
  shiftTypes: ShiftType[];
  clients: Client[];
  organizationId: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("single");

  const dayShiftType = shiftTypes.find((t) => t.name.toLowerCase() === "day");

  const sortedShiftTypes = useMemo(
    () =>
      [...shiftTypes].sort((a, b) => {
        if (a.name.toLowerCase() === "day") return -1;
        if (b.name.toLowerCase() === "day") return 1;
        return a.name.localeCompare(b.name);
      }),
    [shiftTypes]
  );

  // Shared fields
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [caregiverId, setCaregiverId] = useState("");
  const [shiftTypeId, setShiftTypeId] = useState(dayShiftType?.id ?? "");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("20:00");
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusReason, setBonusReason] = useState("");
  const [notes, setNotes] = useState("");

  // Single-mode date
  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateLocal(d);
  }, []);
  const [singleDate, setSingleDate] = useState(tomorrowStr);

  // Bulk-mode range and weekdays
  const fourWeeksStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 28);
    return formatDateLocal(d);
  }, []);
  const [rangeStart, setRangeStart] = useState(tomorrowStr);
  const [rangeEnd, setRangeEnd] = useState(fourWeeksStr);
  // Sun-Sat checkboxes; default to all 7 days selected
  const [selectedWeekdays, setSelectedWeekdays] = useState<boolean[]>([
    true,
    true,
    true,
    true,
    true,
    true,
    true,
  ]);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const noClients = clients.length === 0;
  const noShiftTypes = shiftTypes.length === 0;

  // Preview: how many shifts will be created in bulk mode
  const bulkPreview = useMemo(() => {
    if (mode !== "bulk") return null;
    const dates = expandDates(rangeStart, rangeEnd, selectedWeekdays);
    return dates;
  }, [mode, rangeStart, rangeEnd, selectedWeekdays]);

  function toggleWeekday(i: number) {
    setSelectedWeekdays((prev) => {
      const next = [...prev];
      next[i] = !next[i];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId) {
      setError("Pick a client.");
      return;
    }

    const baseRow = {
      organization_id: organizationId,
      client_id: clientId,
      caregiver_id: caregiverId || null,
      assignment_status: caregiverId ? "pending" : null,
      shift_type_id: shiftTypeId || null,
      bonus_amount: bonusAmount ? Number(bonusAmount) : 0,
      bonus_reason: bonusReason || null,
      notes: notes || null,
      created_by: currentUserId,
    };

    type ShiftInsert = typeof baseRow & {
      scheduled_start: string;
      scheduled_end: string;
    };

    let rows: ShiftInsert[] = [];

    if (mode === "single") {
      const startISO = combineDateTime(singleDate, startTime);
      const endISO = combineDateTime(singleDate, endTime);
      if (!startISO || !endISO) {
        setError("Please pick a valid date and times.");
        return;
      }
      if (new Date(endISO) <= new Date(startISO)) {
        setError("End time must be after start time.");
        return;
      }
      rows = [
        { ...baseRow, scheduled_start: startISO, scheduled_end: endISO },
      ];
    } else {
      const dates = bulkPreview ?? [];
      if (dates.length === 0) {
        setError("No dates match. Pick at least one weekday in the range.");
        return;
      }
      if (dates.length > 200) {
        setError(
          `That would create ${dates.length} shifts. Pick a smaller range (max 200 at a time).`
        );
        return;
      }

      const sample = combineDateTime(dates[0], startTime);
      const sampleEnd = combineDateTime(dates[0], endTime);
      if (!sample || !sampleEnd || new Date(sampleEnd) <= new Date(sample)) {
        setError("End time must be after start time.");
        return;
      }

      rows = dates
        .map((d) => {
          const start = combineDateTime(d, startTime);
          const end = combineDateTime(d, endTime);
          if (!start || !end) return null;
          return {
            ...baseRow,
            scheduled_start: start,
            scheduled_end: end,
          };
        })
        .filter((r): r is ShiftInsert => r !== null);
    }

    setSubmitting(true);
    const supabase = createClient();
    const { data: createdShifts, error } = await supabase
      .from("shifts")
      .insert(rows)
      .select("id, caregiver_id");

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    const assignedShiftIds =
      createdShifts
        ?.filter((shift) => shift.caregiver_id)
        .map((shift) => shift.id) ?? [];

    await Promise.all(
      assignedShiftIds.map((shiftId) =>
        sendNotificationEvent({ type: "shift_assigned", shiftId })
      )
    );

    router.push("/schedule");
    router.refresh();
  }

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href="/schedule"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back
        </Link>
        <h1 className="font-display text-3xl text-ink-900">New shift</h1>
        <p className="text-ink-500 text-sm">Add one shift or fill a date range</p>
      </header>

      {/* Mode toggle */}
      <div className="bg-white rounded-2xl p-1 grid grid-cols-2 mb-5 shadow-soft">
        <ModeBtn
          active={mode === "single"}
          onClick={() => setMode("single")}
          label="One shift"
        />
        <ModeBtn
          active={mode === "bulk"}
          onClick={() => setMode("bulk")}
          label="Many shifts"
        />
      </div>

      {(noClients || noShiftTypes) && (
        <div className="bg-terracotta-400/10 border border-terracotta-400/30 rounded-2xl p-4 mb-5 text-sm text-terracotta-600">
          <p className="font-medium mb-1">Setup needed</p>
          <ul className="list-disc list-inside space-y-0.5 text-ink-700">
            {noClients && <li>No clients yet (run bootstrap script)</li>}
            {noShiftTypes && <li>No shift types yet (run seed script)</li>}
          </ul>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* When */}
        {mode === "single" ? (
          <Card title="When">
            <Field label="Date">
              <input
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                required
                className={inputCls}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="End">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>
            </div>
          </Card>
        ) : (
          <Card title="When">
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <input
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="To">
                <input
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Days of the week">
              <div className="grid grid-cols-7 gap-1.5">
                {["S", "M", "T", "W", "T", "F", "S"].map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleWeekday(i)}
                    aria-pressed={selectedWeekdays[i]}
                    className={`aspect-square rounded-xl text-sm font-medium transition ${
                      selectedWeekdays[i]
                        ? "bg-forest-600 text-cream-50"
                        : "bg-cream-50 text-ink-500 border border-cream-200 hover:bg-cream-100"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="End">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>
            </div>

            {bulkPreview && (
              <div className="bg-forest-100 border border-forest-100 rounded-xl px-4 py-3 text-sm">
                <span className="font-display text-forest-700 text-lg">
                  {bulkPreview.length}
                </span>{" "}
                <span className="text-forest-600">
                  shift{bulkPreview.length === 1 ? "" : "s"} will be created
                </span>
                {bulkPreview.length > 200 && (
                  <p className="text-terracotta-600 text-xs mt-1">
                    Maximum 200 at a time
                  </p>
                )}
              </div>
            )}
          </Card>
        )}

        <Card title="Who & what">
          <Field label="Client">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              disabled={noClients}
              className={inputCls}
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Caregiver">
            <select
              value={caregiverId}
              onChange={(e) => setCaregiverId(e.target.value)}
              className={inputCls}
            >
              <option value="">Leave unassigned (assign later)</option>
              {caregivers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
            {caregiverId && (
              <p className="text-xs text-ink-500 mt-1.5">
                The caregiver will need to accept{" "}
                {mode === "bulk" ? "each shift" : "this shift"}.
              </p>
            )}
            {!caregiverId && (
              <p className="text-xs text-ink-500 mt-1.5">
                Leaving this blank creates an open shift that eligible caregivers can claim.
              </p>
            )}
          </Field>

          <Field label="Shift type">
            <select
              value={shiftTypeId}
              onChange={(e) => setShiftTypeId(e.target.value)}
              className={inputCls}
            >
              <option value="">Untyped</option>
              {sortedShiftTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </Card>

        <Card title="Bonus & notes (optional)">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bonus $">
              <input
                type="number"
                step="0.01"
                min="0"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>
            <Field label="Reason">
              <input
                type="text"
                value={bonusReason}
                onChange={(e) => setBonusReason(e.target.value)}
                placeholder="e.g. last-minute"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={
                mode === "bulk"
                  ? "Will apply to every shift in the batch"
                  : "Anything the caregiver should know"
              }
              className={inputCls}
            />
          </Field>
        </Card>

        {error && (
          <div className="bg-terracotta-400/10 border border-terracotta-400/30 text-terracotta-600 rounded-2xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2.5">
          <Link
            href="/schedule"
            className="flex-1 bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-3.5 rounded-2xl font-medium text-center transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-3.5 rounded-2xl font-medium transition disabled:opacity-50 active:scale-[0.99]"
          >
            {submitting
              ? "Saving..."
              : mode === "bulk" && bulkPreview
                ? `Create ${bulkPreview.length} shift${bulkPreview.length === 1 ? "" : "s"}`
                : "Create shift"}
          </button>
        </div>
      </form>
    </main>
  );
}

function ModeBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2.5 rounded-xl text-sm font-medium transition ${
        active ? "bg-forest-600 text-cream-50" : "text-ink-500 hover:text-ink-900"
      }`}
    >
      {label}
    </button>
  );
}

const inputCls =
  "w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
      <div className="relative">
        <h2 className="font-display text-base text-ink-900 mb-3">{title}</h2>
        <div className="space-y-3">{children}</div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function formatDateLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function combineDateTime(date: string, time: string) {
  if (!date || !time) return null;
  const local = new Date(`${date}T${time}`);
  if (isNaN(local.getTime())) return null;
  return local.toISOString();
}

function expandDates(
  startStr: string,
  endStr: string,
  weekdaysOn: boolean[]
): string[] {
  if (!startStr || !endStr) return [];
  const start = new Date(`${startStr}T00:00`);
  const end = new Date(`${endStr}T00:00`);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return [];

  const out: string[] = [];
  const cur = new Date(start);
  // safety cap so a typo can't loop forever
  for (let i = 0; i < 400 && cur <= end; i++) {
    if (weekdaysOn[cur.getDay()]) {
      out.push(formatDateLocal(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}
