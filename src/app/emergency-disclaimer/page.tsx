const LAST_UPDATED = "May 31, 2026";

export default function EmergencyDisclaimerPage() {
  return (
    <main className="px-5 py-8 max-w-2xl mx-auto space-y-4">
      <header>
        <h1 className="font-display text-3xl text-ink-900 mb-2">Emergency &amp; Incident Disclaimer</h1>
        <p className="text-sm text-ink-500">Last updated: {LAST_UPDATED}</p>
        <p className="text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mt-3">
          Notice: These terms and policies should be reviewed by a qualified attorney before deployment.
        </p>
      </header>

      <Section title="Emergency Protocol">
        <p className="font-bold text-terracotta-700">
          IN ANY MEDICAL, FIRE, POLICE, SAFETY, OR LIFE-THREATENING EMERGENCY, CALL YOUR LOCAL EMERGENCY SERVICES IMMEDIATELY.
        </p>
        <p className="mt-2 text-sm text-ink-700">
          Do not open or rely on this application to alert first responders. The app does not automatically contact emergency systems, dispatchers, or medical professionals. Users must call emergency numbers manually.
        </p>
      </Section>

      <Section title="Local Emergency Numbers">
        <p>Emergency numbers vary depending on your location. Ensure you know the number for your area:</p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-ink-700">
          <li><strong>United States and Canada:</strong> 911</li>
          <li><strong>United Kingdom:</strong> 999 or 112</li>
          <li><strong>European Union and other countries:</strong> 112</li>
        </ul>
      </Section>

      <Section title="Reference Only">
        <p>
          Emergency contacts, medical histories, physician details, allergies, and device locations provided in the app are strictly for informational reference.
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-ink-700">
          <li>Information entered in the app may be incomplete, outdated, or incorrect.</li>
          <li>Administrators, family coordinates, and caregivers must verify emergency facts independently.</li>
          <li>Handoff logs, safety guides, and medication listings are not clinical instructions and are not substitute for professional medical plans.</li>
        </ul>
      </Section>

      <Section title="Notification Limitations">
        <p>
          Alerts, messages, notifications, and reminders may fail, be delayed, or be blocked by network problems, cellular coverage limits, device settings, or power loss. Do not rely on application alerts for time-critical care or safety tasks.
        </p>
      </Section>
    </main>
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
    <section className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
      <h2 className="font-display text-lg text-ink-900 mb-2">{title}</h2>
      <div className="text-sm text-ink-700 space-y-2">{children}</div>
    </section>
  );
}
