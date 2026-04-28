import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ArrowRightIcon } from "@/components/icons";

export default async function NewMessagePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("id", user.id)
    .single<{ id: string; organization_id: string }>();

  if (!profile) redirect("/login");

  // Get all other people in the org
  const { data: people } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("organization_id", profile.organization_id)
    .eq("is_active", true)
    .neq("id", profile.id)
    .order("role")
    .order("full_name")
    .returns<
      { id: string; full_name: string; role: "admin" | "client" | "caregiver" }[]
    >();

  const roleCopy: Record<string, string> = {
    admin: "Admin",
    client: "Client",
    caregiver: "Caregiver",
  };

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href="/messages"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back
        </Link>
        <h1 className="font-display text-3xl text-ink-900">New message</h1>
        <p className="text-ink-500 text-sm">Pick someone to message</p>
      </header>

      {!people || people.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 shadow-soft text-center grain-overlay">
          <div className="relative">
            <p className="font-display text-lg mb-1">No teammates yet</p>
            <p className="text-sm text-ink-500">
              Once others join the team, they'll show up here.
            </p>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {people.map((p) => (
            <li key={p.id}>
              <Link
                href={`/messages/${p.id}`}
                className="flex items-center gap-3 bg-white hover:bg-cream-50 px-4 py-3 rounded-2xl shadow-soft transition active:scale-[0.99]"
              >
                <span
                  className={`w-10 h-10 rounded-full grid place-items-center font-display text-base shrink-0 ${
                    p.role === "admin"
                      ? "bg-forest-600 text-cream-50"
                      : p.role === "client"
                        ? "bg-terracotta-500 text-cream-50"
                        : "bg-forest-100 text-forest-600"
                  }`}
                >
                  {p.full_name[0]?.toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-ink-900 truncate">
                    {p.full_name}
                  </p>
                  <p className="text-xs text-ink-500">
                    {roleCopy[p.role] ?? p.role}
                  </p>
                </div>
                <ArrowRightIcon size={14} className="text-ink-300" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
