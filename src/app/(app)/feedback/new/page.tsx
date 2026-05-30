import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import FeedbackForm from "./feedback-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewFeedbackPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single<{ id: string; role: string; organization_id: string }>();

  if (!profile) redirect("/login");

  if (profile.role === "caregiver") {
    redirect("/home");
  }

  // Fetch all active caregivers in the organization
  const { data: caregiversData } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("organization_id", profile.organization_id)
    .eq("role", "caregiver")
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  // Fetch all clients in the organization
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("organization_id", profile.organization_id)
    .order("full_name", { ascending: true });

  const caregivers = (caregiversData ?? []).map((c) => ({
    id: c.id,
    name: c.full_name,
  }));

  const clients = (clientsData ?? []).map((c) => ({
    id: c.id,
    name: c.full_name,
  }));

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-5">
        <Link href="/home" className="text-sm text-forest-600 hover:underline mb-2 inline-block">
          ← Back
        </Link>
        <h1 className="font-display text-3xl text-ink-900">Feedback</h1>
        <p className="text-ink-500 text-sm">
          Submit appreciation, feedback, or concerns about a caregiver.
        </p>
      </header>

      <FeedbackForm caregivers={caregivers} clients={clients} />
    </main>
  );
}
