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
    incidentId?: string;
    action?: "resolve" | "archive";
  } | null;

  if (!body?.incidentId || !body.action) {
    return NextResponse.json({ error: "Missing incident action." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: actor, error: actorError } = await admin
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single<{ id: string; role: string; organization_id: string }>();

  if (actorError || !actor) {
    return NextResponse.json({ error: "Profile not found." }, { status: 403 });
  }

  const { data: incident, error: incidentError } = await admin
    .from("incidents")
    .select("id, organization_id, reported_by, status")
    .eq("id", body.incidentId)
    .single<{
      id: string;
      organization_id: string;
      reported_by: string;
      status: string;
    }>();

  if (incidentError || !incident) {
    return NextResponse.json({ error: incidentError?.message ?? "Incident not found." }, { status: 404 });
  }

  if (incident.organization_id !== actor.organization_id) {
    return NextResponse.json({ error: "Incident belongs to another organization." }, { status: 403 });
  }

  if (body.action === "resolve") {
    const canResolve = actor.role === "admin" || incident.reported_by === actor.id;
    if (!canResolve) {
      return NextResponse.json({ error: "You cannot resolve this incident." }, { status: 403 });
    }

    const { error } = await admin
      .from("incidents")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        resolved_by: actor.id,
      })
      .eq("id", incident.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  if (actor.role !== "admin") {
    return NextResponse.json({ error: "Only admins can archive incidents." }, { status: 403 });
  }

  const { error } = await admin
    .from("incidents")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: actor.id,
    })
    .eq("id", incident.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
