"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { sendNotificationEvent } from "@/lib/notify-client";

type Person = {
  id: string;
  full_name: string;
  organization_id: string;
};

type Other = Person & { role: "admin" | "client" | "caregiver" | "family" };

type Message = {
  id: string;
  sender_id: string;
  recipient_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
};

export default function ThreadView({
  me,
  other,
  initialMessages,
}: {
  me: Person;
  other: Other;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  // Real-time subscription: listen for new messages in this thread
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`thread-${me.id}-${other.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const m = payload.new as Message;
          // Only include messages between me and the other person
          const inThread =
            (m.sender_id === me.id && m.recipient_id === other.id) ||
            (m.sender_id === other.id && m.recipient_id === me.id);
          if (!inThread) return;

          setMessages((prev) => {
            // Skip if we already have this message (optimistic update collision)
            if (prev.some((p) => p.id === m.id)) return prev;
            return [...prev, m];
          });

          // Mark new incoming messages as read
          if (m.sender_id === other.id) {
            void supabase
              .from("messages")
              .update({
                is_read: true,
                read_at: new Date().toISOString(),
              })
              .eq("id", m.id);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [me.id, other.id]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = text.trim();
    if (!content) return;

    setSending(true);
    setError(null);
    const supabase = createClient();

    // Optimistic message so it shows up instantly
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      sender_id: me.id,
      recipient_id: other.id,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setText("");

    const { data: insertedRows, error } = await supabase
      .from("messages")
      .insert({
        organization_id: me.organization_id,
        sender_id: me.id,
        recipient_id: other.id,
        content,
      })
      .select("id, sender_id, recipient_id, content, is_read, created_at");

    if (error || !insertedRows || insertedRows.length === 0) {
      // Roll back optimistic
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setError(error?.message ?? "Could not send message.");
      setText(content);
      setSending(false);
      return;
    }

    // Replace optimistic with real
    const real = insertedRows[0] as Message;
    setMessages((prev) =>
      prev.map((m) => (m.id === tempId ? real : m))
    );

    setSending(false);

    void sendNotificationEvent({
      type: "new_message",
      recipientId: other.id,
      preview: content,
    });
  }

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto flex flex-col min-h-[calc(100dvh-7rem)]">
      <header className="mb-4">
        <Link
          href="/messages"
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back
        </Link>
        <div className="flex items-center gap-3">
          <span
            className={`w-11 h-11 rounded-full grid place-items-center font-display text-base shrink-0 ${
              other.role === "admin"
                ? "bg-forest-600 text-cream-50"
                : other.role === "client"
                  ? "bg-terracotta-500 text-cream-50"
                  : "bg-forest-100 text-forest-600"
            }`}
          >
            {other.full_name[0]?.toUpperCase()}
          </span>
          <div>
            <h1 className="font-display text-xl text-ink-900 leading-tight">
              {other.full_name}
            </h1>
            <p className="text-xs text-forest-600 capitalize">{other.role}</p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-2 mb-4 -mx-1 px-1">
        {messages.length === 0 ? (
          <div className="text-center py-10 text-sm text-ink-500">
            Say hello to {other.full_name.split(" ")[0]}.
          </div>
        ) : (
          messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              isFromMe={m.sender_id === me.id}
              showTime={shouldShowTime(messages, i)}
            />
          ))
        )}
        <div ref={scrollRef} />
      </div>

      {error && (
        <div className="bg-terracotta-400/10 border border-terracotta-400/30 text-terracotta-600 rounded-xl px-3 py-2 text-xs mb-2">
          {error}
        </div>
      )}

      {/* Composer */}
      <form onSubmit={send} className="flex gap-2 sticky bottom-0">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a message"
          maxLength={1000}
          className="flex-1 px-4 py-3 bg-white border border-cream-200 rounded-2xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition shadow-soft"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="bg-forest-600 hover:bg-forest-700 disabled:opacity-50 text-cream-50 px-5 rounded-2xl font-medium transition active:scale-[0.99] shadow-soft"
        >
          Send
        </button>
      </form>
    </main>
  );
}

function MessageBubble({
  message,
  isFromMe,
  showTime,
}: {
  message: Message;
  isFromMe: boolean;
  showTime: boolean;
}) {
  return (
    <div className={`flex flex-col ${isFromMe ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isFromMe
            ? "bg-forest-600 text-cream-50 rounded-br-md"
            : "bg-white text-ink-900 shadow-soft rounded-bl-md"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap break-words leading-snug">
          {message.content}
        </p>
      </div>
      {showTime && (
        <p className="text-[10px] text-ink-500 mt-0.5 px-2">
          {formatTime(new Date(message.created_at))}
        </p>
      )}
    </div>
  );
}

function shouldShowTime(messages: Message[], index: number) {
  // Show timestamp on the last message of a "burst" (when the next message
  // is from a different sender or more than 5 minutes later)
  const m = messages[index];
  const next = messages[index + 1];
  if (!next) return true;
  if (next.sender_id !== m.sender_id) return true;
  const gapMin =
    (new Date(next.created_at).getTime() -
      new Date(m.created_at).getTime()) /
    60000;
  return gapMin > 5;
}

function formatTime(d: Date) {
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  if (isToday) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
