"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function HandoffNote({
  shiftId,
  initialNote,
  initialNoteAt,
  canEdit,
  labels,
}: {
  shiftId: string;
  initialNote: string | null;
  initialNoteAt: string | null;
  canEdit: boolean;
  labels: {
    title: string;
    placeholder: string;
    save: string;
    saving: string;
    edit: string;
    leaveNote: string;
  };
}) {
  const router = useRouter();
  const [note, setNote] = useState(initialNote ?? "");
  const [editing, setEditing] = useState(!initialNote && canEdit);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(initialNoteAt);

  async function save() {
    setSaving(true);
    const supabase = createClient();
    const trimmed = note.trim() || null;
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from("shifts")
      .update({
        handoff_note: trimmed,
        handoff_note_at: trimmed ? nowIso : null,
      })
      .eq("id", shiftId);

    setSaving(false);
    if (error) {
      alert(error.message);
      return;
    }

    setSavedAt(trimmed ? nowIso : null);
    setEditing(false);
    router.refresh();
  }

  // Read-only view
  if (!canEdit && !note) return null;

  if (!editing) {
    return (
      <section className="bg-white rounded-3xl shadow-soft p-5 mt-4 grain-overlay">
        <div className="relative">
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="font-display text-base">{labels.title}</h2>
            {canEdit && (
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-forest-600 hover:underline"
              >
                {labels.edit}
              </button>
            )}
          </div>
          {note ? (
            <>
              <p className="text-sm text-ink-700 whitespace-pre-wrap">
                {note}
              </p>
              {savedAt && (
                <p className="text-[10px] text-ink-400 mt-2">
                  {new Date(savedAt).toLocaleString("en-US", {
                    timeZone: "America/New_York",
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-forest-600 hover:underline"
            >
              {labels.leaveNote}
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white rounded-3xl shadow-soft p-5 mt-4 grain-overlay">
      <div className="relative space-y-3">
        <h2 className="font-display text-base">{labels.title}</h2>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={labels.placeholder}
          className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm resize-none"
        />
        <div className="flex gap-2">
          {initialNote != null && (
            <button
              onClick={() => {
                setNote(initialNote ?? "");
                setEditing(false);
              }}
              disabled={saving}
              className="flex-1 bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            {saving ? labels.saving : labels.save}
          </button>
        </div>
      </div>
    </section>
  );
}
