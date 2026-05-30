import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type DocumentPayload = {
  clientId?: string | null;
  userId?: string | null;
  title: string;
  description?: string | null;
  storagePath: string;
  documentType: 'care_plan' | 'caregiver_agreement' | 'emergency_plan' | 'pet_instructions' | 'policy' | 'invoice_supporting' | 'insurance' | 'other';
  visibility: 'admin_only' | 'caregiver_visible' | 'client_visible' | 'family_visible' | 'assigned_caregivers_only' | 'specific_user_only';
  requiresAcknowledgment?: boolean;
  requiresPrintApproval?: boolean;
  expirationDate?: string | null;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as DocumentPayload | null;
  if (!payload) {
    return NextResponse.json({ error: "Missing payload." }, { status: 400 });
  }

  const title = payload.title?.trim();
  const storagePath = payload.storagePath?.trim();
  const documentType = payload.documentType;
  const visibility = payload.visibility;

  if (!title || !storagePath || !documentType || !visibility) {
    return NextResponse.json({ error: "Title, storage path, document type, and visibility are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: actor } = await admin
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .maybeSingle<{ id: string; role: string; organization_id: string }>();

  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Only administrators can upload documents." }, { status: 403 });
  }

  const { data: doc, error } = await admin
    .from("documents")
    .insert({
      organization_id: actor.organization_id,
      client_id: payload.clientId ?? null,
      user_id: payload.userId ?? null,
      title,
      description: payload.description ?? null,
      storage_path: storagePath,
      document_type: documentType,
      visibility,
      requires_acknowledgment: payload.requiresAcknowledgment ?? false,
      requires_print_approval: payload.requiresPrintApproval ?? false,
      expiration_date: payload.expirationDate ?? null,
      uploaded_by: actor.id,
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !doc) {
    return NextResponse.json({ error: error?.message ?? "Could not register document." }, { status: 500 });
  }

  return NextResponse.json({ id: doc.id });
}
