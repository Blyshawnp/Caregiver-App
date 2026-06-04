"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatEnumLabel } from "@/lib/pay";

type ClientDoc = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  storage_path: string;
  requires_print_approval: boolean;
};

type PrintRequest = {
  status: string;
  reason: string | null;
};

export default function ClientDocumentItem({
  doc,
  isAdmin,
  printRequest,
}: {
  doc: ClientDoc;
  isAdmin: boolean;
  printRequest: PrintRequest | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(false);
  const canPrint = !doc.requires_print_approval || isAdmin || printRequest?.status === "approved";

  async function requestPrintApproval() {
    setLoading(true);
    const res = await fetch("/api/client-documents/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: doc.id, action: "request_print" }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      alert(body?.error ?? "Failed to request print approval.");
      setLoading(false);
      return;
    }
    startTransition(() => {
      router.refresh();
      setLoading(false);
    });
  }

  return (
    <li className="bg-white rounded-3xl shadow-soft p-5 border border-cream-200/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-lg bg-forest-100 text-forest-800 mb-2">
            {formatEnumLabel(doc.category)}
          </span>
          <h3 className="font-display text-lg text-ink-900 font-semibold">{doc.title}</h3>
          {doc.description && <p className="text-sm text-ink-600 mt-1">{doc.description}</p>}
        </div>
      </div>

      {doc.requires_print_approval && !isAdmin && (
        <div className="mt-3 text-xs">
          {!printRequest && (
            <p className="text-ink-500">Printing this document requires approval.</p>
          )}
          {printRequest?.status === "requested" && (
            <p className="text-amber-800 font-medium">Approval status: Pending</p>
          )}
          {printRequest?.status === "approved" && (
            <p className="text-forest-700 font-medium">Approval status: Approved</p>
          )}
          {printRequest?.status === "denied" && (
            <p className="text-terracotta-700 font-medium">
              Approval status: Denied{printRequest.reason ? ` - ${printRequest.reason}` : ""}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-cream-100">
        <Link
          href={`/print?type=client-document&id=${doc.id}&mode=view`}
          className="text-xs border border-cream-300 hover:bg-cream-50 text-ink-700 px-3.5 py-2 rounded-xl font-medium transition"
        >
          View
        </Link>
        {doc.requires_print_approval && !isAdmin && !canPrint && (
          <button
            type="button"
            onClick={requestPrintApproval}
            disabled={loading || isPending || printRequest?.status === "requested"}
            className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 px-3.5 py-2 rounded-xl font-medium transition disabled:opacity-50"
          >
            {loading ? "Submitting..." : printRequest?.status === "requested" ? "Approval pending" : "Request print approval"}
          </button>
        )}
        {canPrint && (
          <Link
            href={`/print?type=client-document&id=${doc.id}`}
            className="text-xs bg-forest-50 hover:bg-forest-100 text-forest-700 px-3.5 py-2 rounded-xl font-medium transition"
          >
            Print / Save as PDF
          </Link>
        )}
      </div>
    </li>
  );
}
