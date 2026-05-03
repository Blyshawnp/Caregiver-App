import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sendPushForNotifications } from "@/lib/web-push";

type IncidentPayload = {
  shiftId?: string | null;
  clientId?: string | null;
  title: string;
  description: string;
  severity?: "low" | "medium" | "high" | "urgent";
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json()) as IncidentPayload;
  const title = payload.title?.trim();
  const description = payload.description?.trim();
  const severity = payload.severity ?? "medium";

  if (!title || !description) {
    return NextResponse.json({ error: "Title and description are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: reporter } = await admin
    .from("profiles")
    .select("id, full_name, role, organization_id")
    .eq("id", user.id)
    .maybeSingle<{
      id: string;
      full_name: string;
      role: "admin" | "client" | "caregiver" | "family";
      organization_id: string;
    }>();

  if (!reporter) {
    return NextResponse.json({ error: "Profile not found" }, { status: 403 });
  }

  let clientId = payload.clientId ?? null;
  if (payload.shiftId) {
    const { data: shift } = await admin
      .from("shifts")
      .select("id, organization_id, caregiver_id, client_id")
      .eq("id", payload.shiftId)
      .maybeSingle<{
        id: string;
        organization_id: string;
        caregiver_id: string | null;
        client_id: string | null;
      }>();

    if (!shift || shift.organization_id !== reporter.organization_id) {
      return NextResponse.json({ error: "Shift not found." }, { status: 404 });
    }
    if (reporter.role === "caregiver" && shift.caregiver_id !== reporter.id) {
      return NextResponse.json({ error: "You can only report incidents for your shifts." }, { status: 403 });
    }
    clientId = shift.client_id ?? clientId;
  }

  const { data: incident, error } = await admin
    .from("incidents")
    .insert({
      organization_id: reporter.organization_id,
      shift_id: payload.shiftId ?? null,
      client_id: clientId,
      reported_by: reporter.id,
      severity,
      title,
      description,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !incident) {
    return NextResponse.json({ error: error?.message ?? "Could not create incident." }, { status: 500 });
  }

  const { data: recipients } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", reporter.organization_id)
    .eq("is_active", true)
    .neq("id", reporter.id)
    .in("role", ["admin", "client", "family"]);

  const rows = (recipients ?? []).map((recipient) => ({
    organization_id: reporter.organization_id,
    recipient_id: recipient.id,
    kind: severity === "urgent" ? "incident_urgent" : "incident_reported",
    title: severity === "urgent" ? "Urgent incident reported" : "Incident reported",
    body: `${reporter.full_name}: ${title}`,
    link: `/incidents?incident=${incident.id}`,
  }));

  if (rows.length > 0) {
    await admin.from("notifications").insert(rows);
    void sendPushForNotifications(admin, rows).catch(() => {});
  }

  return NextResponse.json({ id: incident.id });
}
