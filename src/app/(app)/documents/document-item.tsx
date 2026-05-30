"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type DocItemProps = {
  doc: {
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
  userId: string;
  isAdmin: boolean;
  acknowledgedAt: string | null;
  printRequest: {
    status: string;
    reason: string | null;
  } | null;
};

export default function DocumentItem({
  doc,
  userId,
  isAdmin,
  acknowledgedAt,
  printRequest,
}: DocItemProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);

  // Check expiration status
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = doc.expiration_date ? new Date(doc.expiration_date) : null;
  const isExpired = expDate ? expDate < today : false;
  const isExpiringSoon = expDate && !isExpired ? (expDate.getTime() - today.getTime()) <= 30 * 86400 * 1000 : false;

  async function handleAcknowledge() {
    setLoading(true);
    const res = await fetch("/api/documents/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: doc.id, action: "acknowledge" }),
    });

    if (!res.ok) {
      alert("Failed to acknowledge document.");
      setLoading(false);
      return;
    }

    startTransition(() => {
      router.refresh();
      setLoading(false);
    });
  }

  async function handleRequestPrint() {
    setLoading(true);
    const res = await fetch("/api/documents/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: doc.id, action: "request_print" }),
    });

    if (!res.ok) {
      alert("Failed to submit print request.");
      setLoading(false);
      return;
    }

    startTransition(() => {
      router.refresh();
      setLoading(false);
    });
  }

  const documentTypesMap: Record<string, string> = {
    care_plan: "Care Plan",
    caregiver_agreement: "Caregiver Agreement",
    emergency_plan: "Emergency Plan",
    pet_instructions: "Pet Instructions",
    policy: "Policy Document",
    invoice_supporting: "Invoice / Support Doc",
    insurance: "Insurance",
    other: "Other",
  };

  const docTypeName = documentTypesMap[doc.document_type] || doc.document_type;
  const canPrint = !doc.requires_print_approval || isAdmin || printRequest?.status === "approved";

  // PDF Viewer link: Supabase public url or direct pdf asset viewer.
  // We can view it directly in our print-friendly viewer `/print/document/[id]`.
  const printUrl = `/print/document/${doc.id}`;

  return (
    <li className={`bg-white rounded-3xl shadow-soft p-5 border border-cream-200/50 ${isExpired ? "bg-red-50/10" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-lg bg-forest-100 text-forest-800 mb-2">
            {docTypeName}
          </span>

          {isExpired && (
            <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-lg bg-terracotta-100 text-terracotta-800 mb-2 ml-2">
              ⚠️ Expired
            </span>
          )}

          {isExpiringSoon && (
            <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 mb-2 ml-2">
              ⏳ Expiring Soon
            </span>
          )}
        </div>

        <span className="text-[10px] text-ink-400">
          Visibility: {doc.visibility.replace(/_/g, " ")}
        </span>
      </div>

      <h3 className="font-display text-lg text-ink-900 font-semibold mb-1">
        {doc.title}
      </h3>

      {doc.description && (
        <p className="text-sm text-ink-600 mb-3">{doc.description}</p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500 mb-3">
        {doc.expiration_date && (
          <p>
            Expires: <span className={`font-semibold ${isExpired ? "text-terracotta-700" : ""}`}>{doc.expiration_date}</span>
          </p>
        )}
        {doc.requires_acknowledgment && (
          <p className="flex items-center gap-1">
            {acknowledgedAt ? (
              <span className="text-forest-700 font-medium">✓ Acknowledged on {new Date(acknowledgedAt).toLocaleDateString()}</span>
            ) : (
              <span className="text-terracotta-700 font-medium">⏳ Acknowledgment Required</span>
            )}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-3 border-t border-cream-100 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {/* Acknowledge Button */}
          {doc.requires_acknowledgment && !acknowledgedAt && (
            <button
              onClick={handleAcknowledge}
              disabled={loading || isPending}
              className="text-xs bg-forest-600 hover:bg-forest-700 text-cream-50 px-3.5 py-2 rounded-xl font-medium transition disabled:opacity-50"
            >
              {loading ? "Saving..." : "✓ Acknowledge Document"}
            </button>
          )}

          {/* Normal View/Download is always permitted */}
          <a
            href={`https://xunvxasgoxhujshmhkqy.supabase.co/storage/v1/object/authenticated/client-documents/${doc.storage_path}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs border border-cream-300 hover:bg-cream-50 text-ink-700 px-3.5 py-2 rounded-xl font-medium transition flex items-center gap-1"
          >
            🖻 View PDF
          </a>

          {/* Print Approval workflows */}
          {doc.requires_print_approval && !isAdmin && (
            <>
              {!printRequest && (
                <button
                  onClick={handleRequestPrint}
                  disabled={loading || isPending}
                  className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 px-3.5 py-2 rounded-xl font-medium transition disabled:opacity-50"
                >
                  {loading ? "Submitting..." : "🖨️ Request Print Approval"}
                </button>
              )}

              {printRequest?.status === "requested" && (
                <span className="text-xs bg-cream-100 text-ink-600 px-3.5 py-2 rounded-xl font-medium flex items-center gap-1">
                  ⏳ Print Approval Pending
                </span>
              )}

              {printRequest?.status === "denied" && (
                <div className="text-xs bg-red-50 text-terracotta-800 px-3.5 py-2 rounded-xl font-medium flex flex-col gap-0.5">
                  <span className="font-semibold">❌ Print Denied</span>
                  <span className="text-[10px] text-ink-500 font-normal">Reason: {printRequest.reason}</span>
                  <button
                    onClick={handleRequestPrint}
                    disabled={loading || isPending}
                    className="text-[10px] text-forest-700 hover:underline text-left mt-1 font-semibold"
                  >
                    Re-request Approval
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Print/Save to PDF Button */}
        {canPrint && (
          <Link
            href={printUrl}
            className="text-xs bg-forest-50 hover:bg-forest-100 text-forest-700 px-3.5 py-2 rounded-xl font-medium transition flex items-center gap-1"
          >
            🖨️ Print / Save as PDF
          </Link>
        )}
      </div>
    </li>
  );
}
