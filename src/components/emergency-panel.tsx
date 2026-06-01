"use client";

import { useState } from "react";
import Image from "next/image";
import { StarOfLifeIcon } from "./icons";

type Allergy = {
  id: string;
  name: string;
  severity: "critical" | "mild" | "minor";
  notes: string | null;
};

type EmergencyInfo = {
  // Contacts
  emergency_contact_1_name: string | null;
  emergency_contact_1_phone: string | null;
  emergency_contact_1_relationship: string | null;
  emergency_contact_2_name: string | null;
  emergency_contact_2_phone: string | null;
  emergency_contact_2_relationship: string | null;
  // Hospital
  preferred_hospital_name: string | null;
  preferred_hospital_address: string | null;
  preferred_hospital_phone: string | null;
  // Physician
  primary_physician_name: string | null;
  primary_physician_address: string | null;
  primary_physician_phone: string | null;
  // Emergency devices
  has_panic_button: boolean | null;
  panic_button_location: string | null;
  has_medical_alert: boolean | null;
  medical_alert_location: string | null;
  first_aid_location: string | null;
  hypoglycemia_kit_location: string | null;
  fire_extinguisher_location: string | null;
  aed_location: string | null;
};

export default function EmergencyPanel({
  info,
  allergies,
}: {
  info: EmergencyInfo;
  allergies: Allergy[];
}) {
  const [expanded, setExpanded] = useState(false);

  const criticalAllergies = allergies.filter((a) => a.severity === "critical");
  const mildAllergies = allergies.filter((a) => a.severity === "mild");
  const minorAllergies = allergies.filter((a) => a.severity === "minor");

  const hasContacts = !!(
    info.emergency_contact_1_phone || info.emergency_contact_2_phone
  );
  const hasHospital = !!(
    info.preferred_hospital_name || info.preferred_hospital_phone
  );
  const hasPhysician = !!(
    info.primary_physician_name || info.primary_physician_phone
  );
  const hasDevices = !!(
    info.has_panic_button ||
    info.has_medical_alert ||
    info.first_aid_location ||
    info.hypoglycemia_kit_location ||
    info.fire_extinguisher_location ||
    info.aed_location
  );

  // Don't render the panel at all if there's nothing to show
  const hasAnyInfo =
    hasContacts ||
    hasHospital ||
    hasPhysician ||
    hasDevices ||
    allergies.length > 0;
  if (!hasAnyInfo) return null;

  return (
    <section className="bg-white rounded-3xl shadow-soft border-2 border-terracotta-500/30 mt-4 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-5 hover:bg-red-50 transition text-left"
      >
        <span className="relative w-10 h-10 rounded-xl grid place-items-center shrink-0 overflow-hidden shadow-[0_0_12px_rgba(220,38,38,0.25)] bg-red-600">
          <Image
            src="/icons/emergency.png"
            alt="Emergency information"
            width={40}
            height={40}
            className="object-contain"
          />
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-display text-lg text-ink-900">Emergency info</p>
          <p className="text-xs text-ink-500">
            {criticalAllergies.length > 0 && (
              <span className="text-terracotta-600 font-medium mr-2">
                {criticalAllergies.length} critical{" "}
                {criticalAllergies.length === 1 ? "allergy" : "allergies"}
              </span>
            )}
            {hasContacts && "Contacts · "}
            {hasHospital && "Hospital · "}
            {hasPhysician && "Physician · "}
            {hasDevices && "Devices"}
            {allergies.length === 0 &&
              !hasContacts &&
              !hasHospital &&
              !hasPhysician &&
              !hasDevices &&
              "Tap to view"}
          </p>
        </div>
        <ChevronIcon expanded={expanded} />
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-cream-200">
          {/* ALLERGIES (always first if present) */}
          {allergies.length > 0 && (
            <Section title="Allergies">
              {criticalAllergies.length > 0 && (
                <AllergyGroup
                  label="Critical"
                  tone="critical"
                  items={criticalAllergies}
                />
              )}
              {mildAllergies.length > 0 && (
                <AllergyGroup
                  label="Mild"
                  tone="mild"
                  items={mildAllergies}
                />
              )}
              {minorAllergies.length > 0 && (
                <AllergyGroup
                  label="Minor"
                  tone="minor"
                  items={minorAllergies}
                />
              )}
            </Section>
          )}

          {/* EMERGENCY CONTACTS */}
          {hasContacts && (
            <Section title="Emergency contacts">
              {info.emergency_contact_1_phone && (
                <ContactRow
                  name={info.emergency_contact_1_name}
                  phone={info.emergency_contact_1_phone}
                  relationship={info.emergency_contact_1_relationship}
                />
              )}
              {info.emergency_contact_2_phone && (
                <ContactRow
                  name={info.emergency_contact_2_name}
                  phone={info.emergency_contact_2_phone}
                  relationship={info.emergency_contact_2_relationship}
                />
              )}
            </Section>
          )}

          {/* HOSPITAL */}
          {hasHospital && (
            <Section title="Preferred hospital">
              <PlaceRow
                name={info.preferred_hospital_name}
                address={info.preferred_hospital_address}
                phone={info.preferred_hospital_phone}
              />
            </Section>
          )}

          {/* PHYSICIAN */}
          {hasPhysician && (
            <Section title="Primary physician">
              <PlaceRow
                name={info.primary_physician_name}
                address={info.primary_physician_address}
                phone={info.primary_physician_phone}
              />
            </Section>
          )}

          {/* EMERGENCY DEVICES & LOCATIONS */}
          {hasDevices && (
            <Section title="In case of emergency">
              {info.has_panic_button && info.panic_button_location && (
                <DeviceRow
                  label="Panic button"
                  location={info.panic_button_location}
                />
              )}
              {info.has_medical_alert && info.medical_alert_location && (
                <DeviceRow
                  label="Medical alert button"
                  location={info.medical_alert_location}
                />
              )}
              {info.first_aid_location && (
                <DeviceRow
                  label="First aid kit"
                  location={info.first_aid_location}
                />
              )}
              {info.hypoglycemia_kit_location && (
                <DeviceRow
                  label="Hypoglycemia kit / glucagon"
                  location={info.hypoglycemia_kit_location}
                />
              )}
              {info.aed_location && (
                <DeviceRow label="AED" location={info.aed_location} />
              )}
              {info.fire_extinguisher_location && (
                <DeviceRow
                  label="Fire extinguisher"
                  location={info.fire_extinguisher_location}
                />
              )}
            </Section>
          )}
        </div>
      )}
    </section>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-ink-500 mb-2 mt-4">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function AllergyGroup({
  label,
  tone,
  items,
}: {
  label: string;
  tone: "critical" | "mild" | "minor";
  items: Allergy[];
}) {
  const styles = {
    critical: "bg-terracotta-500/10 border-terracotta-500/40 text-terracotta-700",
    mild: "bg-yellow-50 border-yellow-300/50 text-yellow-800",
    minor: "bg-cream-50 border-cream-200 text-ink-700",
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${styles[tone]}`}>
      <p className="text-[10px] uppercase tracking-wider font-bold mb-1">
        {label}
      </p>
      <ul className="space-y-1">
        {items.map((a) => (
          <li key={a.id} className="text-sm">
            <span className="font-medium">{a.name}</span>
            {a.notes && (
              <span className="text-xs opacity-80"> · {a.notes}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactRow({
  name,
  phone,
  relationship,
}: {
  name: string | null;
  phone: string | null;
  relationship: string | null;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 bg-cream-50 rounded-xl px-3 py-2.5">
      <div className="min-w-0">
        <p className="font-medium text-ink-900 truncate">{name ?? "—"}</p>
        {relationship && (
          <p className="text-xs text-ink-500">{relationship}</p>
        )}
      </div>
      {phone && (
        <a
          href={`tel:${phone}`}
          className="text-sm text-forest-600 font-medium hover:underline shrink-0"
        >
          {phone}
        </a>
      )}
    </div>
  );
}

function PlaceRow({
  name,
  address,
  phone,
}: {
  name: string | null;
  address: string | null;
  phone: string | null;
}) {
  return (
    <div className="bg-cream-50 rounded-xl px-3 py-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium text-ink-900">{name ?? "—"}</p>
        {phone && (
          <a
            href={`tel:${phone}`}
            className="text-sm text-forest-600 font-medium hover:underline shrink-0"
          >
            {phone}
          </a>
        )}
      </div>
      {address && (
        <p className="text-xs text-ink-500 mt-0.5">{address}</p>
      )}
    </div>
  );
}

function DeviceRow({
  label,
  location,
}: {
  label: string;
  location: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 bg-cream-50 rounded-xl px-3 py-2">
      <span className="text-xs uppercase tracking-wide text-ink-500 shrink-0">
        {label}
      </span>
      <span className="text-sm text-ink-900 text-right">{location}</span>
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`w-5 h-5 text-ink-500 transition-transform ${
        expanded ? "rotate-180" : ""
      }`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
