import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export async function POST(request: Request) {
  const auth = await requireManager();
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as { label?: string } | null;
  const label = body?.label?.trim();
  if (!label) {
    return NextResponse.json({ error: "Category name is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const keyBase = slugify(label) || "category";
  let key = keyBase;
  for (let i = 2; i < 50; i += 1) {
    const { data: existing } = await admin
      .from("task_categories")
      .select("id")
      .eq("organization_id", auth.profile.organization_id)
      .eq("key", key)
      .maybeSingle();
    if (!existing) break;
    key = `${keyBase}_${i}`;
  }

  const { count } = await admin
    .from("task_categories")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", auth.profile.organization_id);

  const { error } = await admin.from("task_categories").insert({
    organization_id: auth.profile.organization_id,
    key,
    label,
    sort_order: ((count ?? 0) + 1) * 10,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const auth = await requireManager();
  if ("response" in auth) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    id?: string;
    label?: string;
  } | null;
  const label = body?.label?.trim();
  if (!body?.id || !label) {
    return NextResponse.json({ error: "Category id and name are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("task_categories")
    .update({ label })
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
    return { response: NextResponse.json({ error: "Only admins and clients can manage task categories." }, { status: 403 }) };
  }

  return { profile };
}
