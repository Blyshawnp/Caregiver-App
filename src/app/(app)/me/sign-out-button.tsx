"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSignOut() {
    setLoading(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="w-full bg-white hover:bg-cream-50 text-terracotta-600 py-3.5 rounded-2xl font-medium transition disabled:opacity-50 active:scale-[0.99] shadow-soft"
    >
      {loading ? "Signing out..." : "Sign out"}
    </button>
  );
}
