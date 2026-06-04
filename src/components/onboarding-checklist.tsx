"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type ChecklistRole = "admin" | "client" | "caregiver" | "family" | string;

export default function OnboardingChecklist({
  role,
  dismissed,
}: {
  role: ChecklistRole;
  dismissed: boolean;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState(dismissed);
  const [saving, setSaving] = useState(false);
  const items = itemsForRole(role);

  if (hidden) return null;

  async function dismiss() {
    setSaving(true);
    await fetch("/api/tutorial/complete", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingChecklistDismissed: true }),
    }).catch(() => null);
    setHidden(true);
    setSaving(false);
    router.refresh();
  }

  return (
    <section className="mx-auto max-w-2xl px-5 pt-5">
      <div className="rounded-3xl bg-white p-5 shadow-soft border border-cream-200 grain-overlay">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-forest-700 font-semibold">
              Setup checklist
            </p>
            <h2 className="font-display text-xl text-ink-900">Recommended next steps</h2>
          </div>
          <button
            type="button"
            onClick={dismiss}
            disabled={saving}
            className="text-xs font-semibold text-ink-500 hover:text-ink-800 disabled:opacity-60"
          >
            Dismiss
          </button>
        </div>
        <ul className="grid gap-2 text-sm text-ink-700">
          {items.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-cream-50 px-3 py-2">
              <span>{item.label}</span>
              <Link href={item.href} className="text-xs font-semibold text-forest-700 hover:underline">
                Open
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function itemsForRole(role: ChecklistRole) {
  if (role === "caregiver") {
    return [
      { label: "Add profile photo or avatar", href: "/me" },
      { label: "Enable notifications", href: "/me/notifications" },
      { label: "Install the app", href: "/account/settings" },
      { label: "Review first shift", href: "/schedule" },
      { label: "Review pets and emergency info", href: "/clients" },
      { label: "Complete first check-in", href: "/schedule" },
    ];
  }
  if (role === "client" || role === "family") {
    return [
      { label: "Review schedule", href: "/schedule" },
      { label: "Review pets, documents, and emergency info", href: "/clients" },
      { label: "Enable notifications", href: "/me/notifications" },
      { label: "Install the app", href: "/account/settings" },
    ];
  }
  return [
    { label: "Create profile", href: "/me" },
    { label: "Add first client", href: "/clients" },
    { label: "Add emergency info", href: "/clients" },
    { label: "Add pets if any", href: "/clients" },
    { label: "Add documents and instructions", href: "/documents" },
    { label: "Invite caregiver", href: "/team" },
    { label: "Create first shift", href: "/schedule/new" },
    { label: "Enable notifications", href: "/me/notifications" },
    { label: "Install app", href: "/account/settings" },
  ];
}
