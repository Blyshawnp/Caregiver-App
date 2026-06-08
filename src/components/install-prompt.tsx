"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ALERT_PROMPT_DISMISSED_EVENT } from "@/components/push-permission-prompt";

export const PWA_INSTALL_NEVER_SHOW_KEY = "cvp_install_prompt_never_show";
export const PWA_INSTALL_DISMISS_UNTIL_KEY = "cvp_install_prompt_dismissed_until";
export const PWA_INSTALL_DISMISSED_SESSION_KEY = "cvp_install_prompt_session_dismissed";
export const PWA_INSTALL_LAST_PROMPTED_KEY = "cvp_install_prompt_last_prompted_at";
export const PWA_INSTALL_LAST_ACTION_KEY = "cvp_install_prompt_last_action";
export const PWA_INSTALL_DIAGNOSTICS_KEY = "cvp_install_prompt_diagnostics";

const LEGACY_PWA_INSTALL_NEVER_SHOW_KEYS = [
  "caregiver-app:pwa-install-never-show",
  "caregiver_app_pwa_install_never_show",
  "pwa_install_never_show",
];
const LEGACY_PWA_INSTALL_DISMISS_UNTIL_KEYS = [
  "caregiver-app:pwa-install-dismissed-until",
  "caregiver_app_pwa_install_dismissed_until",
  "pwa_install_dismissed_until",
];
const LEGACY_PWA_INSTALL_LAST_PROMPTED_KEYS = [
  "caregiver-app:pwa-install-last-prompted-at",
  "caregiver_app_pwa_install_last_prompted_at",
  "pwa_install_last_prompted_at",
];
const LEGACY_PWA_INSTALL_SESSION_KEYS = [
  "caregiver-app:pwa-install-dismissed-session",
];
const LEGACY_PWA_INSTALL_NOT_NOW_COOLDOWN_KEY =
  "caregiver-app:pwa-install-not-now-cooldown";
const LEGACY_DIAGNOSTICS_KEY = "caregiver-app:install-prompt-diagnostics";
const PROMPT_DELAY_MS = 1800;
const REPROMPT_COOLDOWN_MS = 15 * 60_000;

type Platform = "ios" | "android" | "desktop" | "unsupported";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type InstallPromptDiagnostics = {
  shouldShowInstallPrompt: boolean;
  hiddenReason: string;
  currentRoute: string;
  authenticated: boolean;
  appShellReady: boolean;
  installedPwaModeDetected: boolean;
  beforeinstallpromptAvailable: boolean;
  manualFallbackAllowed: boolean;
  installPromptNeverShow: boolean;
  installPromptDismissedUntil: string | null;
  dismissedUntilExpired: boolean;
  installPromptSessionDismissed: boolean;
  notificationPromptOpen: boolean;
  blockingModalOpen: boolean;
  lastInstallPromptAction: string | null;
  storageKeysUsed: string[];
  publicPrivateDifferenceFound: string;
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

function readLocalStorage(keys: string[]) {
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value !== null) return value;
  }
  return null;
}

function getDismissedUntil() {
  return readLocalStorage([
    PWA_INSTALL_DISMISS_UNTIL_KEY,
    ...LEGACY_PWA_INSTALL_DISMISS_UNTIL_KEYS,
    LEGACY_PWA_INSTALL_NOT_NOW_COOLDOWN_KEY,
  ]);
}

function isSuppressedRoute(pathname?: string | null): boolean {
  return (
    pathname === "/me/notifications" ||
    pathname?.endsWith("/notifications") ||
    pathname === "/login" ||
    pathname?.startsWith("/auth/") ||
    pathname === "/accept-invite" ||
    pathname === "/setup" ||
    pathname === "/onboarding"
  );
}

function isNotificationPromptOpen() {
  if (typeof document === "undefined") return false;
  return document.body?.innerHTML?.includes("Get important alerts") ?? false;
}

function isBlockingModalOpen() {
  if (typeof document === "undefined") return false;
  const dialogs = Array.from(
    document.querySelectorAll('[role="dialog"], [aria-modal="true"]')
  );
  return dialogs.some(
    (element) => !element.closest("[data-install-prompt-modal='true']")
  );
}

function buildDiagnostics({
  pathname,
  isAuthenticated,
  appShellReady,
  deferredPrompt,
  platform,
}: {
  pathname: string | null;
  isAuthenticated: boolean;
  appShellReady: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  platform: Platform;
}): InstallPromptDiagnostics {
  const neverShow =
    localStorage.getItem(PWA_INSTALL_NEVER_SHOW_KEY) === "true" ||
    LEGACY_PWA_INSTALL_NEVER_SHOW_KEYS.some(
      (key) => localStorage.getItem(key) === "true"
    );
  const dismissedUntil = getDismissedUntil();
  const dismissedUntilMs = dismissedUntil ? Number(dismissedUntil) : NaN;
  const dismissedUntilExpired =
    !dismissedUntil || Number.isNaN(dismissedUntilMs) || Date.now() >= dismissedUntilMs;
  const sessionDismissed =
    sessionStorage.getItem(PWA_INSTALL_DISMISSED_SESSION_KEY) === "true" ||
    LEGACY_PWA_INSTALL_SESSION_KEYS.some(
      (key) => sessionStorage.getItem(key) === "true"
    );
  const lastPrompt = readLocalStorage([
    PWA_INSTALL_LAST_PROMPTED_KEY,
    ...LEGACY_PWA_INSTALL_LAST_PROMPTED_KEYS,
  ]);
  const lastPromptMs = lastPrompt ? Number(lastPrompt) : NaN;
  const promptCooldownActive =
    !!lastPrompt && !Number.isNaN(lastPromptMs) && Date.now() - lastPromptMs < REPROMPT_COOLDOWN_MS;
  const notificationPromptOpen = isNotificationPromptOpen();
  const blockingModalOpen = isBlockingModalOpen();
  const installedPwaModeDetected = isStandalone();
  const routeSuppressed = isSuppressedRoute(pathname);
  const manualFallbackAllowed = !installedPwaModeDetected && platform !== "unsupported";

  let hiddenReason = "eligible";
  if (!isAuthenticated) hiddenReason = "auth_not_ready";
  else if (!appShellReady) hiddenReason = "app_shell_not_ready";
  else if (installedPwaModeDetected) hiddenReason = "installed_pwa_mode";
  else if (routeSuppressed) hiddenReason = "route_suppressed";
  else if (neverShow) hiddenReason = "never_show";
  else if (!dismissedUntilExpired) hiddenReason = "dismissed_until_future";
  else if (sessionDismissed) hiddenReason = "session_dismissed";
  else if (notificationPromptOpen) hiddenReason = "notification_prompt_open";
  else if (blockingModalOpen) hiddenReason = "blocking_modal_open";
  else if (promptCooldownActive) hiddenReason = "recently_prompted";

  const shouldShowInstallPrompt = hiddenReason === "eligible";

  return {
    shouldShowInstallPrompt,
    hiddenReason: shouldShowInstallPrompt ? "showing" : hiddenReason,
    currentRoute: pathname || "/",
    authenticated: isAuthenticated,
    appShellReady,
    installedPwaModeDetected,
    beforeinstallpromptAvailable: !!deferredPrompt,
    manualFallbackAllowed,
    installPromptNeverShow: neverShow,
    installPromptDismissedUntil: dismissedUntil
      ? new Date(Number(dismissedUntil)).toISOString()
      : null,
    dismissedUntilExpired,
    installPromptSessionDismissed: sessionDismissed,
    notificationPromptOpen,
    blockingModalOpen,
    lastInstallPromptAction: localStorage.getItem(PWA_INSTALL_LAST_ACTION_KEY),
    storageKeysUsed: [
      PWA_INSTALL_NEVER_SHOW_KEY,
      PWA_INSTALL_DISMISS_UNTIL_KEY,
      PWA_INSTALL_DISMISSED_SESSION_KEY,
      PWA_INSTALL_LAST_PROMPTED_KEY,
      PWA_INSTALL_LAST_ACTION_KEY,
    ],
    publicPrivateDifferenceFound:
      "Private previously did not re-evaluate after the alert prompt was dismissed; public listened for push-prompt-dismissed.",
  };
}

function writeDiagnostics(details: InstallPromptDiagnostics) {
  localStorage.setItem(PWA_INSTALL_DIAGNOSTICS_KEY, JSON.stringify(details));
  localStorage.setItem(LEGACY_DIAGNOSTICS_KEY, JSON.stringify(details));
}

export default function InstallPrompt() {
  const pathname = usePathname();
  const [platform, setPlatform] = useState<Platform>("unsupported");
  const [show, setShow] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [showManualSheet, setShowManualSheet] = useState(false);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [appShellReady, setAppShellReady] = useState(false);
  const [coordinationTick, setCoordinationTick] = useState(0);

  useEffect(() => {
    setPlatform(detectPlatform());
    const readyTimer = window.setTimeout(() => setAppShellReady(true), 1000);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCoordinationTick((current) => current + 1);
    };
    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.clearTimeout(readyTimer);
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) setIsAuthenticated(!!session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onPromptClosed = () => {
      window.setTimeout(
        () => setCoordinationTick((current) => current + 1),
        250
      );
    };

    window.addEventListener(ALERT_PROMPT_DISMISSED_EVENT, onPromptClosed);
    window.addEventListener("push-prompt-dismissed", onPromptClosed);
    window.addEventListener("install-prompt-preference-reset", onPromptClosed);

    return () => {
      window.removeEventListener(ALERT_PROMPT_DISMISSED_EVENT, onPromptClosed);
      window.removeEventListener("push-prompt-dismissed", onPromptClosed);
      window.removeEventListener("install-prompt-preference-reset", onPromptClosed);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const timer = window.setTimeout(() => {
      const details = buildDiagnostics({
        pathname,
        isAuthenticated,
        appShellReady,
        deferredPrompt,
        platform,
      });
      writeDiagnostics(details);

      if (!details.shouldShowInstallPrompt) {
        setShow(false);
        return;
      }

      setShow(true);
      localStorage.setItem(PWA_INSTALL_LAST_PROMPTED_KEY, String(Date.now()));
    }, PROMPT_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [
    pathname,
    platform,
    deferredPrompt,
    isAuthenticated,
    appShellReady,
    coordinationTick,
  ]);

  function recordAction(action: string) {
    try {
      localStorage.setItem(PWA_INSTALL_LAST_ACTION_KEY, action);
    } catch {
      /* ignore */
    }
  }

  function handleNotNow() {
    setShow(false);
    setShowManualSheet(false);
    setShowIosSheet(false);
    try {
      sessionStorage.setItem(PWA_INSTALL_DISMISSED_SESSION_KEY, "true");
      recordAction("not_now");
    } catch {
      /* ignore */
    }
  }

  function handleRemindTomorrow() {
    setShow(false);
    setShowIosSheet(false);
    setShowManualSheet(false);
    try {
      localStorage.setItem(
        PWA_INSTALL_DISMISS_UNTIL_KEY,
        String(Date.now() + 24 * 3600_000)
      );
      recordAction("dismiss_24_hours");
    } catch {
      /* ignore */
    }
  }

  function handleNeverShow() {
    setShow(false);
    setShowIosSheet(false);
    setShowManualSheet(false);
    try {
      localStorage.setItem(PWA_INSTALL_NEVER_SHOW_KEY, "true");
      recordAction("never_show");
    } catch {
      /* ignore */
    }
  }

  async function handleInstallClick() {
    recordAction("install_clicked");

    if (platform === "ios") {
      setShowIosSheet(true);
      return;
    }

    if (!deferredPrompt) {
      setShowManualSheet(true);
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);

    if (outcome === "accepted") {
      setShow(false);
      recordAction("install_accepted");
    } else {
      recordAction("install_dismissed");
      handleNotNow();
    }
  }

  if (!show && !showIosSheet && !showManualSheet) return null;

  return (
    <>
      {show && !showIosSheet && !showManualSheet && (
        <div className="fixed bottom-24 left-3 right-3 z-40 max-w-md mx-auto pb-[env(safe-area-inset-bottom)] animate-slide-up">
          <div className="bg-forest-600 text-cream-50 rounded-3xl shadow-lifted p-5 flex flex-col gap-3.5 border border-forest-500/30">
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cream-50/10 grid place-items-center font-display text-xl font-bold shrink-0 text-cream-50">
                  C
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight text-cream-50">
                    Install Carer Vista Pro
                  </p>
                  <p className="text-[11px] text-cream-50/70 mt-0.5">
                    Add Carer Vista Pro to your home screen for rapid offline
                    check-ins, tasks, and notes.
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
              <button
                onClick={handleRemindTomorrow}
                className="hover:text-cream-50 hover:underline"
              >
                Don&apos;t show for 24 hours
              </button>
              <button
                onClick={handleNeverShow}
                className="hover:text-cream-50 hover:underline"
              >
                Don&apos;t show again
              </button>
            </div>
          </div>
        </div>
      )}

      {showIosSheet && (
        <InstallInstructions
          title="Add to Home Screen"
          description="Two taps to make Carer Vista Pro feel like a real app on your iPhone."
          steps={[
            <>
              Tap the{" "}
              <span className="inline-flex items-center mx-1 px-1.5 py-0.5 bg-cream-200 rounded text-[11px] font-semibold text-ink-800">
                <ShareGlyph /> Share
              </span>{" "}
              button at the bottom of Safari
            </>,
            <>
              Scroll down and tap{" "}
              <strong className="font-semibold text-ink-950">
                Add to Home Screen
              </strong>
            </>,
            <>
              Tap <strong className="font-semibold text-ink-950">Add</strong>.
              The icon will appear with your other apps.
            </>,
          ]}
          onClose={() => setShowIosSheet(false)}
          onRemindTomorrow={handleRemindTomorrow}
          onNeverShow={handleNeverShow}
        />
      )}

      {showManualSheet && (
        <InstallInstructions
          title="Install from browser settings"
          description="This browser did not offer an automatic install button, but you can still add the app from browser settings."
          steps={[
            "Open your browser menu, usually the three-dot or share menu.",
            "Choose Install app or Add to Home Screen.",
            "Confirm the install, then open Carer Vista Pro from the installed icon.",
          ]}
          onClose={() => {
            setShow(false);
            setShowManualSheet(false);
            recordAction("manual_guidance_closed");
          }}
          onRemindTomorrow={handleRemindTomorrow}
          onNeverShow={handleNeverShow}
        />
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

function InstallInstructions({
  title,
  description,
  steps,
  onClose,
  onRemindTomorrow,
  onNeverShow,
}: {
  title: string;
  description: string;
  steps: React.ReactNode[];
  onClose: () => void;
  onRemindTomorrow: () => void;
  onNeverShow: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm flex items-end justify-center px-3 pb-3 animate-fade-in"
      data-install-prompt-modal="true"
      onClick={onClose}
    >
      <div
        className="bg-cream-50 rounded-3xl shadow-lifted w-full max-w-md p-6 pb-8 grain-overlay relative"
        role="dialog"
        aria-modal="true"
        data-install-prompt-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          <div className="w-12 h-1 bg-cream-200 rounded-full mx-auto mb-5" />
          <h2 className="font-display text-2xl text-ink-900 mb-1">{title}</h2>
          <p className="text-sm text-ink-500 mb-5">{description}</p>
          <ol className="space-y-3.5 mb-6">
            {steps.map((step, index) => (
              <Step key={index} n={index + 1}>
                {step}
              </Step>
            ))}
          </ol>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-xs font-semibold transition"
            >
              Got it
            </button>
            <button
              onClick={onRemindTomorrow}
              className="bg-cream-200 hover:bg-cream-300 text-ink-700 px-4 py-3 rounded-2xl text-xs font-semibold transition"
            >
              Don&apos;t show for 24 hours
            </button>
            <button
              onClick={onNeverShow}
              className="bg-cream-100 hover:bg-cream-200 text-ink-500 px-4 py-3 rounded-2xl text-xs font-medium transition"
            >
              Don&apos;t show again
            </button>
          </div>
        </div>
      </div>
    </div>
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
