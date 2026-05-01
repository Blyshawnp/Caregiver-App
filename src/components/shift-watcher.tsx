"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { haversineMeters, formatDistance } from "@/lib/geo";
import { sendNotificationEvent } from "@/lib/notify-client";

type ActiveWatch = {
  shift_id: string;
  caregiver_id: string;
  organization_id: string;
  scheduled_end: string;
  client_lat: number | null;
  client_lng: number | null;
  geofence_radius: number;
  client_name: string;
  check_in_id: string | null;
};

export type { ActiveWatch };

/**
 * Watches the caregiver's location while they're checked in. Behaviors:
 *
 *  1) Past their scheduled end time AND past 8pm → if they leave the geofence,
 *     auto-check them out using the geofence-leave time as their check-out
 *     timestamp. Notifies admin/client.
 *
 *  2) Before their scheduled end → just notify admin/client they left, but
 *     keep them checked in (might be a bathroom break, errand, etc).
 *
 *  3) Sticky reminder banner shown when past scheduled end OR past 8pm,
 *     suggesting check-out.
 *
 * Note: only runs while the caregiver has the app foregrounded. Server-side
 * cron would handle locked-phone scenarios; not yet implemented.
 */
export default function ShiftWatcher({
  active,
}: {
  active: ActiveWatch | null;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => new Date());
  const leftFenceFiredRef = useRef(false);
  const autoCheckedOutRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Geofence watcher
  useEffect(() => {
    if (!active) return;
    if (active.client_lat == null || active.client_lng == null) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    leftFenceFiredRef.current = false;
    autoCheckedOutRef.current = false;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        if (autoCheckedOutRef.current) return;

        const distance = haversineMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          active.client_lat as number,
          active.client_lng as number
        );

        const inside = distance <= active.geofence_radius;

        if (inside) {
          // Reset so a future leave will fire again
          if (distance <= active.geofence_radius * 0.9) {
            leftFenceFiredRef.current = false;
          }
          return;
        }

        // Outside fence
        if (leftFenceFiredRef.current) return;
        leftFenceFiredRef.current = true;

        // Decide: auto-checkout or just notify?
        const endTime = new Date(active.scheduled_end);
        const cutoff8pm = new Date();
        cutoff8pm.setHours(20, 0, 0, 0);
        const nowTime = new Date();
        const pastScheduled = nowTime > endTime;
        const past8pm = nowTime >= cutoff8pm;

        if (pastScheduled && past8pm) {
          // Auto-checkout
          autoCheckedOutRef.current = true;
          await performAutoCheckOut(active, distance, pos.coords);
          // Force a hard reload to refresh all state
          window.location.href = `/schedule/${active.shift_id}`;
        } else {
          // Just notify admin/client
          await notifyLeftGeofence(active, distance);
        }
      },
      () => {
        /* ignore errors; best effort */
      },
      {
        enableHighAccuracy: false,
        maximumAge: 60_000,
        timeout: 30_000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [active]);

  if (!active) return null;

  const scheduledEnd = new Date(active.scheduled_end);
  const cutoff8pm = new Date(now);
  cutoff8pm.setHours(20, 0, 0, 0);
  const pastScheduled = now > scheduledEnd;
  const past8pm = now >= cutoff8pm && now.getHours() >= 20;
  const showReminder = pastScheduled || past8pm;

  if (!showReminder) return null;

  return (
    <Link
      href={`/schedule/${active.shift_id}/check-out`}
      className="block bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 rounded-2xl px-5 py-4 mb-4 transition active:scale-[0.99]"
    >
      <p className="text-xs uppercase tracking-[0.18em] text-cream-50/70 mb-0.5">
        Reminder
      </p>
      <p className="font-medium">Time to check out</p>
      <p className="text-xs text-cream-50/80 mt-0.5">
        {pastScheduled
          ? "You're past your scheduled end. Tap to check out."
          : "It's past 8 PM. Tap to check out when you're ready."}
      </p>
      <p className="text-[10px] text-cream-50/70 mt-1.5">
        If you leave the location without checking out, you'll be checked out
        automatically.
      </p>
    </Link>
  );
}

async function performAutoCheckOut(
  active: ActiveWatch,
  distance: number,
  coords: GeolocationCoordinates
) {
  if (!active.check_in_id) return;
  const supabase = createClient();

  // Update check_in row with auto check-out info
  const update = {
    check_out_time: new Date().toISOString(),
    check_out_latitude: coords.latitude,
    check_out_longitude: coords.longitude,
    check_out_within_geofence: false,
    flagged_outside_geofence: true,
    flag_reason: `Auto-checked out: caregiver left geofence (${formatDistance(distance)} away) past scheduled end time`,
  };

  await supabase
    .from("check_ins")
    .update(update)
    .eq("id", active.check_in_id);

  await sendNotificationEvent({
    type: "auto_check_out",
    shiftId: active.shift_id,
    distanceMeters: distance,
  });
}

async function notifyLeftGeofence(active: ActiveWatch, distance: number) {
  await sendNotificationEvent({
    type: "left_geofence",
    shiftId: active.shift_id,
    distanceMeters: distance,
  });
}
