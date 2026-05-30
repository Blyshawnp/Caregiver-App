import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PetPayload = {
  id?: string;
  name: string;
  pet_type: string;
  sex?: "Male" | "Female" | "Unknown" | null;
  spayed_neutered?: "Yes" | "No" | "Unknown" | null;
  photo_url?: string | null;
  feeding_instructions?: string | null;
  medication_instructions?: string | null;
  behavior_notes?: string | null;
  emergency_notes?: string | null;
  supplies_location?: string | null;
  vet_name?: string | null;
  vet_phone?: string | null;
  emergency_vet_phone?: string | null;
  microchip_number?: string | null;
  vaccine_info?: string | null;
  show_to_caregivers?: boolean;
};

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
    return NextResponse.json({ error: "Only administrators or clients can configure pet records." }, { status: 403 });
  }

  const payload = (await request.json().catch(() => null)) as { pets?: PetPayload[] } | null;
  if (!payload?.pets) {
    return NextResponse.json({ error: "Missing pets list." }, { status: 400 });
  }

  // Validate pets
  for (const pet of payload.pets) {
    if (!pet.name?.trim()) {
      return NextResponse.json({ error: "Pet name is required." }, { status: 400 });
    }
    const isDogOrCat = pet.pet_type === "Dog" || pet.pet_type === "Cat";
    if (isDogOrCat) {
      if (!pet.sex) {
        return NextResponse.json({ error: `Sex is required for dog/cat: ${pet.name}.` }, { status: 400 });
      }
      if (!pet.spayed_neutered) {
        return NextResponse.json({ error: `Spayed/neutered status is required for dog/cat: ${pet.name}.` }, { status: 400 });
      }
    }
  }

  // Transaction-like sync: Delete existing pets and insert new list
  const { error: deleteError } = await admin
    .from("client_pets")
    .delete()
    .eq("client_id", clientId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (payload.pets.length > 0) {
    const insertRows = payload.pets.map((pet) => ({
      client_id: clientId,
      organization_id: actor.organization_id,
      name: pet.name.trim(),
      pet_type: pet.pet_type,
      sex: pet.sex || null,
      spayed_neutered: pet.spayed_neutered || null,
      photo_url: pet.photo_url || null,
      feeding_instructions: pet.feeding_instructions || null,
      medication_instructions: pet.medication_instructions || null,
      behavior_notes: pet.behavior_notes || null,
      emergency_notes: pet.emergency_notes || null,
      supplies_location: pet.supplies_location || null,
      vet_name: pet.vet_name || null,
      vet_phone: pet.vet_phone || null,
      emergency_vet_phone: pet.emergency_vet_phone || null,
      microchip_number: pet.microchip_number || null,
      vaccine_info: pet.vaccine_info || null,
      show_to_caregivers: pet.show_to_caregivers ?? true,
    }));

    const { error: insertError } = await admin
      .from("client_pets")
      .insert(insertRows);

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
