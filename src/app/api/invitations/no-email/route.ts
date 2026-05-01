import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Role } from "@/lib/db-types";

type AdminProfile = {
  id: string;
  organization_id: string;
  role: Role;
};

type NoEmailInviteRequest = {
  fullName?: string;
  role?: Role;
  usernamePart?: string;
  password?: string;
  hourlyRate?: number | null;
};

const NO_EMAIL_ROLES: Role[] = ["admin", "caregiver", "client", "family"];

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, organization_id, role")
      .eq("id", user.id)
      .maybeSingle<AdminProfile>();

    if (!profile || profile.role !== "admin") {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const payload = (await request.json()) as NoEmailInviteRequest;
    const fullName = payload.fullName?.trim() ?? "";
    const usernamePart = payload.usernamePart?.trim().toLowerCase() ?? "";
    const password = payload.password ?? "";
    const role = payload.role;
    const hourlyRate = normalizeHourlyRate(payload.hourlyRate);

    if (!fullName) {
      return NextResponse.json({ error: "Full name is required." }, { status: 400 });
    }
    if (!role || !NO_EMAIL_ROLES.includes(role)) {
      return NextResponse.json({ error: "Role is invalid." }, { status: 400 });
    }
    if (role !== "caregiver" && hourlyRate !== null) {
      return NextResponse.json(
        { error: "Only caregivers can have an hourly rate." },
        { status: 400 }
      );
    }

    const cleanUser = usernamePart.replace(/[^a-z0-9]/g, "");
    if (cleanUser.length < 2) {
      return NextResponse.json(
        { error: "Username must be at least 2 letters or numbers." },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const placeholderEmail = `${cleanUser}@noemail.local`;

    const { data: invitation, error: invitationError } = await admin
      .from("invitations")
      .insert({
        organization_id: profile.organization_id,
        full_name: fullName,
        email: placeholderEmail,
        role,
        invited_by: profile.id,
        created_by: profile.id,
        caregiver_hourly_rate: role === "caregiver" ? hourlyRate : null,
        status: "pending",
      })
      .select("id")
      .single<{ id: string }>();

    if (invitationError || !invitation) {
      return NextResponse.json(
        { error: invitationError?.message ?? "Could not create invitation." },
        { status: 400 }
      );
    }

    const createdUser = await admin.auth.admin.createUser({
      email: placeholderEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (createdUser.error || !createdUser.data.user) {
      await admin.from("invitations").delete().eq("id", invitation.id);
      return NextResponse.json(
        {
          error: mapAuthCreationError(
            createdUser.error?.message ?? "Could not create account."
          ),
        },
        { status: 400 }
      );
    }

    const invitedUserId = createdUser.data.user.id;
    const acceptedAt = new Date().toISOString();

    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: invitedUserId,
        organization_id: profile.organization_id,
        role,
        full_name: fullName,
        email: placeholderEmail,
        phone: null,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      await rollbackNoEmailInvite(admin, invitation.id, invitedUserId);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    if (role === "caregiver" && hourlyRate !== null) {
      const today = new Date().toISOString().split("T")[0];
      const { data: existingRate, error: rateLookupError } = await admin
        .from("caregiver_rates")
        .select("id")
        .eq("caregiver_id", invitedUserId)
        .eq("effective_from", today)
        .limit(1)
        .maybeSingle<{ id: string }>();

      if (rateLookupError) {
        await rollbackNoEmailInvite(admin, invitation.id, invitedUserId);
        return NextResponse.json({ error: rateLookupError.message }, { status: 500 });
      }

      if (!existingRate) {
        const { error: rateInsertError } = await admin.from("caregiver_rates").insert({
          caregiver_id: invitedUserId,
          base_hourly_rate: hourlyRate,
          effective_from: today,
        });

        if (rateInsertError) {
          await rollbackNoEmailInvite(admin, invitation.id, invitedUserId);
          return NextResponse.json({ error: rateInsertError.message }, { status: 500 });
        }
      }
    }

    const { error: updateInvitationError } = await admin
      .from("invitations")
      .update({
        status: "accepted",
        accepted_by: invitedUserId,
        accepted_at: acceptedAt,
      })
      .eq("id", invitation.id);

    if (updateInvitationError) {
      await rollbackNoEmailInvite(admin, invitation.id, invitedUserId);
      return NextResponse.json(
        { error: updateInvitationError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      email: placeholderEmail,
      password,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service role configuration is missing.");
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function normalizeHourlyRate(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null;
  if (value < 0) {
    throw new Error("Hourly rate cannot be negative.");
  }
  return value;
}

function mapAuthCreationError(message: string) {
  return message.toLowerCase().includes("already")
    ? "That username is taken. Pick another."
    : message;
}

async function rollbackNoEmailInvite(
  admin: ReturnType<typeof createAdminClient>,
  invitationId: string,
  userId: string
) {
  await admin.from("invitations").delete().eq("id", invitationId);
  await admin.from("caregiver_rates").delete().eq("caregiver_id", userId);
  await admin.from("profiles").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId);
}
