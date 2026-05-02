import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type LocationPingRequest = {
  shiftId: string;
  checkInId: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  distanceMeters: number | null;
  withinGeofence: boolean;
  recordedAt: string;
};

type CheckInLookup = {
  id: string;
  shift_id: string;
  caregiver_id: string;
  check_out_time: string | null;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = (await request.json()) as LocationPingRequest;
    if (
      !payload.shiftId ||
      !payload.checkInId ||
      typeof payload.latitude !== "number" ||
      typeof payload.longitude !== "number" ||
      typeof payload.withinGeofence !== "boolean" ||
      !payload.recordedAt
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: checkIn } = await admin
      .from("check_ins")
      .select("id, shift_id, caregiver_id, check_out_time")
      .eq("id", payload.checkInId)
      .maybeSingle<CheckInLookup>();

    if (
      !checkIn ||
      checkIn.shift_id !== payload.shiftId ||
      checkIn.caregiver_id !== user.id ||
      checkIn.check_out_time
    ) {
      return NextResponse.json({ error: "Active check-in not found" }, { status: 403 });
    }

    await admin.from("shift_location_pings").insert({
      shift_id: payload.shiftId,
      check_in_id: payload.checkInId,
      caregiver_id: user.id,
      recorded_at: payload.recordedAt,
      latitude: payload.latitude,
      longitude: payload.longitude,
      accuracy_meters: payload.accuracy,
      distance_meters: payload.distanceMeters,
      within_geofence: payload.withinGeofence,
    });

    await admin
      .from("check_ins")
      .update({
        last_location_at: payload.recordedAt,
        last_location_latitude: payload.latitude,
        last_location_longitude: payload.longitude,
        last_location_accuracy_meters: payload.accuracy,
        last_location_distance_meters: payload.distanceMeters,
        last_location_within_geofence: payload.withinGeofence,
      })
      .eq("id", payload.checkInId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Location ping failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
