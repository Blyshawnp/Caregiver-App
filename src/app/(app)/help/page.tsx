import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Role = "admin" | "client" | "caregiver" | "family" | "family";

export default async function HelpPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single<{ role: Role }>();

  const role: Role = profile?.role ?? "caregiver";

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href="/me"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back
        </Link>
        <h1 className="font-display text-3xl text-ink-900">Help</h1>
        <p className="text-ink-500 text-sm">
          How the app works for {role === "caregiver" ? "caregivers" : role === "admin" ? "admins" : "clients"}.
        </p>
      </header>

      <div className="space-y-3">
        <Section title="Quick start">
          {role === "caregiver" ? (
            <ul className="text-sm text-ink-700 space-y-2 list-disc pl-5">
              <li>Open the <strong>Schedule</strong> tab to see your upcoming shifts.</li>
              <li>When you arrive at a shift, tap it and use <strong>Check in</strong>. You need to be inside the geofence.</li>
              <li>Work through the <strong>Tasks</strong> for that shift, checking each off as you go.</li>
              <li>Tap <strong>Check out</strong> when you're done. If you forget and leave, you'll be auto-checked-out.</li>
            </ul>
          ) : role === "admin" ? (
            <ul className="text-sm text-ink-700 space-y-2 list-disc pl-5">
              <li>Use <strong>Schedule</strong> to view and create shifts. The + button creates a single shift or a recurring batch.</li>
              <li>Manage caregivers and rates in <strong>Me → Manage team</strong>.</li>
              <li>Set up <strong>home info, allergies, hospital pref, emergency devices</strong> per client in <strong>Me → Clients</strong>.</li>
              <li>Track everyone's pay live and view past invoices in <strong>Me → Payroll</strong>.</li>
            </ul>
          ) : (
            <ul className="text-sm text-ink-700 space-y-2 list-disc pl-5">
              <li>See who's currently on shift on the <strong>Home</strong> tab.</li>
              <li>Edit home info, emergency contacts, allergies under <strong>Me → Home info</strong>.</li>
              <li>Track pay live and view past invoices under <strong>Me → Payroll</strong>.</li>
            </ul>
          )}
        </Section>

        <Section title="Check-in and check-out">
          <p className="text-sm text-ink-700 mb-2">
            Check-in uses your phone's location to confirm you're at the
            client's home. The geofence is a circle around the address (default
            150 meters).
          </p>
          {role === "caregiver" ? (
            <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
              <li>If you check in or out outside the geofence, the shift gets <strong>flagged</strong> and the admin sees the reason.</li>
              <li>If you leave the location after your scheduled end time, you'll be checked out automatically.</li>
              <li>Shift action buttons (Accept, Check in, Check out, Lunch and Break timers) are located at the top of the shift detail page for easy mobile access.</li>
              <li>Unfinished required tasks will prompt a checkout warning, but optional and PRN tasks will not block checkout.</li>
            </ul>
          ) : (
            <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
              <li>You can manually check a caregiver in or out from any shift detail page (without geofence enforcement).</li>
              <li>Manual check-ins are flagged with a reason note that's visible on the shift.</li>
              <li>Force check-out from the live shift card if needed.</li>
            </ul>
          )}
        </Section>

        <Section title="Pay & invoices">
          {role === "caregiver" ? (
            <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
              <li>Your <strong>Me</strong> tab shows your running pay for the current period.</li>
              <li>Pay periods run <strong>Friday 9 PM to Friday 9 PM</strong> (Eastern). Each period locks automatically at the end.</li>
              <li>Once locked, the invoice can't change. Older invoices are paginated under <strong>Me → My invoices</strong>.</li>
              <li>If you forgot to check out or need to correct your hours, tap <strong>Request Time Correction</strong> on the shift details page to submit corrected check-in/out times. Approved corrections will reflect on the next invoice.</li>
              <li>All amounts are <strong>rounded up to the nearest $0.25</strong>.</li>
            </ul>
          ) : (
            <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
              <li>The <strong>Payroll</strong> page shows live current-period totals per caregiver.</li>
              <li>Pay periods auto-release at <strong>Friday 9 PM Eastern</strong>. Once released, invoices are locked.</li>
              <li>Adjust a specific shift's pay (hours, rate, or fixed amount) using <strong>Adjust pay for this shift</strong> on the shift detail page. Changes are logged with a reason.</li>
              <li>Review caregiver time corrections directly from the shift details page. Approved corrections update check-in details and automatically reflect on the next invoice.</li>
              <li>All amounts round up to the nearest $0.25.</li>
            </ul>
          )}
        </Section>

        {role === "caregiver" && (
          <Section title="Releasing & claiming shifts">
            <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
              <li>If you can't make a shift, open it and tap <strong>Release shift</strong> with a reason. Other caregivers will see it.</li>
              <li>Released shifts that aren't claimed remain your responsibility until handed off.</li>
              <li>Shifts another caregiver releases will appear in your schedule with a <strong>Claim</strong> button.</li>
            </ul>
          </Section>
        )}

        <Section title="Tasks">
          {role === "caregiver" ? (
            <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
              <li><strong>Required Tasks:</strong> Must be completed by shift end. Incomplete required tasks will trigger warnings at checkout.</li>
              <li><strong>Optional Tasks:</strong> Good to complete if possible, but leaving them unfinished will never trigger missed-task warnings or block checkout.</li>
              <li><strong>PRN / If-Needed Tasks:</strong> Tasks that are only done if required. Leaving a PRN task unchecked is normal and does not mean it was missed. You can mark it <strong>"Not needed this shift"</strong>, <strong>"Client declined"</strong>, or <strong>"Needs follow-up"</strong>.</li>
              <li><strong>Checkout Reminder:</strong> A gentle reminder is displayed at checkout if any PRN tasks remain unmarked. If require_prn_acknowledgment is enabled, you must choose a status for each PRN task before checking out.</li>
              <li>Tap a task's checkbox to mark it complete. Notes can be added per task.</li>
            </ul>
          ) : (
            <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
              <li>Manage the master task list under <strong>Tasks → Master tasks</strong>.</li>
              <li>Mark a task as <strong>default</strong> to auto-add it to every new shift.</li>
              <li>Assign a task to a specific caregiver to make it appear only on that person's shifts.</li>
            </ul>
          )}
        </Section>

        <Section title="Messages & notifications">
          <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
            <li>The <strong>Messages</strong> tab supports 1-on-1 conversations between anyone in the org.</li>
            <li>Notifications appear in the bell icon at the top. The badge updates in real time.</li>
            <li>For system-level pop-up notifications, allow notification permission when prompted by your browser. On iOS, you must add the app to your home screen first.</li>
          </ul>
        </Section>

        {role !== "caregiver" && (
          <Section title="Home info & emergency">
            <ul className="text-sm text-ink-750 space-y-1.5 list-disc pl-5">
              <li>Visit <strong>Me → Clients → Edit home info</strong> to manage everything caregivers see on the shift detail page.</li>
              <li>Stable profile, contact, Wi-Fi, and preferred hospital details reside in <strong>General & Home Info</strong>, whereas emergency evacuation action plans are managed separately under the <strong>Emergency Guide</strong> to prevent duplicate entries and keep care circles aligned.</li>
              <li>Add <strong>allergies</strong> with severity (critical, mild, minor) so caregivers can see them at a glance.</li>
              <li>Set the <strong>preferred hospital</strong> and <strong>primary physician</strong> for emergencies.</li>
              <li>Toggle on <strong>panic buttons</strong> or <strong>medical alerts</strong> and tell caregivers where they are.</li>
              <li>Document the location of the <strong>first aid kit, hypoglycemia kit, fire extinguisher, AED</strong>.</li>
              <li>Upload <strong>PDFs and images</strong> for instructions, emergency info, etc. Categorize each so caregivers find them easily.</li>
              <li>Wi-Fi password is editable by admin only; clients see read-only.</li>
            </ul>
          </Section>
        )}

        <Section title="Privacy & access">
          <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
            <li>Each role only sees data within its own organization.</li>
            <li>Caregivers can see all home info needed to do their work, but never edit Wi-Fi or sensitive admin settings.</li>
            <li>Admins can do everything in their org.</li>
            <li>Clients can edit emergency contacts, allergies, notes — but not Wi-Fi password.</li>
            <li><strong>Sensitive Documents:</strong> Shared documents may contain highly sensitive medical or personal information. Users should only upload, view, or share documents they are explicitly authorized to share.</li>
            <li><strong>Print Approvals & Acknowledgments:</strong> Printing sensitive documents may require administrator approval. When a document requires acknowledgment, your read/acknowledgment records will be stored and made visible to administrators.</li>
          </ul>
        </Section>

        <Section title="Feedback & Commendations">
          <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
            <li>Clients and families can submit positive commendations, thank you notes, concerns, or complaints about caregivers via <strong>Me &rarr; Submit caregiver feedback</strong>.</li>
            <li><strong>Admin Review:</strong> All feedback is securely sent to administrators. Complaints and concerns are never shared with caregivers automatically.</li>
            <li><strong>Commendations & Appreciation:</strong> Administrators can choose to share positive commendations or appreciations directly with the caregiver to recognize their good work.</li>
            <li><strong>Emergency Warning:</strong> Caregiver feedback is NOT monitored 24/7 and should never be used for emergencies or active safety issues. Please report emergencies via 911 immediately.</li>
          </ul>
        </Section>

        <Section title="Emergency Prep & Pet Records">
          <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
            <li><strong>Accuracy:</strong> Pet information and emergency preparedness instructions are user-entered and must be kept up-to-date and accurate.</li>
            <li><strong>Not a Substitute:</strong> This app is NOT a substitute for professional emergency services (such as calling 911).</li>
            <li><strong>Caregiver Instructions:</strong> Caregivers must follow the organization and client's instructions during an event and immediately call emergency services (911) when appropriate.</li>
          </ul>
        </Section>

        <Section title="Invoices & Year-End Summaries">
          <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
            <li><strong>How to Print Invoices:</strong> Go to <strong>Me &rarr; Invoices</strong>, select any locked invoice statement, and click the <strong>🖨️ Print Invoice</strong> button.</li>
            <li><strong>Year-End summaries:</strong> Released automatically every January 5 for the prior calendar year. Go to <strong>Me &rarr; Year-End Summaries</strong> to view them.</li>
            <li><strong>How to Print summaries:</strong> Inside any EOY summary card, click <strong>🖨️ Print or Save as PDF</strong>. Works on mobile, PWA, and desktop browsers.</li>
            <li><strong>Correction Requests:</strong> If hours/pay rates look wrong, enter details in the correction form under the summary card. Administrators will review and respond.</li>
            <li><strong>Independent Contractor Status:</strong> Caregivers are considered independent contractors and are responsible for their own taxes and records. No W-2 or 1099 is issued by this app. It is strictly for recordkeeping.</li>
          </ul>
        </Section>

        <Section title="Schedule Multi-Select & Bulk Actions">
          <p className="text-sm text-ink-700 mb-2">
            Administrators and clients can perform bulk actions on multiple shifts at once:
          </p>
          <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
            <li><strong>Bulk Delete / Cancel:</strong> Select multiple shifts on the schedule page (via 'Bulk actions') and delete them together. This will show a strong warning if any shift contains check-ins, completed tasks, or notes.</li>
            <li><strong>Bulk Add Tasks:</strong> Assign library task templates to all selected shifts in one go, with duplication-skipping controls to avoid duplicate tasks.</li>
          </ul>
        </Section>

        <Section title="Default Tasks by Day of Week">
          <p className="text-sm text-ink-700 mb-2">
            Default task library settings permit granular automatic task scheduling:
          </p>
          <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
            <li><strong>Weekly Schedule:</strong> Default tasks can be set to only auto-add to shifts on specific days of the week (e.g. Monday, Wednesday, Friday).</li>
            <li><strong>Date Ranges:</strong> You can define optional start and end dates for task auto-scheduling.</li>
            <li><strong>Backfilling:</strong> Use the "Apply default tasks to future shifts" action in the library to backfill matching default tasks on existing future shifts.</li>
          </ul>
        </Section>

        <Section title="Account Settings & PWA Installation">
          <p className="text-sm text-ink-700 mb-2">
            Manage your credentials and offline standalone experience in <strong>Account & Settings</strong>:
          </p>
          <ul className="text-sm text-ink-700 space-y-1.5 list-disc pl-5">
            <li><strong>Theme Preference:</strong> Choose a curated primary color scheme (Teal, Blue, Green, Purple, Rose, High Contrast) that overrides default styles safely.</li>
            <li><strong>Email & Password changes:</strong> Change your signed-in email address or password securely.</li>
            <li><strong>PWA Banners & Prompts:</strong> Control progressive web app banners. You can dismiss them for 24 hours, suppress them permanently, or access manual device installation guides.</li>
          </ul>
        </Section>

        <Section title="Trouble?">
          <p className="text-sm text-ink-700">
            If something looks wrong (a time is off, a shift didn't update, etc), try a hard refresh first. If it persists, message your admin from the Messages tab.
          </p>
        </Section>
      </div>
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
      <div className="relative">
        <h2 className="font-display text-base mb-2">{title}</h2>
        {children}
      </div>
    </section>
  );
}
