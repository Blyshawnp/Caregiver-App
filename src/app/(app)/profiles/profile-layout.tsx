"use client";

import { UserIcon, MailIcon, PhoneIcon, ShieldIcon, CalendarIcon, HeartIcon } from "@/components/icons";
import UserAvatar from "@/components/user-avatar";

type ProfileData = {
  id: string;
  full_name: string;
  role: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
  organization_id: string;
  is_active: boolean;
};

export default function ProfileLayout({
  profile,
  viewerRole,
  caregiverStats,
}: {
  profile: ProfileData;
  viewerRole: string;
  caregiverStats: { upcomingShifts: number; activeNow: boolean } | null;
}) {
  const canShowContact =
    viewerRole === "admin" ||
    viewerRole === "client" ||
    profile.role === "admin" ||
    profile.role === "caregiver";

  return (
    <main className="px-5 py-8 max-w-2xl mx-auto">
      <div className="bg-white rounded-3xl shadow-lifted overflow-hidden grain-overlay border border-cream-200">
        {/* Header/Cover Area */}
        <div className="h-32 bg-forest-600 relative">
          <div className="absolute -bottom-12 left-8 p-1 bg-white rounded-full shadow-soft">
            <UserAvatar 
              person={{
                full_name: profile.full_name,
                avatar_url: profile.avatar_url ?? null,
                avatar_color: profile.avatar_color ?? null,
                id: profile.id
              }} 
              size="xl" 
              linkToProfile={false}
            />
          </div>
        </div>

        <div className="pt-16 px-8 pb-10">
          <div className="mb-8">
            <h1 className="font-display text-3xl text-ink-900 mb-1">{profile.full_name}</h1>
            <p className="text-forest-600 font-medium uppercase tracking-widest text-xs flex items-center gap-2">
              <ShieldIcon size={12} /> {profile.role}
            </p>
            {!profile.is_active && (
              <p className="inline-flex mt-2 text-[10px] uppercase tracking-wider bg-cream-200 text-ink-600 px-2 py-1 rounded-full">
                Inactive
              </p>
            )}
          </div>

          <div className="grid gap-6">
            {/* Basic Info */}
            {canShowContact && (
            <section className="space-y-4">
              <h2 className="text-[10px] uppercase tracking-[0.2em] text-ink-400 font-bold">Contact Details</h2>
              <div className="grid gap-3">
                <InfoRow icon={MailIcon} label="Email" value={profile.email} />
                {profile.phone && <InfoRow icon={PhoneIcon} label="Phone" value={profile.phone} />}
              </div>
            </section>
            )}

            {/* Role Specifics */}
            {profile.role === 'caregiver' && (
              <section className="space-y-4">
                 <h2 className="text-[10px] uppercase tracking-[0.2em] text-ink-400 font-bold">Professional Profile</h2>
                 <div className="bg-cream-50 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center gap-3 text-sm text-ink-700">
                       <UserIcon size={16} className="text-forest-500" />
                       <span>{caregiverStats?.activeNow ? "ON SHIFT NOW" : "Care team member"}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-ink-700">
                       <CalendarIcon size={16} className="text-forest-500" />
                       <span>{caregiverStats?.upcomingShifts ?? 0} upcoming shifts</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-ink-700">
                       <HeartIcon size={16} className="text-terracotta-500" />
                       <span>Caregiver profile for team context</span>
                    </div>
                 </div>
              </section>
            )}

            {(profile.role === "client" || profile.role === "family") && (
              <section className="space-y-4">
                <h2 className="text-[10px] uppercase tracking-[0.2em] text-ink-400 font-bold">Client / Family Context</h2>
                <div className="bg-cream-50 rounded-2xl p-4 text-sm text-ink-700">
                  This profile is used for care-team communication and family/client visibility.
                </div>
              </section>
            )}

            {profile.role === "admin" && (
              <section className="space-y-4">
                <h2 className="text-[10px] uppercase tracking-[0.2em] text-ink-400 font-bold">Admin Context</h2>
                <div className="bg-cream-50 rounded-2xl p-4 text-sm text-ink-700">
                  Organization administrator for scheduling, team, notifications, incidents, and care operations.
                </div>
              </section>
            )}

            <p className="text-[10px] text-ink-300 mt-8 text-center italic">
              Profiles are optional. This information is shared only within your organization.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any, label: string, value?: string | null }) {
  return (
    <div className="flex items-center gap-3 bg-cream-50 rounded-xl px-4 py-3 border border-cream-100">
      <Icon size={16} className="text-ink-400" />
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-ink-400 leading-none mb-0.5">{label}</p>
        <p className="text-sm text-ink-900 font-medium truncate">{value || '—'}</p>
      </div>
    </div>
  );
}
