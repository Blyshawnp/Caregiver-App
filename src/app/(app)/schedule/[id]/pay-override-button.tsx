"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { roundUpToQuarter, formatCurrency, formatPay } from "@/lib/pay";

type Mode = "amount" | "hours_rate" | "clear";

export default function PayOverrideButton({
  shiftId,
  currentOverrideAmount,
  currentOverrideHours,
  currentOverrideRate,
  currentOverrideReason,
  computedAmount,
  computedHours,
  computedRate,
  isLocked,
}: {
  shiftId: string;
  currentOverrideAmount: number | null;
  currentOverrideHours: number | null;
  currentOverrideRate: number | null;
  currentOverrideReason: string | null;
  computedAmount: number;
  computedHours: number;
  computedRate: number;
  isLocked: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(
    currentOverrideAmount != null ? "amount" : "hours_rate"
  );
  const [amount, setAmount] = useState(
    currentOverrideAmount != null ? String(currentOverrideAmount) : ""
  );
  const [hours, setHours] = useState(
    currentOverrideHours != null
      ? String(currentOverrideHours)
      : computedHours.toFixed(2)
  );
  const [rate, setRate] = useState(
    currentOverrideRate != null
      ? String(currentOverrideRate)
      : computedRate.toFixed(2)
  );
  const [reason, setReason] = useState(currentOverrideReason ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasOverride =
    currentOverrideAmount != null ||
    currentOverrideHours != null ||
    currentOverrideRate != null;

  if (isLocked) {
    return (
      <div className="bg-white border border-cream-200 rounded-2xl px-4 py-3 text-center text-xs text-ink-500">
        Pay locked. This shift is in a released invoice.
      </div>
    );
  }

  async function save() {
    setError(null);

    if (mode !== "clear" && !reason.trim()) {
      setError("A reason is required for any pay correction.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    let update: Record<string, string | number | null>;

    if (mode === "clear") {
      update = {
        pay_override_amount: null,
        pay_override_hours: null,
        pay_override_rate: null,
        pay_override_reason: null,
        pay_override_by: null,
        pay_override_at: null,
      };
    } else if (mode === "amount") {
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt < 0) {
        setError("Enter a valid amount.");
        setSubmitting(false);
        return;
      }
      update = {
        pay_override_amount: amt,
        pay_override_hours: null,
        pay_override_rate: null,
        pay_override_reason: reason.trim(),
        pay_override_at: new Date().toISOString(),
      };
    } else {
      const h = parseFloat(hours);
      const r = parseFloat(rate);
      if (isNaN(h) || h < 0 || isNaN(r) || r < 0) {
        setError("Enter valid hours and rate.");
        setSubmitting(false);
        return;
      }
      update = {
        pay_override_amount: null,
        pay_override_hours: h,
        pay_override_rate: r,
        pay_override_reason: reason.trim(),
        pay_override_at: new Date().toISOString(),
      };
    }

    const { error: updateError } = await supabase
      .from("shifts")
      .update(update)
      .eq("id", shiftId);

    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }

    window.location.reload();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="block w-full bg-white hover:bg-cream-50 text-ink-700 border border-cream-200 py-3 rounded-2xl font-medium text-center transition shadow-soft text-sm"
      >
        {hasOverride ? "Edit pay correction" : "Adjust pay for this shift"}
      </button>
    );
  }

  const previewAmount =
    mode === "amount"
      ? parseFloat(amount) || 0
      : mode === "hours_rate"
        ? (parseFloat(hours) || 0) * (parseFloat(rate) || 0)
        : computedAmount;

  return (
    <div className="bg-white rounded-2xl shadow-soft p-5 grain-overlay">
      <div className="relative space-y-3">
        <p className="text-sm font-medium text-ink-900">
          Adjust pay for this shift
        </p>
        <p className="text-xs text-ink-500">
          Computed: {formatPay(computedAmount)} (
          {computedHours.toFixed(1)} hrs × {formatCurrency(computedRate)}/hr)
        </p>

        {/* Mode tabs */}
        <div className="grid grid-cols-3 bg-cream-50 border border-cream-200 rounded-xl p-1 gap-1">
          <ModeTab
            active={mode === "hours_rate"}
            onClick={() => setMode("hours_rate")}
          >
            Hours/rate
          </ModeTab>
          <ModeTab
            active={mode === "amount"}
            onClick={() => setMode("amount")}
          >
            Fixed amount
          </ModeTab>
          {hasOverride && (
            <ModeTab active={mode === "clear"} onClick={() => setMode("clear")}>
              Clear
            </ModeTab>
          )}
        </div>

        {mode === "hours_rate" && (
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Hours"
              value={hours}
              onChange={setHours}
              type="number"
              step="0.25"
              placeholder="8.0"
            />
            <Input
              label="Rate ($/hr)"
              value={rate}
              onChange={setRate}
              type="number"
              step="0.25"
              placeholder="20.00"
            />
          </div>
        )}

        {mode === "amount" && (
          <Input
            label="Total pay ($)"
            value={amount}
            onChange={setAmount}
            type="number"
            step="0.01"
            placeholder="100.00"
          />
        )}

        {mode === "clear" && (
          <div className="bg-cream-50 border border-cream-200 rounded-xl p-3 text-sm text-ink-700">
            Removes this override. Pay reverts to the calculated amount.
          </div>
        )}

        {mode !== "clear" && (
          <Input
            label="Reason (required)"
            value={reason}
            onChange={setReason}
            placeholder="e.g. Worked extra 30 minutes"
          />
        )}

        {/* Preview */}
        <div className="bg-forest-100 rounded-xl p-3 flex items-baseline justify-between">
          <span className="text-xs text-forest-700 uppercase tracking-wider font-medium">
            New pay
          </span>
          <span className="font-display text-lg text-forest-700">
            {formatPay(previewAmount)}
          </span>
        </div>

        {error && <p className="text-terracotta-600 text-xs">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            disabled={submitting}
            className="flex-1 bg-white hover:bg-cream-50 text-ink-700 border border-cream-200 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={submitting}
            className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            {submitting ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`py-1.5 rounded-lg text-xs font-medium transition ${
        active
          ? "bg-forest-600 text-cream-50"
          : "text-ink-500 hover:text-ink-900"
      }`}
    >
      {children}
    </button>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  step?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
        {label}
      </span>
      <input
        type={type}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
      />
    </label>
  );
}
