"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Option = {
  id: string;
  name: string;
};

export default function FeedbackForm({
  caregivers,
  clients,
}: {
  caregivers: Option[];
  clients: Option[];
}) {
  const router = useRouter();
  const [caregiverId, setCaregiverId] = useState("");
  const [clientId, setClientId] = useState("");
  const [feedbackType, setFeedbackType] = useState("commendation");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        caregiverId: caregiverId || null,
        clientId: clientId || null,
        feedbackType,
        message,
        rating,
      }),
    });

    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      setError(result?.error ?? "Could not submit feedback.");
      setSaving(false);
      return;
    }

    setSuccess(true);
    setSaving(false);
    setMessage("");
    setRating(null);
    setCaregiverId("");
    setClientId("");
    router.refresh();
  }

  const feedbackTypes = [
    { value: "commendation", label: "Good job / commendation" },
    { value: "appreciation", label: "Thank you / appreciation" },
    { value: "concern", label: "Concern" },
    { value: "complaint", label: "Complaint" },
    { value: "safety_issue", label: "Safety issue" },
    { value: "scheduling_issue", label: "Scheduling issue" },
    { value: "other", label: "Other" },
  ];

  if (success) {
    return (
      <div className="bg-white rounded-3xl shadow-soft p-6 text-center grain-overlay">
        <span className="w-12 h-12 rounded-full bg-forest-100 text-forest-600 flex items-center justify-center mx-auto mb-4 text-xl">✓</span>
        <h2 className="font-display text-xl text-ink-900 mb-2">Thank you!</h2>
        <p className="text-sm text-ink-500 mb-6">
          Your feedback has been successfully submitted and sent to the administration team for review.
        </p>
        <div className="space-y-2">
          <button
            onClick={() => setSuccess(false)}
            className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-sm font-medium transition"
          >
            Submit more feedback
          </button>
          <Link
            href="/home"
            className="block w-full text-center border border-cream-300 hover:bg-cream-50 text-ink-700 py-3 rounded-2xl text-sm font-medium transition"
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
      <div className="relative space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Feedback Type
          </label>
          <select
            value={feedbackType}
            onChange={(e) => setFeedbackType(e.target.value)}
            className={inputCls}
            required
          >
            {feedbackTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Caregiver (Optional)
          </label>
          <select
            value={caregiverId}
            onChange={(e) => setCaregiverId(e.target.value)}
            className={inputCls}
          >
            <option value="">Select caregiver if relevant</option>
            {caregivers.map((cg) => (
              <option key={cg.id} value={cg.id}>
                {cg.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Client / Care Recipient (Optional)
          </label>
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className={inputCls}
          >
            <option value="">Select client if relevant</option>
            {clients.map((cl) => (
              <option key={cl.id} value={cl.id}>
                {cl.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Rating (Optional)
          </label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(rating === star ? null : star)}
                className={`w-10 h-10 rounded-xl font-display font-semibold transition text-sm flex items-center justify-center ${
                  rating !== null && rating >= star
                    ? "bg-forest-600 text-cream-50 shadow-sm"
                    : "bg-cream-50 border border-cream-200 text-ink-500 hover:bg-cream-100"
                }`}
              >
                ★
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1.5">
            Your Message
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Share your thoughts, praise, or concerns..."
            rows={4}
            className={inputCls}
            required
            maxLength={1000}
          />
        </div>

        {/* Emergency disclaimer block */}
        <div className="bg-terracotta-400/10 border border-terracotta-400/20 text-terracotta-800 text-xs p-3.5 rounded-2xl leading-relaxed">
          <p className="font-semibold text-terracotta-900 mb-0.5">⚠️ NOT FOR EMERGENCIES</p>
          Do not use this form for urgent, immediate safety issues, or medical emergencies. If there is an active crisis or emergency, please call <strong>911</strong> immediately or contact your manager directly.
        </div>

        {error && <p className="text-sm text-terracotta-600 font-medium">{error}</p>}

        <button
          type="submit"
          disabled={saving || !message.trim()}
          className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-sm font-medium transition disabled:opacity-60"
        >
          {saving ? "Submitting..." : "Submit Feedback"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-2xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition text-sm";
