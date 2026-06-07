"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export const PWA_INSTALL_NEVER_SHOW_KEY = "caregiver-app:pwa-install-never-show";
export const PWA_INSTALL_DISMISS_UNTIL_KEY = "caregiver-app:pwa-install-dismissed-until";
export const PWA_INSTALL_DISMISSED_SESSION_KEY = "caregiver-app:pwa-install-dismissed-session";
export const PWA_INSTALL_LAST_PROMPTED_KEY = "caregiver-app:pwa-install-last-prompted-at";
export const PWA_INSTALL_NOT_NOW_COOLDOWN_KEY = "caregiver-app:pwa-install-not-now-cooldown";

const LEGACY_PWA_INSTALL_NEVER_SHOW_KEY = "caregiver_app_pwa_install_never_show";
const LEGACY_PWA_INSTALL_DISMISS_UNTIL_KEY = "caregiver_app_pwa_install_dismissed_until";
const LEGACY_PWA_INSTALL_LAST_PROMPTED_KEY = "caregiver_app_pwa_install_last_prompted_at";

type Platform = "ios" | "android" | "desktop" | "unsupported";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unsupported";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

function isPromptSuppressed(pathname?: string | null): boolean {
  if (typeof window === "undefined") return true;
  try {
    // 1. If installed PWA mode is detected, never show install prompt
    if (isStandalone()) return true;

    // 8. Do not show install prompt on the Suppressed routes
    if (
      pathname === "/me/notifications" || 
      pathname?.endsWith("/notifications") ||
      pathname === "/login" ||
      pathname?.startsWith("/auth/") ||
      pathname === "/accept-invite" ||
      pathname === "/onboarding"
    ) {
      return true;
    }

    // 2. If localStorage installPromptNeverShow = true, never show install prompt
    const neverShow =
      localStorage.getItem(PWA_INSTALL_NEVER_SHOW_KEY) ??
      localStorage.getItem(LEGACY_PWA_INSTALL_NEVER_SHOW_KEY);
    if (neverShow === "true") return true;

    // 6. If user clicked Not now previously in the same session, hide repeatedly
    const sessionDismissed = sessionStorage.getItem(PWA_INSTALL_DISMISSED_SESSION_KEY);
    if (sessionDismissed === "true") return true;

    // 3. If localStorage installPromptDismissedUntil exists and Date.now() is before it, do not show
    const dismissedUntil =
      localStorage.getItem(PWA_INSTALL_DISMISS_UNTIL_KEY) ??
      localStorage.getItem(LEGACY_PWA_INSTALL_DISMISS_UNTIL_KEY);
    if (dismissedUntil) {
      const until = parseInt(dismissedUntil, 10);
      if (!isNaN(until) && Date.now() < until) return true;
    }

    // 6. Not now 1-hour cooldown check
    const notNowCooldown = localStorage.getItem(PWA_INSTALL_NOT_NOW_COOLDOWN_KEY);
    if (notNowCooldown) {
      const cooldownTime = parseInt(notNowCooldown, 10);
      if (!isNaN(cooldownTime) && Date.now() < cooldownTime) return true;
    }

    // 8. Do not show while notification permission prompt is active
    const isPushPromptActive = document.body.innerHTML.includes("Get important alerts");
    if (isPushPromptActive) return true;

    // 8. Do not show while modal dialogs are open
    const isModalOpen = !!document.querySelector('[role="dialog"]') || !!document.querySelector('[aria-modal="true"]');
    if (isModalOpen) return true;

    // Avoid prompting repeatedly on every single page load (cooldown of 15 min unless forced)
    const lastPrompt =
      localStorage.getItem(PWA_INSTALL_LAST_PROMPTED_KEY) ??
      localStorage.getItem(LEGACY_PWA_INSTALL_LAST_PROMPTED_KEY);
    if (lastPrompt) {
      const last = parseInt(lastPrompt, 10);
      if (!isNaN(last) && Date.now() - last < 900_000) return true;
    }

    return false;
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const pathname = usePathname();
  const [platform, setPlatform] = useState<Platform>("unsupported");
  const [show, setShow] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [showManualSheet, setShowManualSheet] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Initialize first sign-in session flag
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasSeenFirstSignIn = localStorage.getItem("caregiver-app:first-signin-seen") === "true";
    if (!hasSeenFirstSignIn) {
      localStorage.setItem("caregiver-app:first-signin-seen", "true");
      sessionStorage.setItem("caregiver-app:is-first-signin-session", "true");
    }
  }, []);

  // Monitor Supabase auth session
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Register beforeinstallprompt globally once on mount
  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);

    if (p === "android" || p === "desktop") {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  // Handle display logic based on pathname, platform, deferred prompt, suppression state, and authentication
  useEffect(() => {
    if (!isAuthenticated || isPromptSuppressed(pathname)) {
      setShow(false);
      return;
    }

    if (show) return;

    // Delay slightly (2 seconds) after page load and auth resolution
    const t = setTimeout(() => {
      if (isPromptSuppressed(pathname)) return;

      // If beforeinstallprompt is not available, show manual guidance sheet once after first sign-in session
      if (!deferredPrompt && platform !== "ios") {
        const isFirstSession = sessionStorage.getItem("caregiver-app:is-first-signin-session") === "true";
        if (!isFirstSession) return;
      }

      setShow(true);
      try {
        localStorage.setItem(PWA_INSTALL_LAST_PROMPTED_KEY, String(Date.now()));
      } catch {}
    }, 2000);

    return () => clearTimeout(t);
  }, [pathname, platform, deferredPrompt, isAuthenticated, show]);

  // Keep advanced diagnostics written to localStorage so the Notifications settings page can read it
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const neverShowVal =
        localStorage.getItem(PWA_INSTALL_NEVER_SHOW_KEY) === "true" ||
        localStorage.getItem(LEGACY_PWA_INSTALL_NEVER_SHOW_KEY) === "true";
      const sessionDismissedVal = sessionStorage.getItem(PWA_INSTALL_DISMISSED_SESSION_KEY) === "true";
      const dismissedUntilVal =
        localStorage.getItem(PWA_INSTALL_DISMISS_UNTIL_KEY) ??
        localStorage.getItem(LEGACY_PWA_INSTALL_DISMISS_UNTIL_KEY);

      const dismissedUntilExpired = dismissedUntilVal 
        ? Date.now() > parseInt(dismissedUntilVal, 10)
        : true;

      const notNowCooldownVal = localStorage.getItem(PWA_INSTALL_NOT_NOW_COOLDOWN_KEY);
      const notNowCooldownExpired = notNowCooldownVal
        ? Date.now() > parseInt(notNowCooldownVal, 10)
        : true;

      const isSuppressedRoute = 
        pathname === "/me/notifications" || 
        pathname?.endsWith("/notifications") ||
        pathname === "/login" ||
        pathname?.startsWith("/auth/") ||
        pathname === "/accept-invite" ||
        pathname === "/onboarding";

      const isModalOpen = !!document.querySelector('[role="dialog"]') || !!document.querySelector('[aria-modal="true"]');

      let reason = "showing";
      if (!isAuthenticated) reason = "auth_not_ready";
      else if (isStandalone()) reason = "installed";
      else if (neverShowVal) reason = "never_show";
      else if (dismissedUntilVal && !dismissedUntilExpired) reason = "dismissed_until_future";
      else if (notNowCooldownVal && !notNowCooldownExpired) reason = "dismissed_until_future";
      else if (sessionDismissedVal) reason = "session_dismissed";
      else if (isSuppressedRoute) reason = "route_suppressed";
      else if (isModalOpen) reason = "modal_open";
      else if (!deferredPrompt && platform !== "ios") {
        const isFirstSession = sessionStorage.getItem("caregiver-app:is-first-signin-session") === "true";
        if (!isFirstSession) {
          reason = "prompt_event_missing";
        }
      }

      const shouldShowInstallPrompt = 
        isAuthenticated &&
        !isStandalone() &&
        !isSuppressedRoute &&
        !neverShowVal &&
        dismissedUntilExpired &&
        notNowCooldownExpired &&
        !sessionDismissedVal &&
        !isModalOpen &&
        (!!deferredPrompt || platform === "ios" || sessionStorage.getItem("caregiver-app:is-first-signin-session") === "true");

      const details = {
        currentRoute: pathname || "/",
        authenticated: isAuthenticated,
        installedPwaModeDetected: isStandalone(),
        beforeinstallpromptAvailable: !!deferredPrompt,
        neverShow: neverShowVal,
        dismissedUntil: dismissedUntilVal ? new Date(parseInt(dismissedUntilVal, 10)).toISOString() : null,
        dismissedUntilExpired,
        sessionDismissed: sessionDismissedVal,
        shouldShowInstallPrompt,
        hiddenReason: shouldShowInstallPrompt ? "showing" : reason,
      };

      localStorage.setItem("caregiver-app:install-prompt-diagnostics", JSON.stringify(details));
    } catch {}
  }, [pathname, platform, deferredPrompt, show, showIosSheet, showManualSheet, isAuthenticated]);

  // 6. Not now dismiss handler (current session only + 1 hour cooldown)
  function handleNotNow() {
    setShow(false);
    setShowManualSheet(false);
    try {
      sessionStorage.setItem(PWA_INSTALL_DISMISSED_SESSION_KEY, "true");
      localStorage.setItem(PWA_INSTALL_NOT_NOW_COOLDOWN_KEY, String(Date.now() + 3600_000));
    } catch {}
  }

  // 5. Don't show for 24 hours handler
  function handleRemindTomorrow() {
    setShow(false);
    setShowIosSheet(false);
    setShowManualSheet(false);
    try {
      localStorage.setItem(PWA_INSTALL_DISMISS_UNTIL_KEY, String(Date.now() + 24 * 3600_000));
    } catch {}
  }

  // 4. Don't show again handler
  function handleNeverShow() {
    setShow(false);
    setShowIosSheet(false);
    setShowManualSheet(false);
    try {
      localStorage.setItem(PWA_INSTALL_NEVER_SHOW_KEY, "true");
    } catch {}
  }

  async function handleInstallClick() {
    if (platform === "ios") {
      setShowIosSheet(true);
      return;
    }
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      if (outcome === "accepted") {
        setShow(false);
      } else {
        handleRemindTomorrow();
      }
    } else {
      // 9. If beforeinstallprompt is missing, show manual guidance sheet
      setShowManualSheet(true);
    }
  }

  if (isPromptSuppressed(pathname)) return null;
  if (!show && !showIosSheet && !showManualSheet) return null;

  return (
    <>
      {/* Install banner */}
      {show && !showIosSheet && !showManualSheet && (
        <div className="fixed bottom-24 left-3 right-3 z-40 max-w-md mx-auto pb-[env(safe-area-inset-bottom)] animate-slide-up">
          <div className="bg-forest-600 text-cream-50 rounded-3xl shadow-lifted p-5 flex flex-col gap-3.5 border border-forest-500/30">
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cream-50/10 grid place-items-center font-display text-xl font-bold shrink-0 text-cream-50">
                  C
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight text-cream-50">Install Carer Vista Pro</p>
                  <p className="text-[11px] text-cream-50/70 mt-0.5">
                    Add Carer Vista Pro to your home screen for rapid offline check-ins, tasks, and notes.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-cream-50 hover:bg-cream-100 text-forest-700 py-2 rounded-xl text-xs font-semibold transition active:scale-95 text-center"
              >
                Install app
              </button>
              <button
                onClick={handleNotNow}
                className="bg-forest-700/40 hover:bg-forest-700/60 text-cream-50 px-3 py-2 rounded-xl text-xs font-medium transition"
              >
                Not now
              </button>
            </div>

            <div className="flex justify-between items-center border-t border-cream-50/10 pt-2 text-[10px] text-cream-50/60 font-medium">
              <button onClick={handleRemindTomorrow} className="hover:text-cream-50 hover:underline">
                Don&apos;t show for 24 hours
              </button>
              <button onClick={handleNeverShow} className="hover:text-cream-50 hover:underline">
                Don&apos;t show again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS instruction sheet */}
      {showIosSheet && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm flex items-end justify-center px-3 pb-3 animate-fade-in"
          onClick={() => setShowIosSheet(false)}
        >
          <div
            className="bg-cream-50 rounded-3xl shadow-lifted w-full max-w-md p-6 pb-8 grain-overlay relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <div className="w-12 h-1 bg-cream-200 rounded-full mx-auto mb-5" />
              <h2 className="font-display text-2xl text-ink-900 mb-1">Add to Home Screen</h2>
              <p className="text-sm text-ink-500 mb-5">
                Two taps to make Carer Vista Pro feel like a real app on your iPhone.
              </p>
              <ol className="space-y-3.5 mb-6">
                <Step n={1}>
                  Tap the{" "}
                  <span className="inline-flex items-center mx-1 px-1.5 py-0.5 bg-cream-200 rounded text-[11px] font-semibold text-ink-800">
                    <ShareGlyph /> Share
                  </span>{" "}
                  button at the bottom of Safari
                </Step>
                <Step n={2}>
                  Scroll down and tap <strong className="font-semibold text-ink-950">Add to Home Screen</strong>
                </Step>
                <Step n={3}>
                  Tap <strong className="font-semibold text-ink-950">Add</strong>. The icon will appear with your other apps.
                </Step>
              </ol>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowIosSheet(false)}
                  className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-xs font-semibold transition"
                >
                  Got it
                </button>
                <button
                  onClick={handleRemindTomorrow}
                  className="bg-cream-200 hover:bg-cream-300 text-ink-700 px-4 py-3 rounded-2xl text-xs font-semibold transition"
                >
                  Don&apos;t show for 24 hours
                </button>
                <button
                  onClick={handleNeverShow}
                  className="bg-cream-100 hover:bg-cream-200 text-ink-500 px-4 py-3 rounded-2xl text-xs font-medium transition"
                >
                  Don&apos;t show again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Manual guidance instruction sheet for desktop/android when beforeinstallprompt is missing */}
      {showManualSheet && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm flex items-end justify-center px-3 pb-3 animate-fade-in"
          onClick={() => setShowManualSheet(false)}
        >
          <div
            className="bg-cream-50 rounded-3xl shadow-lifted w-full max-w-md p-6 pb-8 grain-overlay relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <div className="w-12 h-1 bg-cream-200 rounded-full mx-auto mb-5" />
              <h2 className="font-display text-2xl text-ink-900 mb-1">Add to Home Screen</h2>
              <p className="text-sm text-ink-500 mb-5">
                Add Carer Vista Pro to your device using your browser settings:
              </p>
              <ol className="space-y-3.5 mb-6">
                <Step n={1}>
                  Open your browser menu (usually three dots or menu icon at the top/bottom)
                </Step>
                <Step n={2}>
                  Look for <strong className="font-semibold text-ink-950">Add to Home Screen</strong> or <strong className="font-semibold text-ink-950">Install App</strong>
                </Step>
                <Step n={3}>
                  Tap it to install Carer Vista Pro on your device.
                </Step>
              </ol>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowManualSheet(false)}
                  className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-xs font-semibold transition"
                >
                  Got it
                </button>
                <button
                  onClick={handleRemindTomorrow}
                  className="bg-cream-200 hover:bg-cream-300 text-ink-700 px-4 py-3 rounded-2xl text-xs font-semibold transition"
                >
                  Don&apos;t show for 24 hours
                </button>
                <button
                  onClick={handleNeverShow}
                  className="bg-cream-100 hover:bg-cream-200 text-ink-500 px-4 py-3 rounded-2xl text-xs font-medium transition"
                >
                  Don&apos;t show again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-up {
          from {
            transform: translateY(120%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 text-sm text-ink-750">
      <span className="w-6 h-6 rounded-full bg-forest-600 text-cream-50 grid place-items-center font-display text-sm shrink-0 font-bold">
        {n}
      </span>
      <span className="leading-snug pt-0.5">{children}</span>
    </li>
  );
}

function ShareGlyph() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-3.5 h-3.5 mr-1"
    >
      <path d="M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6" />
    </svg>
  );
}
