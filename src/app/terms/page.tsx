const LAST_UPDATED = "May 30, 2026";

export default function TermsPage() {
  return (
    <main className="px-5 py-8 max-w-2xl mx-auto space-y-4">
      <header>
        <h1 className="font-display text-3xl text-ink-900 mb-2">Terms and Conditions</h1>
        <p className="text-sm text-ink-500">Last updated: {LAST_UPDATED}</p>
      </header>

      <Section title="Independent Contractor Status">
        <p>
          Caregivers are considered independent contractors and are responsible for their own taxes,
          withholding, and recordkeeping. No 1099 or W-2 tax forms will be generated or sent by the
          client/admin through this app. Caregivers may use invoices and year-end summaries solely
          as reference material to assist in keeping records for personal tax filing.
        </p>
      </Section>

      <Section title="No Tax or Payroll Advice">
        <p>
          This app provides recordkeeping services only. It does not provide tax, payroll, legal,
          accounting, insurance, or employment advice. Caregivers are fully responsible for determining
          their own tax obligations, compliance, and classification requirements.
        </p>
      </Section>

      <Section title="Limits of Responsibility">
        <p>
          The homeowner/client is not responsible for damages, injuries, or liabilities beyond what
          homeowner insurance policies allow or applicable law requires. Users utilize the app at
          their own risk.
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
