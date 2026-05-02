"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
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
 *  1) Persist last-known location while on shift so a server-side cron can
 *     make the auto-checkout decision after 8 PM without requiring the tab.
 *
 *  2) Before their scheduled end → just notify admin/client they left, but
 *     keep them checked in (might be a bathroom break, errand, etc).
 *
 *  3) Sticky reminder banner shown when past scheduled end OR past 8pm,
 *     suggesting check-out.
 *
 * Note: geolocation collection still depends on the device sharing location.
 * The checkout decision itself now runs on the server.
 */
export default function ShiftWatcher({
  active,
}: {
  active: ActiveWatch | null;
}) {
  const [now, setNow] = useState(() => new Date());
  const leftFenceFiredRef = useRef(false);
  const lastPingAtRef = useRef(0);

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
    lastPingAtRef.current = 0;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const distance = haversineMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          active.client_lat as number,
          active.client_lng as number
        );

        const inside = distance <= active.geofence_radius;

        const nowMs = Date.now();
        if (nowMs - lastPingAtRef.current >= 120_000 || !inside) {
          lastPingAtRef.current = nowMs;
          void persistLocationPing(active, distance, inside, pos.coords);
        }

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

        await notifyLeftGeofence(active, distance);
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
        If you leave the location after 8 PM, the server can auto-check you out
        based on your last known geofence ping.
      </p>
    </Link>
  );
}

async function persistLocationPing(
  active: ActiveWatch,
  distance: number,
  withinGeofence: boolean,
  coords: GeolocationCoordinates
) {
  if (!active.check_in_id) return;
  await fetch("/api/shift-location", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      shiftId: active.shift_id,
      checkInId: active.check_in_id,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy ?? null,
      distanceMeters: distance,
      withinGeofence,
      recordedAt: new Date().toISOString(),
    }),
  });
}

async function notifyLeftGeofence(active: ActiveWatch, distance: number) {
  await sendNotificationEvent({
    type: "left_geofence",
    shiftId: active.shift_id,
    distanceMeters: distance,
  });
}
