import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/db-types";

type Action = "update_profile" | "send_password_reset";

type UserManagementRequest = {
  action?: Action;
  userId?: string;
  profile?: {
    fullName?: string;
    phone?: string | null;
    contactEmail?: string | null;
    bio?: string | null;
    vehicle1MakeModel?: string | null;
    vehicle1Color?: string | null;
    vehicle2MakeModel?: string | null;
    vehicle2Color?: string | null;
  };
};

type Profile = {
  id: string;
  organization_id: string;
  role: Role;
  email: string;
  contact_email: string | null;
  full_name: string;
  phone: string | null;
  bio: string | null;
  vehicle_1_make_model: string | null;
  vehicle_1_color: string | null;
  vehicle_2_make_model: string | null;
  vehicle_2_color: string | null;
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
      .select("id, organization_id, role, email, contact_email, full_name, phone, bio, vehicle_1_make_model, vehicle_1_color, vehicle_2_make_model, vehicle_2_color")
      .eq("id", user.id)
      .maybeSingle<Profile>();

    if (!actor || actor.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const payload = (await request.json()) as UserManagementRequest;
    const targetUserId = payload.userId ?? "";

    if (!targetUserId || !payload.action) {
      return NextResponse.json({ error: "A user and action are required." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: target } = await admin
      .from("profiles")
      .select("id, organization_id, role, email, contact_email, full_name, phone, bio, vehicle_1_make_model, vehicle_1_color, vehicle_2_make_model, vehicle_2_color")
      .eq("id", targetUserId)
      .maybeSingle<Profile>();

    if (!target || target.organization_id !== actor.organization_id) {
      return NextResponse.json(
        { error: "This user was not found in your care circle." },
        { status: 404 }
      );
    }

    if (payload.action === "update_profile") {
      return updateManagedProfile(admin, actor, target, payload.profile);
    }

    if (payload.action === "send_password_reset") {
      return sendPasswordReset(admin, actor, target, request);
    }

    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not complete user action.",
      },
      { status: 500 }
    );
  }
}

async function updateManagedProfile(
  admin: ReturnType<typeof createAdminClient>,
  actor: Profile,
  target: Profile,
  profile: UserManagementRequest["profile"]
) {
  const fullName = normalizeRequired(profile?.fullName, 120);
  if (!fullName) {
    return NextResponse.json({ error: "Display name is required." }, { status: 400 });
  }

  const contactEmail = normalizeOptional(profile?.contactEmail, 254);
  if (contactEmail && !isValidEmail(contactEmail)) {
    return NextResponse.json({ error: "Enter a valid contact email." }, { status: 400 });
  }

  const updates = {
    full_name: fullName,
    phone: normalizeOptional(profile?.phone, 40),
    contact_email: contactEmail,
    bio: normalizeOptional(profile?.bio, 1000),
    vehicle_1_make_model: normalizeOptional(profile?.vehicle1MakeModel, 160),
    vehicle_1_color: normalizeOptional(profile?.vehicle1Color, 80),
    vehicle_2_make_model: normalizeOptional(profile?.vehicle2MakeModel, 160),
    vehicle_2_color: normalizeOptional(profile?.vehicle2Color, 80),
    updated_at: new Date().toISOString(),
  };

  const { error } = await admin
    .from("profiles")
    .update(updates)
    .eq("id", target.id)
    .eq("organization_id", actor.organization_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logActivity(admin, actor, "managed_user_profile_updated", target, {
    updated_fields: Object.entries(updates)
      .filter(([key, value]) => key !== "updated_at" && value !== target[toProfileKey(key)])
      .map(([key]) => key),
  });

  return NextResponse.json({ ok: true });
}

async function sendPasswordReset(
  admin: ReturnType<typeof createAdminClient>,
  actor: Profile,
  target: Profile,
  request: Request
) {
  if (target.email.endsWith("@noemail.local")) {
    return NextResponse.json(
      { error: "This user does not have a login email." },
      { status: 400 }
    );
  }

  if (target.role === "admin" && target.id !== actor.id) {
    return NextResponse.json(
      { error: "Password resets for another administrator are not allowed here." },
      { status: 403 }
    );
  }

  const { error } = await admin.auth.resetPasswordForEmail(target.email, {
    redirectTo: buildAppUrl("/auth/reset-password", request),
  });

  if (error) {
    return NextResponse.json(
      { error: "Password reset email could not be sent. Please try again." },
      { status: 400 }
    );
  }

  await logActivity(admin, actor, "password_reset_sent", target, {
    target_email: target.email,
  });

  return NextResponse.json({ ok: true });
}

async function logActivity(
  admin: ReturnType<typeof createAdminClient>,
  actor: Profile,
  actionType: string,
  target: Profile,
  metadata: Record<string, unknown>
) {
  await admin.from("activity_logs").insert({
    organization_id: actor.organization_id,
    actor_id: actor.id,
    action_type: actionType,
    shift_count: 0,
    metadata: {
      target_user_id: target.id,
      target_role: target.role,
      ...metadata,
    },
  });
}

function normalizeRequired(value: string | null | undefined, maxLength: number) {
  const normalized = normalizeOptional(value, maxLength);
  return normalized && normalized.length > 0 ? normalized : null;
}

function normalizeOptional(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildAppUrl(path: string, request: Request) {
  const configured = normalizeOrigin(
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
  );
  const origin = configured ?? new URL(request.url).origin;
  return `${origin}${path.startsWith("/") ? path : `/${path}`}`;
}

function normalizeOrigin(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "localhost") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function toProfileKey(key: string): keyof Profile {
  const map: Record<string, keyof Profile> = {
    full_name: "full_name",
    phone: "phone",
    contact_email: "contact_email",
    bio: "bio",
    vehicle_1_make_model: "vehicle_1_make_model",
    vehicle_1_color: "vehicle_1_color",
    vehicle_2_make_model: "vehicle_2_make_model",
    vehicle_2_color: "vehicle_2_color",
  };
  return map[key] ?? "id";
}
