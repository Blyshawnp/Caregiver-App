import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: clientId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: actor } = await admin
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: string; organization_id: string }>();

  if (!actor || (actor.role !== "admin" && actor.role !== "client")) {
    return NextResponse.json({ error: "Only administrators or clients can configure emergency guides." }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Missing payload." }, { status: 400 });
  }

  const { error } = await admin
    .from("client_emergency_guides")
    .upsert({
      client_id: clientId,
      organization_id: actor.organization_id,
      enabled: payload.enabled ?? false,
      visible_to_caregivers: payload.visible_to_caregivers ?? true,
      visible_to_family: payload.visible_to_family ?? true,
      requires_acknowledgment: payload.requires_acknowledgment ?? false,
      medical_emergency_plan: payload.medical_emergency_plan || null,
      fall_plan: payload.fall_plan || null,
      fire_evacuation_plan: payload.fire_evacuation_plan || null,
      severe_weather_plan: payload.severe_weather_plan || null,
      power_outage_plan: payload.power_outage_plan || null,
      pet_evacuation_plan: payload.pet_evacuation_plan || null,
      supplies_location: payload.supplies_location || null,
      backup_contact_instructions: payload.backup_contact_instructions || null,
      mobility_equipment: payload.mobility_equipment || null,
      oxygen_fire_risk: payload.oxygen_fire_risk || null,
      access_notes: payload.access_notes || null,
      hospital_preference: payload.hospital_preference || null,
      other_instructions: payload.other_instructions || null,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: "client_id"
    });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
