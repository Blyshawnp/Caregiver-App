import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/bottom-nav";
import AppHeader from "@/components/app-header";
import ShiftWatcher, {
  type ActiveWatch,
} from "@/components/shift-watcher";
import InstallPrompt from "@/components/install-prompt";
import type { Role } from "@/lib/db-types";

type ProfileWithOrg = {
  id: string;
  full_name: string;
  role: Role;
  organization_id: string;
  organizations: { name: string } | null;
};

type ActiveShiftRow = {
  id: string;
  scheduled_end: string;
  organization_id: string;
  clients: {
    full_name: string;
    latitude: number | null;
    longitude: number | null;
    geofence_radius_meters: number;
  } | null;
  check_ins: Array<{
    id: string;
    check_in_time: string | null;
    check_out_time: string | null;
  }>;
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id, organizations(name)")
    .eq("id", user.id)
    .single<ProfileWithOrg>();

  // If caregiver, look up their active (checked-in but not checked-out) shift
  let activeWatch: ActiveWatch | null = null;
  if (profile?.role === "caregiver") {
    try {
      const { data: activeRaw } = await supabase
        .from("shifts")
        .select(
          `
          id,
          scheduled_end,
          organization_id,
          clients ( full_name, latitude, longitude, geofence_radius_meters ),
          check_ins!inner ( id, check_in_time, check_out_time )
        `
        )
        .eq("caregiver_id", profile.id)
        .not("check_ins.check_in_time", "is", null)
        .is("check_ins.check_out_time", null)
        .limit(1)
        .maybeSingle();

      if (activeRaw) {
        const active = activeRaw as unknown as ActiveShiftRow;
        activeWatch = {
          shift_id: active.id,
          caregiver_id: profile.id,
          organization_id: active.organization_id,
          scheduled_end: active.scheduled_end,
          client_lat: active.clients?.latitude ?? null,
          client_lng: active.clients?.longitude ?? null,
          geofence_radius: active.clients?.geofence_radius_meters ?? 150,
          client_name: active.clients?.full_name ?? "Client",
          check_in_id: active.check_ins?.[0]?.id ?? null,
        };
      }
    } catch {
      activeWatch = null;
    }
  }

  // Unread message count for the Messages tab badge
  let unreadMessages = 0;
  if (profile) {
    try {
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", profile.id)
        .eq("is_read", false);
      unreadMessages = count ?? 0;
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-cream-100">
      <AppHeader
        fullName={profile?.full_name ?? "There"}
        orgName={profile?.organizations?.name ?? ""}
      />

      <div className="flex-1 pb-24">
        {activeWatch && (
          <div className="px-5 pt-4 max-w-2xl mx-auto">
            <ShiftWatcher active={activeWatch} />
          </div>
        )}
        {children}
      </div>

      <BottomNav
        role={profile?.role ?? "caregiver"}
        unreadMessages={unreadMessages}
      />
      <InstallPrompt />
    </div>
  );
}
