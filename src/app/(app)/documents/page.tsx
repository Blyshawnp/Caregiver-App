import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import DocumentItem from "./document-item";
import PrintRequestsList from "./print-requests-list";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DocType = {
  id: string;
  title: string;
  description: string | null;
  document_type: string;
  visibility: string;
  requires_acknowledgment: boolean;
  requires_print_approval: boolean;
  expiration_date: string | null;
  storage_path: string;
};

type PrintRequestRow = {
  id: string;
  document_id: string;
  requested_by: string;
  requested_at: string;
  status: string;
  reason: string | null;
  documents: { title: string } | null;
  profiles: { full_name: string } | null;
};

export default async function DocumentsDashboardPage() {
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

  const isAdmin = profile.role === "admin";

  // Fetch documents matching visibility constraints (RLS handles this perfectly)
  const { data: documentsData } = await supabase
    .from("documents")
    .select(`
      id,
      title,
      description,
      document_type,
      visibility,
      requires_acknowledgment,
      requires_print_approval,
      expiration_date,
      storage_path
    `)
    .order("created_at", { ascending: false });

  const documents = (documentsData ?? []) as unknown as DocType[];

  // Fetch current user's acknowledgments
  const { data: acksData } = await supabase
    .from("document_acknowledgments")
    .select("document_id, acknowledged_at")
    .eq("acknowledged_by", profile.id);

  const acknowledgmentsMap: Record<string, string> = {};
  (acksData ?? []).forEach((ack) => {
    acknowledgmentsMap[ack.document_id] = ack.acknowledged_at;
  });

  // Fetch print requests
  let printRequests: PrintRequestRow[] = [];
  if (isAdmin) {
    // Admin sees all requested prints
    const { data: adminReqs } = await supabase
      .from("document_print_requests")
      .select(`
        id,
        document_id,
        requested_by,
        requested_at,
        status,
        reason,
        documents:document_id ( title ),
        profiles:requested_by ( full_name )
      `)
      .eq("status", "requested");
    printRequests = (adminReqs ?? []) as unknown as PrintRequestRow[];
  } else {
    // Normal user sees their own print requests
    const { data: userReqs } = await supabase
      .from("document_print_requests")
      .select(`
        id,
        document_id,
        requested_by,
        requested_at,
        status,
        reason
      `)
      .eq("requested_by", profile.id);
    
    printRequests = (userReqs ?? []).map((req) => ({
      ...req,
      documents: null,
      profiles: null,
    })) as unknown as PrintRequestRow[];
  }

  const printRequestsMap: Record<string, PrintRequestRow> = {};
  printRequests.forEach((req) => {
    printRequestsMap[req.document_id] = req;
  });

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-5 flex justify-between items-start gap-4">
        <div>
          <Link href="/home" className="text-sm text-forest-600 hover:underline mb-2 inline-block">
            ← Back
          </Link>
          <h1 className="font-display text-3xl text-ink-900">Documents</h1>
          <p className="text-ink-500 text-sm">
            View agreements, policies, care plans, and supporting documentation.
          </p>
        </div>

        {isAdmin && (
          <Link
            href="/documents/new"
            className="bg-forest-600 hover:bg-forest-700 text-cream-50 text-xs px-4 py-2.5 rounded-2xl font-medium transition shadow-soft shrink-0"
          >
            + Upload PDF
          </Link>
        )}
      </header>

      {/* Admin print requests reviewer queue */}
      {isAdmin && <PrintRequestsList requests={printRequests} />}

      <ul className="space-y-3">
        {documents.map((doc) => (
          <DocumentItem
            key={doc.id}
            doc={doc}
            userId={profile.id}
            isAdmin={isAdmin}
            acknowledgedAt={acknowledgmentsMap[doc.id] ?? null}
            printRequest={printRequestsMap[doc.id] ?? null}
          />
        ))}

        {documents.length === 0 && (
          <li className="bg-white rounded-3xl shadow-soft p-8 text-center text-sm text-ink-500">
            No documents found.
          </li>
        )}
      </ul>
    </main>
  );
}
