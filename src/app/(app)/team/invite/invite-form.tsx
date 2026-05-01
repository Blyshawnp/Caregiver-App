"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function InviteForm({
  organizationId,
  currentUserId,
}: {
  organizationId: string;
  currentUserId: string;
}) {
  const [fullName, setFullName] = useState("");
  const [hasEmail, setHasEmail] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<
    "caregiver" | "client" | "admin" | "family"
  >(
    "caregiver"
  );
  const [hourlyRate, setHourlyRate] = useState("");

  // No-email-mode fields
  const [usernamePart, setUsernamePart] = useState("");
  const [password, setPassword] = useState(generatePassword());
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [createdNoEmailCreds, setCreatedNoEmailCreds] = useState<{
    email: string;
    password: string;
  } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const supabase = createClient();

    if (hasEmail) {
      // Standard invitation link flow
      const { data, error } = await supabase
        .from("invitations")
        .insert({
          organization_id: organizationId,
          full_name: fullName.trim(),
          email: email.trim().toLowerCase(),
          role,
          invited_by: currentUserId,
          created_by: currentUserId,
          caregiver_hourly_rate:
            role === "caregiver" && hourlyRate
              ? Number(hourlyRate)
              : null,
          status: "pending",
        })
        .select("token")
        .single();

      if (error || !data) {
        setError(error?.message ?? "Could not create invitation.");
        setSubmitting(false);
        return;
      }

      const link = `${window.location.origin}/accept-invite?token=${data.token}`;
      setCreatedLink(link);

      setSubmitting(false);
      return;
    }

    // No-email flow: admin creates the account directly
    const cleanUser = usernamePart.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!cleanUser || cleanUser.length < 2) {
      setError("Username must be at least 2 letters or numbers.");
      setSubmitting(false);
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setSubmitting(false);
      return;
    }

    const response = await fetch("/api/invitations/no-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: fullName.trim(),
        role,
        usernamePart: cleanUser,
        password,
        hourlyRate: role === "caregiver" && hourlyRate ? Number(hourlyRate) : null,
      }),
    });

    const result = (await response.json()) as {
      error?: string;
      email?: string;
      password?: string;
    };

    if (!response.ok || !result.email || !result.password) {
      setError(result.error ?? "Could not create account.");
      setSubmitting(false);
      return;
    }

    setCreatedNoEmailCreds({ email: result.email, password: result.password });
    setSubmitting(false);
  }

  // ===== Success screens =====

  if (createdLink) {
    return (
      <main className="px-5 py-6 max-w-2xl mx-auto">
        <header className="mb-6">
          <h1 className="font-display text-3xl text-ink-900">Invite ready</h1>
          <p className="text-ink-500 text-sm">
            Send this link to {fullName} to join.
          </p>
        </header>
        <section className="bg-white rounded-3xl shadow-soft p-5 mb-4 grain-overlay">
          <div className="relative">
            <p className="text-xs uppercase tracking-wide font-medium text-ink-500 mb-2">
              Invitation link
            </p>
            <div className="bg-cream-50 border border-cream-200 rounded-xl px-4 py-3 mb-3 font-mono text-sm break-all">
              {createdLink}
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                onClick={() => navigator.clipboard.writeText(createdLink)}
                className="bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl font-medium transition"
              >
                Copy link
              </button>
              <a
                href={`sms:?&body=${encodeURIComponent(
                  `You've been invited to join the caregiver team. Open this link to set up your account: ${createdLink}`
                )}`}
                className="bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-3 rounded-2xl font-medium text-center transition"
              >
                Send by text
              </a>
            </div>
            <p className="text-xs text-ink-500 mt-3">
              Expires in 14 days.
            </p>
          </div>
        </section>
        <Link
          href="/team"
          className="block w-full bg-white hover:bg-cream-50 text-ink-700 py-3.5 rounded-2xl font-medium text-center shadow-soft transition"
        >
          Done
        </Link>
      </main>
    );
  }

  if (createdNoEmailCreds) {
    const smsBody = `Caregiver app login\nUsername: ${createdNoEmailCreds.email}\nPassword: ${createdNoEmailCreds.password}\nApp: ${window.location.origin}`;
    return (
      <main className="px-5 py-6 max-w-2xl mx-auto">
        <header className="mb-6">
          <h1 className="font-display text-3xl text-ink-900">Account created</h1>
          <p className="text-ink-500 text-sm">
            Send these details to {fullName}.
          </p>
        </header>

        <section className="bg-white rounded-3xl shadow-soft p-5 mb-4 grain-overlay">
          <div className="relative space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide font-medium text-ink-500 mb-1.5">
                Username
              </p>
              <div className="bg-cream-50 border border-cream-200 rounded-xl px-4 py-3 font-mono text-sm break-all">
                {createdNoEmailCreds.email}
              </div>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide font-medium text-ink-500 mb-1.5">
                Password
              </p>
              <div className="bg-cream-50 border border-cream-200 rounded-xl px-4 py-3 font-mono text-sm break-all">
                {createdNoEmailCreds.password}
              </div>
            </div>
            <p className="text-xs text-ink-500 pt-1">
              On first login, the phone will offer to save these. After that,
              they'll auto-fill.
            </p>
          </div>
        </section>

        <div className="grid grid-cols-2 gap-2.5 mb-4">
          <button
            onClick={() =>
              navigator.clipboard.writeText(
                `Username: ${createdNoEmailCreds.email}\nPassword: ${createdNoEmailCreds.password}`
              )
            }
            className="bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl font-medium transition"
          >
            Copy details
          </button>
          <a
            href={`sms:?&body=${encodeURIComponent(smsBody)}`}
            className="bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-3 rounded-2xl font-medium text-center transition"
          >
            Send by text
          </a>
        </div>

        <Link
          href="/team"
          className="block w-full bg-white hover:bg-cream-50 text-ink-700 py-3.5 rounded-2xl font-medium text-center shadow-soft transition"
        >
          Done
        </Link>
      </main>
    );
  }

  // ===== Main form =====

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href="/team"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back to team
        </Link>
        <h1 className="font-display text-3xl text-ink-900">Invite someone</h1>
        <p className="text-ink-500 text-sm">
          Send a link, or set up an account for caregivers without email
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card title="About them">
          <Field label="Full name">
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              className={inputCls}
            />
          </Field>

          <Field label="Role">
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              className={inputCls}
            >
              <option value="caregiver">Caregiver</option>
              <option value="client">Client</option>
              <option value="family">Family member</option>
              <option value="admin">Admin</option>
            </select>
          </Field>
        </Card>

        <Card title="How they'll sign in">
          <div className="bg-cream-50 border border-cream-200 rounded-xl p-3 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setHasEmail(true)}
              className={`py-2 rounded-lg text-sm font-medium transition ${
                hasEmail
                  ? "bg-forest-600 text-cream-50"
                  : "text-ink-500 hover:text-ink-900"
              }`}
            >
              Has email
            </button>
            <button
              type="button"
              onClick={() => setHasEmail(false)}
              className={`py-2 rounded-lg text-sm font-medium transition ${
                !hasEmail
                  ? "bg-forest-600 text-cream-50"
                  : "text-ink-500 hover:text-ink-900"
              }`}
            >
              No email
            </button>
          </div>

          {hasEmail ? (
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className={inputCls}
                autoComplete="off"
              />
              <p className="text-xs text-ink-500 mt-1.5">
                You'll get a link to send them. They set their own password.
              </p>
            </Field>
          ) : (
            <>
              <Field label="Username">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={usernamePart}
                    onChange={(e) =>
                      setUsernamePart(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))
                    }
                    placeholder="jane"
                    className={inputCls}
                    autoComplete="off"
                  />
                  <span className="text-sm text-ink-500 font-mono shrink-0">
                    @noemail.local
                  </span>
                </div>
                <p className="text-xs text-ink-500 mt-1.5">
                  Letters and numbers only. Keep it short and easy to remember.
                </p>
              </Field>

              <Field label="Password">
                <div className="flex gap-2">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    className={`${inputCls} font-mono`}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="bg-cream-200 hover:bg-cream-200/70 text-ink-700 px-3 rounded-xl text-sm font-medium transition shrink-0"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPassword(generatePassword());
                      setShowPassword(true);
                    }}
                    className="bg-cream-200 hover:bg-cream-200/70 text-ink-700 px-3 rounded-xl text-sm font-medium transition shrink-0"
                  >
                    New
                  </button>
                </div>
                <p className="text-xs text-ink-500 mt-1.5">
                  Their phone will offer to save this on first login.
                </p>
              </Field>
            </>
          )}
        </Card>

        {role === "caregiver" && (
          <Card title="Pay (optional)">
            <Field label="Hourly rate $">
              <input
                type="number"
                step="0.01"
                min="0"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="20.00"
                className={inputCls}
              />
            </Field>
            <p className="text-xs text-ink-500">
              Can be set or changed later from the team page.
            </p>
          </Card>
        )}

        {error && (
          <div className="bg-terracotta-400/10 border border-terracotta-400/30 text-terracotta-600 rounded-2xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2.5">
          <Link
            href="/team"
            className="flex-1 bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-3.5 rounded-2xl font-medium text-center transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-3.5 rounded-2xl font-medium transition disabled:opacity-50 active:scale-[0.99]"
          >
            {submitting
              ? "Creating..."
              : hasEmail
                ? "Create invitation"
                : "Create account"}
          </button>
        </div>
      </form>
    </main>
  );
}

const inputCls =
  "w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
      <div className="relative">
        <h2 className="font-display text-base text-ink-900 mb-3">{title}</h2>
        <div className="space-y-3">{children}</div>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

// Generate a memorable password: Adjective + Animal + 2 digits
function generatePassword(): string {
  const adjectives = [
    "Happy",
    "Bright",
    "Quick",
    "Calm",
    "Brave",
    "Kind",
    "Sunny",
    "Lucky",
    "Gentle",
    "Mighty",
  ];
  const animals = [
    "Otter",
    "Robin",
    "Fox",
    "Tiger",
    "Whale",
    "Hawk",
    "Bear",
    "Owl",
    "Lynx",
    "Heron",
  ];
  const a = adjectives[Math.floor(Math.random() * adjectives.length)];
  const b = animals[Math.floor(Math.random() * animals.length)];
  const n = Math.floor(Math.random() * 90 + 10);
  return `${a}${b}${n}`;
}
