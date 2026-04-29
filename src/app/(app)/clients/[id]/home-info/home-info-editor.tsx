"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ClientHomeInfo = {
  id: string;
  full_name: string;
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

export default function HomeInfoEditor({
  client,
  canEditWifi,
}: {
  client: ClientHomeInfo;
  canEditWifi: boolean;
}) {
  const router = useRouter();
  const [wifiSsid, setWifiSsid] = useState(client.wifi_ssid ?? "");
  const [wifiPassword, setWifiPassword] = useState(client.wifi_password ?? "");
  const [showWifi, setShowWifi] = useState(false);

  const [ec1Name, setEc1Name] = useState(client.emergency_contact_1_name ?? "");
  const [ec1Phone, setEc1Phone] = useState(
    client.emergency_contact_1_phone ?? ""
  );
  const [ec1Rel, setEc1Rel] = useState(
    client.emergency_contact_1_relationship ?? ""
  );

  const [ec2Name, setEc2Name] = useState(client.emergency_contact_2_name ?? "");
  const [ec2Phone, setEc2Phone] = useState(
    client.emergency_contact_2_phone ?? ""
  );
  const [ec2Rel, setEc2Rel] = useState(
    client.emergency_contact_2_relationship ?? ""
  );

  const [notes, setNotes] = useState(client.home_notes ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const supabase = createClient();

    const update: Record<string, string | null> = {
      emergency_contact_1_name: ec1Name.trim() || null,
      emergency_contact_1_phone: ec1Phone.trim() || null,
      emergency_contact_1_relationship: ec1Rel.trim() || null,
      emergency_contact_2_name: ec2Name.trim() || null,
      emergency_contact_2_phone: ec2Phone.trim() || null,
      emergency_contact_2_relationship: ec2Rel.trim() || null,
      home_notes: notes.trim() || null,
    };

    if (canEditWifi) {
      update.wifi_ssid = wifiSsid.trim() || null;
      update.wifi_password = wifiPassword.trim() || null;
    }

    const { error: updateError } = await supabase
      .from("clients")
      .update(update)
      .eq("id", client.id);

    if (updateError) {
      setError(updateError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setSavedAt(new Date());
    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {/* Emergency contact 1 */}
      <Card title="Emergency contact">
        <Field
          label="Name"
          value={ec1Name}
          onChange={setEc1Name}
          placeholder="Sarah Smith"
        />
        <Field
          label="Phone"
          type="tel"
          value={ec1Phone}
          onChange={setEc1Phone}
          placeholder="555-123-4567"
        />
        <Field
          label="Relationship"
          value={ec1Rel}
          onChange={setEc1Rel}
          placeholder="Daughter"
        />
      </Card>

      {/* Emergency contact 2 */}
      <Card title="Emergency contact 2 (optional)">
        <Field
          label="Name"
          value={ec2Name}
          onChange={setEc2Name}
          placeholder="John Smith"
        />
        <Field
          label="Phone"
          type="tel"
          value={ec2Phone}
          onChange={setEc2Phone}
          placeholder="555-987-6543"
        />
        <Field
          label="Relationship"
          value={ec2Rel}
          onChange={setEc2Rel}
          placeholder="Son"
        />
      </Card>

      {/* Wifi (admin only) */}
      <Card
        title="Wi-Fi"
        subtitle={
          canEditWifi
            ? undefined
            : "Only admins can edit Wi-Fi credentials."
        }
      >
        {canEditWifi ? (
          <>
            <Field
              label="Network name (SSID)"
              value={wifiSsid}
              onChange={setWifiSsid}
              placeholder="HomeNetwork"
            />
            <div>
              <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
                Password
              </span>
              <div className="flex gap-2">
                <input
                  type={showWifi ? "text" : "password"}
                  value={wifiPassword}
                  onChange={(e) => setWifiPassword(e.target.value)}
                  placeholder="••••••••"
                  className="flex-1 px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowWifi((v) => !v)}
                  className="text-xs text-forest-600 hover:underline px-2"
                >
                  {showWifi ? "Hide" : "Show"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <ReadOnly
              label="Network"
              value={client.wifi_ssid || "Not set"}
            />
            <ReadOnly
              label="Password"
              value={client.wifi_password ? "•".repeat(8) : "Not set"}
            />
          </>
        )}
      </Card>

      {/* General notes */}
      <Card title="Notes for caregivers (optional)">
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Anything caregivers should know — e.g. how to operate the lift, alarm code (if you trust it here), pet info, parking instructions..."
          className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm resize-none"
        />
      </Card>

      {error && (
        <div className="bg-terracotta-400/10 border border-terracotta-400/30 text-terracotta-600 rounded-xl px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 sticky bottom-3 bg-cream-100/95 backdrop-blur p-3 rounded-2xl shadow-soft border border-cream-200">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl font-medium transition disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
        {savedAt && (
          <p className="text-xs text-forest-600">
            Saved {savedAt.toLocaleTimeString()}
          </p>
        )}
      </div>
    </form>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
      <div className="relative">
        <h2 className="font-display text-base mb-1">{title}</h2>
        {subtitle && (
          <p className="text-xs text-ink-500 mb-3">{subtitle}</p>
        )}
        <div className="space-y-3 mt-3">{children}</div>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
      />
    </label>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-cream-200 last:border-b-0">
      <span className="text-xs uppercase tracking-wide text-ink-500">
        {label}
      </span>
      <span className="text-sm text-ink-900">{value}</span>
    </div>
  );
}
