import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RecurringTemplatesManager from "./recurring-templates-manager";

type RecurringTemplateRow = {
  id: string;
  client_id: string;
  caregiver_id: string | null;
  shift_type_id: string | null;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  start_date: string;
  end_date: string | null;
  repeat_frequency: "daily" | "weekly";
  is_active: boolean;
  is_paused: boolean;
  last_generated_through: string | null;
  notes: string | null;
  clients: { full_name: string } | null;
  profiles: { full_name: string } | null;
  shift_types: { name: string; color: string } | null;
};

export default async function RecurringSchedulePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single<{
      role: "admin" | "client" | "caregiver" | "family";
      organization_id: string;
    }>();

  if (!profile || profile.role !== "admin") {
    return (
      <main className="px-5 py-10 max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-8 shadow-soft text-center">
          <h1 className="font-display text-2xl mb-2">Not allowed</h1>
          <p className="text-ink-500 text-sm mb-5">
            Only administrators can manage recurring schedules.
          </p>
          <Link
            href="/schedule"
            className="inline-block bg-forest-600 hover:bg-forest-700 text-cream-50 px-5 py-2.5 rounded-2xl text-sm font-medium transition"
          >
            Back to schedule
          </Link>
        </div>
      </main>
    );
  }

  const [caregiversRes, shiftTypesRes, clientsRes, templatesRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "caregiver")
        .eq("is_active", true)
        .order("full_name"),
      supabase.from("shift_types").select("id, name, color").order("name"),
      supabase.from("clients").select("id, full_name").order("full_name"),
      supabase
        .from("recurring_shift_templates")
        .select(
          `
          id,
          client_id,
          caregiver_id,
          shift_type_id,
          days_of_week,
          start_time,
          end_time,
          start_date,
          end_date,
          repeat_frequency,
          is_active,
          is_paused,
          last_generated_through,
          notes,
          clients ( full_name ),
          profiles:caregiver_id ( full_name ),
          shift_types ( name, color )
        `
        )
        .eq("organization_id", profile.organization_id)
        .order("created_at", { ascending: false }),
    ]);

  return (
    <RecurringTemplatesManager
      organizationId={profile.organization_id}
      currentUserId={user.id}
      caregivers={caregiversRes.data ?? []}
      shiftTypes={shiftTypesRes.data ?? []}
      clients={clientsRes.data ?? []}
      templates={(templatesRes.data ?? []) as unknown as RecurringTemplateRow[]}
    />
  );
}
