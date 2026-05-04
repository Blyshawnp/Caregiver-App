"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { sendNotificationEvent } from "@/lib/notify-client";
import type { Role, ShiftProposalRow } from "@/lib/db-types";
import { ArrowRightIcon, PlusIcon } from "@/components/icons";

type Client = { id: string; full_name: string };
type ProposalRow = ShiftProposalRow & {
  profiles?:
    | { full_name: string | null }
    | Array<{ full_name: string | null }>
    | null;
  clients?:
    | { full_name: string | null }
    | Array<{ full_name: string | null }>
    | null;
};
const inputCls =
  "w-full px-3 py-2.5 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm";

export default function ProposalsPanel({
  role,
  currentUserId,
  organizationId,
  clients,
  proposals,
}: {
  role: Role;
  currentUserId: string;
  organizationId: string;
  clients: Client[];
  proposals: ProposalRow[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const canCreate = role === "caregiver";
  const canManage = role === "admin";

  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(defaultDate());
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("20:00");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [handledProposalIds, setHandledProposalIds] = useState<Set<string>>(
    () => new Set()
  );

  const myProposals = useMemo(
    () => proposals.filter((proposal) => proposal.caregiver_id === currentUserId),
    [currentUserId, proposals]
  );

  async function createProposal(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const startISO = combineDateTime(date, startTime);
    const endISO = combineDateTime(date, endTime);
    if (!startISO || !endISO) {
      setError("Please pick a valid date and times.");
      return;
    }
    if (new Date(endISO) <= new Date(startISO)) {
      setError("End time must be after start time.");
      return;
    }

    setSubmitting(true);
    const { data, error: insertError } = await supabase
      .from("shift_proposals")
      .insert({
        organization_id: organizationId,
        caregiver_id: currentUserId,
        client_id: clientId || null,
        scheduled_start: startISO,
        scheduled_end: endISO,
        notes: notes.trim() || null,
        created_by: currentUserId,
      })
      .select("id")
      .single<{ id: string }>();

    if (insertError) {
      setError(insertError.message);
      setSubmitting(false);
      return;
    }

    if (data?.id) {
      void sendNotificationEvent({
        type: "shift_proposal_created",
        proposalId: data.id,
      });
    }

    setNotes("");
    setClientId("");
    setSubmitting(false);
    router.refresh();
  }

  async function approveProposal(proposalId: string) {
    setError(null);
    setMessage(null);
    const response = await fetch("/api/shift-proposals/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposalId }),
    });
    const result = (await response.json().catch(() => null)) as
      | { error?: string; shiftId?: string | null }
      | null;

    if (!response.ok) {
      setError(result?.error ?? "Could not approve proposal.");
      return;
    }

    void sendNotificationEvent({
      type: "shift_proposal_approved",
      proposalId,
      shiftId: result?.shiftId ?? null,
    });

    setHandledProposalIds((prev) => new Set(prev).add(proposalId));
    setMessage("Proposal approved and shift created.");
    router.refresh();
  }

  async function rejectProposal(proposalId: string, reason: string) {
    setError(null);
    const { error: rpcError } = await supabase.rpc("reject_shift_proposal", {
      p_proposal_id: proposalId,
      p_reason: reason.trim() || null,
    });

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    void sendNotificationEvent({
      type: "shift_proposal_rejected",
      proposalId,
      reason: reason.trim() || null,
    });

    setHandledProposalIds((prev) => new Set(prev).add(proposalId));
    setMessage("Proposal rejected.");
    router.refresh();
  }

  async function cancelProposal(proposalId: string) {
    setError(null);
    const { error: cancelError } = await supabase
      .from("shift_proposals")
      .update({
        status: "canceled",
        canceled_by: currentUserId,
        canceled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", proposalId)
      .eq("caregiver_id", currentUserId)
      .eq("status", "pending");

    if (cancelError) {
      setError(cancelError.message);
      return;
    }

    router.refresh();
  }

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href="/schedule"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back to schedule
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-ink-900 leading-tight">
              Shift proposals
            </h1>
            <p className="text-ink-500 text-sm">
              {canCreate
                ? "Propose availability or a client-specific shift."
                : "Review pending caregiver proposals."}
            </p>
          </div>
        </div>
      </header>

      {(error || message) && (
        <p className={`mb-4 text-sm ${error ? "text-terracotta-600" : "text-forest-700"}`}>
          {error ?? message}
        </p>
      )}

      {canCreate && (
        <form onSubmit={createProposal} className="space-y-5 mb-6">
          <Card title="New proposal">
            <Field label="Client">
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className={inputCls}
              >
                <option value="">General availability</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Date">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="Start">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="End">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                  className={inputCls}
                />
              </Field>
            </div>

            <Field label="Notes">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className={`${inputCls} resize-y min-h-[110px]`}
                placeholder="Optional details for the admin"
              />
            </Field>

            {error && <p className="text-terracotta-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl font-medium text-sm transition disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              <PlusIcon size={16} />
              {submitting ? "Submitting..." : "Submit proposal"}
            </button>
          </Card>
        </form>
      )}

      <section className="space-y-6">
        {canManage ? (
          <>
            <SectionHeader
              title="Pending proposals"
              description="Approve to create a shift or reject with a reason."
            />
            {proposals.filter((proposal) => !handledProposalIds.has(proposal.id)).length === 0 ? (
              <EmptyState text="No pending proposals right now." />
            ) : (
              <div className="space-y-3">
                {proposals
                  .filter((proposal) => !handledProposalIds.has(proposal.id))
                  .map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    role={role}
                    onApprove={approveProposal}
                    onReject={rejectProposal}
                  />
                ))}
              </div>
            )}
          </>
        ) : null}

        {canCreate && (
          <>
            <SectionHeader
              title="My proposals"
              description="Track pending, approved, rejected, and canceled requests."
            />
            {myProposals.length === 0 ? (
              <EmptyState text="You have not created any proposals yet." />
            ) : (
              <div className="space-y-3">
                {myProposals.map((proposal) => (
                  <ProposalCard
                    key={proposal.id}
                    proposal={proposal}
                    role={role}
                    onCancel={cancelProposal}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function ProposalCard({
  proposal,
  role,
  onApprove,
  onReject,
  onCancel,
}: {
  proposal: ProposalRow;
  role: Role;
  onApprove?: (proposalId: string) => Promise<void>;
  onReject?: (proposalId: string, reason: string) => Promise<void>;
  onCancel?: (proposalId: string) => Promise<void>;
}) {
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);

  const caregiverName = firstJoinedName(proposal.profiles) ?? "Caregiver";
  const label = proposal.client_id
    ? firstJoinedName(proposal.clients) ?? "Client"
    : "General availability";
  const start = new Date(proposal.scheduled_start);
  const end = new Date(proposal.scheduled_end);

  async function handleApprove() {
    if (!onApprove) return;
    setBusy(true);
    await onApprove(proposal.id);
    setBusy(false);
  }

  async function handleReject() {
    if (!onReject) return;
    setBusy(true);
    await onReject(proposal.id, rejectReason);
    setBusy(false);
  }

  async function handleCancel() {
    if (!onCancel) return;
    setBusy(true);
    await onCancel(proposal.id);
    setBusy(false);
  }

  return (
    <article className="bg-white rounded-3xl p-4 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-medium text-ink-900 truncate">
              {label}
            </p>
            <StatusPill status={proposal.status} />
          </div>
          <p className="text-sm text-ink-700">
            {start.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            })}{" "}
            · {start.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} –{" "}
            {end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
          </p>
          <p className="text-xs text-ink-500 mt-1">
            {role === "admin"
              ? `${caregiverName} requested this`
              : proposal.status === "approved" && proposal.shift_id
                ? "Approved and converted into a shift"
                : "Your proposal"}
          </p>
        </div>
        {proposal.shift_id && proposal.status === "approved" && (
          <Link
            href={`/schedule/${proposal.shift_id}`}
            className="text-forest-600 hover:underline text-sm shrink-0 inline-flex items-center gap-1"
          >
            Open
            <ArrowRightIcon size={14} />
          </Link>
        )}
      </div>

      {proposal.notes && (
        <p className="text-sm text-ink-700 mt-3 whitespace-pre-wrap">
          {proposal.notes}
        </p>
      )}

      {proposal.status === "rejected" && proposal.rejection_reason && (
        <p className="text-xs text-terracotta-600 mt-2">
          Rejected: {proposal.rejection_reason}
        </p>
      )}

      {proposal.status === "pending" && role === "admin" && (
        <div className="mt-4 grid gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={handleApprove}
            className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-2xl text-sm font-medium transition disabled:opacity-60"
          >
            {busy ? "Working..." : "Approve"}
          </button>
          <label className="block">
            <span className="block text-[10px] uppercase tracking-[0.18em] text-ink-500 mb-1">
              Reject reason
            </span>
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className={inputCls}
              placeholder="Optional reason"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={handleReject}
            className="w-full bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 py-2.5 rounded-2xl text-sm font-medium transition disabled:opacity-60"
          >
            Reject
          </button>
        </div>
      )}

      {proposal.status === "pending" && role === "caregiver" && onCancel && (
        <button
          type="button"
          disabled={busy}
          onClick={handleCancel}
          className="mt-4 w-full bg-cream-100 hover:bg-cream-200 text-ink-700 py-2.5 rounded-2xl text-sm font-medium transition disabled:opacity-60"
        >
          Cancel proposal
        </button>
      )}
    </article>
  );
}

function StatusPill({ status }: { status: ShiftProposalRow["status"] }) {
  const cls =
    status === "pending"
      ? "bg-amber-100 text-amber-800"
      : status === "approved"
        ? "bg-forest-100 text-forest-700"
        : status === "rejected"
          ? "bg-terracotta-400/15 text-terracotta-600"
          : "bg-cream-200 text-ink-600";

  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${cls}`}>
      {status}
    </span>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="px-1">
      <h2 className="text-xs uppercase tracking-[0.18em] text-ink-500 mb-1">
        {title}
      </h2>
      <p className="text-sm text-ink-500">{description}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-soft text-center grain-overlay">
      <p className="text-sm text-ink-500">{text}</p>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-white rounded-3xl p-5 shadow-soft space-y-4">
      <h2 className="font-display text-xl text-ink-900">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.18em] text-ink-500 mb-1.5">
        {label}
      </span>
      {children}
    </label>
  );
}

function defaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDateLocal(d);
}

function formatDateLocal(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function combineDateTime(dateStr: string, timeStr: string) {
  if (!dateStr || !timeStr) return null;
  const dt = new Date(`${dateStr}T${timeStr}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

function firstJoinedName(
  joined:
    | { full_name: string | null }
    | Array<{ full_name: string | null }>
    | null
    | undefined
) {
  if (!joined) return null;
  if (Array.isArray(joined)) return joined[0]?.full_name ?? null;
  return joined.full_name ?? null;
}
