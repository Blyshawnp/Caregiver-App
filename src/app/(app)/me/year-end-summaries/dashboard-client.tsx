"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/pay";

type SummaryRow = {
  id: string;
  caregiver_id: string;
  year: number;
  total_hours: number;
  total_pay: number;
  total_bonus: number;
  released_at: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
};

type CorrectionRow = {
  id: string;
  summary_id: string;
  caregiver_id: string;
  message: string;
  status: "submitted" | "reviewed" | "resolved" | "dismissed";
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
  profiles?: { full_name: string } | null;
};

type DashboardClientProps = {
  role: "admin" | "client" | "caregiver" | "family";
  initialSummaries: SummaryRow[];
  initialCorrections: CorrectionRow[];
  caregiversList: { id: string; full_name: string }[];
  isPublicApp: boolean;
  orgSettings?: {
    enable_year_end_summary: boolean;
    year_end_summary_release_month: number;
    year_end_summary_release_day: number;
  } | null;
};

export default function YearEndDashboardClient({
  role,
  initialSummaries,
  initialCorrections,
  caregiversList,
  isPublicApp,
  orgSettings,
}: DashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isCaregiver = role === "caregiver";
  const isAdmin = role === "admin" || role === "client";

  // Caregiver state
  const [selectedSummary, setSelectedSummary] = useState<SummaryRow | null>(
    initialSummaries.length > 0 ? initialSummaries[0] : null
  );
  const [correctionMsg, setCorrectionMsg] = useState("");
  const [submittingCorr, setSubmittingCorr] = useState(false);
  const [corrError, setCorrError] = useState<string | null>(null);

  // Admin state
  const [genYear, setGenYear] = useState(new Date().getFullYear() - 1);
  const [releasing, setReleasing] = useState(false);
  const [releaseImmediately, setReleaseImmediately] = useState(false);
  const [genSuccess, setGenSuccess] = useState<string | null>(null);

  // Org Settings State (Public App only)
  const [settingsEnabled, setSettingsEnabled] = useState(orgSettings?.enable_year_end_summary ?? false);
  const [settingsMonth, setSettingsMonth] = useState(orgSettings?.year_end_summary_release_month ?? 1);
  const [settingsDay, setSettingsDay] = useState(orgSettings?.year_end_summary_release_day ?? 5);
  const [savingSettings, setSavingSettings] = useState(false);

  // Admin Correction Request State
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<"submitted" | "reviewed" | "resolved" | "dismissed">("reviewed");
  const [adminReply, setAdminReply] = useState("");
  const [savingReply, setSavingReply] = useState(false);

  // Save public app settings
  async function handleSaveSettings() {
    setSavingSettings(true);
    const res = await fetch("/api/year-end-summaries/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enable_year_end_summary: settingsEnabled,
        year_end_summary_release_month: settingsMonth,
        year_end_summary_release_day: settingsDay,
      }),
    });
    setSavingSettings(false);
    if (res.ok) {
      alert("Organization year-end summary settings updated.");
      router.refresh();
    } else {
      alert("Failed to update settings.");
    }
  }

  // Caregiver: submit correction request
  async function handleSubmitCorrection(summaryId: string) {
    if (!correctionMsg.trim()) return;
    setSubmittingCorr(true);
    setCorrError(null);

    const res = await fetch("/api/year-end-summaries/corrections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary_id: summaryId,
        message: correctionMsg,
      }),
    });

    setSubmittingCorr(false);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      setCorrError(err?.error ?? "Failed to submit correction request.");
    } else {
      setCorrectionMsg("");
      alert("Correction request submitted. The administration has been notified.");
      startTransition(() => {
        router.refresh();
      });
    }
  }

  // Admin: generate year end summaries
  async function handleGenerateSummaries() {
    setReleasing(true);
    setGenSuccess(null);

    const res = await fetch("/api/year-end-summaries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year: genYear,
        released: releaseImmediately,
      }),
    });

    setReleasing(false);
    if (res.ok) {
      const data = await res.json();
      setGenSuccess(
        `Generated ${data.summaries?.length ?? 0} summaries for year ${genYear}.${
          releaseImmediately ? " Released immediately." : " Scheduled for EOY release."
        }`
      );
      startTransition(() => {
        router.refresh();
      });
    } else {
      alert("Failed to generate year-end summaries.");
    }
  }

  // Admin: patch correction request
  async function handleSaveAdminReply(id: string) {
    setSavingReply(true);
    const res = await fetch("/api/year-end-summaries/corrections", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        status: adminStatus,
        admin_response: adminReply,
      }),
    });

    setSavingReply(false);
    if (res.ok) {
      setReplyingToId(null);
      setAdminReply("");
      startTransition(() => {
        router.refresh();
      });
    } else {
      alert("Failed to save response.");
    }
  }

  return (
    <div className="space-y-6">
      {/* CAREGIVER DASHBOARD */}
      {isCaregiver && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Summary selector (Sidebar) */}
          <div className="md:col-span-1 space-y-3">
            <h3 className="text-xs uppercase font-bold tracking-wider text-ink-400">Your Annual Earnings</h3>
            {initialSummaries.length === 0 ? (
              <div className="bg-white rounded-3xl p-5 border border-cream-200 text-center text-xs text-ink-400">
                No summaries available yet. Prior year summaries are released annually.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {initialSummaries.map((sum) => (
                  <button
                    key={sum.id}
                    onClick={() => setSelectedSummary(sum)}
                    className={`w-full text-left p-4 rounded-2xl border transition ${
                      selectedSummary?.id === sum.id
                        ? "bg-forest-600 text-cream-50 border-forest-600 shadow-md"
                        : "bg-white text-ink-900 border-cream-200 hover:bg-cream-50/50"
                    }`}
                  >
                    <p className="font-bold font-display text-lg">{sum.year} Earnings</p>
                    <p className={`text-xs ${selectedSummary?.id === sum.id ? "text-cream-50/80" : "text-ink-400"}`}>
                      {formatCurrency(sum.total_pay)} · {sum.total_hours.toFixed(1)} hrs
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* EOY Summary Card Detail (Main Pane) */}
          <div className="md:col-span-2 space-y-4">
            {selectedSummary ? (
              <>
                <section className="bg-white rounded-3xl p-6 shadow-soft border border-cream-200/50 grain-overlay relative">
                  <h2 className="font-display text-xl font-bold text-ink-900 border-b border-cream-200 pb-3 mb-4">
                    {isPublicApp ? "Year-End Summary Report" : "Year-End Income Summary"} ({selectedSummary.year})
                  </h2>

                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="p-3 bg-cream-50 rounded-2xl text-center">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-ink-400">Total Hours</p>
                      <p className="font-display text-lg font-bold text-ink-950 mt-1">{selectedSummary.total_hours.toFixed(1)}</p>
                    </div>
                    <div className="p-3 bg-cream-50 rounded-2xl text-center">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-ink-400">Total Earnings</p>
                      <p className="font-display text-lg font-bold text-ink-950 mt-1">{formatCurrency(selectedSummary.total_pay)}</p>
                    </div>
                    <div className="p-3 bg-cream-50 rounded-2xl text-center">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-ink-400">Bonuses</p>
                      <p className="font-display text-lg font-bold text-ink-950 mt-1">{formatCurrency(selectedSummary.total_bonus)}</p>
                    </div>
                  </div>

                  {/* Disclaimers */}
                  <div className="bg-cream-100/50 p-4 rounded-2xl border border-cream-200 text-xs text-ink-600 mb-6 leading-relaxed text-center font-medium">
                    {isPublicApp ? (
                      <p>
                        ⚠️ <strong>For recordkeeping only</strong> unless your organization separately verifies and issues official tax forms.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-forest-800 font-bold uppercase tracking-wider text-[10px]">⚠️ Year-End Income Summary</p>
                        <p>For recordkeeping only · Not a W-2 or 1099</p>
                        <p className="text-[10px] text-ink-400 font-normal">This app does not send or prepare a 1099 or W-2 tax document.</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <a
                      href={`/print?type=year-end-summary&id=${selectedSummary.id}`}
                      target="_blank"
                      className="flex-1 text-center bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-sm font-semibold transition shadow-md"
                    >
                      🖨️ Print or Save as PDF
                    </a>
                  </div>
                </section>

                {/* Correction Requests Section */}
                <section className="bg-white rounded-3xl p-6 shadow-soft border border-cream-200/50 grain-overlay space-y-4">
                  <h3 className="font-display text-base font-bold text-ink-900">Need a correction?</h3>
                  <p className="text-xs text-ink-500">
                    If hours, pay rates, or bonuses look incorrect, submit a request. The client admin will review app logs.
                  </p>

                  <div className="space-y-2">
                    <textarea
                      value={correctionMsg}
                      onChange={(e) => setCorrectionMsg(e.target.value)}
                      placeholder="Specify incorrect dates, hours, or rates..."
                      className="w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-2xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition text-sm"
                      rows={3}
                      disabled={submittingCorr}
                    />
                    {corrError && <p className="text-xs text-terracotta-600 font-semibold">{corrError}</p>}
                    <button
                      type="button"
                      onClick={() => handleSubmitCorrection(selectedSummary.id)}
                      disabled={submittingCorr || !correctionMsg.trim()}
                      className="w-full bg-cream-50 hover:bg-cream-100 text-forest-600 border border-forest-500/30 py-2.5 rounded-2xl text-xs font-semibold transition"
                    >
                      {submittingCorr ? "Submitting Request..." : "Submit Correction Request"}
                    </button>
                  </div>

                  {/* Previous Requests list */}
                  {initialCorrections.filter((c) => c.summary_id === selectedSummary.id).length > 0 && (
                    <div className="border-t border-cream-100 pt-4 space-y-3">
                      <h4 className="text-xs uppercase font-bold tracking-wider text-ink-400">Correction History</h4>
                      <div className="space-y-3">
                        {initialCorrections
                          .filter((c) => c.summary_id === selectedSummary.id)
                          .map((corr) => (
                            <div key={corr.id} className="bg-cream-50/50 p-3.5 rounded-2xl border border-cream-200/80 text-xs">
                              <div className="flex justify-between items-baseline mb-1">
                                <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider ${
                                  corr.status === "resolved" 
                                    ? "bg-forest-50 text-forest-700" 
                                    : corr.status === "dismissed" 
                                      ? "bg-cream-200 text-ink-500" 
                                      : "bg-amber-50 text-amber-800"
                                }`}>
                                  {corr.status}
                                </span>
                                <span className="text-[10px] text-ink-400">
                                  {new Date(corr.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-ink-800 mt-1">{corr.message}</p>
                              {corr.admin_response && (
                                <div className="mt-2.5 pl-3 border-l-2 border-forest-500 text-[11px] text-ink-650">
                                  <p className="font-bold text-ink-800">Admin Response:</p>
                                  <p className="mt-0.5">{corr.admin_response}</p>
                                </div>
                              )}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </section>
              </>
            ) : (
              <div className="bg-white rounded-3xl p-8 border border-cream-200 text-center text-sm text-ink-500 grain-overlay">
                Select a summary to view annual totals and disclaimers.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ADMINISTRATOR DASHBOARD */}
      {isAdmin && (
        <div className="space-y-6">
          {/* Generation & Settings panel */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="bg-white rounded-3xl p-5 border border-cream-200/50 grain-overlay space-y-4">
              <h2 className="font-display text-base font-bold text-ink-900">Compile Year-End Summaries</h2>
              <p className="text-xs text-ink-500">
                Generate or update annual earnings summaries for caregivers. Values compile locked snapshots.
              </p>

              <div className="space-y-3.5">
                <div>
                  <label className="block text-[10px] uppercase font-bold tracking-wider text-ink-400 mb-1.5">Tax Year</label>
                  <select
                    value={genYear}
                    onChange={(e) => setGenYear(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-sm"
                  >
                    {[0, 1, 2].map((offset) => {
                      const yr = new Date().getFullYear() - offset;
                      return (
                        <option key={yr} value={yr}>
                          {yr}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-ink-800">
                  <input
                    type="checkbox"
                    checked={releaseImmediately}
                    onChange={(e) => setReleaseImmediately(e.target.checked)}
                    className="w-4 h-4 rounded text-forest-600 focus:ring-forest-500"
                  />
                  <span>Release immediately to caregivers</span>
                </label>

                <button
                  type="button"
                  onClick={handleGenerateSummaries}
                  disabled={releasing}
                  className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-2xl text-xs font-semibold transition"
                >
                  {releasing ? "Compiling..." : "Generate Annual Summaries"}
                </button>

                {genSuccess && <p className="text-xs text-forest-700 font-semibold text-center mt-1">✓ {genSuccess}</p>}
              </div>
            </section>

            {/* Optional Settings Panel (Public App only) */}
            {isPublicApp && (
              <section className="bg-white rounded-3xl p-5 border border-cream-200/50 grain-overlay space-y-4">
                <h2 className="font-display text-base font-bold text-ink-900">Year-End Summary Settings</h2>
                <p className="text-xs text-ink-500">
                  Configure whether caregivers see year-end reports and schedule their automatic release.
                </p>

                <div className="space-y-3.5">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-ink-800">
                    <input
                      type="checkbox"
                      checked={settingsEnabled}
                      onChange={(e) => setSettingsEnabled(e.target.checked)}
                      className="w-4 h-4 rounded text-forest-600 focus:ring-forest-500"
                    />
                    <span>Enable Year-End Earning Reports for this organization</span>
                  </label>

                  {settingsEnabled && (
                    <div className="grid grid-cols-2 gap-3 pl-6 border-l-2 border-cream-100">
                      <div>
                        <label className="block text-[10px] uppercase font-bold tracking-wider text-ink-400 mb-1.5">Release Month</label>
                        <select
                          value={settingsMonth}
                          onChange={(e) => setSettingsMonth(parseInt(e.target.value, 10))}
                          className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-sm"
                        >
                          {Array.from({ length: 12 }, (_, idx) => (
                            <option key={idx + 1} value={idx + 1}>
                              {new Date(0, idx).toLocaleString("en-US", { month: "long" })}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold tracking-wider text-ink-400 mb-1.5">Release Day</label>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={settingsDay}
                          onChange={(e) => setSettingsDay(parseInt(e.target.value, 10) || 1)}
                          className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-sm"
                        />
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="w-full bg-cream-50 hover:bg-cream-100 text-forest-600 border border-forest-500/30 py-2.5 rounded-2xl text-xs font-semibold transition"
                  >
                    {savingSettings ? "Saving Settings..." : "Save Settings"}
                  </button>
                </div>
              </section>
            )}
          </div>

          {/* Caregiver summaries list */}
          <section className="bg-white rounded-3xl p-5 border border-cream-200/50 grain-overlay">
            <h2 className="font-display text-base font-bold text-ink-900 mb-3">Caregiver Annual Statements</h2>
            {initialSummaries.length === 0 ? (
              <p className="text-xs text-ink-450 text-center py-4">No year-end statements generated yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-cream-200 text-ink-500">
                      <th className="py-2 px-1">Year</th>
                      <th className="py-2">Caregiver</th>
                      <th className="py-2 text-right">Hours</th>
                      <th className="py-2 text-right">Earning</th>
                      <th className="py-2 text-right">Bonuses</th>
                      <th className="py-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100">
                    {initialSummaries.map((sum) => (
                      <tr key={sum.id}>
                        <td className="py-2.5 px-1 font-bold text-ink-900">{sum.year}</td>
                        <td className="py-2.5 font-medium text-ink-800">{sum.profiles?.full_name ?? "—"}</td>
                        <td className="py-2.5 text-right">{sum.total_hours.toFixed(1)}</td>
                        <td className="py-2.5 text-right font-semibold">{formatCurrency(sum.total_pay)}</td>
                        <td className="py-2.5 text-right text-forest-700">{formatCurrency(sum.total_bonus)}</td>
                        <td className="py-2.5 text-right">
                          <span className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider ${
                            sum.released_at && new Date(sum.released_at) <= new Date()
                              ? "bg-forest-50 text-forest-700"
                              : "bg-cream-100 text-ink-500"
                          }`}>
                            {sum.released_at && new Date(sum.released_at) <= new Date() ? "Released" : "Scheduled"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* active correction requests */}
          <section className="bg-white rounded-3xl p-5 border border-cream-200/50 grain-overlay space-y-4">
            <h2 className="font-display text-base font-bold text-ink-900">Caregiver Correction Requests</h2>
            {initialCorrections.length === 0 ? (
              <p className="text-xs text-ink-450 text-center py-4">No correction requests received.</p>
            ) : (
              <div className="space-y-4">
                {initialCorrections.map((corr) => {
                  const summary = initialSummaries.find((s) => s.id === corr.summary_id);
                  return (
                    <div key={corr.id} className="bg-cream-50/50 p-4 rounded-3xl border border-cream-200/80 space-y-3 text-xs">
                      <div className="flex justify-between items-baseline border-b border-cream-100 pb-2">
                        <div>
                          <p className="font-bold text-sm text-ink-900">{corr.profiles?.full_name ?? "Caregiver"}</p>
                          {summary && (
                            <p className="text-[10px] text-ink-500">
                              Report: {summary.year} ({formatCurrency(summary.total_pay)} · {summary.total_hours.toFixed(1)} hrs)
                            </p>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider ${
                          corr.status === "resolved" 
                            ? "bg-forest-50 text-forest-700" 
                            : corr.status === "dismissed" 
                              ? "bg-cream-200 text-ink-500" 
                              : "bg-amber-50 text-amber-800"
                        }`}>
                          {corr.status}
                        </span>
                      </div>

                      <div className="text-ink-800">
                        <p className="font-semibold text-[10px] uppercase text-ink-400">Caregiver Message:</p>
                        <p className="mt-0.5">{corr.message}</p>
                      </div>

                      {corr.admin_response && replyingToId !== corr.id && (
                        <div className="pl-3 border-l-2 border-forest-500 text-[11px] text-ink-700 bg-forest-50/10 p-2 rounded-r-xl">
                          <p className="font-bold text-ink-800">Your Response:</p>
                          <p className="mt-0.5">{corr.admin_response}</p>
                        </div>
                      )}

                      {/* Reply form */}
                      {replyingToId === corr.id ? (
                        <div className="bg-white p-3 rounded-2xl border border-cream-200 space-y-3">
                          <div>
                            <label className="block text-[10px] uppercase font-bold tracking-wider text-ink-400 mb-1">Status</label>
                            <select
                              value={adminStatus}
                              onChange={(e: any) => setAdminStatus(e.target.value)}
                              className="w-full px-3 py-1.5 bg-cream-50 border border-cream-200 rounded-xl text-xs"
                            >
                              <option value="submitted">Submitted</option>
                              <option value="reviewed">Reviewed</option>
                              <option value="resolved">Resolved</option>
                              <option value="dismissed">Dismissed</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase font-bold tracking-wider text-ink-400 mb-1">Response message</label>
                            <textarea
                              value={adminReply}
                              onChange={(e) => setAdminReply(e.target.value)}
                              placeholder="Describe payroll corrections or resolution status..."
                              className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-xs"
                              rows={2}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveAdminReply(corr.id)}
                              disabled={savingReply}
                              className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-1.5 rounded-xl text-xs font-semibold transition"
                            >
                              {savingReply ? "Saving..." : "Save Update"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setReplyingToId(null)}
                              className="px-4 bg-cream-50 hover:bg-cream-100 text-ink-600 border border-cream-200 py-1.5 rounded-xl text-xs font-semibold transition"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingToId(corr.id);
                            setAdminStatus(corr.status);
                            setAdminReply(corr.admin_response || "");
                          }}
                          className="w-full text-center bg-cream-50 hover:bg-cream-100 text-forest-600 border border-forest-500/20 py-1.5 rounded-xl text-[11px] font-semibold transition"
                        >
                          ✎ Respond & Update Request
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
