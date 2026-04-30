"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Caregiver = { id: string; full_name: string };
type ShiftType = { id: string; name: string; color: string };
type Client = { id: string; full_name: string };

type Shift = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  caregiver_id: string | null;
  client_id: string;
  shift_type_id: string | null;
  bonus_amount: number | null;
  bonus_reason: string | null;
  notes: string | null;
};

export default function EditShiftForm({
  shift,
  caregivers,
  shiftTypes,
  clients,
}: {
  shift: Shift;
  caregivers: Caregiver[];
  shiftTypes: ShiftType[];
  clients: Client[];
}) {
  const router = useRouter();

  const startDate = new Date(shift.scheduled_start);
  const endDate = new Date(shift.scheduled_end);

  const [date, setDate] = useState(formatDateLocal(startDate));
  const [startTime, setStartTime] = useState(formatTimeLocal(startDate));
  const [endTime, setEndTime] = useState(formatTimeLocal(endDate));
  const [clientId, setClientId] = useState(shift.client_id);
  const [caregiverId, setCaregiverId] = useState(shift.caregiver_id ?? "");
  const [shiftTypeId, setShiftTypeId] = useState(shift.shift_type_id ?? "");
  const [bonusAmount, setBonusAmount] = useState(
    shift.bonus_amount ? String(shift.bonus_amount) : ""
  );
  const [bonusReason, setBonusReason] = useState(shift.bonus_reason ?? "");
  const [notes, setNotes] = useState(shift.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const startISO = combineDateTime(date, startTime);
    const endISO = combineDateTime(date, endTime);
    if (!startISO || !endISO) {
      setError("Please pick a valid date and times.");
      return;
    }
    if (new Date(endISO) <= new Date(startISO)) {
      setError("End time must be after start time.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    // If caregiver changed, reset assignment status to pending
    const caregiverChanged = (caregiverId || null) !== shift.caregiver_id;
    const updates: {
      client_id: string;
      caregiver_id: string | null;
      shift_type_id: string | null;
      scheduled_start: string;
      scheduled_end: string;
      bonus_amount: number;
      bonus_reason: string | null;
      notes: string | null;
      assignment_status?: "pending" | null;
    } = {
      client_id: clientId,
      caregiver_id: caregiverId || null,
      shift_type_id: shiftTypeId || null,
      scheduled_start: startISO,
      scheduled_end: endISO,
      bonus_amount: bonusAmount ? Number(bonusAmount) : 0,
      bonus_reason: bonusReason || null,
      notes: notes || null,
    };
    if (caregiverChanged) {
      updates.assignment_status = caregiverId ? "pending" : null;
    }

    const { error } = await supabase
      .from("shifts")
      .update(updates)
      .eq("id", shift.id);

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    router.push(`/schedule/${shift.id}`);
    router.refresh();
  }

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href={`/schedule/${shift.id}`}
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back
        </Link>
        <h1 className="font-display text-3xl text-ink-900">Edit shift</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card title="When">
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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

        <Card title="Who & what">
          <Field label="Client">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
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
              <option value="">Unassigned</option>
              {caregivers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
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
              {shiftTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </Card>

        <Card title="Bonus & notes">
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
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
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
            href={`/schedule/${shift.id}`}
            className="flex-1 bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-3.5 rounded-2xl font-medium text-center transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-3.5 rounded-2xl font-medium transition disabled:opacity-50 active:scale-[0.99]"
          >
            {submitting ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </main>
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

function formatTimeLocal(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function combineDateTime(date: string, time: string) {
  if (!date || !time) return null;
  const local = new Date(`${date}T${time}`);
  if (isNaN(local.getTime())) return null;
  return local.toISOString();
}
