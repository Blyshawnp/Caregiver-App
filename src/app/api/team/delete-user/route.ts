import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/db-types";

type DeleteUserRequest = {
  userId?: string;
};

type Profile = {
  id: string;
  organization_id: string;
  role: Role;
  email: string;
  full_name: string;
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

    const { data: actor } = await supabase
      .from("profiles")
      .select("id, organization_id, role, email, full_name")
      .eq("id", user.id)
      .maybeSingle<Profile>();

    if (!actor || actor.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const payload = (await request.json()) as DeleteUserRequest;
    const targetUserId = payload.userId ?? "";

    if (!targetUserId) {
      return NextResponse.json({ error: "A user is required." }, { status: 400 });
    }

    if (targetUserId === actor.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account while signed in." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: target } = await admin
      .from("profiles")
      .select("id, organization_id, role, email, full_name")
      .eq("id", targetUserId)
      .maybeSingle<Profile>();

    if (!target || target.organization_id !== actor.organization_id) {
      return NextResponse.json(
        { error: "This user was not found in your organization." },
        { status: 404 }
      );
    }

    const error = await deleteUserAppData(admin, target.id, target.organization_id);
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    const { error: profileError } = await admin
      .from("profiles")
      .delete()
      .eq("id", target.id)
      .eq("organization_id", target.organization_id);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const { error: authError } = await admin.auth.admin.deleteUser(target.id);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not delete user.",
      },
      { status: 500 }
    );
  }
}

async function deleteUserAppData(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  organizationId: string
) {
  const operations = [
    admin.from("checkout_flags").delete().eq("caregiver_id", userId),
    admin.from("shift_location_pings").delete().eq("caregiver_id", userId),
    admin.from("check_ins").delete().eq("caregiver_id", userId),
    admin.from("caregiver_rates").delete().eq("caregiver_id", userId),
    admin.from("push_subscriptions").delete().eq("user_id", userId),
    admin.from("notification_preferences").delete().eq("user_id", userId),
    admin.from("notifications").delete().eq("recipient_id", userId),
    admin.from("messages").delete().or(`sender_id.eq.${userId},recipient_id.eq.${userId}`),
    admin.from("incidents").delete().eq("reported_by", userId),
    admin.from("incidents").update({ resolved_by: null }).eq("resolved_by", userId),
    admin.from("incidents").update({ archived_by: null }).eq("archived_by", userId),
    admin.from("shift_proposals").delete().eq("caregiver_id", userId),
    admin.from("shift_proposals").update({ approved_by: null }).eq("approved_by", userId),
    admin.from("shift_proposals").update({ rejected_by: null }).eq("rejected_by", userId),
    admin.from("shift_proposals").update({ canceled_by: null }).eq("canceled_by", userId),
    admin.from("shift_proposals").update({ created_by: null }).eq("created_by", userId),
    admin.from("shift_todos").update({ completed_by: null }).eq("completed_by", userId),
    admin.from("todo_templates").delete().eq("caregiver_id", userId),
    admin.from("recurring_shift_templates").delete().eq("caregiver_id", userId),
    admin.from("invitations").delete().eq("accepted_by", userId),
    admin.from("invitations").update({ invited_by: null }).eq("invited_by", userId),
    admin.from("invitations").update({ created_by: null }).eq("created_by", userId),
    admin
      .from("shifts")
      .update({
        caregiver_id: null,
        assignment_status: null,
        is_released: false,
        released_by: null,
        release_reason: null,
      })
      .eq("organization_id", organizationId)
      .eq("caregiver_id", userId),
    admin
      .from("shifts")
      .update({ released_by: null, release_reason: null })
      .eq("organization_id", organizationId)
      .eq("released_by", userId),
  ];

  for (const operation of operations) {
    const { error } = await operation;
    if (error) return error.message;
  }

  return null;
}
