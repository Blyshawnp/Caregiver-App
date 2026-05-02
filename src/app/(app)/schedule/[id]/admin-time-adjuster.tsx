"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { sendNotificationEvent } from "@/lib/notify-client";

type Props = {
  shiftId: string;
  caregiverId: string | null;
  caregiverName: string;
  organizationId: string;
  actorId: string;
  scheduledStart: string;
  scheduledEnd: string;
  // Existing check-in row, if any
  existing: {
    id: string;
    check_in_time: string | null;
    check_out_time: string | null;
  } | null;
};

/**
 * Admin/client tool for managing check-in/out timestamps:
 *  - Create a check-in if none exists (caregiver forgot)
 *  - Adjust existing check-in or check-out times
 *  - Reason note required for any manual edit (audit trail)
 */
export default function AdminTimeAdjuster({
  shiftId,
  caregiverId,
  caregiverName,
  organizationId,
  actorId,
  scheduledStart,
  scheduledEnd,
  existing,
}: Props) {
  const [open, setOpen] = useState(false);
  const [checkInTime, setCheckInTime] = useState(
    existing?.check_in_time
      ? toLocalInputValue(existing.check_in_time)
      : toLocalInputValue(scheduledStart)
  );
  const [checkOutTime, setCheckOutTime] = useState(
    existing?.check_out_time
      ? toLocalInputValue(existing.check_out_time)
      : ""
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No caregiver assigned → can't create a check-in row
  if (!caregiverId) return null;

  async function save() {
    setError(null);

    if (!reason.trim()) {
      setError("A reason note is required for manual time edits.");
      return;
    }
    if (!checkInTime) {
      setError("Check-in time is required.");
      return;
    }

    const checkInISO = new Date(checkInTime).toISOString();
    const checkOutISO = checkOutTime
      ? new Date(checkOutTime).toISOString()
      : null;

    if (checkOutISO && new Date(checkOutISO) <= new Date(checkInISO)) {
      setError("Check-out must be after check-in.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    const flagReason = `Manually adjusted by admin: ${reason.trim()}`;

    if (existing) {
      // Update existing check_in row
      const update: {
        check_in_time: string;
        check_out_time: string | null;
        check_out_method: string | null;
        check_out_by: string | null;
        flagged_outside_geofence: boolean;
        flag_reason: string;
      } = {
        check_in_time: checkInISO,
        check_out_time: checkOutISO,
        check_out_method: checkOutISO ? "admin_manual" : null,
        check_out_by: checkOutISO ? actorId : null,
        flagged_outside_geofence: true,
        flag_reason: flagReason,
      };

      const { data, error: updateError } = await supabase
        .from("check_ins")
        .update(update)
        .eq("id", existing.id)
        .select("id");

      if (updateError) {
        setError(updateError.message);
        setSubmitting(false);
        return;
      }
      if (!data || data.length === 0) {
        setError(
          "Update did not save. Your account may not have permission."
        );
        setSubmitting(false);
        return;
      }
    } else {
      // Insert new check_in row (caregiver never checked in)
      // Use upsert on shift_id so if a row was created in the meantime
      // (e.g. caregiver checked in just now, or stale page), we update it
      // instead of failing on the unique constraint.
      const upsertRow: {
        shift_id: string;
        caregiver_id: string;
        check_in_time: string;
        check_out_time: string | null;
        check_out_method: string | null;
        check_out_by: string | null;
        check_in_within_geofence: boolean;
        check_out_within_geofence: boolean | null;
        flagged_outside_geofence: boolean;
        flag_reason: string;
      } = {
        shift_id: shiftId,
        caregiver_id: caregiverId as string,
        check_in_time: checkInISO,
        check_out_time: checkOutISO,
        check_out_method: checkOutISO ? "admin_manual" : null,
        check_out_by: checkOutISO ? actorId : null,
        check_in_within_geofence: false,
        check_out_within_geofence: checkOutISO ? false : null,
        flagged_outside_geofence: true,
        flag_reason: flagReason,
      };

      const { data, error: upsertError } = await supabase
        .from("check_ins")
        .upsert(upsertRow, { onConflict: "shift_id" })
        .select("id");

      if (upsertError) {
        setError(upsertError.message);
        setSubmitting(false);
        return;
      }
      if (!data || data.length === 0) {
        setError("Save did not complete. Try refreshing.");
        setSubmitting(false);
        return;
      }
    }

    void sendNotificationEvent({
      type: "time_adjusted",
      shiftId,
      reason,
    });

    window.location.href = `/schedule/${shiftId}`;
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="block w-full bg-white hover:bg-cream-50 text-ink-700 border border-cream-200 py-3 rounded-2xl font-medium text-center transition shadow-soft text-sm"
      >
        {existing
          ? existing.check_in_time && !existing.check_out_time
            ? "Manually check out / adjust times"
            : "Adjust check-in / check-out times"
          : "Manually check in caregiver"}
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft p-5 grain-overlay">
      <div className="relative">
        <p className="text-sm font-medium text-ink-900 mb-1">
          {existing
            ? `Adjust ${caregiverName.split(" ")[0]}'s shift times`
            : `Manually check in ${caregiverName.split(" ")[0]}`}
        </p>
        <p className="text-xs text-ink-500 mb-4">
          Use this when {caregiverName.split(" ")[0]} forgot to check in or out, or
          when their times need correcting. Edits are logged with your reason note.
        </p>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
            Check-in time
          </span>
          <input
            type="datetime-local"
            value={checkInTime}
            onChange={(e) => setCheckInTime(e.target.value)}
            className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
          />
        </label>

        <label className="block mb-3">
          <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
            Check-out time{" "}
            <span className="text-ink-400 normal-case">(leave blank if still on shift)</span>
          </span>
          <input
            type="datetime-local"
            value={checkOutTime}
            onChange={(e) => setCheckOutTime(e.target.value)}
            className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
          />
        </label>

        <label className="block mb-4">
          <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
            Reason <span className="text-terracotta-600 normal-case">(required)</span>
          </span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Forgot to check in; arrived 8:05 AM"
            maxLength={200}
            className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
          />
        </label>

        {error && (
          <p className="text-terracotta-600 text-xs mb-3">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            disabled={submitting}
            className="flex-1 bg-white hover:bg-cream-50 text-ink-700 border border-cream-200 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={submitting}
            className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>

        <p className="text-[10px] text-ink-400 mt-3 text-center">
          Scheduled: {formatTime(new Date(scheduledStart))} –{" "}
          {formatTime(new Date(scheduledEnd))}
        </p>
      </div>
    </div>
  );
}

/**
 * Convert an ISO datetime to the format <input type="datetime-local"> expects:
 *   "YYYY-MM-DDTHH:mm" in LOCAL time (no timezone suffix).
 */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
