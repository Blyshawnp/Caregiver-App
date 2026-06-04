import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ClientDocumentItem from "./client-document-item";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ClientDoc = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  storage_path: string;
  requires_print_approval: boolean;
  created_at: string;
};

type PrintRequest = {
  client_document_id: string;
  status: string;
  reason: string | null;
};

export default async function ClientDocumentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  const { data: client } = await supabase
    .from("clients")
    .select("id, full_name, organization_id")
    .eq("id", id)
    .maybeSingle<{ id: string; full_name: string; organization_id: string }>();
  if (!client || client.organization_id !== profile.organization_id) notFound();

  const isAdmin = profile.role === "admin" || profile.role === "client";

  const { data: docsData } = await supabase
    .from("client_documents")
    .select("id, title, description, category, storage_path, requires_print_approval, created_at")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false });
  const docs = (docsData ?? []) as ClientDoc[];

  let printRequests: PrintRequest[] = [];
  if (docs.length > 0) {
    const docIds = docs.map((doc) => doc.id);
    const { data } = await supabase
      .from("client_document_print_requests")
      .select("client_document_id, status, reason")
      .in("client_document_id", docIds)
      .eq("requested_by", profile.id);
    printRequests = (data ?? []) as PrintRequest[];
  }

  const requestByDoc = new Map(printRequests.map((req) => [req.client_document_id, req]));

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-5">
        <Link href={`/clients/${client.id}/home-info`} className="text-sm text-forest-600 hover:underline mb-2 inline-block">
          ← Back to client
        </Link>
        <h1 className="font-display text-3xl text-ink-900">{client.full_name} documents</h1>
        <p className="text-ink-500 text-sm">
          View client instructions, care documents, emergency files, and home access documents.
        </p>
      </header>

      <ul className="space-y-3">
        {docs.map((doc) => (
          <ClientDocumentItem
            key={doc.id}
            doc={doc}
            isAdmin={isAdmin}
            printRequest={requestByDoc.get(doc.id) ?? null}
          />
        ))}
        {docs.length === 0 && (
          <li className="bg-white rounded-3xl shadow-soft p-8 text-center text-sm text-ink-500">
            No client documents have been uploaded yet.
          </li>
        )}
      </ul>
    </main>
  );
}
