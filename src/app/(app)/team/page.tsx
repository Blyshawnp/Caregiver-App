import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PlusIcon, ArrowRightIcon } from "@/components/icons";
import UserAvatar from "@/components/user-avatar";
import { formatCurrency } from "@/lib/pay";

type TeamMember = {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "client" | "caregiver" | "family";
  is_active: boolean;
  avatar_url: string | null;
  avatar_color: string | null;
  shift_count: number;
  current_rate: number | null;
};

type Invitation = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  expires_at: string;
  accepted_at: string | null;
  token: string;
};

export default async function TeamPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single<{
      role: "admin" | "client" | "caregiver" | "family";
      organization_id: string;
    }>();

  if (!profile || profile.role !== "admin") {
    return (
      <main className="px-5 py-10 max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl p-8 shadow-soft text-center">
          <h1 className="font-display text-2xl mb-2">Admin only</h1>
          <p className="text-ink-500 text-sm mb-5">
            Only administrators can manage the team.
          </p>
          <Link
            href="/me"
            className="inline-block bg-forest-600 hover:bg-forest-700 text-cream-50 px-5 py-2.5 rounded-2xl text-sm font-medium transition"
          >
            Back
          </Link>
        </div>
      </main>
    );
  }

  // Fetch all profiles in org
  const { data: peopleRaw } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, is_active, avatar_url, avatar_color")
    .eq("organization_id", profile.organization_id)
    .order("role")
    .order("full_name");

  const people = peopleRaw ?? [];

  // For each, get count of upcoming shifts and current pay rate
  const enriched: TeamMember[] = await Promise.all(
    people.map(async (p) => {
      const { count } = await supabase
        .from("shifts")
        .select("id", { count: "exact", head: true })
        .eq("caregiver_id", p.id)
        .gte("scheduled_end", new Date().toISOString());

      const { data: rate } = await supabase
        .from("caregiver_rates")
        .select("base_hourly_rate")
        .eq("caregiver_id", p.id)
        .lte("effective_from", new Date().toISOString().split("T")[0])
        .or(`effective_to.is.null,effective_to.gte.${new Date().toISOString().split("T")[0]}`)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle<{ base_hourly_rate: number }>();

      return {
        ...(p as Omit<TeamMember, "shift_count" | "current_rate">),
        shift_count: count ?? 0,
        current_rate: rate?.base_hourly_rate ?? null,
      };
    })
  );

  // Pending (not-yet-accepted, not-expired) invitations
  const { data: invitationsRaw } = await supabase
    .from("invitations")
    .select("id, email, full_name, role, status, expires_at, accepted_at, token")
    .eq("organization_id", profile.organization_id)
    .eq("status", "pending")
    .gte("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const invitations = (invitationsRaw ?? []) as Invitation[];

  const caregivers = enriched.filter((p) => p.role === "caregiver");
  const others = enriched.filter((p) => p.role !== "caregiver");

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="flex items-end justify-between mb-6">
        <div>
          <Link
            href="/me"
            className="text-sm text-forest-600 hover:underline mb-2 inline-block"
          >
            ← Back
          </Link>
          <h1 className="font-display text-3xl text-ink-900 leading-tight">
            Team
          </h1>
          <p className="text-ink-500 text-sm">
            {caregivers.length} caregiver{caregivers.length === 1 ? "" : "s"} ·{" "}
            {invitations.length} pending invite{invitations.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/team/invite"
          className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-4 py-2.5 rounded-2xl text-sm font-medium flex items-center gap-1.5 transition active:scale-[0.99]"
        >
          <PlusIcon size={16} />
          Invite
        </Link>
      </header>

      <Link
        href="/schedule/proposals"
        className="flex items-center justify-between bg-white hover:bg-cream-50 px-5 py-4 rounded-2xl shadow-soft mb-6 transition"
      >
        <span>
          <span className="block font-medium text-ink-900">
            Shift proposals
          </span>
          <span className="block text-xs text-ink-500">
            Review caregiver availability and proposed shifts
          </span>
        </span>
        <ArrowRightIcon size={16} className="text-ink-300" />
      </Link>

      {/* Pending invitations */}
      {invitations.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs uppercase tracking-[0.18em] text-ink-500 mb-2 px-1">
            Pending invites
          </h2>
          <ul className="space-y-2">
            {invitations.map((inv) => (
              <li key={inv.id}>
                <InvitationRow invitation={inv} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Caregivers */}
      <section className="mb-6">
        <h2 className="text-xs uppercase tracking-[0.18em] text-ink-500 mb-2 px-1">
          Caregivers
        </h2>
        {caregivers.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 shadow-soft text-center grain-overlay">
            <div className="relative">
              <p className="text-ink-500 text-sm mb-3">
                No caregivers on the team yet.
              </p>
              <Link
                href="/team/invite"
                className="inline-block bg-forest-600 hover:bg-forest-700 text-cream-50 px-5 py-2.5 rounded-2xl text-sm font-medium transition"
              >
                Send first invite
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-2">
            {caregivers.map((p) => (
              <li key={p.id}>
                <PersonRow person={p} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Admins / clients */}
      {others.length > 0 && (
        <section>
          <h2 className="text-xs uppercase tracking-[0.18em] text-ink-500 mb-2 px-1">
            Admins & clients
          </h2>
          <ul className="space-y-2">
            {others.map((p) => (
              <li key={p.id}>
                <PersonRow person={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function PersonRow({ person }: { person: TeamMember }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl p-4 shadow-soft">
      <UserAvatar person={person} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-ink-900 truncate">{person.full_name}</p>
          {!person.is_active && (
            <span className="text-[10px] uppercase tracking-wider bg-cream-200 text-ink-500 px-1.5 py-0.5 rounded">
              Inactive
            </span>
          )}
        </div>
        <p className="text-xs text-ink-500 truncate">
          {person.role === "caregiver"
            ? `${person.shift_count} upcoming · ${
                person.current_rate
                  ? `${formatCurrency(person.current_rate)}/hr`
                  : "No rate set"
              }`
            : person.email}
        </p>
      </div>
      <Link
        href={`/team/${person.id}`}
        className="text-xs font-medium text-forest-600 hover:underline shrink-0"
      >
        Manage
      </Link>
      <ArrowRightIcon size={16} className="text-ink-300" />
    </div>
  );
}

function InvitationRow({ invitation }: { invitation: Invitation }) {
  return (
    <Link
      href={`/team/invite/${invitation.id}`}
      className="flex items-center gap-3 bg-cream-50 border border-dashed border-ink-300/40 rounded-2xl p-4 hover:bg-white transition"
    >
      <span className="w-10 h-10 rounded-full grid place-items-center font-display text-sm bg-cream-200 text-ink-500 shrink-0">
        {invitation.full_name[0]?.toUpperCase()}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink-900 truncate">
          {invitation.full_name}
        </p>
        <p className="text-xs text-ink-500 truncate">
          {invitation.email} · invite pending
        </p>
      </div>
      <ArrowRightIcon size={16} className="text-ink-300" />
    </Link>
  );
}
