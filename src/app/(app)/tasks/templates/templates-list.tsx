"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon } from "@/components/icons";

type Template = {
  id: string;
  task_name: string;
  description: string | null;
  default_for_new_shifts: boolean;
  sort_order: number;
  is_active: boolean;
};

export default function TemplatesList({
  templates,
  organizationId,
}: {
  templates: Template[];
  organizationId: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsDefault, setNewIsDefault] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  const defaults = templates.filter((t) => t.default_for_new_shifts);
  const optional = templates.filter((t) => !t.default_for_new_shifts);

  async function addTemplate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const supabase = createClient();
    const maxSort = Math.max(0, ...templates.map((t) => t.sort_order ?? 0));
    const { error } = await supabase.from("todo_templates").insert({
      organization_id: organizationId,
      task_name: newName.trim(),
      description: newDescription.trim() || null,
      default_for_new_shifts: newIsDefault,
      sort_order: maxSort + 10,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setNewName("");
    setNewDescription("");
    setNewIsDefault(true);
    setAdding(false);
    router.refresh();
  }

  async function toggleDefault(t: Template) {
    const supabase = createClient();
    await supabase
      .from("todo_templates")
      .update({ default_for_new_shifts: !t.default_for_new_shifts })
      .eq("id", t.id);
    router.refresh();
  }

  async function deleteTemplate(id: string) {
    if (!confirm("Delete this task from the master list? Existing shifts won't be affected.")) return;
    const supabase = createClient();
    // Soft delete (preserves any shift_todos that reference it)
    await supabase
      .from("todo_templates")
      .update({ is_active: false })
      .eq("id", id);
    router.refresh();
  }

  return (
    <div>
      {/* Defaults section */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between mb-2 px-1">
          <h2 className="text-xs uppercase tracking-[0.18em] text-ink-500">
            On every new shift ({defaults.length})
          </h2>
        </div>
        {defaults.length === 0 ? (
          <div className="bg-white/60 rounded-2xl p-5 text-center text-sm text-ink-500 border border-dashed border-ink-300/30">
            No default tasks. Mark items below as default and they'll appear on
            every new shift.
          </div>
        ) : (
          <ul className="space-y-2">
            {defaults.map((t) => (
              <li key={t.id}>
                <TemplateRow
                  template={t}
                  isEditing={editingId === t.id}
                  onEdit={() => setEditingId(t.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null);
                    router.refresh();
                  }}
                  onToggleDefault={() => toggleDefault(t)}
                  onDelete={() => deleteTemplate(t.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Optional section */}
      {optional.length > 0 && (
        <section className="mb-6">
          <div className="flex items-baseline justify-between mb-2 px-1">
            <h2 className="text-xs uppercase tracking-[0.18em] text-ink-500">
              Optional ({optional.length})
            </h2>
          </div>
          <ul className="space-y-2">
            {optional.map((t) => (
              <li key={t.id}>
                <TemplateRow
                  template={t}
                  isEditing={editingId === t.id}
                  onEdit={() => setEditingId(t.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null);
                    router.refresh();
                  }}
                  onToggleDefault={() => toggleDefault(t)}
                  onDelete={() => deleteTemplate(t.id)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Add new */}
      {adding ? (
        <form onSubmit={addTemplate} className="bg-white rounded-2xl shadow-soft p-4 space-y-3">
          <input
            type="text"
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Task name (e.g. Give morning meds)"
            maxLength={140}
            className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
            required
          />
          <textarea
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
            placeholder="Optional details or instructions"
            rows={2}
            className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm resize-none"
          />
          <label className="flex items-center gap-2 text-sm text-ink-700 cursor-pointer">
            <input
              type="checkbox"
              checked={newIsDefault}
              onChange={(e) => setNewIsDefault(e.target.checked)}
              className="w-4 h-4 accent-forest-600"
            />
            Add to every new shift by default
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setNewName("");
                setNewDescription("");
                setNewIsDefault(true);
              }}
              className="flex-1 bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-2.5 rounded-xl text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!newName.trim()}
              className="flex-1 bg-forest-600 hover:bg-forest-700 disabled:opacity-50 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition"
            >
              Add to master list
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full flex items-center gap-2 bg-cream-200/60 hover:bg-cream-200 text-ink-700 px-4 py-3 rounded-2xl font-medium transition active:scale-[0.99]"
        >
          <span className="w-7 h-7 rounded-full bg-white text-forest-600 grid place-items-center">
            <PlusIcon size={16} />
          </span>
          Add task to master list
        </button>
      )}
    </div>
  );
}

function TemplateRow({
  template,
  isEditing,
  onEdit,
  onCancelEdit,
  onSaved,
  onToggleDefault,
  onDelete,
}: {
  template: Template;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onToggleDefault: () => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(template.task_name);
  const [description, setDescription] = useState(template.description ?? "");
  const [saving, setSaving] = useState(false);

  if (isEditing) {
    return (
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!name.trim()) return;
          setSaving(true);
          const supabase = createClient();
          await supabase
            .from("todo_templates")
            .update({
              task_name: name.trim(),
              description: description.trim() || null,
            })
            .eq("id", template.id);
          setSaving(false);
          onSaved();
        }}
        className="bg-white rounded-2xl shadow-soft p-4 space-y-3"
      >
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={140}
          className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
          required
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional details"
          rows={2}
          className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm resize-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setName(template.task_name);
              setDescription(template.description ?? "");
              onCancelEdit();
            }}
            className="flex-1 bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-2 rounded-xl text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 bg-forest-600 hover:bg-forest-700 disabled:opacity-50 text-cream-50 py-2 rounded-xl text-sm font-medium transition"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft p-4 flex items-start gap-3">
      <label className="flex items-center cursor-pointer mt-1 shrink-0">
        <input
          type="checkbox"
          checked={template.default_for_new_shifts}
          onChange={onToggleDefault}
          className="w-4 h-4 accent-forest-600"
          aria-label="Default for new shifts"
        />
      </label>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink-900 leading-snug">
          {template.task_name}
        </p>
        {template.description && (
          <p className="text-xs text-ink-500 mt-0.5">{template.description}</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={onEdit}
          aria-label="Edit"
          className="p-1.5 text-ink-500 hover:text-ink-900 transition"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7m-1.4-9.6a2.1 2.1 0 113 3L12 19l-4 1 1-4 9.6-9.6z" />
          </svg>
        </button>
        <button
          onClick={onDelete}
          aria-label="Delete"
          className="p-1.5 text-ink-300 hover:text-terracotta-600 transition"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4"
          >
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
