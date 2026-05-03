import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import IncidentForm from "./incident-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Role = "admin" | "client" | "caregiver" | "family";
type IncidentShift = {
  id: string;
  scheduled_start: string;
  clients: { full_name: string | null } | null;
};
type IncidentRow = {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
  profiles: { full_name: string | null } | null;
  clients: { full_name: string | null } | null;
};

export default async function IncidentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single<{ id: string; role: Role; organization_id: string }>();
  if (!profile) redirect("/login");

  const canReport = profile.role === "caregiver" || profile.role === "admin";
  const { data: shifts } = await supabase
    .from("shifts")
    .select("id, scheduled_start, caregiver_id, clients(full_name)")
    .gte("scheduled_start", new Date(Date.now() - 30 * 86400_000).toISOString())
    .lte("scheduled_start", new Date(Date.now() + 7 * 86400_000).toISOString())
    .or(profile.role === "caregiver" ? `caregiver_id.eq.${profile.id}` : `organization_id.eq.${profile.organization_id}`)
    .order("scheduled_start", { ascending: false });

  const { data: incidents } = await supabase
    .from("incidents")
    .select("id, title, description, severity, status, created_at, profiles:reported_by(full_name), clients(full_name)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-5">
        <Link href="/home" className="text-sm text-forest-600 hover:underline mb-2 inline-block">
          ← Back
        </Link>
        <h1 className="font-display text-3xl text-ink-900">Incidents</h1>
        <p className="text-ink-500 text-sm">Report and review care incidents.</p>
      </header>

      {canReport && (
        <IncidentForm
          shifts={((shifts ?? []) as unknown as IncidentShift[]).map((shift) => ({
            id: shift.id,
            label: `${formatDate(shift.scheduled_start)} · ${shift.clients?.full_name ?? "Client"}`,
          }))}
        />
      )}

      <ul className="space-y-2">
        {((incidents ?? []) as unknown as IncidentRow[]).map((incident) => (
          <li key={incident.id} className="bg-white rounded-2xl shadow-soft p-4">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-medium text-ink-900">{incident.title}</p>
              <span className="text-[10px] uppercase tracking-wide text-terracotta-600">
                {incident.severity}
              </span>
            </div>
            <p className="text-sm text-ink-500 mt-1 line-clamp-2">{incident.description}</p>
            <p className="text-xs text-ink-400 mt-2">
              {incident.profiles?.full_name ?? "Reporter"} · {incident.clients?.full_name ?? "No client"} · {formatDate(incident.created_at)}
            </p>
          </li>
        ))}
        {(incidents ?? []).length === 0 && (
          <li className="bg-white rounded-2xl shadow-soft p-6 text-center text-sm text-ink-500">
            No incidents reported.
          </li>
        )}
      </ul>
    </main>
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
