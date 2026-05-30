"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { StarOfLifeIcon } from "@/components/icons";
import { formatCurrency } from "@/lib/pay";
import AcceptDeclineButtons from "./accept-decline-buttons";
import ClaimShiftButton from "./claim-shift-button";
import CancelReleaseButton from "./cancel-release-button";

type TopShiftActionAreaProps = {
  shiftId: string;
  clientName: string;
  shiftDateTime: string;
  shiftStatusLabel: string;
  shiftStatusTone: string;
  role: string;
  isAssignedCaregiver: boolean;
  canCheckIn: boolean;
  canCheckOut: boolean;
  canClaim: boolean;
  iReleasedThis: boolean;
  assignmentStatus: string | null;
  isReleased: boolean;
  computedPayAmount: number;
  isPayOverridden: boolean;
  hourlyRate: number | null;
  caregiverId: string;
  showPay: boolean;
};

export default function TopShiftActionArea({
  shiftId,
  clientName,
  shiftDateTime,
  shiftStatusLabel,
  shiftStatusTone,
  role,
  isAssignedCaregiver,
  canCheckIn,
  canCheckOut,
  canClaim,
  iReleasedThis,
  assignmentStatus,
  isReleased,
  computedPayAmount,
  isPayOverridden,
  hourlyRate,
  caregiverId,
  showPay,
}: TopShiftActionAreaProps) {
  const [lunchActive, setLunchActive] = useState(false);
  const [lunchStart, setLunchStart] = useState<string | null>(null);
  const [lunchElapsed, setLunchElapsed] = useState("");

  const [breakActive, setBreakActive] = useState(false);
  const [breakStart, setBreakStart] = useState<string | null>(null);
  const [breakElapsed, setBreakElapsed] = useState("");

  // Load break/lunch state from localStorage
  useEffect(() => {
    const lActive = localStorage.getItem(`lunch_active_${shiftId}`) === "true";
    const lStart = localStorage.getItem(`lunch_start_${shiftId}`);
    setLunchActive(lActive);
    setLunchStart(lStart);

    const bActive = localStorage.getItem(`break_active_${shiftId}`) === "true";
    const bStart = localStorage.getItem(`break_start_${shiftId}`);
    setBreakActive(bActive);
    setBreakStart(bStart);
  }, [shiftId]);

  // Stopwatch effect for lunch/break
  useEffect(() => {
    const t = setInterval(() => {
      if (lunchActive && lunchStart) {
        const diffMs = new Date().getTime() - new Date(lunchStart).getTime();
        const diffMin = Math.max(0, Math.floor(diffMs / 60000));
        const diffSec = Math.max(0, Math.floor((diffMs % 60000) / 1000));
        setLunchElapsed(`${diffMin}m ${diffSec}s`);
      }
      if (breakActive && breakStart) {
        const diffMs = new Date().getTime() - new Date(breakStart).getTime();
        const diffMin = Math.max(0, Math.floor(diffMs / 60000));
        const diffSec = Math.max(0, Math.floor((diffMs % 60000) / 1000));
        setBreakElapsed(`${diffMin}m ${diffSec}s`);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [lunchActive, lunchStart, breakActive, breakStart]);

  const toggleLunch = () => {
    if (lunchActive) {
      localStorage.removeItem(`lunch_active_${shiftId}`);
      localStorage.removeItem(`lunch_start_${shiftId}`);
      setLunchActive(false);
      setLunchStart(null);
    } else {
      const nowStr = new Date().toISOString();
      localStorage.setItem(`lunch_active_${shiftId}`, "true");
      localStorage.setItem(`lunch_start_${shiftId}`, nowStr);
      setLunchActive(true);
      setLunchStart(nowStr);
      // End break if lunch started
      if (breakActive) toggleBreak();
    }
  };

  const toggleBreak = () => {
    if (breakActive) {
      localStorage.removeItem(`break_active_${shiftId}`);
      localStorage.removeItem(`break_start_${shiftId}`);
      setBreakActive(false);
      setBreakStart(null);
    } else {
      const nowStr = new Date().toISOString();
      localStorage.setItem(`break_active_${shiftId}`, "true");
      localStorage.setItem(`break_start_${shiftId}`, nowStr);
      setBreakActive(true);
      setBreakStart(nowStr);
      // End lunch if break started
      if (lunchActive) toggleLunch();
    }
  };

  const paySummary = showPay ? (
    <div className="text-xs font-semibold text-forest-700 bg-forest-50 border border-forest-200/50 px-3 py-1.5 rounded-xl inline-flex items-center gap-1 mt-1">
      <span>Est. Pay: {formatCurrency(computedPayAmount)}</span>
      {isPayOverridden && <span className="text-[10px] text-terracotta-600 font-normal">(Adjusted)</span>}
      {hourlyRate && <span className="text-ink-500 font-normal"> · {formatCurrency(hourlyRate)}/hr</span>}
    </div>
  ) : null;

  return (
    <section className="bg-white border-2 border-cream-200 rounded-3xl p-5 mb-5 shadow-soft grain-overlay relative">
      <div className="relative">
        <div className="flex justify-between items-start gap-4 mb-2">
          <div>
            <h2 className="font-display text-lg text-ink-900 leading-tight">
              {clientName}
            </h2>
            <p className="text-xs text-ink-500 mt-0.5">{shiftDateTime}</p>
          </div>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${
            shiftStatusTone === "forest"
              ? "bg-forest-100 text-forest-700"
              : shiftStatusTone === "terracotta"
                ? "bg-terracotta-100 text-terracotta-700"
                : "bg-cream-200 text-ink-600"
          }`}>
            {shiftStatusLabel}
          </span>
        </div>

        {paySummary}

        {/* Emergency shortcut button */}
        <div className="mt-3 flex gap-2">
          <Link
            href="/emergency"
            className="flex-1 max-w-[150px] flex items-center justify-center gap-1 text-[11px] font-semibold text-terracotta-700 bg-terracotta-400/10 hover:bg-terracotta-400/20 border border-terracotta-400/30 px-3 py-2 rounded-xl transition"
          >
            <StarOfLifeIcon size={12} className="text-terracotta-600 shrink-0" />
            <span>Emergency Info</span>
          </Link>
        </div>

        {/* Action Button Section */}
        <div className="mt-4 space-y-2.5">
          {/* Claim Shift Button */}
          {canClaim && caregiverId && role === "caregiver" && (
            <ClaimShiftButton shiftId={shiftId} caregiverId={caregiverId} />
          )}

          {/* Cancel Release Button */}
          {iReleasedThis && caregiverId && (
            <CancelReleaseButton shiftId={shiftId} caregiverId={caregiverId} />
          )}

          {/* Accept / Decline Shift Buttons */}
          {!isReleased && isAssignedCaregiver && assignmentStatus === "pending" && (
            <AcceptDeclineButtons shiftId={shiftId} />
          )}

          {/* Check In Button */}
          {!isReleased && isAssignedCaregiver && assignmentStatus === "accepted" && canCheckIn && (
            <Link
              href={`/schedule/${shiftId}/check-in`}
              className="block w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl font-semibold text-center text-sm transition active:scale-[0.99] shadow-soft"
            >
              Check in
            </Link>
          )}

          {/* Active Shift Checkout and Break / Lunch buttons */}
          {!isReleased && isAssignedCaregiver && canCheckOut && (
            <div className="space-y-3">
              {/* Check Out Button */}
              <Link
                href={`/schedule/${shiftId}/check-out`}
                className="block w-full bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 py-3 rounded-2xl font-semibold text-center text-sm transition active:scale-[0.99] shadow-soft"
              >
                Check out
              </Link>

              {/* Lunch and Break Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  onClick={toggleLunch}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition ${
                    lunchActive
                      ? "bg-amber-100 border-amber-300 text-amber-800 ring-2 ring-amber-400"
                      : "bg-cream-50 hover:bg-cream-100 border-cream-200 text-ink-700"
                  }`}
                >
                  <span className="text-xs font-semibold">
                    {lunchActive ? "End Lunch" : "Start Lunch"}
                  </span>
                  {lunchActive && (
                    <span className="text-[10px] text-amber-700 font-mono mt-0.5 animate-pulse">
                      {lunchElapsed} elapsed
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={toggleBreak}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition ${
                    breakActive
                      ? "bg-blue-100 border-blue-300 text-blue-800 ring-2 ring-blue-400"
                      : "bg-cream-50 hover:bg-cream-100 border-cream-200 text-ink-700"
                  }`}
                >
                  <span className="text-xs font-semibold">
                    {breakActive ? "End Break" : "Start Break"}
                  </span>
                  {breakActive && (
                    <span className="text-[10px] text-blue-700 font-mono mt-0.5 animate-pulse">
                      {breakElapsed} elapsed
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
