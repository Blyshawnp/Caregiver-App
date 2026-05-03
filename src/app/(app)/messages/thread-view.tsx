"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ArrowRightIcon } from "@/components/icons";

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

export default function ThreadView({
  otherId,
  currentUserId,
  otherName,
  initialMessages,
}: {
  otherId: string;
  currentUserId: string;
  otherName: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel(`thread-${otherId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${currentUserId}`,
        },
        (payload) => {
          const newMessage = payload.new as Message;
          if (newMessage.sender_id === otherId) {
            setMessages((prev) => [...prev, newMessage]);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [otherId, currentUserId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim() || sending) return;

    setSending(true);
    try {
      const response = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: otherId, content: content.trim() }),
      });

      if (response.ok) {
        const { message } = await response.json();
        setMessages((prev) => [...prev, message]);
        setContent("");
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-140px)]">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${
              m.sender_id === currentUserId ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                m.sender_id === currentUserId
                  ? "bg-forest-600 text-cream-50 rounded-tr-none"
                  : "bg-white text-ink-900 shadow-soft rounded-tl-none"
              }`}
            >
              <p className="leading-relaxed">{m.content}</p>
              <p className={`text-[10px] mt-1 opacity-60 ${m.sender_id === currentUserId ? 'text-right' : ''}`}>
                {new Date(m.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={send} className="p-4 bg-cream-100/50 backdrop-blur-sm sticky bottom-0">
        <div className="flex gap-2 bg-white rounded-2xl p-1.5 shadow-soft border border-cream-200">
          <input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Message ${otherName}...`}
            className="flex-1 px-4 py-2 text-sm bg-transparent outline-none text-ink-900"
          />
          <button
            type="submit"
            disabled={!content.trim() || sending}
            className="w-10 h-10 rounded-xl bg-forest-600 text-cream-50 grid place-items-center transition active:scale-95 disabled:opacity-50"
          >
            <ArrowRightIcon size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}
