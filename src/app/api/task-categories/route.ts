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

export async function DELETE(request: Request) {
  const auth = await requireManager();
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const reassignTo = searchParams.get("reassignTo") || "other";

  if (!id) {
    return NextResponse.json({ error: "Category id is required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: category } = await admin
    .from("task_categories")
    .select("key, organization_id")
    .eq("id", id)
    .eq("organization_id", auth.profile.organization_id)
    .maybeSingle();

  if (!category) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  // Reassign the templates in todo_templates
  const { error: templateError } = await admin
    .from("todo_templates")
    .update({ category: reassignTo })
    .eq("organization_id", auth.profile.organization_id)
    .eq("category", category.key);

  if (templateError) {
    return NextResponse.json({ error: templateError.message }, { status: 500 });
  }

  // Reassign the shift todos in shift_todos
  const { error: shiftTodoError } = await admin
    .from("shift_todos")
    .update({ category: reassignTo })
    .eq("category", category.key);

  // Mark category as inactive
  const { error: deleteError } = await admin
    .from("task_categories")
    .update({ is_active: false })
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

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
