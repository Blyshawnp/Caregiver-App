"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Caregiver = { id: string; full_name: string };
type ShiftType = { id: string; name: string; color: string };
type Client = { id: string; full_name: string };

type RecurringTemplateRow = {
  id: string;
  client_id: string;
  caregiver_id: string | null;
  shift_type_id: string | null;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string | null;
  repeat_frequency: "daily" | "weekly";
  is_active: boolean;
  is_paused: boolean;
  last_generated_through: string | null;
  notes: string | null;
  clients: { full_name: string } | null;
  profiles: { full_name: string } | null;
  shift_types: { name: string; color: string } | null;
};

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;

export default function RecurringTemplatesManager({
  organizationId,
  currentUserId,
  caregivers,
  shiftTypes,
  clients,
  templates,
}: {
  organizationId: string;
  currentUserId: string;
  caregivers: Caregiver[];
  shiftTypes: ShiftType[];
  clients: Client[];
  templates: RecurringTemplateRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tomorrowStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateLocal(d);
  }, []);

  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [caregiverId, setCaregiverId] = useState("");
  const [shiftTypeId, setShiftTypeId] = useState(shiftTypes[0]?.id ?? "");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("20:00");
  const [startDate, setStartDate] = useState(tomorrowStr);
  const [endDate, setEndDate] = useState("");
  const [repeatFrequency, setRepeatFrequency] = useState<"daily" | "weekly">(
    "weekly"
  );
  const [notes, setNotes] = useState("");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 3, 5]);

  async function createTemplate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId) {
      setError("Pick a client.");
      return;
    }
    if (repeatFrequency === "weekly" && selectedWeekdays.length === 0) {
      setError("Pick at least one day of the week.");
      return;
    }
    if (endTime <= startTime) {
      setError("End time must be after start time.");
      return;
    }

    setSubmitting(true);
    const { error: insertError } = await supabase
      .from("recurring_shift_templates")
      .insert({
        organization_id: organizationId,
        client_id: clientId,
        caregiver_id: caregiverId || null,
        shift_type_id: shiftTypeId || null,
        days_of_week:
          repeatFrequency === "daily"
            ? WEEKDAY_OPTIONS.map((day) => day.value)
            : selectedWeekdays,
        start_time: startTime,
        end_time: endTime,
        start_date: startDate,
        end_date: endDate || null,
        repeat_frequency: repeatFrequency,
        notes: notes.trim() || null,
        created_by: currentUserId,
      });

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    await supabase.rpc("generate_recurring_shifts");
    router.refresh();
  }

  async function toggleTemplate(
    template: RecurringTemplateRow,
    key: "is_paused" | "is_active"
  ) {
    await supabase
      .from("recurring_shift_templates")
      .update({ [key]: !template[key] })
      .eq("id", template.id);
    router.refresh();
  }

  async function generateNow(templateId?: string) {
    const { error: rpcError } = await supabase.rpc("generate_recurring_shifts", {
      p_template_id: templateId ?? null,
    });

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    router.refresh();
  }

  function toggleWeekday(day: number) {
    setSelectedWeekdays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b)
    );
  }

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href="/schedule"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back to schedule
        </Link>
        <h1 className="font-display text-3xl text-ink-900">
          Recurring schedules
        </h1>
        <p className="text-ink-500 text-sm">
          Build daily or weekly patterns and generate real shifts without duplicates.
        </p>
      </header>

      <form onSubmit={createTemplate} className="space-y-5 mb-6">
        <Card title="Template details">
          <Field label="Client">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={inputCls}
              required
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.full_name}
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
              <option value="">Leave open for claiming</option>
              {caregivers.map((caregiver) => (
                <option key={caregiver.id} value={caregiver.id}>
                  {caregiver.full_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Shift type">
            <select
              value={shiftTypeId}
              onChange={(e) => setShiftTypeId(e.target.value)}
              className={inputCls}
            >
              <option value="">Untyped</option>
              {shiftTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </Field>
        </Card>

        <Card title="Repeat">
          <div className="bg-cream-50 border border-cream-200 rounded-xl p-3 grid grid-cols-2 gap-1">
            <TogglePill
              active={repeatFrequency === "daily"}
              onClick={() => setRepeatFrequency("daily")}
              label="Daily"
            />
            <TogglePill
              active={repeatFrequency === "weekly"}
              onClick={() => setRepeatFrequency("weekly")}
              label="Weekly"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start date">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputCls}
                required
              />
            </Field>
            <Field label="End date">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Start time">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputCls}
                required
              />
            </Field>
            <Field label="End time">
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputCls}
                required
              />
            </Field>
          </div>

          <Field label="Days of week">
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_OPTIONS.map((day) => {
                const active =
                  repeatFrequency === "daily" || selectedWeekdays.includes(day.value);
                return (
                  <button
                    key={day.value}
                    type="button"
                    disabled={repeatFrequency === "daily"}
                    onClick={() => toggleWeekday(day.value)}
                    className={`aspect-square rounded-xl text-sm font-medium transition ${
                      active
                        ? "bg-forest-600 text-cream-50"
                        : "bg-cream-50 text-ink-500 border border-cream-200 hover:bg-cream-100"
                    } ${repeatFrequency === "daily" ? "opacity-70" : ""}`}
                  >
                    {day.label[0]}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Notes (optional)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={inputCls}
              placeholder="Applies to every generated shift from this template"
            />
          </Field>
        </Card>

        {error && (
          <div className="bg-terracotta-400/10 border border-terracotta-400/30 text-terracotta-600 rounded-2xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3.5 rounded-2xl font-medium transition disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Create recurring template"}
        </button>
      </form>

      <section className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
        <div className="relative">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base text-ink-900">
                Existing templates
              </h2>
              <p className="text-xs text-ink-500">
                Generate upcoming shifts again anytime without creating duplicates.
              </p>
            </div>
            <button
              onClick={() => generateNow()}
              className="bg-cream-200 hover:bg-cream-200/70 text-ink-700 px-3 py-2 rounded-xl text-sm font-medium transition"
            >
              Generate due shifts
            </button>
          </div>

          {templates.length === 0 ? (
            <p className="text-sm text-ink-500">No recurring templates yet.</p>
          ) : (
            <ul className="space-y-3">
              {templates.map((template) => (
                <li key={template.id} className="border border-cream-200 rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink-900">
                        {template.clients?.full_name ?? "Client"} ·{" "}
                        {formatTimeLabel(template.start_time)} -{" "}
                        {formatTimeLabel(template.end_time)}
                      </p>
                      <p className="text-xs text-ink-500 mt-0.5">
                        {template.repeat_frequency === "daily"
                          ? "Daily"
                          : weekdaySummary(template.days_of_week)}{" "}
                        ·{" "}
                        {template.profiles?.full_name
                          ? template.profiles.full_name
                          : "Open shift"}
                      </p>
                      <p className="text-xs text-ink-500 mt-0.5">
                        Starts {formatDateLabel(template.start_date)}
                        {template.end_date
                          ? ` · ends ${formatDateLabel(template.end_date)}`
                          : " · no end date"}
                      </p>
                      {template.last_generated_through && (
                        <p className="text-xs text-ink-500 mt-0.5">
                          Generated through {formatDateLabel(template.last_generated_through)}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <StatusPill
                        tone={
                          !template.is_active
                            ? "muted"
                            : template.is_paused
                              ? "terracotta"
                              : "forest"
                        }
                        label={
                          !template.is_active
                            ? "Inactive"
                            : template.is_paused
                              ? "Paused"
                              : "Active"
                        }
                      />
                      <button
                        onClick={() => generateNow(template.id)}
                        className="text-xs text-forest-600 hover:underline"
                      >
                        Generate now
                      </button>
                    </div>
                  </div>

                  {template.notes && (
                    <p className="text-sm text-ink-700 mt-3">{template.notes}</p>
                  )}

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => toggleTemplate(template, "is_paused")}
                      className="flex-1 bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-2.5 rounded-xl text-sm font-medium transition"
                    >
                      {template.is_paused ? "Resume" : "Pause"}
                    </button>
                    <button
                      onClick={() => toggleTemplate(template, "is_active")}
                      className="flex-1 bg-white hover:bg-cream-50 border border-cream-200 text-ink-700 py-2.5 rounded-xl text-sm font-medium transition"
                    >
                      {template.is_active ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </main>
  );
}

function TogglePill({
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
      className={`py-2 rounded-lg text-sm font-medium transition ${
        active
          ? "bg-forest-600 text-cream-50"
          : "text-ink-500 hover:text-ink-900"
      }`}
    >
      {label}
    </button>
  );
}

function StatusPill({
  tone,
  label,
}: {
  tone: "forest" | "terracotta" | "muted";
  label: string;
}) {
  const styles = {
    forest: "bg-forest-100 text-forest-700",
    terracotta: "bg-terracotta-400/15 text-terracotta-600",
    muted: "bg-cream-200 text-ink-500",
  };
  return (
    <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-medium ${styles[tone]}`}>
      {label}
    </span>
  );
}

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

const inputCls =
  "w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition";

function formatDateLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTimeLabel(time: string) {
  return new Date(`1970-01-01T${time}`).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function weekdaySummary(days: number[]) {
  return WEEKDAY_OPTIONS.filter((day) => days.includes(day.value))
    .map((day) => day.label)
    .join(", ");
}
