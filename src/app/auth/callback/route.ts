import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeNextPath(searchParams.get("next"), origin);

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}

function getSafeNextPath(next: string | null, origin: string) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/home";
  }

  try {
    const parsed = new URL(next, origin);
    const normalizedPath = `${parsed.pathname}${parsed.search}${parsed.hash}`;

    if (parsed.origin !== origin || normalizedPath !== next) {
      return "/home";
    }

    return normalizedPath;
  } catch {
    return "/home";
  }
}
