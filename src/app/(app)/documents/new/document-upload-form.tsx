"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Option = { id: string; name: string; role?: string };

export default function DocumentUploadForm({
  clients,
  profiles,
  orgId,
}: {
  clients: Option[];
  profiles: Option[];
  orgId: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [documentType, setDocumentType] = useState("care_plan");
  const [visibility, setVisibility] = useState("caregiver_visible");
  const [clientId, setClientId] = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [requiresAck, setRequiresAck] = useState(false);
  const [requiresPrintApproval, setRequiresPrintApproval] = useState(false);
  const [expirationDate, setExpirationDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const documentTypes = [
    { value: "care_plan", label: "Care Plan" },
    { value: "caregiver_agreement", label: "Caregiver Agreement" },
    { value: "emergency_plan", label: "Emergency Plan" },
    { value: "pet_instructions", label: "Pet Instructions" },
    { value: "policy", label: "Policy Document" },
    { value: "invoice_supporting", label: "Invoice / Supporting Document" },
    { value: "insurance", label: "Insurance" },
    { value: "other", label: "Other" },
  ];

  const visibilities = [
    { value: "admin_only", label: "Admin Only" },
    { value: "caregiver_visible", label: "Caregiver Visible" },
    { value: "client_visible", label: "Client Visible" },
    { value: "family_visible", label: "Family Visible" },
    { value: "assigned_caregivers_only", label: "Assigned Caregivers Only" },
    { value: "specific_user_only", label: "Specific User Only" },
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) {
      setError("Please select a PDF file to upload.");
      return;
    }
    if (file.type !== "application/pdf") {
      setError("Only PDF documents are supported.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const supabase = createClient();
      const fileExt = "pdf";
      const fileName = `${orgId}/${crypto.randomUUID()}.${fileExt}`;

      // Upload file directly to Supabase storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("client-documents")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError || !uploadData) {
        throw new Error(uploadError?.message ?? "Failed to upload file to storage.");
      }

      // Register metadata
      const response = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          storagePath: uploadData.path,
          documentType,
          visibility,
          clientId: visibility === "assigned_caregivers_only" || clientId ? clientId : null,
          userId: visibility === "specific_user_only" ? targetUserId : null,
          requiresAcknowledgment: requiresAck,
          requiresPrintApproval: requiresPrintApproval,
          expirationDate: expirationDate || null,
        }),
      });

      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(result?.error ?? "Could not save document metadata.");
      }

      router.push("/documents");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "An error occurred.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-3xl shadow-soft p-5 space-y-4 grain-overlay">
      <div className="relative space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Document Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Policy Manual, Care Plan"
            required
            className={inputCls}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Description (Optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Provide a summary of the document contents..."
            rows={2}
            className={inputCls}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
              Document Type
            </label>
            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className={inputCls}
            >
              {documentTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
              Visibility Scope
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value)}
              className={inputCls}
            >
              {visibilities.map((vis) => (
                <option key={vis.value} value={vis.value}>
                  {vis.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {visibility === "assigned_caregivers_only" && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
              Associated Client (Required for assigned caregivers scope)
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              required
              className={inputCls}
            >
              <option value="">Select client...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {visibility === "specific_user_only" && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
              Target User (Required for specific user scope)
            </label>
            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              required
              className={inputCls}
            >
              <option value="">Select user...</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Client association option if not already required */}
        {visibility !== "assigned_caregivers_only" && visibility !== "specific_user_only" && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
              Associated Client (Optional)
            </label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={inputCls}
            >
              <option value="">None</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
              Expiration Date (Optional)
            </label>
            <input
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
              PDF Document File
            </label>
            <input
              type="file"
              accept="application/pdf"
              required
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-ink-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-forest-50 file:text-forest-700 hover:file:bg-forest-100 cursor-pointer"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2.5 bg-cream-50/50 p-4 rounded-2xl border border-cream-200/50">
          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-ink-800">
            <input
              type="checkbox"
              checked={requiresAck}
              onChange={(e) => setRequiresAck(e.target.checked)}
              className="w-4 h-4 rounded text-forest-600 focus:ring-forest-500"
            />
            <span>Requires Acknowledgment / Mark as Read</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-ink-800">
            <input
              type="checkbox"
              checked={requiresPrintApproval}
              onChange={(e) => setRequiresPrintApproval(e.target.checked)}
              className="w-4 h-4 rounded text-forest-600 focus:ring-forest-500"
            />
            <span>Requires Print or PDF Download Approval Workflow</span>
          </label>
        </div>

        {error && <p className="text-sm text-terracotta-600 font-medium">{error}</p>}

        <button
          type="submit"
          disabled={saving || !title.trim()}
          className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-sm font-medium transition disabled:opacity-60"
        >
          {saving ? "Uploading PDF..." : "Upload Document"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-2xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition text-sm";
