"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type ThemeOption = {
  key: string;
  label: string;
  primaryBg: string;
};

const THEME_OPTIONS: ThemeOption[] = [
  { key: "default", label: "Caregiver App Default (Tealish Blue)", primaryBg: "bg-[#0D6587]" },
  { key: "teal", label: "Teal Theme", primaryBg: "bg-teal-600" },
  { key: "blue", label: "Clean Blue Theme", primaryBg: "bg-blue-600" },
  { key: "green", label: "Natural Forest Green", primaryBg: "bg-green-600" },
  { key: "purple", label: "Regal Purple Theme", primaryBg: "bg-purple-600" },
  { key: "rose", label: "Premium Rose Theme", primaryBg: "bg-rose-600" },
  { key: "high-contrast", label: "High Contrast", primaryBg: "bg-black" },
];

export default function AccountSettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);

  // Form states
  const [email, setEmail] = useState("");
  const [currentEmail, setCurrentEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [themePref, setThemePref] = useState("default");

  // Statuses
  const [emailSuccess, setEmailSuccess] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passSuccess, setPassSuccess] = useState("");
  const [passError, setPassError] = useState("");
  const [themeSuccess, setThemeSuccess] = useState("");
  const [themeError, setThemeError] = useState("");

  const [emailUpdating, setEmailUpdating] = useState(false);
  const [passUpdating, setPassUpdating] = useState(false);
  const [themeUpdating, setThemeUpdating] = useState(false);

  // Unsaved changes checks
  const isEmailDirty = email.trim() !== "" && email !== currentEmail;
  const isPassDirty = password.trim() !== "" || confirmPassword.trim() !== "";
  const isThemeDirty = profile && themePref !== (profile.theme_preference ?? "default");
  const isDirty = isEmailDirty || isPassDirty || isThemeDirty;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = "You have unsaved settings changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/login");
          return;
        }
        setUserId(user.id);
        setEmail(user.email ?? "");
        setCurrentEmail(user.email ?? "");

        const { data: prof } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (prof) {
          setProfile(prof);
          setThemePref(prof.theme_preference ?? "default");
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  async function handleUpdateEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || email === currentEmail) return;

    setEmailUpdating(true);
    setEmailSuccess("");
    setEmailError("");

    try {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;

      setEmailSuccess("Email update request sent! Please check both your current and new email addresses to confirm the change.");
      setCurrentEmail(email);
    } catch (err: any) {
      setEmailError(err.message || "Failed to request email change.");
    } finally {
      setEmailUpdating(false);
    }
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    if (password !== confirmPassword) {
      setPassError("Passwords do not match.");
      return;
    }

    setPassUpdating(true);
    setPassSuccess("");
    setPassError("");

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setPassSuccess("Password updated successfully!");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPassError(err.message || "Failed to update password.");
    } finally {
      setPassUpdating(false);
    }
  }

  async function handleUpdateTheme(themeKey: string) {
    if (!userId) return;

    setThemePref(themeKey);
    setThemeUpdating(true);
    setThemeSuccess("");
    setThemeError("");

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ theme_preference: themeKey })
        .eq("id", userId);

      if (error) throw error;

      setThemeSuccess("Theme preference saved!");
      if (profile) {
        setProfile({ ...profile, theme_preference: themeKey });
      }
      router.refresh();
    } catch (err: any) {
      setThemeError(err.message || "Failed to save theme preference.");
    } finally {
      setThemeUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-5 py-12 text-center">
        <p className="text-sm text-ink-500 animate-pulse">Loading settings...</p>
      </div>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-5 py-6">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900 leading-tight">Account & Settings</h1>
        <p className="text-ink-500 text-sm">Manage your profile credentials, app theme and offline PWA settings.</p>
      </header>

      <div className="space-y-6">
        {/* Color Scheme preferences */}
        <section className="bg-white rounded-3xl p-6 shadow-soft border border-cream-150">
          <h2 className="font-display text-lg text-ink-900 mb-1">Color Scheme & Theme</h2>
          <p className="text-xs text-ink-500 mb-4">Choose a curated primary color scheme across all app headers, cards, and buttons.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleUpdateTheme(opt.key)}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left text-xs font-semibold transition ${
                  themePref === opt.key
                    ? "border-forest-600 bg-forest-50/20 text-forest-750"
                    : "border-cream-200 bg-cream-50 hover:bg-cream-100 text-ink-700"
                }`}
              >
                <div className={`w-5 h-5 rounded-lg shrink-0 ${opt.primaryBg}`} />
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
          </div>

          {themeSuccess && (
            <p className="text-xs text-forest-650 mt-3 font-semibold">{themeSuccess}</p>
          )}
          {themeError && (
            <p className="text-xs text-terracotta-600 mt-3 font-semibold">{themeError}</p>
          )}
        </section>

        {/* Change Email */}
        <section className="bg-white rounded-3xl p-6 shadow-soft border border-cream-150">
          <h2 className="font-display text-lg text-ink-900 mb-1">Change Email Address</h2>
          <p className="text-xs text-ink-500 mb-4">Request a secure update to your signed-in email address. Both addresses must verify the link.</p>

          <form onSubmit={handleUpdateEmail} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-600"
                required
              />
            </div>

            {emailSuccess && (
              <p className="text-xs text-forest-650 font-semibold">{emailSuccess}</p>
            )}
            {emailError && (
              <p className="text-xs text-terracotta-600 font-semibold">{emailError}</p>
            )}

            <button
              type="submit"
              disabled={emailUpdating || !isEmailDirty}
              className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-4 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-50"
            >
              {emailUpdating ? "Sending..." : "Request Email Change"}
            </button>
          </form>
        </section>

        {/* Change Password */}
        <section className="bg-white rounded-3xl p-6 shadow-soft border border-cream-150">
          <h2 className="font-display text-lg text-ink-900 mb-1">Change Password</h2>
          <p className="text-xs text-ink-500 mb-4">Update your signed-in password securely. Must be at least 6 characters long.</p>

          <form onSubmit={handleUpdatePassword} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-600"
                  minLength={6}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-600"
                  minLength={6}
                  required
                />
              </div>
            </div>

            {passSuccess && (
              <p className="text-xs text-forest-650 font-semibold">{passSuccess}</p>
            )}
            {passError && (
              <p className="text-xs text-terracotta-600 font-semibold">{passError}</p>
            )}

            <button
              type="submit"
              disabled={passUpdating || !isPassDirty}
              className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-4 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-50"
            >
              {passUpdating ? "Updating..." : "Update Password"}
            </button>
          </form>
        </section>

        {/* PWA Manual Install Instructions */}
        <section className="bg-white rounded-3xl p-6 shadow-soft border border-cream-150">
          <h2 className="font-display text-lg text-ink-900 mb-1">PWA Progressive Web App Settings</h2>
          <p className="text-xs text-ink-500 mb-4">Install Caregiver App directly onto your device for standalone offline reliability.</p>

          <div className="space-y-4 text-xs text-ink-750">
            <div className="bg-cream-50 p-4 rounded-2xl border border-cream-200">
              <h4 className="font-semibold text-ink-850 mb-2">Device Installation Manual Guide:</h4>
              <ul className="space-y-2.5 pl-1.5 list-none">
                <li className="flex gap-2 items-start">
                  <span className="font-bold text-forest-600 shrink-0">📱 iPhone & iPad:</span>
                  <span>Open Safari → Tap the <strong className="font-semibold text-ink-900">Share</strong> button at bottom → Scroll & select <strong className="font-semibold text-ink-900">Add to Home Screen</strong>.</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="font-bold text-forest-600 shrink-0">🤖 Android & Chrome:</span>
                  <span>Tap the Chrome menu (three dots) → Select <strong className="font-semibold text-ink-900">Install app</strong> or <strong className="font-semibold text-ink-900">Add to Home Screen</strong>.</span>
                </li>
                <li className="flex gap-2 items-start">
                  <span className="font-bold text-forest-600 shrink-0">💻 Desktop Chrome / Edge:</span>
                  <span>Click the <strong className="font-semibold text-ink-900">Install icon</strong> inside the address bar (far right) or choose <strong className="font-semibold text-ink-900">Install</strong> in browser menu.</span>
                </li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-2 pt-1.5">
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem("pwa_install_never_show");
                    localStorage.removeItem("pwa_install_dismissed_until");
                    alert("PWA automatic install banners reset. Banners will show on next reload if applicable.");
                    window.location.reload();
                  } catch {}
                }}
                className="bg-cream-200 hover:bg-cream-300 text-ink-700 px-4 py-2.5 rounded-xl font-semibold transition"
              >
                Reset install banners
              </button>
            </div>
          </div>
        </section>

        {/* Unsaved changes banner footer */}
        {isDirty && (
          <div className="bg-terracotta-500/10 border border-terracotta-500/20 rounded-2xl p-4 text-xs text-terracotta-700 font-semibold animate-pulse text-center">
            ⚠️ You have unsaved theme or credentials settings. Please save them before navigating away.
          </div>
        )}
      </div>
    </main>
  );
}
