import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, organization_id")
      .eq("id", user.id)
      .single<{ id: string; role: string; organization_id: string }>();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Secure Check: Only admins and clients can delete shifts in the private app.
    if (profile.role !== "admin" && profile.role !== "client") {
      return NextResponse.json(
        { error: "You do not have permission to delete shifts." },
        { status: 403 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      shiftId?: string;
      shiftIds?: string[];
      reason?: string;
    } | null;

    const shiftId = body?.shiftId;
    const shiftIds = body?.shiftIds ?? (shiftId ? [shiftId] : []);
    const reason = body?.reason;

    if (shiftIds.length === 0) {
      return NextResponse.json(
        { error: "No shifts specified for deletion." },
        { status: 400 }
      );
    }

    // Secure Deletion of shifts belonging to the actor's organization
    const { error: deleteError } = await admin
      .from("shifts")
      .delete()
      .in("id", shiftIds)
      .eq("organization_id", profile.organization_id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    // Log the deletion to activity_logs
    await admin.from("activity_logs").insert({
      organization_id: profile.organization_id,
      actor_id: user.id,
      action_type: shiftIds.length === 1 ? "delete_shift" : "bulk_delete_shifts",
      shift_count: shiftIds.length,
      reason: reason || null,
      metadata: { shift_ids: shiftIds },
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "An unexpected error occurred." },
      { status: 500 }
    );
  }
}
