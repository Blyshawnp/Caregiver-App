"use client";

import { useState } from "react";

type HomeInfo = {
  wifi_ssid: string | null;
  wifi_password: string | null;
  emergency_contact_1_name: string | null;
  emergency_contact_1_phone: string | null;
  emergency_contact_1_relationship: string | null;
  emergency_contact_2_name: string | null;
  emergency_contact_2_phone: string | null;
  emergency_contact_2_relationship: string | null;
  home_notes: string | null;
};

export default function HomeInfoCard({
  info,
  title = "Home info",
}: {
  info: HomeInfo;
  title?: string;
}) {
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const hasWifi = !!(info.wifi_ssid || info.wifi_password);
  const hasEC1 = !!(info.emergency_contact_1_name || info.emergency_contact_1_phone);
  const hasEC2 = !!(info.emergency_contact_2_name || info.emergency_contact_2_phone);
  const hasNotes = !!info.home_notes;

  if (!hasWifi && !hasEC1 && !hasEC2 && !hasNotes) return null;

  function copy(value: string | null, field: string) {
    if (!value) return;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    }
  }

  return (
    <section className="bg-white rounded-3xl shadow-soft p-5 mt-4 grain-overlay">
      <div className="relative">
        <h2 className="font-display text-base mb-3">{title}</h2>

        <div className="space-y-3">
          {/* Emergency contacts */}
          {hasEC1 && (
            <ContactBlock
              label="Emergency contact"
              name={info.emergency_contact_1_name}
              phone={info.emergency_contact_1_phone}
              relationship={info.emergency_contact_1_relationship}
            />
          )}
          {hasEC2 && (
            <ContactBlock
              label="Emergency contact 2"
              name={info.emergency_contact_2_name}
              phone={info.emergency_contact_2_phone}
              relationship={info.emergency_contact_2_relationship}
            />
          )}

          {/* Wifi */}
          {hasWifi && (
            <div className="pt-3 border-t border-cream-200">
              <p className="text-xs uppercase tracking-wider text-ink-500 mb-1.5">
                Wi-Fi
              </p>
              {info.wifi_ssid && (
                <div className="flex items-baseline justify-between mb-1.5">
                  <p className="text-sm text-ink-500">Network</p>
                  <button
                    onClick={() => copy(info.wifi_ssid, "ssid")}
                    className="text-sm text-ink-900 font-medium hover:underline"
                    title="Tap to copy"
                  >
                    {info.wifi_ssid}
                    {copiedField === "ssid" && (
                      <span className="ml-2 text-[10px] text-forest-600">
                        copied!
                      </span>
                    )}
                  </button>
                </div>
              )}
              {info.wifi_password && (
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm text-ink-500">Password</p>
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      onClick={() => copy(info.wifi_password, "password")}
                      className="text-sm text-ink-900 font-medium hover:underline font-mono truncate"
                      title="Tap to copy"
                    >
                      {showWifiPassword
                        ? info.wifi_password
                        : "•".repeat(Math.min(info.wifi_password.length, 12))}
                      {copiedField === "password" && (
                        <span className="ml-2 text-[10px] text-forest-600 font-sans">
                          copied!
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setShowWifiPassword((v) => !v)}
                      className="text-xs text-forest-600 hover:underline shrink-0"
                    >
                      {showWifiPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {hasNotes && (
            <div className="pt-3 border-t border-cream-200">
              <p className="text-xs uppercase tracking-wider text-ink-500 mb-1.5">
                Notes
              </p>
              <p className="text-sm text-ink-700 whitespace-pre-wrap">
                {info.home_notes}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ContactBlock({
  label,
  name,
  phone,
  relationship,
}: {
  label: string;
  name: string | null;
  phone: string | null;
  relationship: string | null;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-ink-500 mb-1.5">
        {label}
      </p>
      <div className="flex items-baseline justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-ink-900">{name ?? "—"}</p>
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
    </div>
  );
}
