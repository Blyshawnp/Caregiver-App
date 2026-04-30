import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import AcceptInviteForm from "./accept-invite-form";

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) return <ErrorScreen message="No invitation token provided." />;

  const supabase = await createClient();
  const { data: invitation } = await supabase
    .from("invitations")
    .select(
      "id, email, full_name, role, organization_id, expires_at, accepted_at, organizations(name)"
    )
    .eq("token", token)
    .maybeSingle<{
      id: string;
      email: string;
      full_name: string;
      role: "admin" | "client" | "caregiver" | "family";
      organization_id: string;
      expires_at: string;
      accepted_at: string | null;
      organizations: { name: string } | null;
    }>();

  if (!invitation)
    return (
      <ErrorScreen message="This invitation link is invalid or has been removed." />
    );

  if (invitation.accepted_at)
    return (
      <ErrorScreen
        message="This invitation has already been accepted. Try signing in."
        showLogin
      />
    );

  if (new Date(invitation.expires_at) < new Date())
    return (
      <ErrorScreen message="This invitation has expired. Ask the admin to send a new one." />
    );

  return <AcceptInviteForm invitation={invitation} token={token} />;
}

function ErrorScreen({
  message,
  showLogin,
}: {
  message: string;
  showLogin?: boolean;
}) {
  return (
    <main className="min-h-dvh flex items-center justify-center px-5 py-10 bg-cream-100">
      <div className="bg-white rounded-3xl shadow-soft p-8 max-w-sm w-full text-center grain-overlay">
        <div className="relative">
          <div className="w-12 h-12 mx-auto mb-4 rounded-2xl bg-terracotta-400/15 grid place-items-center text-terracotta-600">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="w-6 h-6"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h0" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="font-display text-xl text-ink-900 mb-2">
            Cannot use this link
          </h1>
          <p className="text-ink-500 text-sm mb-5">{message}</p>
          {showLogin && (
            <Link
              href="/login"
              className="inline-block bg-forest-600 hover:bg-forest-700 text-cream-50 px-5 py-2.5 rounded-2xl text-sm font-medium transition"
            >
              Go to sign in
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
