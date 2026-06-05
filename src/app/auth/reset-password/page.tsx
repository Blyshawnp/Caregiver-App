"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AppLogo from "@/components/app-logo";
import { createClient } from "@/lib/supabase/client";

export default function AuthResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      setHasRecoverySession(Boolean(data.session));
      if (!data.session) {
        setError("Open the latest reset link from your email to choose a new password.");
      }
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setHasRecoverySession(true);
        setError(null);
        setCheckingSession(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      setSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(
        "This reset link is expired or invalid. Request a new password reset email and try again."
      );
      setSubmitting(false);
      return;
    }

    setPassword("");
    setConfirmPassword("");
    setMessage("Password updated. You can sign in with your new password.");

    window.setTimeout(async () => {
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    }, 1800);
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5 py-10 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] bg-cream-100">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 inline-flex">
            <AppLogo
              href="/auth/reset-password"
              variant="auth"
              showText={false}
              className="justify-center"
            />
          </div>
          <h1 className="font-display text-4xl text-ink-900 mb-1.5">
            Choose a new password
          </h1>
          <p className="text-sm text-ink-500">
            Enter a new password after opening the reset link from your email.
          </p>
        </div>

        <form
          onSubmit={submit}
          className="bg-white/90 backdrop-blur rounded-3xl shadow-soft p-7 grain-overlay"
        >
          <div className="space-y-4 relative">
            <PasswordField
              label="New password"
              value={password}
              onChange={setPassword}
              disabled={!hasRecoverySession || checkingSession || Boolean(message)}
            />
            <PasswordField
              label="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              disabled={!hasRecoverySession || checkingSession || Boolean(message)}
            />

            {error && (
              <div className="text-sm text-terracotta-600 bg-terracotta-400/10 border border-terracotta-400/20 px-3 py-2.5 rounded-xl">
                {error}
              </div>
            )}
            {message && (
              <div className="text-sm text-navy-700 bg-navy-400/10 border border-navy-400/20 px-3 py-2.5 rounded-xl">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={
                submitting ||
                checkingSession ||
                !hasRecoverySession ||
                Boolean(message)
              }
              className="w-full bg-forest-700 hover:bg-forest-800 text-white border border-forest-800 py-3 rounded-2xl font-semibold tracking-wide transition disabled:bg-forest-700/70 disabled:text-white/80 disabled:cursor-not-allowed shadow-lifted active:scale-[0.99]"
            >
              {checkingSession
                ? "Checking link..."
                : submitting
                  ? "Saving..."
                  : "Update password"}
            </button>
          </div>
        </form>

        <Link
          href="/login"
          className="block w-full text-center text-xs text-navy-600 hover:underline mt-6"
        >
          Back to sign in
        </Link>
      </div>
    </main>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
        {label}
      </span>
      <input
        type="password"
        autoComplete="new-password"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full px-4 py-3 bg-white border border-forest-500/25 rounded-xl text-ink-900 placeholder:text-ink-400 shadow-sm focus:outline-none focus:border-forest-600 focus:ring-2 focus:ring-forest-500/20 transition disabled:bg-cream-50 disabled:text-ink-400 disabled:cursor-not-allowed"
        required
      />
    </label>
  );
}
