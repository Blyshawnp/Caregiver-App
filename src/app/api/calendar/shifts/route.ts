import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ShiftRow = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  caregiver_id: string | null;
  assignment_status: string | null;
  clients: { full_name: string | null; address: string | null } | null;
};

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single<{ id: string; role: string }>();
  if (!profile) return NextResponse.json({ error: "Profile not found." }, { status: 403 });

  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
  const allMine = url.searchParams.get("all") === "mine";

  let query = supabase
    .from("shifts")
    .select("id, scheduled_start, scheduled_end, caregiver_id, assignment_status, clients(full_name, address)")
    .gte("scheduled_end", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .order("scheduled_start", { ascending: true });

  if (ids.length > 0) {
    query = query.in("id", ids);
  } else if (allMine && profile.role === "caregiver") {
    query = query.eq("caregiver_id", profile.id);
  } else if (!allMine) {
    return NextResponse.json({ error: "Select shifts to export." }, { status: 400 });
  }

  const { data, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const shifts = ((data ?? []) as unknown as ShiftRow[]).filter(
    (shift) => profile.role !== "caregiver" || shift.caregiver_id === profile.id
  );
  if (shifts.length === 0) {
    return NextResponse.json({ error: "No shifts available to export." }, { status: 404 });
  }

  const ics = buildIcs(shifts, profile.role);
  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="care-shifts-${new Date().toISOString().slice(0, 10)}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}

function buildIcs(shifts: ShiftRow[], role: string) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Carer Vista Pro//Care Shifts//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  for (const shift of shifts) {
    const canShowClient = role !== "caregiver" || shift.caregiver_id;
    const clientName = canShowClient ? shift.clients?.full_name : null;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escapeIcs(shift.id)}@carer-vista-pro`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(new Date(shift.scheduled_start))}`,
      `DTEND:${formatIcsDate(new Date(shift.scheduled_end))}`,
      `SUMMARY:${escapeIcs(clientName ? `Care shift with ${clientName}` : "Care shift")}`,
      `DESCRIPTION:${escapeIcs(`Carer Vista Pro shift. Status: ${shift.assignment_status ?? "scheduled"}. Shift tracking number: ${shift.id}`)}`
    );
    if (canShowClient && shift.clients?.address) {
      lines.push(`LOCATION:${escapeIcs(shift.clients.address)}`);
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}
