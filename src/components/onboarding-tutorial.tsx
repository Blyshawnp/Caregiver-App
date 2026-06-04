"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSafeIntroVideoEmbedUrl } from "@/lib/intro-video";

type TutorialRole = "admin" | "client" | "caregiver" | "family" | string;

type TutorialSlide = {
  title: string;
  body: string;
  items: string[];
};

export default function OnboardingTutorial({
  role,
  completed,
  introVideoUrl,
  introVideoEnabled,
  showIntroVideoOnFirstLogin,
}: {
  role: TutorialRole;
  completed: boolean;
  introVideoUrl: string | null;
  introVideoEnabled: boolean;
  showIntroVideoOnFirstLogin: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!completed);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const embedUrl =
    introVideoEnabled && showIntroVideoOnFirstLogin
      ? getSafeIntroVideoEmbedUrl(introVideoUrl)
      : null;
  const slides = useMemo(() => buildSlides(role, embedUrl), [role, embedUrl]);
  const current = slides[index];

  if (!open || !current) return null;

  async function finish(skipped: boolean) {
    setSaving(true);
    await fetch("/api/tutorial/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skipped }),
    }).catch(() => null);
    setOpen(false);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink-950/40 px-4 py-6 overflow-y-auto">
      <div className="mx-auto max-w-lg rounded-3xl bg-white shadow-soft border border-cream-200 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-forest-700 font-semibold">
              First-time guide
            </p>
            <h2 className="font-display text-2xl text-ink-900">{current.title}</h2>
          </div>
          <Link
            href="/emergency"
            className="shrink-0 rounded-xl bg-terracotta-600 px-3 py-2 text-xs font-semibold text-white"
          >
            Emergency
          </Link>
        </div>

        {current.body && <p className="text-sm text-ink-600">{current.body}</p>}
        {index === 0 && embedUrl && (
          <div className="aspect-video overflow-hidden rounded-2xl bg-ink-100 border border-cream-200">
            <iframe
              src={embedUrl}
              title="Introduction video"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        <ul className="space-y-2 text-sm text-ink-700">
          {current.items.map((item) => (
            <li key={item} className="rounded-2xl bg-cream-50 px-3 py-2">
              {item}
            </li>
          ))}
        </ul>

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => finish(true)}
            className="text-sm font-semibold text-ink-500 hover:text-ink-800"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={() => setIndex(index - 1)}
                className="rounded-xl bg-cream-200 px-4 py-2 text-xs font-semibold text-ink-700"
              >
                Back
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (index < slides.length - 1) {
                  setIndex(index + 1);
                } else {
                  finish(false);
                }
              }}
              className="rounded-xl bg-forest-600 px-4 py-2 text-xs font-semibold text-cream-50 disabled:opacity-60"
            >
              {index < slides.length - 1 ? "Next" : saving ? "Saving..." : "Finish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildSlides(role: TutorialRole, embedUrl: string | null): TutorialSlide[] {
  const intro: TutorialSlide[] = embedUrl
    ? [
        {
          title: "Welcome",
          body: "This short guide covers the main places to start. You can skip it or restart it from Help later.",
          items: ["Watch the intro video if it is configured.", "Emergency access stays available while this guide is open."],
        },
      ]
    : [];

  if (role === "caregiver") {
    return [
      ...intro,
      {
        title: "Your shifts",
        body: "Start with the work assigned to you.",
        items: ["View assigned shifts.", "Review pets before accepting shifts.", "Accept a shift when you can cover it."],
      },
      {
        title: "During a shift",
        body: "Use the shift detail page as your working checklist.",
        items: ["Check in and check out.", "Complete required and optional tasks.", "Mark PRN tasks with the correct status.", "View emergency info and documents."],
      },
      {
        title: "Stay connected",
        body: "Turn on the device features that help you avoid missing updates.",
        items: ["Enable notifications.", "Install the app from browser settings.", "Use Messages for care-circle communication."],
      },
    ];
  }

  if (role === "family" || role === "client") {
    return [
      ...intro,
      {
        title: "Follow care activity",
        body: "Use the app to see what is happening in the care circle.",
        items: ["View the schedule.", "Review care notes, tasks, pets, documents, and emergency info when allowed.", "Submit feedback, commendations, or concerns."],
      },
      {
        title: "Approvals and records",
        body: "Some workflows may need client or admin review.",
        items: ["Approve print requests when applicable.", "Request schedule coverage if available.", "Review invoices if your role allows it."],
      },
    ];
  }

  return [
    ...intro,
    {
      title: "Set up care",
      body: "Create the core records caregivers need before the first shift.",
      items: ["Add a client or care recipient.", "Add a caregiver or team member.", "Add emergency info, pet info, and documents or instructions."],
    },
    {
      title: "Create the first shift",
      body: "The schedule is where caregivers see and manage assigned care.",
      items: ["Create the first shift.", "Enable notifications.", "Install the app.", "Review print approval and invoice settings if relevant."],
    },
  ];
}
