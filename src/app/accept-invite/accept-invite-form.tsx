"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Invitation = {
  id: string;
  email: string;
  full_name: string;
  role: "admin" | "client" | "caregiver";
  organization_id: string;
  organizations: { name: string } | null;
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

    // Create the profile in the same org with the invited role
    const { error: profileError } = await supabase.from("profiles").insert({
      id: signUpData.user.id,
      organization_id: invitation.organization_id,
      role: invitation.role,
      full_name: invitation.full_name,
      email: invitation.email,
      phone: phone.trim() || null,
    });

    if (profileError) {
      setError(profileError.message);
      setSubmitting(false);
      return;
    }

    // Mark the invitation as accepted via the RPC (security-definer function)
    // so RLS can't silently block it. The token is the auth credential.
    const { data: accepted, error: acceptError } = await supabase.rpc(
      "accept_invitation",
      { invitation_token: token }
    );

    if (acceptError) {
      // Don't block the user from getting in; admin can clean up manually
      console.error("Could not mark invitation accepted:", acceptError);
    } else if (accepted === false) {
      console.error("Invitation accept returned false");
    }

    // If admin had set a pending pay rate (from invite form localStorage), apply it
    if (invitation.role === "caregiver") {
      try {
        const pending = JSON.parse(
          localStorage.getItem("pending_invite_rates") ?? "{}"
        );
        const rate = pending[token];
        if (rate && rate > 0) {
          await supabase.from("caregiver_rates").insert({
            caregiver_id: signUpData.user.id,
            base_hourly_rate: Number(rate),
            effective_from: new Date().toISOString().split("T")[0],
          });
          delete pending[token];
          localStorage.setItem("pending_invite_rates", JSON.stringify(pending));
        }
      } catch {
        /* ignore storage errors */
      }
    }

    router.push("/home");
    router.refresh();
  }

  const orgName = invitation.organizations?.name ?? "the team";
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
