"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  getCurrentPosition,
  haversineMeters,
  formatDistance,
} from "@/lib/geo";
import { MapPinIcon, ClockIcon } from "@/components/icons";

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

type Todo = { id: string; task_name: string; is_completed: boolean };

type Status =
  | { kind: "init" }
  | { kind: "locating" }
  | { kind: "denied" }
  | {
      kind: "located";
      coords: { latitude: number; longitude: number };
      distance: number | null;
      withinFence: boolean;
    }
  | { kind: "submitting" }
  | { kind: "error"; message: string };

export default function CheckOutForm({
  shift,
  checkInId,
  checkInTime,
  todos,
}: {
  shift: Shift;
  checkInId: string;
  checkInTime: string;
  todos: Todo[];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "init" });
  const [confirmingFlag, setConfirmingFlag] = useState(false);
  const [confirmingIncomplete, setConfirmingIncomplete] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const incomplete = todos.filter((t) => !t.is_completed);

  useEffect(() => {
    void runLocate();
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
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

    setStatus({
      kind: "located",
      coords: { latitude: coords.latitude, longitude: coords.longitude },
      distance,
      withinFence,
    });
  }

  async function submitCheckOut(force = false) {
    // Soft warning for incomplete tasks
    if (incomplete.length > 0 && !confirmingIncomplete && !force) {
      setConfirmingIncomplete(true);
      return;
    }

    // Geofence flag warning
    if (
      status.kind === "located" &&
      !status.withinFence &&
      !confirmingFlag &&
      !force
    ) {
      setConfirmingFlag(true);
      return;
    }

    setStatus({ kind: "submitting" });
    const supabase = createClient();

    const flagged =
      status.kind === "denied" ||
      (status.kind === "located" && !status.withinFence);
    const flagReason =
      status.kind === "denied"
        ? "Location permission denied at check-out"
        : status.kind === "located" && !status.withinFence
          ? `Checked out ${formatDistance(status.distance ?? 0)} from client`
          : null;

    const update: any = {
      check_out_time: new Date().toISOString(),
    };
    if (status.kind === "located") {
      update.check_out_latitude = status.coords.latitude;
      update.check_out_longitude = status.coords.longitude;
      update.check_out_within_geofence = status.withinFence;
    } else {
      update.check_out_within_geofence = false;
    }
    // Don't overwrite the check-in flag if it was already flagged
    if (flagged) {
      update.flagged_outside_geofence = true;
      update.flag_reason = flagReason;
    }

    const { error } = await supabase
      .from("check_ins")
      .update(update)
      .eq("id", checkInId);

    if (error) {
      setStatus({ kind: "error", message: error.message });
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
            admins.map((a) => ({
              organization_id: shift.organization_id,
              recipient_id: a.id,
              kind: "check_out_flagged",
              title: "Flagged check-out",
              body: flagReason ?? "A caregiver checked out outside the geofence.",
              link: `/schedule/${shift.id}`,
              related_shift_id: shift.id,
            }))
          );
        }
      } catch {
        /* best effort */
      }
    }

    window.location.href = `/schedule/${shift.id}`;
  }

  const checkInDate = new Date(checkInTime);
  const elapsedMs = now.getTime() - checkInDate.getTime();
  const elapsedMin = Math.max(0, Math.floor(elapsedMs / 60_000));
  const hours = Math.floor(elapsedMin / 60);
  const mins = elapsedMin % 60;

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <Link
        href={`/schedule/${shift.id}`}
        className="text-sm text-forest-600 hover:underline mb-3 inline-block"
      >
        ← Back to shift
      </Link>

      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">Check out</h1>
        <p className="text-ink-500 text-sm">{shift.clients.full_name}</p>
      </header>

      {/* Time worked card */}
      <section className="bg-forest-600 text-cream-50 rounded-3xl p-6 mb-4 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-cream-50/10 blur-2xl"
        />
        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <ClockIcon size={18} className="opacity-80" />
            <p className="text-xs uppercase tracking-[0.2em] text-cream-50/70">
              Time worked
            </p>
          </div>
          <p className="font-display text-5xl leading-none">
            {hours > 0 ? `${hours}h ${mins}m` : `${mins} min`}
          </p>
          <p className="text-sm text-cream-50/70 mt-1.5">
            Started {formatTime(checkInDate)}
          </p>
        </div>
      </section>

      {/* Tasks summary */}
      {todos.length > 0 && (
        <section className="bg-white rounded-3xl shadow-soft p-5 mb-4 grain-overlay">
          <div className="relative">
            <div className="flex justify-between items-baseline mb-2">
              <h2 className="font-display text-base">Tasks</h2>
              <span className="text-sm text-ink-500">
                {todos.length - incomplete.length} / {todos.length} complete
              </span>
            </div>
            {incomplete.length > 0 ? (
              <p className="text-sm text-ink-700">
                <span className="font-medium text-terracotta-600">
                  {incomplete.length} incomplete
                </span>
                {" — "}you can still check out, but unfinished tasks will stay marked
                as incomplete.
              </p>
            ) : (
              <p className="text-sm text-forest-600">All tasks complete</p>
            )}
            <Link
              href="/tasks"
              className="text-sm text-forest-600 font-medium hover:underline mt-2 inline-block"
            >
              View tasks
            </Link>
          </div>
        </section>
      )}

      {/* Location status */}
      <section className="bg-white rounded-3xl shadow-soft p-5 mb-4 grain-overlay">
        <div className="relative">
          {status.kind === "init" || status.kind === "locating" ? (
            <p className="flex items-center gap-2 text-ink-500 text-sm">
              <MapPinIcon size={18} className="text-forest-500" />
              Finding your location...
            </p>
          ) : status.kind === "denied" ? (
            <p className="flex items-start gap-2 text-sm text-ink-700">
              <MapPinIcon
                size={18}
                className="text-terracotta-600 mt-0.5 shrink-0"
              />
              <span>
                Location not available. Check-out will be flagged for review.{" "}
                <button
                  onClick={runLocate}
                  className="text-forest-600 font-medium hover:underline"
                >
                  Try again
                </button>
              </span>
            </p>
          ) : status.kind === "located" ? (
            <p className="flex items-start gap-2 text-sm text-ink-700">
              <MapPinIcon
                size={18}
                className={`mt-0.5 shrink-0 ${
                  status.withinFence ? "text-forest-500" : "text-terracotta-600"
                }`}
              />
              <span>
                {status.withinFence
                  ? "You're at the client's location"
                  : `Outside the location · ${formatDistance(status.distance ?? 0)} away`}
              </span>
            </p>
          ) : null}
        </div>
      </section>

      {/* Confirmation banners */}
      {confirmingIncomplete && (
        <div className="bg-terracotta-400/10 border border-terracotta-400/30 rounded-2xl p-4 mb-4 text-sm">
          <p className="font-medium text-terracotta-600 mb-1">
            {incomplete.length} unfinished task
            {incomplete.length === 1 ? "" : "s"}
          </p>
          <p className="text-ink-700 mb-3">
            Check out anyway? You can still come back to update tasks later.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmingIncomplete(false)}
              className="flex-1 bg-white hover:bg-cream-50 text-ink-700 py-2.5 rounded-xl text-sm font-medium transition"
            >
              Keep working
            </button>
            <button
              onClick={() => {
                setConfirmingIncomplete(false);
                void submitCheckOut(false);
              }}
              className="flex-1 bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition"
            >
              Check out anyway
            </button>
          </div>
        </div>
      )}

      {confirmingFlag && status.kind === "located" && !status.withinFence && (
        <div className="bg-terracotta-400/10 border border-terracotta-400/30 rounded-2xl p-4 mb-4 text-sm">
          <p className="font-medium text-terracotta-600 mb-1">
            Outside the client's location
          </p>
          <p className="text-ink-700 mb-3">
            Checking out from {formatDistance(status.distance ?? 0)} away will
            flag this shift for review. Continue?
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
                void submitCheckOut(true);
              }}
              className="flex-1 bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition"
            >
              Check out anyway
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
        {!confirmingIncomplete && !confirmingFlag && (
          <button
            onClick={() => submitCheckOut(false)}
            disabled={
              status.kind === "submitting" ||
              status.kind === "init" ||
              status.kind === "locating"
            }
            className="block w-full bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 py-3.5 rounded-2xl font-medium text-center transition active:scale-[0.99] disabled:opacity-60"
          >
            {status.kind === "submitting"
              ? "Checking out..."
              : "Check out now"}
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

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
