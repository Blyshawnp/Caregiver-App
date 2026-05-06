import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export async function POST(request: Request) {
  const auth = await requireManager();
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    name?: string;
    color?: string;
  } | null;
  const name = body?.name?.trim();
  const color = body?.color?.trim() || "#0D6587";

  if (!name) {
    return NextResponse.json({ error: "Shift type name is required." }, { status: 400 });
  }
  if (!HEX_RE.test(color)) {
    return NextResponse.json({ error: "Color must be a hex value like #0D6587." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("shift_types").insert({
    organization_id: auth.profile.organization_id,
    name,
    color,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const auth = await requireManager();
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    name?: string;
    color?: string;
  } | null;
  const name = body?.name?.trim();
  const color = body?.color?.trim();

  if (!body?.id || !name) {
    return NextResponse.json({ error: "Shift type id and name are required." }, { status: 400 });
  }
  if (color && !HEX_RE.test(color)) {
    return NextResponse.json({ error: "Color must be a hex value like #0D6587." }, { status: 400 });
  }

  const admin = createAdminClient();
  const update: { name: string; color?: string } = { name };
  if (color) update.color = color;

  const { error } = await admin
    .from("shift_types")
    .update(update)
    .eq("id", body.id)
    .eq("organization_id", auth.profile.organization_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

async function requireManager() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single<{ id: string; role: string; organization_id: string }>();

  if (!profile || (profile.role !== "admin" && profile.role !== "client")) {
    return { response: NextResponse.json({ error: "Only admins and clients can manage shift types." }, { status: 403 }) };
  }

  return { profile };
}
