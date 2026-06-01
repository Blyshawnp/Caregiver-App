const LAST_UPDATED = "May 31, 2026";

export default function DataSecurityPage() {
  return (
    <main className="px-5 py-8 max-w-2xl mx-auto space-y-4">
      <header>
        <h1 className="font-display text-3xl text-ink-900 mb-2">Data Security Notice</h1>
        <p className="text-sm text-ink-500">Last updated: {LAST_UPDATED}</p>
        <p className="text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mt-3">
          Notice: These terms and policies should be reviewed by a qualified attorney before deployment.
        </p>
      </header>

      <Section title="Protection Measures">
        <p>
          We take reasonable technical steps to safeguard care information within this private care circle:
        </p>
        <ul className="list-disc pl-5 space-y-1 text-sm text-ink-700">
          <li>Authentication and secure password hashing.</li>
          <li>Role-based access permissions.</li>
          <li>Supabase database row-level security policies.</li>
          <li>Encrypted data transfer (HTTPS) to Vercel/Supabase servers.</li>
        </ul>
      </Section>

      <Section title="User Security Obligations">
        <p>Data security depends on user vigilance. All coordinates must:</p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-ink-700">
          <li>Select a strong, unique password and keep it strictly confidential.</li>
          <li>Never share accounts or passwords with others.</li>
          <li>Lock your devices (phones, tablets, computers) when not in use.</li>
          <li>Immediately notify the administrator/homeowner if a device is lost or access is compromised.</li>
        </ul>
      </Section>

      <Section title="Security Limitations">
        <p>
          No system is completely secure. Unauthorized access, data breaches, or leaks can still occur due to phishing, malware, user negligence, weak passwords, device compromises, or third-party provider failures.
        </p>
        <p className="mt-2 text-xs text-ink-500">
          The developers and administrators do not guarantee absolute data protection. Users input their information at their own risk.
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
