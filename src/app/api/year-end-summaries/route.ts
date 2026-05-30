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

  const admin = createAdminClient();

  // Fetch profiles role and org
  const { data: profile } = await admin
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "admin" && profile.role !== "client")) {
    return NextResponse.json({ error: "Only administrators can generate year-end summaries." }, { status: 403 });
  }

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
