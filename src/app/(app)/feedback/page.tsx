import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatEnumLabel } from "@/lib/pay";
import FeedbackRowActions from "./feedback-row-actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type FeedbackItem = {
  id: string;
  feedback_type: string;
  message: string;
  rating: number | null;
  status: string;
  created_at: string;
  caregiver: { full_name: string } | null;
  client: { full_name: string } | null;
  reporter: { full_name: string } | null;
};

export default async function FeedbackPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { tab } = (await searchParams) ?? {};
  const currentTab = tab === "history" ? "history" : "active";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", user.id)
    .single<{ id: string; role: string; organization_id: string }>();

  if (!profile) redirect("/login");

  const isAdmin = profile.role === "admin";
  const isCaregiver = profile.role === "caregiver";

  if (!isAdmin && !isCaregiver) {
    redirect("/home");
  }

  let query = supabase
    .from("caregiver_feedback")
    .select(`
      id,
      feedback_type,
      message,
      rating,
      status,
      created_at,
      caregiver:caregiver_id ( full_name ),
      client:client_id ( full_name ),
      reporter:submitted_by ( full_name )
    `)
    .eq("organization_id", profile.organization_id)
    .order("created_at", { ascending: false });

  if (isAdmin) {
    if (currentTab === "active") {
      query = query.in("status", ["submitted", "reviewed", "shared_with_caregiver"]);
    } else {
      query = query.in("status", ["resolved", "dismissed"]);
    }
  } else {
    // Caregiver: only see commendations/appreciations that are shared
    query = query.eq("caregiver_id", profile.id).eq("status", "shared_with_caregiver");
  }

  const { data: feedbackData } = await query;
  const feedbacks = (feedbackData ?? []) as unknown as FeedbackItem[];

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-5">
        <Link href="/home" className="text-sm text-forest-600 hover:underline mb-2 inline-block">
          ← Back
        </Link>
        <h1 className="font-display text-3xl text-ink-900">
          {isAdmin ? "Caregiver Feedback" : "Received Feedback"}
        </h1>
        <p className="text-ink-500 text-sm">
          {isAdmin
            ? "Review and manage appreciation or reports regarding care team members."
            : "Review positive commendations and thank you messages shared by administrators."}
        </p>

        {isAdmin && (
          <div className="flex gap-4 mt-3 pt-1">
            <Link
              href="/feedback?tab=active"
              className={`text-sm hover:underline ${
                currentTab === "active" ? "text-forest-700 font-semibold" : "text-ink-500"
              }`}
            >
              Active feedback
            </Link>
            <Link
              href="/feedback?tab=history"
              className={`text-sm hover:underline ${
                currentTab === "history" ? "text-forest-700 font-semibold" : "text-ink-500"
              }`}
            >
              Resolved / Dismissed
            </Link>
          </div>
        )}
      </header>

      <ul className="space-y-3">
        {feedbacks.map((item) => {
          const isNegative = ["concern", "complaint", "safety_issue", "scheduling_issue"].includes(
            item.feedback_type
          );
          return (
            <li
              key={item.id}
              className={`bg-white rounded-3xl shadow-soft p-5 border border-cream-200/50 ${
                item.status === "resolved" || item.status === "dismissed" ? "opacity-75" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span
                    className={`inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-lg mb-2 ${
                      isNegative
                        ? "bg-terracotta-100 text-terracotta-800"
                        : "bg-forest-100 text-forest-800"
                    }`}
                  >
                    {formatEnumLabel(item.feedback_type)}
                  </span>
                  {item.rating && (
                    <span className="inline-block text-xs text-amber-500 font-medium ml-2">
                      ★ {item.rating}/5
                    </span>
                  )}
                </div>
                <span className="text-[10px] uppercase tracking-wider bg-cream-100 text-ink-600 px-2 py-0.5 rounded-lg">
                  {formatEnumLabel(item.status)}
                </span>
              </div>

              <p className="text-sm text-ink-800 font-medium leading-relaxed my-2">
                &ldquo;{item.message}&rdquo;
              </p>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500 mt-2">
                {item.caregiver && (
                  <p>
                    Caregiver: <span className="font-semibold text-ink-700">{item.caregiver.full_name}</span>
                  </p>
                )}
                {item.client && (
                  <p>
                    Client: <span className="font-semibold text-ink-700">{item.client.full_name}</span>
                  </p>
                )}
                {isAdmin && item.reporter && (
                  <p>
                    Submitted by: <span className="font-semibold text-ink-700">{item.reporter.full_name}</span>
                  </p>
                )}
                <p>{new Date(item.created_at).toLocaleDateString()}</p>
              </div>

              {isAdmin && (
                <FeedbackRowActions
                  feedbackId={item.id}
                  feedbackType={item.feedback_type}
                  caregiverId={item.caregiver ? "has-caregiver" : null}
                  status={item.status}
                />
              )}
            </li>
          );
        })}

        {feedbacks.length === 0 && (
          <li className="bg-white rounded-3xl shadow-soft p-8 text-center text-sm text-ink-500">
            No feedback found.
          </li>
        )}
      </ul>
    </main>
  );
}
