import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowRightIcon, UserIcon, MapPinIcon } from "@/components/icons";
import SignOutButton from "./sign-out-button";
import EditablePhone from "./editable-phone";
import AvatarUploader from "./avatar-uploader";
import EditProfileForm from "./edit-profile-form";
import LanguageSwitcher from "@/components/language-switcher";
import {
  getCurrentPayPeriod,
  getPreviousPayPeriod,
  formatPayPeriod,
  roundUpToQuarter,
  formatPay,
} from "@/lib/pay";
import { t, type Lang } from "@/lib/i18n";

export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, full_name, role, email, phone, language, avatar_url, avatar_color, bio, vehicle_1_make_model, vehicle_1_color, vehicle_2_make_model, vehicle_2_color, organizations(name)"
    )
    .eq("id", user.id)
    .single<{
      id: string;
      full_name: string;
      role: "admin" | "client" | "caregiver" | "family" | "family";
      email: string;
      phone: string | null;
      language: Lang | null;
      avatar_url: string | null;
      avatar_color: string | null;
      bio: string | null;
      vehicle_1_make_model: string | null;
      vehicle_1_color: string | null;
      vehicle_2_make_model: string | null;
      vehicle_2_color: string | null;
      organizations: { name: string } | null;
    }>();

  const lang: Lang = profile?.language === "es" ? "es" : "en";

  // Pay period: Friday 9 PM → next Friday 9 PM (Eastern).
  const now = new Date();
  const currentPeriod = getCurrentPayPeriod(now);
  const previousPeriod = getPreviousPayPeriod(now);

  let currentTotal = 0;
  let currentHours = 0;
  let previousTotal = 0;
  let previousHours = 0;

  if (profile) {
    let q = supabase
      .from("shift_pay_details")
      .select(
        "shift_id, hours_worked, total_pay, scheduled_start, check_in_time, caregiver_id"
      )
      .gte("scheduled_start", previousPeriod.start.toISOString())
      .lte("scheduled_start", currentPeriod.end.toISOString())
      .not("hours_worked", "is", null);

    if (profile.role === "caregiver") {
      q = q.eq("caregiver_id", profile.id);
    }

    type PayRow = {
      shift_id: string;
      hours_worked: number | null;
      total_pay: number | null;
      scheduled_start: string;
      check_in_time: string | null;
      caregiver_id: string;
    };

    const { data: payRows } = await q;

    for (const r of (payRows ?? []) as PayRow[]) {
      const referenceTime = new Date(
        r.check_in_time ?? r.scheduled_start
      );
      const hours = Number(r.hours_worked ?? 0);
      const pay = Number(r.total_pay ?? 0);

      if (
        referenceTime >= currentPeriod.start &&
        referenceTime < currentPeriod.end
      ) {
        currentHours += hours;
        currentTotal += pay;
      } else if (
        referenceTime >= previousPeriod.start &&
        referenceTime < previousPeriod.end
      ) {
        previousHours += hours;
        previousTotal += pay;
      }
    }
  }

  // Round UP to nearest $0.25 for display
  const currentTotalRounded = roundUpToQuarter(currentTotal);
  const previousTotalRounded = roundUpToQuarter(previousTotal);

  const roleCopy: Record<string, string> = {
    admin: "Administrator",
    client: "Client",
    caregiver: "Caregiver",
  };

  const showPay =
    currentHours > 0 ||
    previousHours > 0 ||
    profile?.role === "caregiver";

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">Me</h1>
        <p className="text-ink-500 text-sm">Account & preferences</p>
      </header>

      <section className="bg-white rounded-3xl shadow-soft p-6 mb-4 grain-overlay">
        <div className="relative flex items-center gap-4 mb-5">
          {profile && (
            <AvatarUploader
              userId={profile.id}
              fullName={profile.full_name}
              avatarUrl={profile.avatar_url}
              avatarColor={profile.avatar_color}
            />
          )}
        </div>
        <div className="relative mb-5">
          <div className="min-w-0">
            <h2 className="font-display text-xl text-ink-900 truncate">
              {profile?.full_name}
            </h2>
            <p className="text-sm text-forest-600">
              {roleCopy[profile?.role ?? ""] ?? profile?.role}
            </p>
            {profile && (
              <div className="mt-2">
                <EditProfileForm
                  userId={profile.id}
                  initialName={profile.full_name}
                  initialPhone={profile.phone}
                  initialBio={profile.bio}
                  initialVehicle1MakeModel={profile.vehicle_1_make_model}
                  initialVehicle1Color={profile.vehicle_1_color}
                  initialVehicle2MakeModel={profile.vehicle_2_make_model}
                  initialVehicle2Color={profile.vehicle_2_color}
                  role={profile.role}
                />
              </div>
            )}
          </div>
        </div>

        <dl className="text-sm">
          <Row label={t("me.email", lang)} value={profile?.email} />
          {profile && (
            <EditablePhone
              initialPhone={profile.phone}
              userId={profile.id}
            />
          )}
          <Row
            label={t("me.organization", lang)}
            value={profile?.organizations?.name ?? "—"}
          />
          <Row label="About" value={profile?.bio} />
          {profile?.role === "caregiver" && (
            <>
              <Row
                label="Vehicle 1"
                value={formatVehicle(
                  profile.vehicle_1_color,
                  profile.vehicle_1_make_model
                )}
              />
              <Row
                label="Vehicle 2"
                value={formatVehicle(
                  profile.vehicle_2_color,
                  profile.vehicle_2_make_model
                )}
              />
            </>
          )}
        </dl>
      </section>

      {/* Pay period card */}
      {showPay && (
        <section className="bg-forest-600 text-cream-50 rounded-3xl p-6 mb-4 relative overflow-hidden">
          <div
            aria-hidden
            className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-cream-50/10 blur-2xl"
          />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.2em] text-cream-50/70 mb-3">
              {profile?.role === "caregiver"
                ? t("shift.pay", lang)
                : t("me.payroll", lang)}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-cream-50/70 mb-0.5">
                  {t("pay.thisPeriod", lang)}
                </p>
                <p className="font-display text-3xl">
                  {formatPay(currentTotalRounded)}
                </p>
                <p className="text-xs text-cream-50/70">
                  {currentHours.toFixed(1)} {t("pay.hours", lang)}
                </p>
                <p className="text-[10px] text-cream-50/60 mt-1.5 leading-tight">
                  {formatPayPeriod(currentPeriod)}
                </p>
              </div>
              <div>
                <p className="text-xs text-cream-50/70 mb-0.5">
                  {t("pay.lastPeriod", lang)}
                </p>
                <p className="font-display text-3xl">
                  {formatPay(previousTotalRounded)}
                </p>
                <p className="text-xs text-cream-50/70">
                  {previousHours.toFixed(1)} {t("pay.hours", lang)}
                </p>
                <p className="text-[10px] text-cream-50/60 mt-1.5 leading-tight">
                  {formatPayPeriod(previousPeriod)}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-cream-50/15 flex items-center justify-between">
              <p className="text-xs text-cream-50/70">
                {t("pay.runsFriToFri", lang)}
              </p>
              <Link
                href={profile?.role === "caregiver" ? "/me/invoices" : "/payroll"}
                className="text-xs text-cream-50 hover:underline font-medium"
              >
                {t("pay.viewAll", lang)}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Admin actions */}
      {profile?.role === "admin" && (
        <section className="space-y-2 mb-4">
          <NavLink
            href="/team"
            label={t("me.manageTeam", lang)}
            Icon={UserIcon}
          />
          <NavLink
            href="/clients"
            label={t("me.clientsAndGeofence", lang)}
            Icon={MapPinIcon}
          />
           <NavLink
            href="/payroll"
            label={t("me.payroll", lang)}
            Icon={UserIcon}
          />
          <NavLink
            href="/feedback"
            label="Manage caregiver feedback"
            Icon={UserIcon}
          />
          <NavLink
            href="/me/year-end-summaries"
            label="Year-End Summaries Dashboard"
            Icon={UserIcon}
          />
        </section>
      )}

      {/* Client & Family actions */}
      {(profile?.role === "client" || profile?.role === "family") && (
        <section className="space-y-2 mb-4">
          {profile.role === "client" && (
            <NavLink
              href="/clients"
              label={t("me.homeInfo", lang)}
              Icon={MapPinIcon}
            />
          )}
          <NavLink
            href="/payroll"
            label={t("me.payroll", lang)}
            Icon={UserIcon}
          />
          <NavLink
            href="/feedback/new"
            label="Submit caregiver feedback"
            Icon={UserIcon}
          />
        </section>
      )}

      {/* Caregiver actions */}
      {profile?.role === "caregiver" && (
        <section className="space-y-2 mb-4">
          <NavLink
            href="/me/invoices"
            label={t("me.myInvoices", lang)}
            Icon={UserIcon}
          />
          <NavLink
            href="/feedback"
            label="Received feedback & commendations"
            Icon={UserIcon}
          />
          <NavLink
            href="/me/year-end-summaries"
            label="Year-End Summaries"
            Icon={UserIcon}
          />
        </section>
      )}

      <section className="space-y-2 mb-4">
        <NavLink
          href="/documents"
          label="Documents & agreements"
          Icon={UserIcon}
        />
        <NavLink
          href="/me/notifications"
          label="Notification settings"
          Icon={UserIcon}
        />
        <NavLink
          href="/help"
          label={t("me.helpAndHowTo", lang)}
          Icon={UserIcon}
        />
      </section>

      {/* Language switcher, visible to all roles */}
      {profile && (
        <div className="mb-4">
          <LanguageSwitcher
            initialLanguage={lang}
            userId={profile.id}
            labels={{
              title: t("me.language", lang),
              subtitle: t("me.languageSubtitle", lang),
              en: t("me.languageEn", lang),
              es: t("me.languageEs", lang),
            }}
          />
        </div>
      )}

      <SignOutButton />
    </main>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between py-3 first:pt-0 last:pb-0 border-t border-cream-200 first:border-t-0">
      <dt className="text-ink-500">{label}</dt>
      <dd className="text-ink-900 font-medium text-right">{value ?? "—"}</dd>
    </div>
  );
}

function formatVehicle(color?: string | null, makeModel?: string | null) {
  const parts = [color, makeModel].map((part) => part?.trim()).filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

function NavLink({
  href,
  label,
  Icon,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 bg-white hover:bg-cream-50 px-5 py-4 rounded-2xl shadow-soft transition active:scale-[0.99]"
    >
      <span className="w-9 h-9 rounded-xl bg-forest-100 text-forest-600 grid place-items-center shrink-0">
        <Icon size={18} />
      </span>
      <span className="flex-1 font-medium text-ink-900">{label}</span>
      <ArrowRightIcon size={16} className="text-ink-300" />
    </Link>
  );
}

/* Pay period helpers moved to @/lib/pay */
