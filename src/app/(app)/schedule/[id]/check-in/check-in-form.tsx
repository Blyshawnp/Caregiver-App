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

type LocatedStatus = {
  kind: "located";
  coords: { latitude: number; longitude: number; accuracy: number };
  distance: number | null;
  withinFence: boolean;
};

type SubmittableStatus = LocatedStatus | { kind: "denied" };

type Status =
  | { kind: "init" }
  | { kind: "locating" }
  | { kind: "denied" }
  | LocatedStatus
  | { kind: "submitting"; previous: SubmittableStatus }
  | { kind: "error"; message: string; previous?: SubmittableStatus };

export default function CheckInForm({ shift }: { shift: Shift }) {
  const [status, setStatus] = useState<Status>({ kind: "init" });
  const [confirmingFlag, setConfirmingFlag] = useState(false);

  useEffect(() => {
    void runLocate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runLocate() {
    setConfirmingFlag(false);
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
    if (status.kind === "submitting") return;

    const currentStatus =
      status.kind === "located" || status.kind === "denied"
        ? status
        : status.kind === "error" && status.previous
          ? status.previous
          : null;

    if (!currentStatus) return;

    if (
      currentStatus.kind === "located" &&
      !currentStatus.withinFence &&
      !force
    ) {
      setConfirmingFlag(true);
      return;
    }

    setConfirmingFlag(false);
    setStatus({ kind: "submitting", previous: currentStatus });

    const supabase = createClient();

    const flagged =
      currentStatus.kind === "denied" ||
      (currentStatus.kind === "located" && !currentStatus.withinFence);

    const flagReason =
      currentStatus.kind === "denied"
        ? "Location permission denied"
        : currentStatus.kind === "located" && !currentStatus.withinFence
          ? `Checked in ${formatDistance(currentStatus.distance ?? 0)} from client (radius ${shift.clients.geofence_radius_meters}m)`
          : null;

    const checkInRow: Record<string, unknown> = {
      shift_id: shift.id,
      caregiver_id: shift.caregiver_id,
      check_in_time: new Date().toISOString(),
      flagged_outside_geofence: flagged,
      flag_reason: flagReason,
      check_out_time: null,
      check_out_latitude: null,
      check_out_longitude: null,
      check_out_within_geofence: null,
    };

    if (currentStatus.kind === "located") {
      checkInRow.check_in_latitude = currentStatus.coords.latitude;
      checkInRow.check_in_longitude = currentStatus.coords.longitude;
      checkInRow.check_in_within_geofence = currentStatus.withinFence;
    } else {
      checkInRow.check_in_within_geofence = false;
    }

    const { data: writtenRows, error } = await supabase
      .from("check_ins")
      .upsert(checkInRow, { onConflict: "shift_id" })
      .select("id");

    if (error) {
      setStatus({
        kind: "error",
        message: error.message,
        previous: currentStatus,
      });
      return;
    }

    if (!writtenRows || writtenRows.length === 0) {
      setStatus({
        kind: "error",
        message:
          "Check-in did not save. Your account may not have permission. Try refreshing or contact the admin.",
        previous: currentStatus,
      });
      return;
    }

    if (flagged) {
      try {
        const { data: admins } = await supabase
          .from("profiles")
          .select("id")
          .eq("organization_id", shift.organization_id)
          .eq("role", "admin");

        if (admins && admins.length > 0) {
          await supabase.from("notifications").insert(
            admins.map((admin) => ({
              organization_id: shift.organization_id,
              recipient_id: admin.id,
              kind: "check_in_flagged",
              title: "Flagged check-in",
              body: flagReason ?? "A caregiver checked in outside the geofence.",
              link: `/schedule/${shift.id}`,
              related_shift_id: shift.id,
            }))
          );
        }
      } catch {
        // Notifications are best effort. Do not block check-in.
      }
    }

    window.location.href = `/schedule/${shift.id}`;
  }

  const start = new Date(shift.scheduled_start);
  const noClientCoords =
    shift.clients.latitude == null || shift.clients.longitude == null;

  const canSubmit =
    (status.kind === "located" || status.kind === "denied") && !confirmingFlag;

  const isSubmitting = status.kind === "submitting";

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
          ) : status.kind === "submitting" ? (
            status.previous.kind === "located" ? (
              <LocatedState
                status={status.previous}
                clientName={shift.clients.full_name}
                clientAddress={shift.clients.address}
                radius={shift.clients.geofence_radius_meters}
                noCoords={noClientCoords}
              />
            ) : (
              <DeniedState onRetry={runLocate} />
            )
          ) : status.kind === "error" && status.previous?.kind === "located" ? (
            <LocatedState
              status={status.previous}
              clientName={shift.clients.full_name}
              clientAddress={shift.clients.address}
              radius={shift.clients.geofence_radius_meters}
              noCoords={noClientCoords}
            />
          ) : status.kind === "error" && status.previous?.kind === "denied" ? (
            <DeniedState onRetry={runLocate} />
          ) : null}
        </div>
      </section>

      {confirmingFlag && status.kind === "located" && !status.withinFence && (
        <div className="bg-terracotta-400/10 border border-terracotta-400/30 rounded-2xl p-4 mb-4 text-sm">
          <p className="font-medium text-terracotta-600 mb-1">
            Outside the client's location
          </p>
          <p className="text-ink-700 mb-3">
            You're {formatDistance(status.distance ?? 0)} away. Checking in here
            will flag this shift for the admin to review. Continue anyway?
          </p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmingFlag(false)}
              className="flex-1 bg-white hover:bg-cream-50 text-ink-700 py-2.5 rounded-xl text-sm font-medium transition"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => void submitCheckIn(true)}
              className="flex-1 bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition"
            >
              Check in anyway
            </button>
          </div>
        </div>
      )}

      {status.kind === "error" && (
        <div className="bg-terracotta-400/10 border border-terracotta-400/30 text-terracotta-600 rounded-2xl px-4 py-3 text-sm mb-4">
          {status.message}
        </div>
      )}

      <div className="space-y-2">
        {canSubmit && (
          <button
            type="button"
            onClick={() => void submitCheckIn(false)}
            className="block w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3.5 rounded-2xl font-medium text-center transition active:scale-[0.99]"
          >
            Check in now
          </button>
        )}

        {isSubmitting && (
          <button
            type="button"
            disabled
            className="block w-full bg-forest-600 text-cream-50 py-3.5 rounded-2xl font-medium text-center opacity-70 cursor-not-allowed"
          >
            Checking in...
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
        Allow location access if your browser asks.
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
        type="button"
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
  status: LocatedStatus;
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
          The client's geofence is not configured yet, so we cannot verify that
          you are on-site. Check-in will proceed normally.
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