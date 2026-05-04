"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon } from "@/components/icons";
import {
  type TaskCategory,
  type TaskCategoryOption,
} from "@/lib/task-categories";

type Template = {
  id: string;
  task_name: string;
  description: string | null;
  default_for_new_shifts: boolean;
  sort_order: number;
  is_active: boolean;
  caregiver_id: string | null;
  category:
    | TaskCategory
    | "general"
    | "morning"
    | "afternoon"
    | "evening"
    | "bedtime"
    | null;
};

type Caregiver = { id: string; full_name: string };

export default function TemplatesList({
  templates,
  caregivers,
  organizationId,
  categories,
}: {
  templates: Template[];
  caregivers: Caregiver[];
  organizationId: string;
  categories: TaskCategoryOption[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsDefault, setNewIsDefault] = useState(true);
  const [newCaregiverId, setNewCaregiverId] = useState<string>("");
  const [newCategory, setNewCategory] = useState<TaskCategory>("other");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all"); // "all", "shared", caregiverId
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

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
      category: newCategory,
    });
    if (error) {
      alert(error.message);
      return;
    }
    setNewName("");
    setNewDescription("");
    setNewIsDefault(true);
    setNewCaregiverId("");
    setNewCategory("other");
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

  async function changeCategory(id: string, category: TaskCategory) {
    const supabase = createClient();
    await supabase
      .from("todo_templates")
      .update({ category })
      .eq("id", id);
    router.refresh();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryLabel.trim()) return;
    const response = await fetch("/api/task-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newCategoryLabel }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    if (!response.ok) {
      alert(result?.error ?? "Could not add category.");
      return;
    }
    setNewCategoryLabel("");
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

      <form onSubmit={addCategory} className="mb-5 bg-white rounded-2xl shadow-soft p-4 grid gap-2">
        <p className="text-xs uppercase tracking-[0.18em] text-ink-500">
          Task categories
        </p>
        <div className="flex gap-2">
          <input
            value={newCategoryLabel}
            onChange={(e) => setNewCategoryLabel(e.target.value)}
            placeholder="Add category"
            className="flex-1 px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-sm focus:outline-none focus:border-forest-500"
          />
          <button
            type="submit"
            className="bg-forest-600 text-cream-50 px-3 py-2 rounded-xl text-sm font-medium"
          >
            Add
          </button>
        </div>
        <div className="grid gap-2">
          {categories.map((category) => (
            <CategoryEditor key={category.key} category={category} />
          ))}
        </div>
      </form>

      {/* Group by category */}
      {categories.map((category) => {
        const cat = category.key;
        const tasksInCat = filtered.filter(
          (t) => normalizeCategory(t.category) === cat
        );
        if (tasksInCat.length === 0) return null;

        return (
          <section key={cat} className="mb-5">
            <div className="flex items-baseline justify-between mb-2 px-1">
              <h2 className="text-xs uppercase tracking-[0.18em] text-ink-500">
                {category.label} ({tasksInCat.length})
              </h2>
            </div>
            <ul className="space-y-2">
              {tasksInCat.map((t) => (
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
                    onChangeCategory={(c) => changeCategory(t.id, c)}
                    categories={categories}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

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
              Time of day
            </span>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as TaskCategory)}
              className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
            >
              {categories.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </label>
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
  onChangeCategory,
  categories,
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
  onChangeCategory: (category: TaskCategory) => void;
  categories: TaskCategoryOption[];
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
            Time of day
          </span>
          <select
            value={normalizeCategory(template.category)}
            onChange={(e) => onChangeCategory(e.target.value as TaskCategory)}
            className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
          >
            {categories.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {cat.label}
              </option>
            ))}
          </select>
        </label>
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
          {template.default_for_new_shifts && (
            <span className="text-[10px] uppercase tracking-wider bg-forest-600 text-cream-50 px-1.5 py-0.5 rounded font-medium">
              Default
            </span>
          )}
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

function normalizeCategory(category: Template["category"]): TaskCategory {
  return category ?? "other";
}

function categoryLabel(categories: TaskCategoryOption[], key: string) {
  return categories.find((category) => category.key === key)?.label ?? key;
}

function CategoryEditor({ category }: { category: TaskCategoryOption }) {
  const router = useRouter();
  const [label, setLabel] = useState(category.label);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const response = await fetch("/api/task-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: (category as TaskCategoryOption & { id?: string }).id, label }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    setSaving(false);
    if (!response.ok) {
      alert(result?.error ?? "Could not rename category.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="flex-1 px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-sm focus:outline-none focus:border-forest-500"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving || !label.trim() || label === category.label}
        className="bg-cream-200 text-ink-700 px-3 py-2 rounded-xl text-xs font-medium disabled:opacity-50"
      >
        {saving ? "Saving" : "Rename"}
      </button>
    </div>
  );
}
