"use client";

import { useState, useMemo } from "react";
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
  caregiver_id: string | null;
};

type Caregiver = { id: string; full_name: string };

export default function TemplatesList({
  templates,
  caregivers,
  organizationId,
}: {
  templates: Template[];
  caregivers: Caregiver[];
  organizationId: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsDefault, setNewIsDefault] = useState(true);
  const [newCaregiverId, setNewCaregiverId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all"); // "all", "shared", caregiverId

  const caregiverNameById = useMemo(() => {
    const m = new Map<string, string>();
    caregivers.forEach((c) => m.set(c.id, c.full_name));
    return m;
  }, [caregivers]);

  // Apply filter
  const filtered = useMemo(() => {
    if (filter === "all") return templates;
    if (filter === "shared")
      return templates.filter((t) => t.caregiver_id == null);
    return templates.filter((t) => t.caregiver_id === filter);
  }, [templates, filter]);

  const defaults = filtered.filter((t) => t.default_for_new_shifts);
  const optional = filtered.filter((t) => !t.default_for_new_shifts);

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
      caregiver_id: newCaregiverId || null,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setNewName("");
    setNewDescription("");
    setNewIsDefault(true);
    setNewCaregiverId("");
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

  async function reassignTemplate(id: string, caregiverId: string | null) {
    const supabase = createClient();
    await supabase
      .from("todo_templates")
      .update({ caregiver_id: caregiverId })
      .eq("id", id);
    router.refresh();
  }

  async function deleteTemplate(id: string) {
    if (
      !confirm(
        "Delete this task from the master list? Existing shifts won't be affected."
      )
    )
      return;
    const supabase = createClient();
    await supabase
      .from("todo_templates")
      .update({ is_active: false })
      .eq("id", id);
    router.refresh();
  }

  return (
    <div>
      {/* Filter */}
      {caregivers.length > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-[0.18em] text-ink-500 mr-1">
            Show:
          </span>
          <FilterPill
            active={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All
          </FilterPill>
          <FilterPill
            active={filter === "shared"}
            onClick={() => setFilter("shared")}
          >
            Everyone
          </FilterPill>
          {caregivers.map((c) => (
            <FilterPill
              key={c.id}
              active={filter === c.id}
              onClick={() => setFilter(c.id)}
            >
              {c.full_name.split(" ")[0]}
            </FilterPill>
          ))}
        </div>
      )}

      {/* Defaults section */}
      <section className="mb-6">
        <div className="flex items-baseline justify-between mb-2 px-1">
          <h2 className="text-xs uppercase tracking-[0.18em] text-ink-500">
            On every new shift ({defaults.length})
          </h2>
        </div>
        {defaults.length === 0 ? (
          <div className="bg-white/60 rounded-2xl p-5 text-center text-sm text-ink-500 border border-dashed border-ink-300/30">
            No default tasks here.
          </div>
        ) : (
          <ul className="space-y-2">
            {defaults.map((t) => (
              <li key={t.id}>
                <TemplateRow
                  template={t}
                  caregivers={caregivers}
                  caregiverName={
                    t.caregiver_id
                      ? (caregiverNameById.get(t.caregiver_id) ?? null)
                      : null
                  }
                  isEditing={editingId === t.id}
                  onEdit={() => setEditingId(t.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null);
                    router.refresh();
                  }}
                  onToggleDefault={() => toggleDefault(t)}
                  onDelete={() => deleteTemplate(t.id)}
                  onReassign={(cid) => reassignTemplate(t.id, cid)}
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
                  caregivers={caregivers}
                  caregiverName={
                    t.caregiver_id
                      ? (caregiverNameById.get(t.caregiver_id) ?? null)
                      : null
                  }
                  isEditing={editingId === t.id}
                  onEdit={() => setEditingId(t.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null);
                    router.refresh();
                  }}
                  onToggleDefault={() => toggleDefault(t)}
                  onDelete={() => deleteTemplate(t.id)}
                  onReassign={(cid) => reassignTemplate(t.id, cid)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Add new */}
      {adding ? (
        <form
          onSubmit={addTemplate}
          className="bg-white rounded-2xl shadow-soft p-4 space-y-3"
        >
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
          <label className="block">
            <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
              Assign to
            </span>
            <select
              value={newCaregiverId}
              onChange={(e) => setNewCaregiverId(e.target.value)}
              className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
            >
              <option value="">Everyone (shared task)</option>
              {caregivers.map((c) => (
                <option key={c.id} value={c.id}>
                  Only {c.full_name}
                </option>
              ))}
            </select>
          </label>
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
                setNewCaregiverId("");
              }}
              className="flex-1 bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-2.5 rounded-xl text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition"
            >
              Add task
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full bg-white hover:bg-cream-50 text-forest-600 border border-forest-500/30 py-3 rounded-2xl font-medium text-sm transition flex items-center justify-center gap-1.5"
        >
          <PlusIcon size={16} />
          Add task to master list
        </button>
      )}
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition ${
        active
          ? "bg-forest-600 text-cream-50"
          : "bg-white text-ink-700 hover:bg-cream-100 border border-cream-200"
      }`}
    >
      {children}
    </button>
  );
}

function TemplateRow({
  template,
  caregivers,
  caregiverName,
  isEditing,
  onEdit,
  onCancelEdit,
  onSaved,
  onToggleDefault,
  onDelete,
  onReassign,
}: {
  template: Template;
  caregivers: Caregiver[];
  caregiverName: string | null;
  isEditing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
  onToggleDefault: () => void;
  onDelete: () => void;
  onReassign: (caregiverId: string | null) => void;
}) {
  const [name, setName] = useState(template.task_name);
  const [description, setDescription] = useState(template.description ?? "");
  const [savingEdit, setSavingEdit] = useState(false);

  async function saveEdit() {
    if (!name.trim()) return;
    setSavingEdit(true);
    const supabase = createClient();
    await supabase
      .from("todo_templates")
      .update({
        task_name: name.trim(),
        description: description.trim() || null,
      })
      .eq("id", template.id);
    setSavingEdit(false);
    onSaved();
  }

  if (isEditing) {
    return (
      <div className="bg-white rounded-2xl shadow-soft p-4 space-y-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={140}
          className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm resize-none"
        />
        <label className="block">
          <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
            Assigned to
          </span>
          <select
            value={template.caregiver_id ?? ""}
            onChange={(e) => onReassign(e.target.value || null)}
            className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
          >
            <option value="">Everyone</option>
            {caregivers.map((c) => (
              <option key={c.id} value={c.id}>
                Only {c.full_name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            onClick={onCancelEdit}
            disabled={savingEdit}
            className="flex-1 bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={saveEdit}
            disabled={savingEdit}
            className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-2 rounded-xl text-sm font-medium transition disabled:opacity-50"
          >
            {savingEdit ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-soft p-4 flex items-start gap-3">
      <label className="flex items-center cursor-pointer pt-0.5">
        <input
          type="checkbox"
          checked={template.default_for_new_shifts}
          onChange={onToggleDefault}
          className="w-4 h-4 accent-forest-600"
        />
      </label>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-ink-900 truncate flex items-center gap-2 flex-wrap">
          {template.task_name}
          {caregiverName && (
            <span className="text-[10px] uppercase tracking-wider bg-forest-100 text-forest-600 px-1.5 py-0.5 rounded font-medium">
              for {caregiverName.split(" ")[0]}
            </span>
          )}
        </p>
        {template.description && (
          <p className="text-xs text-ink-500 mt-0.5">{template.description}</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={onEdit}
          className="text-xs text-forest-600 hover:underline"
        >
          Edit
        </button>
        <span className="text-ink-300">·</span>
        <button
          onClick={onDelete}
          className="text-xs text-terracotta-600 hover:underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
