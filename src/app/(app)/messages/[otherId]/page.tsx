import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ThreadView from "./thread-view";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ otherId: string }>;
}) {
  const { otherId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase
    .from("profiles")
    .select("id, full_name, organization_id")
    .eq("id", user.id)
    .single<{ id: string; full_name: string; organization_id: string }>();

  if (!me) redirect("/login");

  const { data: other } = await supabase
    .from("profiles")
    .select("id, full_name, role, organization_id")
    .eq("id", otherId)
    .eq("organization_id", me.organization_id)
    .maybeSingle<{
      id: string;
      full_name: string;
      role: "admin" | "client" | "caregiver";
      organization_id: string;
    }>();

  if (!other) notFound();

  type ThreadMessage = {
    id: string;
    sender_id: string;
    recipient_id: string | null;
    content: string;
    is_read: boolean;
    created_at: string;
  };

  // Fetch messages in this thread
  const { data: messages } = await supabase
    .from("messages")
    .select("id, sender_id, recipient_id, content, is_read, created_at")
    .or(
      `and(sender_id.eq.${me.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${me.id})`
    )
    .order("created_at", { ascending: true })
    .limit(500)
    .returns<ThreadMessage[]>();

  // Mark received messages as read
  await supabase
    .from("messages")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("sender_id", otherId)
    .eq("recipient_id", me.id)
    .eq("is_read", false);

  return (
    <ThreadView
      me={me}
      other={other}
      initialMessages={messages ?? []}
    />
  );
}
