"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppLogo from "@/components/app-logo";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/use-translation";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/home");
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">
      {/* Decorative warm gradient blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-20 w-96 h-96 rounded-full bg-terracotta-400/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-20 w-96 h-96 rounded-full bg-forest-400/15 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 inline-flex">
            <AppLogo href="/login" variant="auth" showText={false} className="justify-center" />
          </div>
          <p className="text-ink-500 text-sm">{t("auth.signInTitle")}</p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="bg-white/90 backdrop-blur rounded-3xl shadow-soft p-7 grain-overlay"
        >
          <div className="space-y-4 relative">
            <Field
              label={t("auth.emailOrUsername")}
              type="text"
              autoComplete="username"
              value={email}
              onChange={setEmail}
              required
            />
            <Field
              label={t("auth.password")}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={setPassword}
              required
            />

            {error && (
              <div className="text-sm text-terracotta-600 bg-terracotta-400/10 border border-terracotta-400/20 px-3 py-2.5 rounded-xl">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl font-medium tracking-wide transition disabled:opacity-60 disabled:cursor-not-allowed shadow-soft active:scale-[0.99]"
            >
              {loading ? t("auth.signingIn") : t("auth.signIn")}
            </button>
          </div>
        </form>

        <p className="text-center text-xs text-ink-500 mt-6">
          {t("auth.needAccess")}
        </p>
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
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
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
        className="w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition"
      />
    </label>
  );
}
