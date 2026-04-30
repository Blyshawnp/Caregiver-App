import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import InviteForm from "./invite-form";

export default async function InvitePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id, id")
    .eq("id", user.id)
    .single<{
      role: "admin" | "client" | "caregiver" | "family";
      organization_id: string;
      id: string;
    }>();

  if (!profile || profile.role !== "admin") redirect("/team");

  return (
    <InviteForm
      organizationId={profile.organization_id}
      currentUserId={profile.id}
    />
  );
}
