"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Invitation = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "client" | "caregiver" | "family";
  organization_id: string;
  caregiver_hourly_rate: number | null;
  organization_name: string | null;
};

export default function AcceptInviteForm({
  invitation,
  token,
}: {
  invitation: Invitation;
  token: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    // Sign up the user
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: invitation.email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    if (!signUpData.user) {
      setError("Could not create account. Try again.");
      setSubmitting(false);
      return;
    }

    // Finalize the invitation server-side so profile creation, acceptance
    // metadata, and caregiver pay rate all come from the stored invitation.
    const { data: accepted, error: acceptError } = await supabase.rpc(
      "accept_invitation",
      {
        invitation_token: token,
        invited_phone: phone.trim() || null,
      }
    );

    if (acceptError || accepted === false) {
      setError(
        acceptError?.message ??
          "Could not finalize this invitation. Contact your admin."
      );
      setSubmitting(false);
      return;
    }

    router.push("/home");
    router.refresh();
  }

  const orgName = invitation.organization_name ?? "the team";
  const roleCopy: Record<string, string> = {
    admin: "administrator",
    client: "client",
    caregiver: "caregiver",
  };

  return (
    <main className="min-h-dvh flex items-center justify-center px-5 py-10 bg-cream-100 relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-20 w-96 h-96 rounded-full bg-terracotta-400/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-forest-400/15 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-6">
          <p className="text-xs uppercase tracking-[0.18em] text-ink-500 mb-2">
            You're invited
          </p>
          <h1 className="font-display text-3xl text-ink-900 mb-1">
            Welcome,{" "}
            <span className="italic text-forest-600">
              {invitation.full_name.split(" ")[0]}
            </span>
          </h1>
          <p className="text-ink-500 text-sm">
            Join {orgName} as a {roleCopy[invitation.role]}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/95 backdrop-blur rounded-3xl shadow-soft p-6 grain-overlay"
        >
          <div className="space-y-4 relative">
            <div>
              <p className="text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
                Email
              </p>
              <p className="px-4 py-3 bg-cream-100 rounded-xl text-ink-900 text-sm">
                {invitation.email}
              </p>
            </div>

            <Field
              label="Phone (optional)"
              type="tel"
              value={phone}
              onChange={setPhone}
              placeholder="555-123-4567"
              autoComplete="tel"
            />

            <Field
              label="Create password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              required
            />
            <Field
              label="Confirm password"
              type="password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
              required
            />

            {error && (
              <div className="text-sm text-terracotta-600 bg-terracotta-400/10 border border-terracotta-400/20 px-3 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl font-medium tracking-wide transition disabled:opacity-60 shadow-soft active:scale-[0.99]"
            >
              {submitting ? "Setting up..." : "Create my account"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  required,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition"
      />
    </label>
  );
}
