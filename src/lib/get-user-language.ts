import { createClient } from "@/lib/supabase/server";
import type { Lang } from "@/lib/i18n";

/**
 * Returns the current user's language preference, or 'en' if not set or
 * not signed in. Safe to call from any server component.
 *
 * Cached at the request level via Next's request memoization, so calling
 * this multiple times in one render is fine.
 */
export async function getUserLanguage(): Promise<Lang> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return "en";

    const { data } = await supabase
      .from("profiles")
      .select("language")
      .eq("id", user.id)
      .single<{ language: Lang | null }>();

    return data?.language === "es" ? "es" : "en";
  } catch {
    return "en";
  }
}
