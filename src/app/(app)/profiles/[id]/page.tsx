import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import UserAvatar from "@/components/user-avatar";

type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: "admin" | "client" | "caregiver" | "family";
  is_active: boolean;
  organization_id: string;
  avatar_url: string | null;
  avatar_color: string | null;
};

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viewer } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single<{ id: string; role: Profile["role"]; organization_id: string }>();

  if (!viewer) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, email, phone, role, is_active, organization_id, avatar_url, avatar_color")
    .eq("id", id)
    .eq("organization_id", viewer.organization_id)
    .maybeSingle<Profile>();

  if (!profile) notFound();

  const canShowContact =
    viewer.role === "admin" || viewer.id === profile.id || profile.role !== "family";

  const { count: upcomingCount } = await supabase
    .from("shifts")
    .select("id", { count: "exact", head: true })
    .eq("caregiver_id", profile.id)
    .gte("scheduled_end", new Date().toISOString());

  const { data: nextShift } = await supabase
    .from("shifts")
    .select("scheduled_start, clients(full_name)")
    .eq("caregiver_id", profile.id)
    .gte("scheduled_end", new Date().toISOString())
    .order("scheduled_start", { ascending: true })
    .limit(1)
    .maybeSingle<{
      scheduled_start: string;
      clients: { full_name: string | null } | null;
    }>();

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <Link href="/messages" className="text-sm text-forest-600 hover:underline mb-3 inline-block">
        ← Back
      </Link>

      <section className="bg-white rounded-3xl shadow-soft p-6 grain-overlay">
        <div className="relative flex items-center gap-4 mb-5">
          <UserAvatar person={profile} size="lg" />
          <div className="min-w-0">
            <h1 className="font-display text-2xl text-ink-900 truncate">
              {profile.full_name}
            </h1>
            <p className="text-sm text-forest-600 capitalize">
              {profile.role}
              {!profile.is_active ? " · inactive" : ""}
            </p>
          </div>
        </div>

        <dl className="divide-y divide-cream-200 text-sm">
          {canShowContact && <Row label="Email" value={profile.email} />}
          {canShowContact && <Row label="Phone" value={profile.phone ?? "Not set"} />}
          {profile.role === "caregiver" && (
            <>
              <Row label="Upcoming shifts" value={String(upcomingCount ?? 0)} />
              <Row
                label="Next shift"
                value={
                  nextShift
                    ? `${formatDate(nextShift.scheduled_start)} · ${nextShift.clients?.full_name ?? "Client"}`
                    : "None scheduled"
                }
              />
            </>
          )}
          {(profile.role === "client" || profile.role === "family") && (
            <Row label="Context" value="Client and family contact" />
          )}
          {profile.role === "admin" && <Row label="Context" value="Organization administrator" />}
        </dl>
      </section>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <dt className="text-xs uppercase tracking-wide font-medium text-ink-500 shrink-0">
        {label}
      </dt>
      <dd className="font-medium text-ink-900 text-right">{value}</dd>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
