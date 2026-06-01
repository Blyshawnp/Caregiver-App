"use client";

import { useEffect, useState } from "react";

const DISMISS_UNTIL_KEY = "pwa_install_dismissed_until";
const NEVER_SHOW_KEY = "pwa_install_never_show";
const LAST_PROMPTED_KEY = "pwa_install_last_prompted_at";

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

function isPromptSuppressed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const neverShow = localStorage.getItem(NEVER_SHOW_KEY);
    if (neverShow === "true") return true;

    const dismissedUntil = localStorage.getItem(DISMISS_UNTIL_KEY);
    if (dismissedUntil) {
      const until = parseInt(dismissedUntil, 10);
      if (!isNaN(until) && Date.now() < until) return true;
    }

    // Avoid prompting repeatedly on every single page load
    const lastPrompt = localStorage.getItem(LAST_PROMPTED_KEY);
    if (lastPrompt) {
      const last = parseInt(lastPrompt, 10);
      // Wait at least 15 minutes between page load auto-prompts
      if (!isNaN(last) && Date.now() - last < 900_000) return true;
    }

    return false;
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>("unsupported");
  const [show, setShow] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);

    if (isStandalone()) return;
    if (isPromptSuppressed()) return;

    if (p === "ios") {
      const t = setTimeout(() => {
        setShow(true);
        try {
          localStorage.setItem(LAST_PROMPTED_KEY, String(Date.now()));
        } catch {}
      }, 5000);
      return () => clearTimeout(t);
    }

    if (p === "android" || p === "desktop") {
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setShow(true);
        try {
          localStorage.setItem(LAST_PROMPTED_KEY, String(Date.now()));
        } catch {}
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  function handleNotNow() {
    setShow(false);
    // Suppress for 1 hour
    try {
      localStorage.setItem(DISMISS_UNTIL_KEY, String(Date.now() + 3600_000));
    } catch {}
  }

  function handleRemindTomorrow() {
    setShow(false);
    setShowIosSheet(false);
    // Suppress for 24 hours
    try {
      localStorage.setItem(DISMISS_UNTIL_KEY, String(Date.now() + 24 * 3600_000));
    } catch {}
  }

  function handleNeverShow() {
    setShow(false);
    setShowIosSheet(false);
    try {
      localStorage.setItem(NEVER_SHOW_KEY, "true");
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
    }
  }

  if (!show && !showIosSheet) return null;

  return (
    <>
      {/* Install banner */}
      {show && !showIosSheet && (
        <div className="fixed bottom-24 left-3 right-3 z-40 max-w-md mx-auto pb-[env(safe-area-inset-bottom)] animate-slide-up">
          <div className="bg-forest-600 text-cream-50 rounded-3xl shadow-lifted p-5 flex flex-col gap-3.5 border border-forest-500/30">
            <div className="flex items-start justify-between">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cream-50/10 grid place-items-center font-display text-xl font-bold shrink-0 text-cream-50">
                  C
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight text-cream-50">Install Caregiver App</p>
                  <p className="text-[11px] text-cream-50/70 mt-0.5">
                    Add Caregiver App to your home screen for rapid offline check-ins, tasks, and notes.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-cream-50 hover:bg-cream-100 text-forest-700 py-2 rounded-xl text-xs font-semibold transition active:scale-95 text-center"
              >
                Install App
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
                Remind in 24h
              </button>
              <button onClick={handleNeverShow} className="hover:text-cream-50 hover:underline">
                Don't show again
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
                Two taps to make Caregiver App feel like a real app on your iPhone.
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
                  Remind tomorrow
                </button>
                <button
                  onClick={handleNeverShow}
                  className="bg-cream-100 hover:bg-cream-200 text-ink-500 px-4 py-3 rounded-2xl text-xs font-medium transition"
                >
                  Never
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
