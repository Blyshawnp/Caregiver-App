"use client";

import { useEffect, useState } from "react";
import { ArrowRightIcon } from "./icons";

const DISMISS_KEY = "caregiver-install-dismissed";
const DISMISS_DAYS = 14;

type Platform = "ios" | "android" | "desktop" | "unsupported";

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "unsupported";
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "desktop";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // iOS-specific
  if ((window.navigator as any).standalone === true) return true;
  // PWA standard
  return window.matchMedia("(display-mode: standalone)").matches;
}

function isDismissed(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const dismissedAt = parseInt(raw, 10);
    if (isNaN(dismissedAt)) return false;
    const days = (Date.now() - dismissedAt) / 86_400_000;
    return days < DISMISS_DAYS;
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>("unsupported");
  const [show, setShow] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const p = detectPlatform();
    setPlatform(p);

    if (isStandalone()) return;
    if (isDismissed()) return;

    if (p === "ios") {
      // iOS doesn't auto-prompt; show our banner after a short delay.
      const t = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(t);
    }

    if (p === "android" || p === "desktop") {
      // Listen for Chrome's beforeinstallprompt
      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setShow(true);
      };
      window.addEventListener("beforeinstallprompt", handler);
      return () => window.removeEventListener("beforeinstallprompt", handler);
    }
  }, []);

  function dismiss() {
    setShow(false);
    setShowIosSheet(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
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
        dismiss();
      }
    }
  }

  if (!show && !showIosSheet) return null;

  return (
    <>
      {/* Install banner */}
      {show && !showIosSheet && (
        <div className="fixed bottom-24 left-3 right-3 z-40 max-w-md mx-auto pb-[env(safe-area-inset-bottom)] animate-slide-up">
          <div className="bg-forest-600 text-cream-50 rounded-2xl shadow-lifted p-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-cream-50/15 grid place-items-center shrink-0">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16" />
              </svg>
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">Install Caregiver</p>
              <p className="text-xs text-cream-50/80">
                Add it to your home screen
              </p>
            </div>
            <button
              onClick={handleInstallClick}
              className="bg-cream-50 text-forest-700 px-3 py-1.5 rounded-xl text-sm font-medium transition active:scale-95"
            >
              Install
            </button>
            <button
              onClick={dismiss}
              aria-label="Dismiss"
              className="w-7 h-7 rounded-full hover:bg-cream-50/15 grid place-items-center transition shrink-0"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                className="w-4 h-4"
              >
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* iOS instruction sheet */}
      {showIosSheet && (
        <div
          className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-sm flex items-end justify-center px-3 pb-3 animate-fade-in"
          onClick={dismiss}
        >
          <div
            className="bg-cream-50 rounded-3xl shadow-lifted w-full max-w-md p-6 pb-8 grain-overlay relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative">
              <div className="w-12 h-1 bg-cream-200 rounded-full mx-auto mb-5" />
              <h2 className="font-display text-2xl text-ink-900 mb-1">
                Add to Home Screen
              </h2>
              <p className="text-sm text-ink-500 mb-5">
                Two taps to make Caregiver feel like a real app on your iPhone.
              </p>
              <ol className="space-y-3 mb-6">
                <Step n={1}>
                  Tap the{" "}
                  <span className="inline-flex items-center mx-1 px-1.5 py-0.5 bg-cream-200 rounded text-xs">
                    <ShareGlyph /> Share
                  </span>{" "}
                  button at the bottom of Safari
                </Step>
                <Step n={2}>
                  Scroll down and tap{" "}
                  <strong className="font-semibold">Add to Home Screen</strong>
                </Step>
                <Step n={3}>
                  Tap{" "}
                  <strong className="font-semibold">Add</strong>. The
                  Caregiver icon will appear with your other apps.
                </Step>
              </ol>
              <button
                onClick={dismiss}
                className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl font-medium transition"
              >
                Got it
              </button>
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
    <li className="flex gap-3 text-sm text-ink-700">
      <span className="w-6 h-6 rounded-full bg-forest-600 text-cream-50 grid place-items-center font-display text-sm shrink-0">
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
