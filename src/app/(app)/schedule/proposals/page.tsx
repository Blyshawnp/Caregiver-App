import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProposalsPanel from "./proposals-panel";
import type { Role, ShiftProposalRow } from "@/lib/db-types";

type Client = { id: string; full_name: string };

export default async function ShiftProposalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single<{
      id: string;
      role: Role;
      organization_id: string;
    }>();

  if (!profile || (profile.role !== "admin" && profile.role !== "caregiver")) {
    redirect("/schedule");
  }

  const clientsResult = await supabase
    .from("clients")
    .select("id, full_name")
    .eq("organization_id", profile.organization_id)
    .order("full_name");

  const proposalsQuery = supabase
    .from("shift_proposals")
    .select(
      `
      id,
      organization_id,
      caregiver_id,
      client_id,
      scheduled_start,
      scheduled_end,
      notes,
      status,
      approved_by,
      approved_at,
      rejection_reason,
      rejected_by,
      rejected_at,
      canceled_by,
      canceled_at,
      shift_id,
      created_by,
      created_at,
      updated_at,
      profiles:caregiver_id ( full_name ),
      clients ( full_name )
    `
    )
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false });

  const proposalsResult =
    profile.role === "admin"
      ? await proposalsQuery.eq("status", "pending")
      : await proposalsQuery.eq("caregiver_id", profile.id);

  return (
    <ProposalsPanel
      role={profile.role}
      currentUserId={profile.id}
      organizationId={profile.organization_id}
      clients={(clientsResult.data ?? []) as Client[]}
      proposals={
        (proposalsResult.data ?? []) as unknown as Array<
          ShiftProposalRow & {
            profiles?:
              | { full_name: string | null }
              | Array<{ full_name: string | null }>
              | null;
            clients?:
              | { full_name: string | null }
              | Array<{ full_name: string | null }>
              | null;
          }
        >
      }
    />
  );
}
