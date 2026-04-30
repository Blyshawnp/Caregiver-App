import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TemplatesList from "./templates-list";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single<{ role: "admin" | "client" | "caregiver" | "family"; organization_id: string }>();

  if (!profile || (profile.role === "caregiver" || profile.role === "family")) redirect("/tasks");

  const [templatesRes, caregiversRes] = await Promise.all([
    supabase
      .from("todo_templates")
      .select(
        "id, task_name, description, default_for_new_shifts, sort_order, is_active, caregiver_id, category"
      )
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("task_name", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", profile.organization_id)
      .eq("role", "caregiver")
      .eq("is_active", true)
      .order("full_name"),
  ]);

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href="/tasks"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back to tasks
        </Link>
        <h1 className="font-display text-3xl text-ink-900">Master tasks</h1>
        <p className="text-ink-500 text-sm">
          Build a master list. Defaults are added to every new shift. Tasks
          assigned to a specific caregiver only get added to that person's
          shifts.
        </p>
      </header>

      <TemplatesList
        templates={templatesRes.data ?? []}
        caregivers={caregiversRes.data ?? []}
        organizationId={profile.organization_id}
      />
    </main>
  );
}
