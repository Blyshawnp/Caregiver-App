import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MessageIcon, ArrowRightIcon, PlusIcon } from "@/components/icons";
import UserAvatar from "@/components/user-avatar";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Thread = {
  other_id: string;
  other_name: string;
  other_role: "admin" | "client" | "caregiver" | "family";
  other_avatar_url: string | null;
  other_avatar_color: string | null;
  last_message: string;
  last_at: string;
  unread_count: number;
  is_from_me: boolean;
};

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, role")
    .eq("id", user.id)
    .single<{
      id: string;
      organization_id: string;
      role: "admin" | "client" | "caregiver" | "family";
    }>();

  if (!profile) redirect("/login");

  // All messages I sent or received
  const { data: messages } = await supabase
    .from("messages")
    .select(
      `
      id,
      sender_id,
      recipient_id,
      content,
      is_read,
      created_at,
      sender:sender_id ( full_name, role, avatar_url, avatar_color ),
      recipient:recipient_id ( full_name, role, avatar_url, avatar_color )
    `
    )
    .or(`sender_id.eq.${profile.id},recipient_id.eq.${profile.id}`)
    .order("created_at", { ascending: false })
    .limit(200);

  type MessageRow = {
    id: string;
    sender_id: string;
    recipient_id: string | null;
    content: string;
    is_read: boolean;
    created_at: string;
    sender: {
      full_name: string;
      role: "admin" | "client" | "caregiver" | "family";
      avatar_url: string | null;
      avatar_color: string | null;
    } | null;
    recipient: {
      full_name: string;
      role: "admin" | "client" | "caregiver" | "family";
      avatar_url: string | null;
      avatar_color: string | null;
    } | null;
  };

  // Group by "other person" (whoever isn't me in the message)
  const threadMap = new Map<string, Thread>();
  for (const m of (messages ?? []) as unknown as MessageRow[]) {
    const isFromMe = m.sender_id === profile.id;
    const otherId = isFromMe ? m.recipient_id : m.sender_id;
    if (!otherId) continue; // skip org-broadcasts (recipient null) for now

    if (!threadMap.has(otherId)) {
      const otherProfile = isFromMe ? m.recipient : m.sender;
      threadMap.set(otherId, {
        other_id: otherId,
        other_name: otherProfile?.full_name ?? "Unknown",
        other_role: otherProfile?.role ?? "caregiver",
        other_avatar_url: otherProfile?.avatar_url ?? null,
        other_avatar_color: otherProfile?.avatar_color ?? null,
        last_message: m.content,
        last_at: m.created_at,
        unread_count: 0,
        is_from_me: isFromMe,
      });
    }

    const thread = threadMap.get(otherId)!;
    if (!isFromMe && !m.is_read) {
      thread.unread_count += 1;
    }
  }

  const threads = Array.from(threadMap.values()).sort((a, b) =>
    b.last_at.localeCompare(a.last_at)
  );

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="flex items-end justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-ink-900">Messages</h1>
          <p className="text-ink-500 text-sm">
            {threads.length} conversation{threads.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/messages/new"
          className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-4 py-2.5 rounded-2xl text-sm font-medium flex items-center gap-1.5 transition active:scale-[0.99]"
        >
          <PlusIcon size={16} />
          New
        </Link>
      </header>

      {threads.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 shadow-soft text-center grain-overlay">
          <div className="relative">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-cream-200 grid place-items-center text-ink-500">
              <MessageIcon size={22} />
            </div>
            <p className="font-display text-lg mb-1">No messages yet</p>
            <p className="text-sm text-ink-500 mb-4">
              Start a conversation with a teammate.
            </p>
            <Link
              href="/messages/new"
              className="inline-block bg-forest-600 hover:bg-forest-700 text-cream-50 px-5 py-2.5 rounded-2xl text-sm font-medium transition"
            >
              New message
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {threads.map((t) => (
            <li key={t.other_id}>
              <Link
                href={`/messages/${t.other_id}`}
                className={`flex items-center gap-3 rounded-2xl p-4 shadow-soft transition active:scale-[0.99] ${
                  t.unread_count > 0
                    ? "bg-cream-50 hover:bg-white"
                    : "bg-white hover:bg-cream-50"
                }`}
              >
                <UserAvatar
                  person={{
                    full_name: t.other_name,
                    avatar_url: t.other_avatar_url,
                    avatar_color: t.other_avatar_color,
                  }}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <p
                      className={`truncate ${t.unread_count > 0 ? "font-semibold text-ink-900" : "font-medium text-ink-900"}`}
                    >
                      {t.other_name}
                    </p>
                    <span className="text-[10px] text-ink-500 shrink-0">
                      {timeAgo(new Date(t.last_at))}
                    </span>
                  </div>
                  <p
                    className={`text-sm truncate ${t.unread_count > 0 ? "text-ink-900" : "text-ink-500"}`}
                  >
                    {t.is_from_me && "You: "}
                    {t.last_message}
                  </p>
                </div>
                {t.unread_count > 0 ? (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-terracotta-500 text-cream-50 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {t.unread_count}
                  </span>
                ) : (
                  <ArrowRightIcon size={14} className="text-ink-300 shrink-0" />
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function timeAgo(d: Date) {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d`;
  return d.toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  });
}
