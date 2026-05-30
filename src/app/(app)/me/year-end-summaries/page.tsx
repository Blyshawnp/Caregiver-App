import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/pay";
import YearEndDashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ProfileRow = {
  id: string;
  role: "admin" | "client" | "caregiver" | "family";
  organization_id: string;
  full_name: string;
};

type SummaryRow = {
  id: string;
  caregiver_id: string;
  year: number;
  total_hours: number;
  total_pay: number;
  total_bonus: number;
  released_at: string | null;
  created_at: string;
  profiles?: { full_name: string } | null;
};

type CorrectionRow = {
  id: string;
  summary_id: string;
  caregiver_id: string;
  message: string;
  status: "submitted" | "reviewed" | "resolved" | "dismissed";
  admin_response: string | null;
  created_at: string;
  resolved_at: string | null;
  profiles?: { full_name: string } | null;
};

export default async function YearEndSummariesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, organization_id, full_name")
    .eq("id", user.id)
    .single<ProfileRow>();

  if (!profile) redirect("/login");

  const isCaregiver = profile.role === "caregiver";
  const isAdmin = profile.role === "admin" || profile.role === "client";

  let summaries: SummaryRow[] = [];
  let corrections: CorrectionRow[] = [];
  let caregiversList: { id: string; full_name: string }[] = [];

  if (isCaregiver) {
    // Caregiver: see own summaries
    const { data: sumData } = await supabase
      .from("year_end_summaries")
      .select("id, caregiver_id, year, total_hours, total_pay, total_bonus, released_at, created_at")
      .eq("caregiver_id", profile.id)
      .order("year", { ascending: false });

    summaries = (sumData ?? []) as SummaryRow[];

    const { data: corrData } = await supabase
      .from("summary_correction_requests")
      .select("id, summary_id, caregiver_id, message, status, admin_response, created_at, resolved_at")
      .eq("caregiver_id", profile.id)
      .order("created_at", { ascending: false });

    corrections = (corrData ?? []) as CorrectionRow[];
  } else if (isAdmin) {
    // Admin: see all summaries in org
    const { data: sumData } = await supabase
      .from("year_end_summaries")
      .select(`
        id, caregiver_id, year, total_hours, total_pay, total_bonus, released_at, created_at,
        profiles:caregiver_id ( full_name )
      `)
      .eq("organization_id", profile.organization_id)
      .order("year", { ascending: false });

    summaries = (sumData ?? []) as unknown as SummaryRow[];

    const { data: corrData } = await supabase
      .from("summary_correction_requests")
      .select(`
        id, summary_id, caregiver_id, message, status, admin_response, created_at, resolved_at,
        profiles:caregiver_id ( full_name )
      `)
      .order("created_at", { ascending: false });

    corrections = (corrData ?? []) as unknown as CorrectionRow[];

    // Fetch all caregivers to show filters or info
    const { data: cgData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("organization_id", profile.organization_id)
      .eq("role", "caregiver")
      .order("full_name");

    caregiversList = (cgData ?? []) as { id: string; full_name: string }[];
  }

  return (
    <main className="px-5 py-6 max-w-3xl mx-auto">
      <header className="mb-5">
        <Link href="/me" className="text-sm text-forest-600 hover:underline mb-2 inline-block">
          ← Back to Profile
        </Link>
        <h1 className="font-display text-3xl text-ink-900">Year-End Summaries</h1>
        <p className="text-ink-500 text-sm">
          {isCaregiver 
            ? "View and verify your income and hours statements for recordkeeping."
            : "Review annual earning statements and resolve caregiver correction requests."
          }
        </p>
      </header>

      {/* Independent Contractor Notice for PRIVATE app */}
      <section className="bg-cream-100/60 border border-cream-200 p-5 rounded-3xl text-xs text-ink-700 leading-relaxed mb-6 grain-overlay">
        <h2 className="font-semibold text-ink-900 uppercase tracking-wider mb-2 text-[10px]">
          📄 Independent Contractor & Tax Information Notice
        </h2>
        <ul className="list-disc pl-4 space-y-1.5">
          <li><strong>Independent Contractor Status:</strong> Caregivers in this app are considered independent contractors and are responsible for their own tax obligations, filings, and recordkeeping.</li>
          <li><strong>No Employer Payroll Tooling:</strong> This app operates strictly on an independent contractor model. It does not perform employee tax withholdings, tax deductions, or payroll withholding.</li>
          <li><strong>No Tax Documents Sent:</strong> No 1099 or W-2 tax forms will be generated or filed by the homeowner/client through this app.</li>
          <li><strong>Recordkeeping Only:</strong> Invoices and year-end summaries are provided solely to assist you in tracking your service hours and pay for personal accounting. This app does not provide legal, accounting, tax, or employment advice.</li>
        </ul>
      </section>

      <YearEndDashboardClient
        role={profile.role}
        initialSummaries={summaries}
        initialCorrections={corrections}
        caregiversList={caregiversList}
        isPublicApp={false}
      />
    </main>
  );
}
