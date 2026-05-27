"use client";

import { useState } from "react";
import type { Lang, TranslationKey } from "@/lib/i18n";
import { t } from "@/lib/i18n";

export function useTranslation(initialLang?: Lang) {
  const [lang] = useState<Lang>(() => {
    if (initialLang === "en" || initialLang === "es") return initialLang;
    if (typeof document !== "undefined") {
      const docLang = document.documentElement.lang as Lang | undefined;
      if (docLang === "en" || docLang === "es") return docLang;
    }
    return "en";
  });

  return {
    lang,
    t: (key: TranslationKey, vars?: Record<string, string | number>) =>
      t(key, lang, vars),
  };
}
