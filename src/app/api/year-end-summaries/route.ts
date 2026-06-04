import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "client")) {
    return { error: NextResponse.json({ error: "Only administrators can manage year-end summaries." }, { status: 403 }) };
  }

  return { admin, profile };
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { admin, profile } = auth;

  const payload = await request.json().catch(() => null);
  if (!payload?.year) {
    return NextResponse.json({ error: "Missing year." }, { status: 400 });
  }

  const year = parseInt(payload.year, 10);
  const orgId = profile.organization_id;

  // 1. Fetch all caregivers in this organization
  const { data: caregivers } = await admin
    .from("profiles")
    .select("id")
    .eq("organization_id", orgId)
    .eq("role", "caregiver");

  if (!caregivers || caregivers.length === 0) {
    return NextResponse.json({ ok: true, message: "No caregivers found." });
  }

  // 2. Fetch all pay period snapshots for the selected year
  // In our schema, pay_periods has period_start and period_end.
  // We'll query snapshots that have a pay_period where period_end falls in the selected year.
  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year}-12-31T23:59:59.999Z`;

  const { data: snapshots } = await admin
    .from("pay_period_snapshots")
    .select(`
      id,
      caregiver_id,
      total_hours,
      total_amount,
      breakdown,
      pay_periods!inner ( period_end )
    `)
    .eq("pay_periods.organization_id", orgId)
    .gte("pay_periods.period_end", yearStart)
    .lte("pay_periods.period_end", yearEnd);

  const snapsByCaregiver = new Map<string, any[]>();
  for (const snap of snapshots ?? []) {
    const list = snapsByCaregiver.get(snap.caregiver_id) ?? [];
    list.push(snap);
    snapsByCaregiver.set(snap.caregiver_id, list);
  }

  const results = [];
  const autoReleaseDate = new Date(Date.UTC(year + 1, 0, 5, 0, 0, 0)); // Jan 5 of next year

  for (const cg of caregivers) {
    const cgSnaps = snapsByCaregiver.get(cg.id) ?? [];
    let hours = 0;
    let pay = 0;
    let bonus = 0;

    for (const snap of cgSnaps) {
      hours += Number(snap.total_hours ?? 0);
      pay += Number(snap.total_amount ?? 0);
      
      const breakdown = (snap.breakdown as any[]) ?? [];
      for (const shift of breakdown) {
        bonus += Number(shift.bonus_amount ?? 0);
      }
    }

    if (hours === 0 && pay === 0) continue; // No activity, skip

    // Insert/upsert year end summary
    const { data: summary, error: upsertError } = await admin
      .from("year_end_summaries")
      .upsert({
        caregiver_id: cg.id,
        organization_id: orgId,
        year,
        total_hours: hours,
        total_pay: pay,
        total_bonus: bonus,
        status: "active",
        voided_at: null,
        voided_by: null,
        void_reason: null,
        released_at: payload.released ? new Date().toISOString() : autoReleaseDate.toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "caregiver_id,year"
      })
      .select()
      .single();

    if (!upsertError) {
      results.push(summary);
    }
  }

  return NextResponse.json({ ok: true, summaries: results });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const { admin, profile } = auth;
  const payload = await request.json().catch(() => null);
  if (!payload?.summaryId || !payload.action) {
    return NextResponse.json({ error: "Missing summary ID or action." }, { status: 400 });
  }

  const { data: summary } = await admin
    .from("year_end_summaries")
    .select("id, organization_id")
    .eq("id", payload.summaryId)
    .maybeSingle();
  if (!summary || summary.organization_id !== profile.organization_id) {
    return NextResponse.json({ error: "Year-end summary not found." }, { status: 404 });
  }

  if (payload.action === "void") {
    if (payload.confirmation !== "CONFIRM") {
      return NextResponse.json({ error: "Type CONFIRM to delete this year-end summary." }, { status: 400 });
    }
    const { error } = await admin
      .from("year_end_summaries")
      .update({
        status: "deleted",
        voided_at: new Date().toISOString(),
        voided_by: profile.id,
        void_reason: payload.reason?.trim() || "Deleted by administrator",
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.summaryId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from("activity_logs").insert({
      organization_id: profile.organization_id,
      actor_id: profile.id,
      action_type: "delete_year_end_summary",
      shift_count: 0,
      metadata: { reason: payload.reason ?? null },
    });
    return NextResponse.json({ ok: true });
  }

  if (payload.action === "adjust") {
    const { error } = await admin
      .from("year_end_summaries")
      .update({
        status: "corrected",
        correction_note: payload.note?.trim() || null,
        adjusted_total_hours: payload.totalHours === "" || payload.totalHours == null ? null : Number(payload.totalHours),
        adjusted_total_pay: payload.totalPay === "" || payload.totalPay == null ? null : Number(payload.totalPay),
        adjusted_total_bonus: payload.totalBonus === "" || payload.totalBonus == null ? null : Number(payload.totalBonus),
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.summaryId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from("activity_logs").insert({
      organization_id: profile.organization_id,
      actor_id: profile.id,
      action_type: "adjust_year_end_summary",
      shift_count: 0,
      metadata: {
        summary_id: payload.summaryId,
        note: payload.note ?? null,
        adjusted_total_hours: payload.totalHours ?? null,
        adjusted_total_pay: payload.totalPay ?? null,
        adjusted_total_bonus: payload.totalBonus ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
}
