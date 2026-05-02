"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentPosition,
  haversineMeters,
  formatDistance,
} from "@/lib/geo";
import { MapPinIcon } from "@/components/icons";
import { sendNotificationEvent } from "@/lib/notify-client";

type Shift = {
  id: string;
  caregiver_id: string;
  organization_id: string;
  scheduled_start: string;
  scheduled_end: string;
  clients: {
    full_name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    geofence_radius_meters: number;
  };
};

type Status =
  | { kind: "init" }
  | { kind: "locating" }
  | { kind: "denied" }
  | {
      kind: "located";
      coords: { latitude: number; longitude: number; accuracy: number };
      distance: number | null;
      withinFence: boolean;
    };

export default function CheckInForm({ shift }: { shift: Shift }) {
  const [status, setStatus] = useState<Status>({ kind: "init" });
  const [confirmingFlag, setConfirmingFlag] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Auto-request location on mount
  useEffect(() => {
    void runLocate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runLocate() {
    setStatus({ kind: "locating" });
    const coords = await getCurrentPosition();

    if (!coords) {
      setStatus({ kind: "denied" });
      return;
    }

    let distance: number | null = null;
    let withinFence = true;

    if (shift.clients.latitude != null && shift.clients.longitude != null) {
      distance = haversineMeters(
        coords.latitude,
        coords.longitude,
        shift.clients.latitude,
        shift.clients.longitude
      );
      withinFence = distance <= shift.clients.geofence_radius_meters;
    }

    setStatus({ kind: "located", coords, distance, withinFence });
  }

  async function submitCheckIn(force = false) {
    // Guard: only proceed from located or denied state
    if (status.kind !== "located" && status.kind !== "denied") return;
    // Guard: prevent double-submit
    if (submitting) return;

    if (status.kind === "located" && !status.withinFence && !force) {
      setConfirmingFlag(true);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    const supabase = createClient();

    const flagged =
      status.kind === "denied" ||
      (status.kind === "located" && !status.withinFence);
    const flagReason =
      status.kind === "denied"
        ? "Location permission denied"
        : status.kind === "located" && !status.withinFence
          ? `Checked in ${formatDistance(status.distance ?? 0)} from client (radius ${shift.clients.geofence_radius_meters}m)`
          : null;

    const checkInRow: {
      shift_id: string;
      caregiver_id: string;
      check_in_time: string;
      check_in_latitude?: number;
      check_in_longitude?: number;
      check_in_within_geofence: boolean;
      flagged_outside_geofence: boolean;
      flag_reason: string | null;
      check_out_time: null;
      check_out_latitude: null;
      check_out_longitude: null;
      check_out_within_geofence: null;
      check_out_method: null;
      check_out_by: null;
      last_location_at?: string;
      last_location_latitude?: number;
      last_location_longitude?: number;
      last_location_accuracy_meters?: number;
      last_location_distance_meters?: number | null;
      last_location_within_geofence?: boolean;
    } = {
      shift_id: shift.id,
      caregiver_id: shift.caregiver_id,
      check_in_time: new Date().toISOString(),
      check_in_within_geofence: false,
      flagged_outside_geofence: flagged,
      flag_reason: flagReason,
      // Reset check-out fields in case there's a stale row
      check_out_time: null,
      check_out_latitude: null,
      check_out_longitude: null,
      check_out_within_geofence: null,
      check_out_method: null,
      check_out_by: null,
    };

    if (status.kind === "located") {
      checkInRow.check_in_latitude = status.coords.latitude;
      checkInRow.check_in_longitude = status.coords.longitude;
      checkInRow.check_in_within_geofence = status.withinFence;
      checkInRow.last_location_at = new Date().toISOString();
      checkInRow.last_location_latitude = status.coords.latitude;
      checkInRow.last_location_longitude = status.coords.longitude;
      checkInRow.last_location_accuracy_meters = status.coords.accuracy;
      checkInRow.last_location_distance_meters = status.distance ?? null;
      checkInRow.last_location_within_geofence = status.withinFence;
    }

    // Upsert: if a check_ins row already exists for this shift, update it.
    // .select() forces the row back so we can confirm it actually wrote
    // (RLS can silently block writes and return success otherwise).
    const { data: writtenRows, error } = await supabase
      .from("check_ins")
      .upsert(checkInRow, { onConflict: "shift_id" })
      .select("id");

    if (error) {
      setSubmitError(error.message);
      setSubmitting(false);
      return;
    }
    if (!writtenRows || writtenRows.length === 0) {
      setSubmitError(
        "Check-in did not save. Your account may not have permission. Try refreshing or contact the admin."
      );
      setSubmitting(false);
      return;
    }

    if (flagged) {
      void sendNotificationEvent({
        type: "check_in_flagged",
        shiftId: shift.id,
        flagReason,
      });
    }

    // Hard navigation to bypass any cached data on the shift detail page.
    // router.push + refresh can race in some Next.js versions; this is bulletproof.
    // Hard navigation with cache-buster so we never serve a stale page
    // showing the "not yet started" state.
    window.location.href = `/schedule/${shift.id}?refreshed=${Date.now()}`;
  }

  const start = new Date(shift.scheduled_start);
  const noClientCoords =
    shift.clients.latitude == null || shift.clients.longitude == null;

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <Link
        href={`/schedule/${shift.id}`}
        className="text-sm text-forest-600 hover:underline mb-3 inline-block"
      >
        ← Back to shift
      </Link>

      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">Check in</h1>
        <p className="text-ink-500 text-sm">
          {shift.clients.full_name} · {formatTime(start)}
        </p>
      </header>

      {/* Map-pin status card */}
      <section className="bg-white rounded-3xl shadow-soft p-6 mb-4 grain-overlay">
        <div className="relative">
          {status.kind === "init" || status.kind === "locating" ? (
            <LocatingState />
          ) : status.kind === "denied" ? (
            <DeniedState onRetry={runLocate} />
          ) : status.kind === "located" ? (
            <LocatedState
              status={status}
              clientName={shift.clients.full_name}
              clientAddress={shift.clients.address}
              radius={shift.clients.geofence_radius_meters}
              noCoords={noClientCoords}
            />
          ) : null}
        </div>
      </section>

      {/* Confirmation banner for outside-fence */}
      {confirmingFlag && status.kind === "located" && !status.withinFence && (
        <div className="bg-terracotta-400/10 border border-terracotta-400/30 rounded-2xl p-4 mb-4 text-sm">
          <p className="font-medium text-terracotta-600 mb-1">
            Outside the client's location
          </p>
          <p className="text-ink-700 mb-3">
            You're {formatDistance(status.distance ?? 0)} away. Checking in
            here will flag this shift for the admin to review. Continue anyway?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmingFlag(false)}
              className="flex-1 bg-white hover:bg-cream-50 text-ink-700 py-2.5 rounded-xl text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setConfirmingFlag(false);
                void submitCheckIn(true);
              }}
              className="flex-1 bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition"
            >
              Check in anyway
            </button>
          </div>
        </div>
      )}

      {submitError && (
        <div className="bg-terracotta-400/10 border border-terracotta-400/30 text-terracotta-600 rounded-2xl px-4 py-3 text-sm mb-4">
          {submitError}
        </div>
      )}

      <div className="space-y-2">
        {(status.kind === "located" || status.kind === "denied") &&
          !confirmingFlag && (
            <button
              onClick={() => submitCheckIn(false)}
              disabled={submitting}
              className="block w-full bg-forest-600 hover:bg-forest-700 disabled:opacity-70 text-cream-50 py-3.5 rounded-2xl font-medium text-center transition active:scale-[0.99]"
            >
              {submitting ? "Checking in..." : "Check in now"}
            </button>
          )}
        <Link
          href={`/schedule/${shift.id}`}
          className="block w-full bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-3.5 rounded-2xl font-medium text-center transition"
        >
          Cancel
        </Link>
      </div>
    </main>
  );
}

function LocatingState() {
  return (
    <div className="text-center py-4">
      <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-forest-100 grid place-items-center text-forest-600">
        <MapPinIcon size={28} />
      </div>
      <p className="font-display text-lg mb-1">Finding your location...</p>
      <p className="text-sm text-ink-500">
        Allow location access if your browser asks
      </p>
    </div>
  );
}

function DeniedState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-2">
      <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-terracotta-400/15 grid place-items-center text-terracotta-600">
        <MapPinIcon size={28} />
      </div>
      <p className="font-display text-lg mb-1">Location not available</p>
      <p className="text-sm text-ink-500 mb-3">
        You can still check in, but it will be flagged for the admin to review.
      </p>
      <button
        onClick={onRetry}
        className="text-sm text-forest-600 font-medium hover:underline"
      >
        Try again
      </button>
    </div>
  );
}

function LocatedState({
  status,
  clientName,
  clientAddress,
  radius,
  noCoords,
}: {
  status: Extract<Status, { kind: "located" }>;
  clientName: string;
  clientAddress: string | null;
  radius: number;
  noCoords: boolean;
}) {
  if (noCoords) {
    return (
      <div className="text-center py-2">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-cream-200 grid place-items-center text-ink-500">
          <MapPinIcon size={28} />
        </div>
        <p className="font-display text-lg mb-1">Location set</p>
        <p className="text-sm text-ink-500">
          The client's geofence isn't configured yet, so we can't verify you're
          on-site. Check-in will proceed normally.
        </p>
      </div>
    );
  }

  const within = status.withinFence;
  return (
    <div className="text-center py-2">
      <div
        className={`w-14 h-14 mx-auto mb-3 rounded-2xl grid place-items-center ${
          within
            ? "bg-forest-600 text-cream-50"
            : "bg-terracotta-400/15 text-terracotta-600"
        }`}
      >
        <MapPinIcon size={28} />
      </div>
      <p className="font-display text-lg mb-1">
        {within ? "You're at the right spot" : "Outside the location"}
      </p>
      <p className="text-sm text-ink-500 mb-2">
        {clientAddress && (
          <span className="block mb-0.5">{clientAddress}</span>
        )}
        <span className="text-xs">
          {status.distance != null && (
            <>
              {formatDistance(status.distance)} from {clientName} · radius{" "}
              {radius}m
            </>
          )}
        </span>
      </p>
    </div>
  );
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
