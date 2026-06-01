const LAST_UPDATED = "May 31, 2026";

export default function PrivacyPage() {
  return (
    <main className="px-5 py-8 max-w-2xl mx-auto space-y-4">
      <header>
        <h1 className="font-display text-3xl text-ink-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-ink-500">Last updated: {LAST_UPDATED}</p>
        <p className="text-xs text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-xl px-4 py-2 mt-3">
          Notice: These terms and policies should be reviewed by a qualified attorney before deployment.
        </p>
      </header>

      <Section title="Information We Collect">
        <p>
          To coordinate care, we collect and store information entered by the administrator, family members, or caregivers:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-ink-700">
          <li><strong>Account Details:</strong> Name, email address, password hashes, and profile settings.</li>
          <li><strong>Care Circle Profiles:</strong> User roles (admin, caregiver, client, family).</li>
          <li><strong>Client & Home Info:</strong> Name, address, entry notes, Wi-Fi details, and home notes.</li>
          <li><strong>Emergency & Health Logs:</strong> Emergency contacts, allergy records, medication instructions, and home safety device locations.</li>
          <li><strong>Schedules & Check-ins:</strong> Shift history, timestamps, geofence verification details, and check-in coordinates.</li>
          <li><strong>Task Logs:</strong> Checkboxes, PRN statuses, notes, and task completion records.</li>
          <li><strong>Communications:</strong> Internal messages, notifications, incident notes, and commendations or feedback.</li>
          <li><strong>Invoices & Payments:</strong> Estimative caregiver pay rates, payment logs, and year-end summaries.</li>
          <li><strong>System Data:</strong> Browser type, device settings, operating system, and security logs.</li>
        </ul>
      </Section>

      <Section title="How We Use Information">
        <p>
          Information is utilized strictly for coordination, operation, and safety purposes:
        </p>
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-ink-700">
          <li>Authentication and authorization controls.</li>
          <li>Displaying schedules and organizing caregivers shifts.</li>
          <li>Providing emergency reference info (allergies, contacts) to caregivers during active shifts.</li>
          <li>Managing checklist completion, notes, and handoff reports.</li>
          <li>Generating manual recordkeeping estimates for caregiver pay histories and client invoices.</li>
          <li>Logging audits, troubleshooting technical errors, and protecting system security.</li>
        </ul>
      </Section>

      <Section title="Information Sharing">
        <p>
          Data is shared strictly within your private care circle. Caregivers see home access notes, medications, allergies, and checklists. Caregivers cannot see sensitive billing matrices or other caregiver pay rates.
        </p>
        <p className="mt-2">
          We do not sell user data. Information is shared with third-party service providers (such as hosting, database, and email delivery platforms) only as required to run the application, or when legally compelled.
        </p>
      </Section>

      <Section title="HIPAA & Health Information Limits">
        <p>
          This private application is a personal coordination tool and is not HIPAA-compliant. The application does not operate under a Health Insurance Portability and Accountability Act (HIPAA) compliance program, and no Business Associate Agreement (BAA) is in place. It is not intended for formal clinical documentation.
        </p>
      </Section>

      <Section title="Location Tracking">
        <p>
          The application checks your device's location strictly at the moment of check-in and check-out to verify the geofence. The app does not track your location continuously in the background.
        </p>
      </Section>

      <Section title="Account & Data Deletion">
        <p>
          Users can request account or data deletion by contacting the primary administrator or homeowner directly. Once requested, the administrator can delete linked profiles.
        </p>
        <p className="mt-2">
          Please note that some data (such as past shift timestamps, audit logs, and billing histories) may be retained for legitimate recordkeeping, insurance, dispute resolution, or legal compliance.
        </p>
      </Section>

      <Section title="Children's Privacy">
        <p>
          The application is not intended for use by children under 13. Care recipient profiles of minors may only be created and managed by authorized adult parents, guardians, or administrators.
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
