import Link from "next/link";

export default function AccountDeletePage() {
  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href="/help"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back to Help
        </Link>
        <h1 className="font-display text-3xl text-ink-900">
          Account Deletion
        </h1>
        <p className="text-ink-500 text-sm">
          How to request deletion of your account and private data.
        </p>
      </header>

      <section className="bg-white rounded-3xl shadow-soft p-6 grain-overlay space-y-4">
        <div>
          <h2 className="font-display text-lg text-ink-900 mb-2">Request Process</h2>
          <p className="text-sm text-ink-700 leading-relaxed">
            As a private coordination application, account management is handled directly by your household or care circle administrator. To request complete deletion of your account and personal data, please contact the primary administrator or homeowner directly.
          </p>
        </div>

        <div className="border-t border-cream-100 pt-4">
          <h2 className="font-display text-base text-ink-900 mb-2">Data Retention Rules</h2>
          <p className="text-sm text-ink-700 leading-relaxed">
            Upon receipt of a deletion request, the administrator will deactivate and remove your account profile. However, please note that some information may be retained in historical logs rather than being immediately deleted:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1.5 text-xs text-ink-600 leading-relaxed">
            <li>Past shift timestamps, caregiver check-in records, and check-out logs are preserved to maintain care coordination history and safety logs.</li>
            <li>Invoices, rate estimates, bonuses, and year-end summaries are retained for household bookkeeping, caregiver tax references, and legal audit protection.</li>
            <li>Security audit trails and system access logs are preserved for system security, troubleshooting, and dispute resolution.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
