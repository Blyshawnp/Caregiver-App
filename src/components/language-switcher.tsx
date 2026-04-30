"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Lang } from "@/lib/i18n";

export default function LanguageSwitcher({
  initialLanguage,
  userId,
  labels,
}: {
  initialLanguage: Lang;
  userId: string;
  labels: { title: string; subtitle: string; en: string; es: string };
}) {
  const router = useRouter();
  const [lang, setLang] = useState<Lang>(initialLanguage);
  const [saving, setSaving] = useState(false);

  async function pick(next: Lang) {
    if (next === lang || saving) return;
    setSaving(true);
    setLang(next);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ language: next })
      .eq("id", userId);

    setSaving(false);

    if (error) {
      // Revert UI on error
      setLang(initialLanguage);
      alert(error.message);
      return;
    }

    // Refresh server components so all visible text re-renders with the
    // new language right away.
    router.refresh();
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft p-5 grain-overlay">
      <div className="relative">
        <p className="font-display text-base mb-1">{labels.title}</p>
        <p className="text-xs text-ink-500 mb-3">{labels.subtitle}</p>
        <div className="grid grid-cols-2 bg-cream-50 border border-cream-200 rounded-xl p-1 gap-1">
          <button
            type="button"
            onClick={() => pick("en")}
            className={`py-2 rounded-lg text-sm font-medium transition ${
              lang === "en"
                ? "bg-forest-600 text-cream-50"
                : "text-ink-700 hover:text-ink-900"
            }`}
          >
            {labels.en}
          </button>
          <button
            type="button"
            onClick={() => pick("es")}
            className={`py-2 rounded-lg text-sm font-medium transition ${
              lang === "es"
                ? "bg-forest-600 text-cream-50"
                : "text-ink-700 hover:text-ink-900"
            }`}
          >
            {labels.es}
          </button>
        </div>
      </div>
    </div>
  );
}
