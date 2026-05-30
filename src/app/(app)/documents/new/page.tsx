import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DocumentUploadForm from "./document-upload-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewDocumentPage() {
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

  if (!profile || profile.role !== "admin") {
    redirect("/documents");
  }

  // Fetch all clients in the organization
  const { data: clientsData } = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("organization_id", profile.organization_id)
    .order("full_name", { ascending: true });

  // Fetch all active profiles in the organization
  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("organization_id", profile.organization_id)
    .eq("is_active", true)
    .order("full_name", { ascending: true });

  const clients = (clientsData ?? []).map((c) => ({
    id: c.id,
    name: c.full_name,
  }));

  const profiles = (profilesData ?? []).map((p) => ({
    id: p.id,
    name: p.full_name,
    role: p.role,
  }));

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-5">
        <Link href="/documents" className="text-sm text-forest-600 hover:underline mb-2 inline-block">
          ← Back to Documents
        </Link>
        <h1 className="font-display text-3xl text-ink-900">Upload PDF</h1>
        <p className="text-ink-500 text-sm">
          Publish agreements, care plans, or policies with visibility controls and print approvals.
        </p>
      </header>

      <DocumentUploadForm clients={clients} profiles={profiles} orgId={profile.organization_id} />
    </main>
  );
}
