"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import UserAvatar from "@/components/user-avatar";

type Person = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: "admin" | "client" | "caregiver" | "family";
  is_active: boolean;
  avatar_url: string | null;
  avatar_color: string | null;
};

type Rate = {
  id: string;
  base_hourly_rate: number;
  effective_from: string;
  effective_to: string | null;
};

export default function TeamMemberDetail({
  person,
  currentRate,
  upcomingShiftCount,
}: {
  person: Person;
  currentRate: Rate | null;
  upcomingShiftCount: number;
}) {
  const router = useRouter();
  const [editingRate, setEditingRate] = useState(false);
  const [newRate, setNewRate] = useState(
    currentRate?.base_hourly_rate.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Password reset state for no-email accounts
  const [showResetCreds, setShowResetCreds] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const isNoEmailAccount = person.email.endsWith("@noemail.local");

  async function saveRate() {
    setError(null);
    if (!newRate || Number(newRate) <= 0) {
      setError("Pay rate must be a positive number.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];

    // End the current rate, start a new one
    if (currentRate) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yStr = yesterday.toISOString().split("T")[0];

      await supabase
        .from("caregiver_rates")
        .update({ effective_to: yStr })
        .eq("id", currentRate.id);
    }

    const { error } = await supabase.from("caregiver_rates").insert({
      caregiver_id: person.id,
      base_hourly_rate: Number(newRate),
      effective_from: today,
    });

    if (error) {
      setError(error.message);
      setSaving(false);
      return;
    }

    setEditingRate(false);
    setSaving(false);
    router.refresh();
  }

  async function toggleActive() {
    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ is_active: !person.is_active })
      .eq("id", person.id);
    router.refresh();
  }

  const roleCopy: Record<string, string> = {
    admin: "Administrator",
    client: "Client",
    caregiver: "Caregiver",
  };

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <Link
        href="/team"
        className="text-sm text-forest-600 hover:underline mb-3 inline-block"
      >
        ← Back to team
      </Link>

      {/* Header card */}
      <section className="bg-white rounded-3xl shadow-soft p-6 mb-4 grain-overlay">
        <div className="relative flex items-center gap-4 mb-4">
          <UserAvatar person={person} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-2xl text-ink-900 leading-tight truncate">
              {person.full_name}
            </h1>
            <p className="text-sm text-forest-600">
              {roleCopy[person.role]}
              {!person.is_active && " · Inactive"}
            </p>
          </div>
        </div>

        <dl className="divide-y divide-cream-200 text-sm">
          <Row label="Email" value={person.email} />
          <Row label="Phone" value={person.phone || "Not set"} />
          {person.role === "caregiver" && (
            <Row
              label="Upcoming shifts"
              value={String(upcomingShiftCount)}
            />
          )}
        </dl>
      </section>

      {/* Pay rate card (caregivers only) */}
      {person.role === "caregiver" && (
        <section className="bg-white rounded-3xl shadow-soft p-5 mb-4 grain-overlay">
          <div className="relative">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-base text-ink-900">Pay rate</h2>
              {!editingRate && (
                <button
                  onClick={() => setEditingRate(true)}
                  className="text-sm text-forest-600 font-medium hover:underline"
                >
                  {currentRate ? "Change" : "Set rate"}
                </button>
              )}
            </div>

            {!editingRate ? (
              <div>
                {currentRate ? (
                  <div>
                    <p className="font-display text-3xl text-ink-900">
                      ${currentRate.base_hourly_rate.toFixed(2)}
                      <span className="text-base text-ink-500 font-sans ml-1">
                        /hr
                      </span>
                    </p>
                    <p className="text-xs text-ink-500 mt-0.5">
                      Effective since{" "}
                      {new Date(
                        currentRate.effective_from
                      ).toLocaleDateString(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-ink-500">No pay rate set yet.</p>
                )}
              </div>
            ) : (
              <div>
                <div className="flex gap-2 items-center mb-2">
                  <span className="text-ink-500 text-2xl font-display">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newRate}
                    onChange={(e) => setNewRate(e.target.value)}
                    placeholder="20.00"
                    className="flex-1 px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20"
                  />
                  <span className="text-ink-500 text-sm">/hr</span>
                </div>
                {error && (
                  <p className="text-terracotta-600 text-xs mb-2">{error}</p>
                )}
                <p className="text-xs text-ink-500 mb-3">
                  New rate applies to shifts starting today. Past shifts keep
                  their original rate.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingRate(false);
                      setError(null);
                      setNewRate(
                        currentRate?.base_hourly_rate.toString() ?? ""
                      );
                    }}
                    disabled={saving}
                    className="flex-1 bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveRate}
                    disabled={saving}
                    className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Password reset for no-email accounts */}
      {isNoEmailAccount && (
        <section className="bg-white rounded-3xl shadow-soft p-5 mb-4 grain-overlay">
          <div className="relative">
            <h2 className="font-display text-base text-ink-900 mb-1">
              Login details
            </h2>
            <p className="text-xs text-ink-500 mb-3">
              This caregiver signs in with a username and password. You can
              reset it for them anytime.
            </p>

            <div className="bg-cream-50 border border-cream-200 rounded-xl px-4 py-3 mb-3">
              <p className="text-xs uppercase tracking-wide font-medium text-ink-500 mb-1">
                Username
              </p>
              <p className="font-mono text-sm break-all">{person.email}</p>
            </div>

            {!showResetCreds ? (
              <button
                onClick={() => {
                  setNewPassword(generatePassword());
                  setShowResetCreds(true);
                  setError(null);
                }}
                className="w-full bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-2.5 rounded-xl text-sm font-medium transition"
              >
                Reset password
              </button>
            ) : (
              <div>
                <p className="text-xs uppercase tracking-wide font-medium text-ink-500 mb-1.5">
                  New password
                </p>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={8}
                    className="flex-1 px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl font-mono text-sm focus:outline-none focus:border-forest-500"
                  />
                  <button
                    type="button"
                    onClick={() => setNewPassword(generatePassword())}
                    className="bg-cream-200 hover:bg-cream-200/70 text-ink-700 px-3 rounded-xl text-sm font-medium transition shrink-0"
                  >
                    New
                  </button>
                </div>

                {error && (
                  <p className="text-terracotta-600 text-xs mb-2">{error}</p>
                )}

                <p className="text-xs text-ink-500 mb-3">
                  Note: Updating the password requires admin server-side access.
                  For now, write down or text the new password to the caregiver,
                  then go to <strong>Supabase Dashboard → Authentication →
                  Users</strong>, find this user by email, click their row, and
                  set the password to match. (We'll automate this when we add a
                  server-side function.)
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowResetCreds(false);
                      setError(null);
                    }}
                    className="flex-1 bg-white hover:bg-cream-50 text-ink-700 py-2.5 rounded-xl text-sm font-medium transition"
                  >
                    Cancel
                  </button>
                  <a
                    href={`sms:?&body=${encodeURIComponent(
                      `Caregiver app new password\nUsername: ${person.email}\nPassword: ${newPassword}`
                    )}`}
                    className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition text-center"
                  >
                    Send by text
                  </a>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Active/inactive toggle */}
      <button
        onClick={toggleActive}
        className="w-full bg-white hover:bg-cream-50 py-3.5 rounded-2xl shadow-soft font-medium text-ink-700 transition"
      >
        {person.is_active ? "Deactivate" : "Reactivate"}
      </button>
      {person.is_active && (
        <p className="text-xs text-ink-500 text-center mt-2">
          Deactivating prevents new shifts from being assigned to this person.
        </p>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between py-3 first:pt-0 last:pb-0 gap-3">
      <dt className="text-ink-500 text-xs uppercase tracking-wide font-medium shrink-0">
        {label}
      </dt>
      <dd className="text-ink-900 font-medium text-right truncate">
        {value ?? "—"}
      </dd>
    </div>
  );
}

function generatePassword(): string {
  const adjectives = ["Happy", "Bright", "Quick", "Calm", "Brave", "Kind", "Sunny", "Lucky", "Gentle", "Mighty"];
  const animals = ["Otter", "Robin", "Fox", "Tiger", "Whale", "Hawk", "Bear", "Owl", "Lynx", "Heron"];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const b = animals[Math.floor(Math.random() * animals.length)];
  const n = Math.floor(Math.random() * 90 + 10);
  return `${a}${b}${n}`;
}
