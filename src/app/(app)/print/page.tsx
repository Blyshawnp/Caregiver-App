import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatPay, roundUpToQuarter } from "@/lib/pay";
import { formatShortDateInTz, formatTimeInTz } from "@/lib/datetime";
import { StarOfLifeIcon } from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ClientFull = {
  id: string;
  full_name: string;
  address: string | null;
  emergency_contact_1_name: string | null;
  emergency_contact_1_phone: string | null;
  emergency_contact_1_relationship: string | null;
  emergency_contact_2_name: string | null;
  emergency_contact_2_phone: string | null;
  emergency_contact_2_relationship: string | null;
  preferred_hospital_name: string | null;
  preferred_hospital_address: string | null;
  preferred_hospital_phone: string | null;
  primary_physician_name: string | null;
  primary_physician_address: string | null;
  primary_physician_phone: string | null;
  has_panic_button: boolean | null;
  panic_button_location: string | null;
  has_medical_alert: boolean | null;
  medical_alert_location: string | null;
  first_aid_location: string | null;
  hypoglycemia_kit_location: string | null;
  fire_extinguisher_location: string | null;
  aed_location: string | null;
};

type Allergy = {
  id: string;
  client_id: string;
  name: string;
  severity: "critical" | "mild" | "minor";
  notes: string | null;
};

type SnapRow = {
  id: string;
  total_hours: number;
  total_amount: number;
  shift_count: number;
  breakdown: Array<{
    shift_id: string;
    scheduled_start: string;
    scheduled_end: string;
    client_name: string | null;
    hours: number;
    rate: number;
    amount: number;
    bonus_amount: number | null;
    bonus_reason: string | null;
    is_overridden: boolean;
    override_reason: string | null;
  }> | null;
  pay_periods: {
    period_start: string;
    period_end: string;
    released_at: string | null;
  } | null;
};

export default async function PrintViewPage({
  searchParams,
}: {
  searchParams?: Promise<{ type?: string; id?: string; clientId?: string }>;
}) {
  const { type, id, clientId } = (await searchParams) ?? {};

  if (!type) redirect("/home");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, organization_id, full_name")
    .eq("id", user.id)
    .single<{ id: string; role: string; organization_id: string; full_name: string }>();

  if (!profile) redirect("/login");

  let printTitle = "Print Document";

  return (
    <main className="px-6 py-6 max-w-3xl mx-auto bg-white min-h-dvh">
      {/* Dynamic print-friendly CSS overrides */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            font-size: 12pt !important;
          }
          nav, footer, .no-print, button, a.back-btn, header {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: 100% !important;
            box-shadow: none !important;
          }
          .page-break {
            page-break-after: always;
          }
        }
      `}} />

      {/* Floating back button & Print Trigger (no-print) */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-cream-50 p-4 rounded-2xl border border-cream-200 mb-6">
        <div>
          <Link
            href="/documents"
            className="back-btn text-xs text-forest-600 hover:underline inline-block mb-1 font-semibold"
          >
            ← Back to Documents
          </Link>
          <h2 className="font-display text-sm text-ink-900 font-bold">Print Preview Mode</h2>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="bg-forest-600 hover:bg-forest-700 text-cream-50 text-xs px-4 py-2 rounded-xl font-medium transition"
          >
            🖨️ Print or Save as PDF
          </button>
        </div>
      </div>

      {/* Mobile & PWA Print Help (no-print) */}
      <div className="no-print bg-cream-100/50 p-4 rounded-2xl border border-cream-200 text-xs text-ink-600 mb-6 space-y-1.5 leading-relaxed">
        <p className="font-semibold text-ink-800 uppercase tracking-wider text-[10px]">📱 Mobile Printing Help</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><strong>iPhone / iPad (iOS):</strong> Tap the browser <strong>Share</strong> button, scroll down and select <strong>Print</strong>. Zoom in on the preview thumbnail with two fingers to save it directly as a PDF!</li>
          <li><strong>Android:</strong> Tap the <strong>three-dots menu</strong> in the top-right, select <strong>Share</strong> or <strong>Print</strong>, then select <strong>Save as PDF</strong>.</li>
          <li><strong>Desktop / PWA:</strong> Press <strong>Ctrl + P</strong> (Windows) or <strong>Cmd + P</strong> (Mac).</li>
        </ul>
      </div>

      {/* RENDER CONTENT BASED ON TYPE */}

      {/* 1. PDF Document */}
      {type === "document" && id && (
        async () => {
          const { data: doc } = await supabase
            .from("documents")
            .select("id, title, description, storage_path, requires_print_approval")
            .eq("id", id)
            .maybeSingle<{ id: string; title: string; description: string | null; storage_path: string; requires_print_approval: boolean }>();

          if (!doc) return <p className="text-sm text-terracotta-600">Document not found.</p>;

          // Check if print approval is required and verify status
          if (doc.requires_print_approval && profile.role !== "admin") {
            const { data: request } = await supabase
              .from("document_print_requests")
              .select("status")
              .eq("document_id", doc.id)
              .eq("requested_by", profile.id)
              .maybeSingle();

            if (request?.status !== "approved") {
              return <p className="text-sm text-terracotta-600">You must receive print approval from an administrator to print this document.</p>;
            }
          }

          const fileUrl = `https://xunvxasgoxhujshmhkqy.supabase.co/storage/v1/object/authenticated/client-documents/${doc.storage_path}`;

          return (
            <div className="space-y-4">
              <header className="border-b border-cream-200 pb-3 mb-4">
                <h1 className="font-display text-2xl font-bold text-ink-900">{doc.title}</h1>
                {doc.description && <p className="text-xs text-ink-500 mt-1">{doc.description}</p>}
                <p className="text-[10px] text-ink-400 mt-0.5">Printed by {profile.full_name} on {new Date().toLocaleDateString()}</p>
              </header>

              <div className="bg-cream-50 p-3 rounded-2xl border border-cream-200/80 mb-3 text-center no-print">
                <p className="text-xs text-ink-600">
                  PDF preview displayed below. Use the native print button above to trigger your browser's PDF print dialer.
                </p>
              </div>

              <iframe
                src={fileUrl}
                title={doc.title}
                className="w-full h-[600px] border border-cream-200 rounded-2xl shadow-soft bg-cream-50"
              />
            </div>
          );
        }
      )()}

      {/* 2. Invoice Print View */}
      {type === "invoice" && id && (
        async () => {
          const { data: snapRaw } = await supabase
            .from("pay_period_snapshots")
            .select(`
              id,
              total_hours,
              total_amount,
              shift_count,
              breakdown,
              pay_periods ( period_start, period_end, released_at )
            `)
            .eq("pay_period_id", id)
            .eq("caregiver_id", profile.id)
            .maybeSingle();

          if (!snapRaw) return <p className="text-sm text-terracotta-600">Invoice not found.</p>;

          const snap = snapRaw as unknown as SnapRow;
          const items = snap.breakdown ?? [];
          const periodStart = snap.pay_periods?.period_start ? new Date(snap.pay_periods.period_start) : null;
          const periodEnd = snap.pay_periods?.period_end ? new Date(snap.pay_periods.period_end) : null;

          return (
            <div className="space-y-6">
              <header className="border-b-2 border-forest-600 pb-4 flex justify-between items-start">
                <div>
                  <h1 className="font-display text-2xl font-bold text-ink-900">INVOICE STATEMENT</h1>
                  <p className="text-xs text-ink-500">
                    Period: {periodStart && formatShortDateInTz(periodStart)} &ndash; {periodEnd && formatShortDateInTz(periodEnd)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ink-800 text-sm">Caregiver: {profile.full_name}</p>
                  <p className="text-[10px] text-ink-400">Statement Generated: {new Date().toLocaleDateString()}</p>
                </div>
              </header>

              <div className="bg-forest-50 p-5 rounded-2xl border border-forest-100 flex justify-between items-center">
                <div>
                  <p className="text-[10px] uppercase font-bold tracking-wider text-forest-700">Total Invoice Amount</p>
                  <p className="font-display text-3xl font-extrabold text-forest-900">{formatCurrency(snap.total_amount)}</p>
                </div>
                <div className="text-right text-xs text-ink-600">
                  <p className="font-semibold">{Number(snap.total_hours).toFixed(1)} Hours Worked</p>
                  <p>{snap.shift_count} total shift{snap.shift_count === 1 ? "" : "s"}</p>
                </div>
              </div>

              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wider text-ink-700 mb-2">Shift Details</h3>
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-cream-300 text-ink-500 bg-cream-50/50">
                      <th className="py-2 px-1">Date / Time</th>
                      <th className="py-2">Client</th>
                      <th className="py-2 text-right">Hours</th>
                      <th className="py-2 text-right">Rate</th>
                      <th className="py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-200">
                    {items.map((item, idx) => {
                      const start = new Date(item.scheduled_start);
                      return (
                        <tr key={idx} className="py-2">
                          <td className="py-2 px-1 font-medium">
                            {formatShortDateInTz(start)}<br/>
                            <span className="text-[10px] text-ink-400 font-normal">
                              {formatTimeInTz(new Date(item.scheduled_start))} &ndash; {formatTimeInTz(new Date(item.scheduled_end))}
                            </span>
                          </td>
                          <td className="py-2 text-ink-700">{item.client_name ?? "—"}</td>
                          <td className="py-2 text-right">{Number(item.hours).toFixed(1)}</td>
                          <td className="py-2 text-right">{formatCurrency(item.rate)}</td>
                          <td className="py-2 text-right font-medium">{formatPay(item.amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="text-[10px] text-ink-400 text-center pt-4 border-t border-cream-200">
                Values rounded up to the nearest $0.25. Official statement for administrative reconciliation.
              </p>
            </div>
          );
        }
      )()}

      {/* 3. Emergency Preparedness Guide */}
      {type === "emergency" && (
        async () => {
          let clientQuery = supabase
            .from("clients")
            .select(`
              id, full_name, address,
              emergency_contact_1_name, emergency_contact_1_phone, emergency_contact_1_relationship,
              emergency_contact_2_name, emergency_contact_2_phone, emergency_contact_2_relationship,
              preferred_hospital_name, preferred_hospital_address, preferred_hospital_phone,
              primary_physician_name, primary_physician_address, primary_physician_phone,
              has_panic_button, panic_button_location,
              has_medical_alert, medical_alert_location,
              first_aid_location, hypoglycemia_kit_location, fire_extinguisher_location, aed_location
            `);

          if (clientId) {
            clientQuery = clientQuery.eq("id", clientId);
          } else {
            clientQuery = clientQuery.order("full_name");
          }

          const { data: clientsRaw } = await clientQuery;
          const clients = (clientsRaw ?? []) as ClientFull[];

          let allAllergies: Allergy[] = [];
          try {
            const { data } = await supabase
              .from("client_allergies")
              .select("id, client_id, name, severity, notes");
            allAllergies = (data ?? []) as Allergy[];
          } catch {
            allAllergies = [];
          }

          // Fetch emergency preparedness guides
          let guides: any[] = [];
          try {
            const { data } = await supabase
              .from("client_emergency_guides")
              .select("*")
              .eq("enabled", true);
            guides = data ?? [];
          } catch {
            guides = [];
          }

          // Fetch pets
          let allPets: any[] = [];
          try {
            const { data } = await supabase
              .from("client_pets")
              .select("*")
              .order("created_at", { ascending: true });
            allPets = data ?? [];
          } catch {
            allPets = [];
          }

          return (
            <div className="space-y-6">
              <header className="border-b-4 border-red-600 pb-3 mb-4 flex items-center gap-3">
                <span className="w-10 h-10 bg-red-600 text-white rounded-lg flex items-center justify-center shrink-0">✚</span>
                <div>
                  <h1 className="font-display text-2xl font-bold text-ink-900 uppercase">EMERGENCY PREPAREDNESS GUIDE</h1>
                  <p className="text-xs text-ink-500">Critical Medical & Emergency Response Assets</p>
                </div>
              </header>

              <div className="space-y-8">
                {clients.map((client) => {
                  const clientAllergies = allAllergies.filter((a) => a.client_id === client.id);
                  const clientGuide = guides.find((g) => g.client_id === client.id);
                  const clientPets = allPets.filter((p) => p.client_id === client.id);

                  return (
                    <div key={client.id} className="border border-cream-300 p-5 rounded-3xl space-y-4 page-break">
                      <h2 className="font-display text-xl font-bold text-ink-900 border-b border-cream-200 pb-1.5">{client.full_name}</h2>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        {/* Contacts */}
                        <div className="space-y-2">
                          <p className="font-bold text-ink-800 uppercase tracking-wider text-[10px]">Emergency Contacts</p>
                          <div className="bg-cream-50 p-3 rounded-2xl space-y-1">
                            <p><strong>Primary:</strong> {client.emergency_contact_1_name || "—"} ({client.emergency_contact_1_relationship})</p>
                            <p>Phone: {client.emergency_contact_1_phone || "—"}</p>
                            {client.emergency_contact_2_name && (
                              <>
                                <p className="mt-1"><strong>Secondary:</strong> {client.emergency_contact_2_name} ({client.emergency_contact_2_relationship})</p>
                                <p>Phone: {client.emergency_contact_2_phone}</p>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Medical Providers */}
                        <div className="space-y-2">
                          <p className="font-bold text-ink-800 uppercase tracking-wider text-[10px]">Preferred Hospital & Physician</p>
                          <div className="bg-cream-50 p-3 rounded-2xl space-y-1">
                            <p><strong>Hospital:</strong> {client.preferred_hospital_name || "—"}</p>
                            <p>Address: {client.preferred_hospital_address || "—"}</p>
                            <p><strong>Physician:</strong> {client.primary_physician_name || "—"}</p>
                            <p>Phone: {client.primary_physician_phone || "—"}</p>
                          </div>
                        </div>
                      </div>

                      {/* Allergies */}
                      <div className="space-y-2 text-xs">
                        <p className="font-bold text-ink-800 uppercase tracking-wider text-[10px]">Allergies ({clientAllergies.length})</p>
                        {clientAllergies.length === 0 ? (
                          <p className="text-ink-500 italic pl-1">No allergies registered.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {clientAllergies.map((alg) => (
                              <div key={alg.id} className="p-2.5 bg-red-50/20 border border-red-100 rounded-xl">
                                <p className="font-semibold text-ink-900">{alg.name} <span className="text-[10px] text-terracotta-700 uppercase font-bold ml-1.5">{alg.severity}</span></p>
                                {alg.notes && <p className="text-[10px] text-ink-500 mt-0.5">{alg.notes}</p>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Equipment Location */}
                      <div className="space-y-2 text-xs">
                        <p className="font-bold text-ink-800 uppercase tracking-wider text-[10px]">Safety & Emergency Equipment Locations</p>
                        <div className="grid grid-cols-2 gap-2 bg-cream-50/30 p-3 rounded-2xl border border-cream-200/50">
                          <p><strong>First Aid Kit:</strong> {client.first_aid_location || "—"}</p>
                          <p><strong>Fire Extinguisher:</strong> {client.fire_extinguisher_location || "—"}</p>
                          <p><strong>Hypoglycemia Kit:</strong> {client.hypoglycemia_kit_location || "—"}</p>
                          <p><strong>AED:</strong> {client.aed_location || "—"}</p>
                          {client.has_panic_button && <p><strong>Panic Button:</strong> {client.panic_button_location || "—"}</p>}
                          {client.has_medical_alert && <p><strong>Medical Alert:</strong> {client.medical_alert_location || "—"}</p>}
                        </div>
                      </div>

                      {/* Emergency Preparedness Guide Section */}
                      {clientGuide && (
                        <div className="space-y-2 text-xs border-t border-cream-200 pt-3">
                          <p className="font-bold text-red-700 uppercase tracking-wider text-[10px]">Emergency Preparedness Guide</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-red-50/5 p-3 rounded-2xl border border-red-100/40">
                            {clientGuide.medical_emergency_plan && (
                              <div>
                                <p className="font-semibold text-ink-800">Medical Emergency Plan</p>
                                <p className="text-ink-600 mt-0.5">{clientGuide.medical_emergency_plan}</p>
                              </div>
                            )}
                            {clientGuide.fall_plan && (
                              <div>
                                <p className="font-semibold text-ink-800">Fall Plan</p>
                                <p className="text-ink-600 mt-0.5">{clientGuide.fall_plan}</p>
                              </div>
                            )}
                            {clientGuide.fire_evacuation_plan && (
                              <div>
                                <p className="font-semibold text-ink-800">Fire Evacuation Plan</p>
                                <p className="text-ink-600 mt-0.5">{clientGuide.fire_evacuation_plan}</p>
                              </div>
                            )}
                            {clientGuide.severe_weather_plan && (
                              <div>
                                <p className="font-semibold text-ink-800">Severe Weather Plan</p>
                                <p className="text-ink-600 mt-0.5">{clientGuide.severe_weather_plan}</p>
                              </div>
                            )}
                            {clientGuide.power_outage_plan && (
                              <div>
                                <p className="font-semibold text-ink-800">Power Outage Plan</p>
                                <p className="text-ink-600 mt-0.5">{clientGuide.power_outage_plan}</p>
                              </div>
                            )}
                            {clientGuide.pet_evacuation_plan && (
                              <div>
                                <p className="font-semibold text-ink-800">Pet Evacuation Plan</p>
                                <p className="text-ink-600 mt-0.5">{clientGuide.pet_evacuation_plan}</p>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 bg-cream-50 p-3 rounded-2xl border border-cream-200/50 mt-2">
                            {clientGuide.supplies_location && <p><strong>Supplies Location:</strong> {clientGuide.supplies_location}</p>}
                            {clientGuide.backup_contact_instructions && <p><strong>Backup Contact Notes:</strong> {clientGuide.backup_contact_instructions}</p>}
                            {clientGuide.mobility_equipment && <p><strong>Mobility Equipment:</strong> {clientGuide.mobility_equipment}</p>}
                            {clientGuide.oxygen_fire_risk && <p><strong>Oxygen / Fire Risk:</strong> {clientGuide.oxygen_fire_risk}</p>}
                            {clientGuide.access_notes && <p><strong>Door / Access / Lockbox:</strong> {clientGuide.access_notes}</p>}
                            {clientGuide.hospital_preference && <p><strong>Preferred Hospital:</strong> {clientGuide.hospital_preference}</p>}
                            {clientGuide.other_instructions && <p className="col-span-2"><strong>Other Prep Instructions:</strong> {clientGuide.other_instructions}</p>}
                          </div>
                        </div>
                      )}

                      {/* Pets Section */}
                      {clientPets.length > 0 && (
                        <div className="space-y-2 text-xs border-t border-cream-200 pt-3">
                          <p className="font-bold text-forest-700 uppercase tracking-wider text-[10px]">Client Pet Records ({clientPets.length})</p>
                          <div className="space-y-3">
                            {clientPets.map((pet: any, pidx: number) => (
                              <div key={pidx} className="bg-forest-50/20 p-3 rounded-2xl border border-forest-100/50 space-y-2">
                                <div className="flex justify-between items-baseline border-b border-forest-100 pb-1">
                                  <span className="font-bold text-forest-900 text-sm">{pet.name} ({pet.pet_type})</span>
                                  <span className="text-[10px] text-forest-700 font-medium">
                                    Sex: {pet.sex || "—"} | Spayed/Neutered: {pet.spayed_neutered || "—"}
                                  </span>
                                </div>
                                {pet.photo_url && (
                                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-cream-200 bg-white">
                                    <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
                                  </div>
                                )}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-ink-700 text-[11px]">
                                  {pet.feeding_instructions && <p><strong>Feeding:</strong> {pet.feeding_instructions}</p>}
                                  {pet.medication_instructions && <p><strong>Medication:</strong> {pet.medication_instructions}</p>}
                                  {pet.behavior_notes && <p><strong>Behavior:</strong> {pet.behavior_notes}</p>}
                                  {pet.emergency_notes && <p><strong>Emergency Notes:</strong> {pet.emergency_notes}</p>}
                                  {pet.supplies_location && <p><strong>Supplies Location:</strong> {pet.supplies_location}</p>}
                                  {pet.vet_name && (
                                    <p>
                                      <strong>Vet:</strong> {pet.vet_name} {pet.vet_phone && `(${pet.vet_phone})`}{" "}
                                      {pet.emergency_vet_phone && `[Emerg: ${pet.emergency_vet_phone}]`}
                                    </p>
                                  )}
                                  {pet.microchip_number && <p><strong>Microchip #:</strong> {pet.microchip_number}</p>}
                                  {pet.vaccine_info && <p><strong>Vaccine / Rabies:</strong> {pet.vaccine_info}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }
      )()}

      {/* 4. Caregiver Pay Summary Statement */}
      {type === "pay-summary" && (
        async () => {
          const { data: snapshots } = await supabase
            .from("pay_period_snapshots")
            .select(`
              id, total_hours, total_amount, shift_count,
              pay_periods ( period_start, period_end, released_at )
            `)
            .eq("caregiver_id", profile.id)
            .order("total_amount", { ascending: false });

          return (
            <div className="space-y-6">
              <header className="border-b-2 border-forest-600 pb-3 mb-4">
                <h1 className="font-display text-2xl font-bold text-ink-900">CAREGIVER ANNUAL EARNINGS SUMMARY</h1>
                <p className="text-xs text-ink-500">Summary Statement of Invoiced Earnings</p>
                <p className="text-[10px] text-ink-400 mt-1">Recipient: {profile.full_name}</p>
              </header>

              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-cream-300 text-ink-500 bg-cream-50/50">
                    <th className="py-2 px-1">Pay Period Dates</th>
                    <th className="py-2 text-right">Shifts</th>
                    <th className="py-2 text-right">Hours</th>
                    <th className="py-2 text-right">Total Earning</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cream-200">
                  {(snapshots ?? []).map((s: any, idx) => {
                    const start = s.pay_periods?.period_start ? new Date(s.pay_periods.period_start) : null;
                    const end = s.pay_periods?.period_end ? new Date(s.pay_periods.period_end) : null;
                    return (
                      <tr key={idx}>
                        <td className="py-2.5 px-1 font-medium">
                          {start && formatShortDateInTz(start)} &ndash; {end && formatShortDateInTz(end)}
                        </td>
                        <td className="py-2.5 text-right">{s.shift_count}</td>
                        <td className="py-2.5 text-right">{Number(s.total_hours).toFixed(1)}</td>
                        <td className="py-2.5 text-right font-semibold">{formatPay(s.total_amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        }
      )()}

      {/* 5. Year-End Summary */}
      {type === "year-end-summary" && id && (
        async () => {
          const { data: summary } = await supabase
            .from("year_end_summaries")
            .select(`
              id, year, total_hours, total_pay, total_bonus, caregiver_id,
              profiles:caregiver_id ( full_name )
            `)
            .eq("id", id)
            .maybeSingle();

          if (!summary) return <p className="text-sm text-terracotta-600">Year-End Summary not found.</p>;

          const cgName = (summary.profiles as any)?.full_name ?? (Array.isArray(summary.profiles) ? (summary.profiles as any)[0]?.full_name : "Caregiver");
          const isPublicApp = false;

          return (
            <div className="space-y-6 text-sm">
              <header className="border-b-2 border-forest-600 pb-4 flex justify-between items-start">
                <div>
                  <h1 className="font-display text-2xl font-bold text-ink-900 uppercase">
                    YEAR-END INCOME SUMMARY
                  </h1>
                  <p className="text-xs text-ink-500">Tax Year: {summary.year}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-ink-800 text-sm">Recipient: {cgName}</p>
                  <p className="text-[10px] text-ink-400">Statement Generated: {new Date().toLocaleDateString()}</p>
                </div>
              </header>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-cream-50 p-4 rounded-2xl text-center border border-cream-200">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-ink-400">Total Hours</p>
                  <p className="font-display text-2xl font-bold text-ink-950 mt-1">{Number(summary.total_hours).toFixed(1)}</p>
                </div>
                <div className="bg-cream-50 p-4 rounded-2xl text-center border border-cream-200">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-ink-400">Total Earnings</p>
                  <p className="font-display text-2xl font-bold text-ink-950 mt-1">{formatCurrency(summary.total_pay)}</p>
                </div>
                <div className="bg-cream-50 p-4 rounded-2xl text-center border border-cream-200">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-ink-400">Total Bonuses</p>
                  <p className="font-display text-2xl font-bold text-ink-950 mt-1">{formatCurrency(summary.total_bonus)}</p>
                </div>
              </div>

              {/* Specific app disclaimers */}
              <div className="bg-cream-100/40 p-5 rounded-2xl border border-cream-200 text-xs text-ink-600 space-y-2 leading-relaxed text-center font-medium">
                <div className="space-y-1">
                  <p className="text-forest-800 font-bold uppercase tracking-wider text-[10px]">⚠️ Year-End Income Summary</p>
                  <p>For recordkeeping only · Not a W-2 or 1099</p>
                  <p className="text-[10px] text-ink-400 font-normal">This app does not send or prepare a 1099 or W-2 tax document.</p>
                </div>
              </div>

              <p className="text-[9px] text-ink-400 text-center pt-4 border-t border-cream-200">
                Official statement of record compiled from completed and locked service activity.
              </p>
            </div>
          );
        }
      )()}
    </main>
  );
}
