import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    proposalId?: string;
  } | null;
  if (!body?.proposalId) {
    return NextResponse.json({ error: "Missing proposalId." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: actor, error: actorError } = await admin
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single<{ id: string; role: string; organization_id: string }>();

  if (actorError || !actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Only admins can approve proposals." }, { status: 403 });
  }

  const { data: proposal, error: proposalError } = await admin
    .from("shift_proposals")
    .select("id, organization_id, caregiver_id, client_id, scheduled_start, scheduled_end, notes, status, shift_id")
    .eq("id", body.proposalId)
    .single<{
      id: string;
      organization_id: string;
      caregiver_id: string;
      client_id: string | null;
      scheduled_start: string;
      scheduled_end: string;
      notes: string | null;
      status: string;
      shift_id: string | null;
    }>();

  if (proposalError || !proposal) {
    return NextResponse.json({ error: proposalError?.message ?? "Proposal not found." }, { status: 404 });
  }
  if (proposal.organization_id !== actor.organization_id) {
    return NextResponse.json({ error: "Proposal belongs to another organization." }, { status: 403 });
  }
  if (proposal.status !== "pending") {
    return NextResponse.json({ error: `Proposal is already ${proposal.status}.` }, { status: 409 });
  }

  let shiftId = proposal.shift_id;
  if (!shiftId) {
    const { data: existingShift } = await admin
      .from("shifts")
      .select("id")
      .eq("source_proposal_id", proposal.id)
      .maybeSingle<{ id: string }>();

    shiftId = existingShift?.id ?? null;
  }

  if (!shiftId) {
    const { data: shift, error: shiftError } = await admin
      .from("shifts")
      .insert({
        organization_id: proposal.organization_id,
        client_id: proposal.client_id,
        caregiver_id: proposal.caregiver_id,
        scheduled_start: proposal.scheduled_start,
        scheduled_end: proposal.scheduled_end,
        notes: proposal.notes,
        assignment_status: "accepted",
        created_by: actor.id,
        source_proposal_id: proposal.id,
      })
      .select("id")
      .single<{ id: string }>();

    if (shiftError || !shift) {
      return NextResponse.json(
        { error: shiftError?.message ?? "Could not create shift from proposal." },
        { status: 500 }
      );
    }
    shiftId = shift.id;
  }

  const { error: updateError } = await admin
    .from("shift_proposals")
    .update({
      status: "approved",
      approved_by: actor.id,
      approved_at: new Date().toISOString(),
      shift_id: shiftId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", proposal.id)
    .eq("status", "pending");

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, shiftId });
}
