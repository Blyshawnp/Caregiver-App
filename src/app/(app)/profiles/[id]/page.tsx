import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileLayout from "../profile-layout";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: viewer } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single<{ id: string; role: string; organization_id: string }>();

  if (!viewer) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, email, phone, avatar_url, avatar_color, bio, vehicle_1_make_model, vehicle_1_color, vehicle_2_make_model, vehicle_2_color, organization_id, is_active")
    .eq("id", id)
    .single();

  if (!profile || profile.organization_id !== viewer.organization_id) return notFound();

  let caregiverStats: { upcomingShifts: number; activeNow: boolean } | null = null;
  if (profile.role === "caregiver") {
    const { count } = await supabase
      .from("shifts")
      .select("id", { count: "exact", head: true })
      .eq("caregiver_id", profile.id)
      .gte("scheduled_end", new Date().toISOString());

    const { data: active } = await supabase
      .from("shifts")
      .select("id, check_ins!inner(check_in_time, check_out_time)")
      .eq("caregiver_id", profile.id)
      .not("check_ins.check_in_time", "is", null)
      .is("check_ins.check_out_time", null)
      .limit(1)
      .maybeSingle();

    caregiverStats = {
      upcomingShifts: count ?? 0,
      activeNow: !!active,
    };
  }

  return <ProfileLayout profile={profile} viewerRole={viewer.role} caregiverStats={caregiverStats} />;
}
