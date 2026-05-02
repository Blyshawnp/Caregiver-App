import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/lib/db-types";

type PasswordResetRequest = {
  userId?: string;
  password?: string;
};

type Profile = {
  id: string;
  organization_id: string;
  role: Role;
  email: string;
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
      .select("id, organization_id, role, email")
      .eq("id", user.id)
      .maybeSingle<Profile>();

    if (!actor || actor.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const payload = (await request.json()) as PasswordResetRequest;
    const userId = payload.userId ?? "";
    const password = payload.password ?? "";

    if (!userId || password.length < 8) {
      return NextResponse.json(
        { error: "A user and password of at least 8 characters are required." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: target } = await admin
      .from("profiles")
      .select("id, organization_id, role, email")
      .eq("id", userId)
      .maybeSingle<Profile>();

    if (
      !target ||
      target.organization_id !== actor.organization_id ||
      !target.email.endsWith("@noemail.local")
    ) {
      return NextResponse.json(
        { error: "This no-email account was not found in your organization." },
        { status: 404 }
      );
    }

    const { error } = await admin.auth.admin.updateUserById(target.id, {
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not update password.",
      },
      { status: 500 }
    );
  }
}
