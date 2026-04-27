"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { haversineMeters, formatDistance } from "@/lib/geo";

type ActiveWatch = {
  shift_id: string;
  caregiver_id: string;
  organization_id: string;
  scheduled_end: string;
  client_lat: number | null;
  client_lng: number | null;
  geofence_radius: number;
  client_name: string;
};

/**
 * Renders a sticky reminder banner when:
 *   - The caregiver is checked in
 *   - It's past 8 PM (or past scheduled end), suggesting time to check out
 *
 * Also watches the caregiver's location while checked in and notifies admin/client
 * when the caregiver leaves the geofence (one notification per leave event).
 *
 * Note: this runs only while the app is open in a foreground tab. For
 * always-on detection (closed app, locked phone), a server-side cron would be
 * needed (Supabase Edge Functions or similar).
 */
export default function ShiftWatcher({
  active,
}: {
  active: ActiveWatch | null;
}) {
  const [now, setNow] = useState(() => new Date());
  const leftFenceFiredRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Geofence-leave watcher
  useEffect(() => {
    if (!active) return;
    if (active.client_lat == null || active.client_lng == null) return;
    if (typeof window === "undefined" || !("geolocation" in navigator)) return;

    leftFenceFiredRef.current = false;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const distance = haversineMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          active.client_lat as number,
          active.client_lng as number
        );

        if (distance > active.geofence_radius && !leftFenceFiredRef.current) {
          leftFenceFiredRef.current = true;
          await notifyAdminsAndClients(active, distance);
        }
        // If they come back inside, allow another notification on next leave
        if (distance <= active.geofence_radius * 0.9) {
          leftFenceFiredRef.current = false;
        }
      },
      () => {
        // ignore errors; geofence watching is best-effort
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
    </Link>
  );
}

async function notifyAdminsAndClients(
  active: ActiveWatch,
  distance: number
) {
  const supabase = createClient();

  // Find admins + clients in this org
  const { data: recipients } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", active.organization_id)
    .in("role", ["admin", "client"]);

  if (!recipients || recipients.length === 0) return;

  // Get caregiver name for the body
  const { data: caregiver } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", active.caregiver_id)
    .maybeSingle<{ full_name: string }>();

  const name = caregiver?.full_name ?? "A caregiver";
  const body = `${name} left the geofence (${formatDistance(distance)} from ${active.client_name}) without checking out yet.`;

  await supabase.from("notifications").insert(
    recipients.map((r) => ({
      organization_id: active.organization_id,
      recipient_id: r.id,
      kind: "left_geofence",
      title: "Caregiver left location",
      body,
      link: `/schedule/${active.shift_id}`,
      related_shift_id: active.shift_id,
    }))
  );
}
