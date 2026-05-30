"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon } from "@/components/icons";
import {
  type TaskCategory,
  type TaskCategoryOption,
} from "@/lib/task-categories";
import { t as tr } from "@/lib/i18n";

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
  is_optional: boolean;
  is_prn: boolean;
  importance: "low" | "medium" | "high" | "critical";
  time_mode: "unscheduled" | "time_of_day" | "exact_time";
  time_of_day: "morning" | "early_afternoon" | "late_afternoon" | "evening" | "bedtime" | null;
  scheduled_time: string | null;
  allow_repeat: boolean;
};

type Caregiver = { id: string; full_name: string };
type TaskType = "required" | "optional" | "prn";

export default function TemplatesList({
  templates,
  caregivers,
  organizationId,
  categories,
  lang,
}: {
  templates: Template[];
  caregivers: Caregiver[];
  organizationId: string;
  categories: TaskCategoryOption[];
  lang: "en" | "es";
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIsDefault, setNewIsDefault] = useState(true);
  const [newCaregiverId, setNewCaregiverId] = useState<string>("");
  const [newCategory, setNewCategory] = useState<TaskCategory>("other");
  const [newTaskType, setNewTaskType] = useState<TaskType>("required");
  const [newImportance, setNewImportance] = useState<Template["importance"]>("medium");
  const [newTimeMode, setNewTimeMode] = useState<Template["time_mode"]>("unscheduled");
  const [newTimeOfDay, setNewTimeOfDay] = useState<NonNullable<Template["time_of_day"]>>("morning");
  const [newScheduledTime, setNewScheduledTime] = useState("12:00");
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [newAllowRepeat, setNewAllowRepeat] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");

  const caregiverNameById = useMemo(() => {
    const m = new Map<string, string>();
    caregivers.forEach((c) => m.set(c.id, c.full_name));
    return m;
  }, [caregivers]);

  const filtered = useMemo(() => {
    if (filter === "all") return templates;
    if (filter === "shared") return templates.filter((t) => t.caregiver_id == null);
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
      sort_order: Number.isFinite(newSortOrder) ? newSortOrder : maxSort + 10,
      caregiver_id: newCaregiverId || null,
      category: newCategory,
      is_optional: newTaskType === "optional",
      is_prn: newTaskType === "prn",
      importance: newImportance,
      time_mode: newTimeMode,
      time_of_day: newTimeMode === "time_of_day" ? newTimeOfDay : null,
      scheduled_time: newTimeMode === "exact_time" ? newScheduledTime : null,
      allow_repeat: newAllowRepeat,
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
    setNewTaskType("required");
    setNewImportance("medium");
    setNewTimeMode("unscheduled");
    setNewTimeOfDay("morning");
    setNewScheduledTime("12:00");
    setNewSortOrder(maxSort + 10);
    setNewAllowRepeat(true);
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
    await supabase.from("todo_templates").update({ caregiver_id: caregiverId }).eq("id", id);
    router.refresh();
  }

  async function changeCategory(id: string, category: TaskCategory) {
    const supabase = createClient();
    await supabase.from("todo_templates").update({ category }).eq("id", id);
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
    if (!confirm("Delete this task from the master list? Existing shifts won't be affected.")) return;
    const supabase = createClient();
    await supabase.from("todo_templates").update({ is_active: false }).eq("id", id);
    router.refresh();
  }

  return (
    <div>
      {caregivers.length > 0 && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs uppercase tracking-[0.18em] text-ink-500 mr-1">
            Show:
          </span>
          <FilterPill active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </FilterPill>
          <FilterPill active={filter === "shared"} onClick={() => setFilter("shared")}>
            Everyone
          </FilterPill>
          {caregivers.map((c) => (
            <FilterPill key={c.id} active={filter === c.id} onClick={() => setFilter(c.id)}>
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
            <CategoryEditor
              key={category.key}
              category={category}
              allCategories={categories}
              templates={templates}
            />
          ))}
        </div>
      </form>

      {categories.map((category) => {
        const cat = category.key;
        const tasksInCat = filtered.filter((t) => normalizeCategory(t.category) === cat);
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
                    caregiverName={t.caregiver_id ? (caregiverNameById.get(t.caregiver_id) ?? null) : null}
                    lang={lang}
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
          <TaskTypePicker value={newTaskType} onChange={setNewTaskType} lang={lang} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Importance">
              <select
                value={newImportance}
                onChange={(e) => setNewImportance(e.target.value as Template["importance"])}
                className={inputCls}
              >
                <option value="low">{tr("task.importanceLow", lang)}</option>
                <option value="medium">{tr("task.importanceMedium", lang)}</option>
                <option value="high">{tr("task.importanceHigh", lang)}</option>
                <option value="critical">{tr("task.importanceCritical", lang)}</option>
              </select>
            </Field>
            <Field label="Time mode">
              <select
                value={newTimeMode}
                onChange={(e) => setNewTimeMode(e.target.value as Template["time_mode"])}
                className={inputCls}
              >
                <option value="unscheduled">{tr("task.unscheduled", lang)}</option>
                <option value="time_of_day">{tr("task.timeOfDay", lang)}</option>
                <option value="exact_time">{tr("task.exactTime", lang)}</option>
              </select>
            </Field>
          </div>
          {newTimeMode === "time_of_day" && (
            <Field label="Time of day">
              <select
                value={newTimeOfDay}
                onChange={(e) =>
                  setNewTimeOfDay(e.target.value as NonNullable<Template["time_of_day"]>)
                }
                className={inputCls}
              >
                <option value="morning">{tr("task.morning", lang)}</option>
                <option value="early_afternoon">{tr("task.earlyAfternoon", lang)}</option>
                <option value="late_afternoon">{tr("task.lateAfternoon", lang)}</option>
                <option value="evening">{tr("task.evening", lang)}</option>
                <option value="bedtime">{tr("task.bedtime", lang)}</option>
              </select>
            </Field>
          )}
          {newTimeMode === "exact_time" && (
            <Field label="Exact time">
              <input
                type="time"
                value={newScheduledTime}
                onChange={(e) => setNewScheduledTime(e.target.value)}
                className={inputCls}
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Manual order">
              <input
                type="number"
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(Number(e.target.value))}
                className={inputCls}
              />
            </Field>
            <label className="flex items-center gap-2 self-end pb-3 text-sm text-ink-700 cursor-pointer">
              <input
                type="checkbox"
                checked={newAllowRepeat}
                onChange={(e) => setNewAllowRepeat(e.target.checked)}
                className="w-4 h-4 accent-forest-600"
              />
              Repeat task on shift
            </label>
          </div>
          <Field label="Category">
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value as TaskCategory)}
              className={inputCls}
            >
              {categories.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.label}
                </option>
              ))}
            </select>
          </Field>
          <label className="block">
            <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
              Assigned to
            </span>
            <select
              value={newCaregiverId}
              onChange={(e) => setNewCaregiverId(e.target.value)}
              className={inputCls}
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
                setNewCategory("other");
                setNewTaskType("required");
                setNewImportance("medium");
                setNewTimeMode("unscheduled");
                setNewTimeOfDay("morning");
                setNewScheduledTime("12:00");
                setNewSortOrder(0);
                setNewAllowRepeat(true);
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
  lang,
}: {
  template: Template;
  caregivers: Caregiver[];
  caregiverName: string | null;
  lang: "en" | "es";
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
  const [taskType, setTaskType] = useState<TaskType>(
    template.is_prn ? "prn" : template.is_optional ? "optional" : "required"
  );
  const [importance, setImportance] = useState(template.importance);
  const [timeMode, setTimeMode] = useState(template.time_mode);
  const [timeOfDay, setTimeOfDay] = useState<NonNullable<Template["time_of_day"]>>(
    template.time_of_day ?? "morning"
  );
  const [scheduledTime, setScheduledTime] = useState(template.scheduled_time ?? "12:00");
  const [sortOrder, setSortOrder] = useState(template.sort_order);
  const [allowRepeat, setAllowRepeat] = useState(template.allow_repeat);
  const [savingEdit, setSavingEdit] = useState(false);

  async function saveEdit() {
    if (!name.trim()) return;
    setSavingEdit(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("todo_templates")
      .update({
        task_name: name.trim(),
        description: description.trim() || null,
        is_optional: taskType === "optional",
        is_prn: taskType === "prn",
        importance,
        time_mode: timeMode,
        time_of_day: timeMode === "time_of_day" ? timeOfDay : null,
        scheduled_time: timeMode === "exact_time" ? scheduledTime : null,
        sort_order: sortOrder,
        allow_repeat: allowRepeat,
      })
      .eq("id", template.id);
    setSavingEdit(false);
    if (error) {
      alert(error.message);
      return;
    }
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
          className={inputCls}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className={inputCls}
        />
              <TaskTypePicker value={taskType} onChange={setTaskType} lang={lang} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Importance">
            <select value={importance} onChange={(e) => setImportance(e.target.value as Template["importance"])} className={inputCls}>
              <option value="low">{tr("task.importanceLow", lang)}</option>
              <option value="medium">{tr("task.importanceMedium", lang)}</option>
              <option value="high">{tr("task.importanceHigh", lang)}</option>
              <option value="critical">{tr("task.importanceCritical", lang)}</option>
            </select>
          </Field>
          <Field label="Time mode">
            <select value={timeMode} onChange={(e) => setTimeMode(e.target.value as Template["time_mode"])} className={inputCls}>
              <option value="unscheduled">{tr("task.unscheduled", lang)}</option>
              <option value="time_of_day">{tr("task.timeOfDay", lang)}</option>
              <option value="exact_time">{tr("task.exactTime", lang)}</option>
            </select>
          </Field>
        </div>
        {timeMode === "time_of_day" && (
          <Field label="Time of day">
            <select value={timeOfDay} onChange={(e) => setTimeOfDay(e.target.value as NonNullable<Template["time_of_day"]>)} className={inputCls}>
              <option value="morning">{tr("task.morning", lang)}</option>
              <option value="early_afternoon">{tr("task.earlyAfternoon", lang)}</option>
              <option value="late_afternoon">{tr("task.lateAfternoon", lang)}</option>
              <option value="evening">{tr("task.evening", lang)}</option>
              <option value="bedtime">{tr("task.bedtime", lang)}</option>
            </select>
          </Field>
        )}
        {timeMode === "exact_time" && (
          <Field label="Exact time">
            <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className={inputCls} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Manual order">
            <input type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className={inputCls} />
          </Field>
          <label className="flex items-center gap-2 self-end pb-3 text-sm text-ink-700 cursor-pointer">
            <input type="checkbox" checked={allowRepeat} onChange={(e) => setAllowRepeat(e.target.checked)} className="w-4 h-4 accent-forest-600" />
            Repeat task on shift
          </label>
        </div>
        <Field label="Category">
          <select value={normalizeCategory(template.category)} onChange={(e) => onChangeCategory(e.target.value as TaskCategory)} className={inputCls}>
            {categories.map((cat) => (
              <option key={cat.key} value={cat.key}>
                {cat.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assigned to">
          <select
            value={template.caregiver_id ?? ""}
            onChange={(e) => onReassign(e.target.value || null)}
            className={inputCls}
          >
            <option value="">Everyone</option>
            {caregivers.map((c) => (
              <option key={c.id} value={c.id}>
                Only {c.full_name}
              </option>
            ))}
          </select>
        </Field>
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
        {template.description && <p className="text-xs text-ink-500 mt-0.5">{template.description}</p>}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <TemplateBadge label={template.is_prn ? tr("task.prn", lang) : template.is_optional ? tr("task.optional", lang) : tr("task.required", lang)} />
          <TemplateBadge label={importanceLabel(template.importance, lang)} />
          <TemplateBadge label={template.time_mode === "exact_time" && template.scheduled_time ? template.scheduled_time : template.time_mode === "time_of_day" && template.time_of_day ? timeOfDayLabel(template.time_of_day, lang) : tr("task.unscheduled", lang)} />
          <TemplateBadge label={template.allow_repeat ? (lang === "es" ? "Repetible" : "Repeatable") : tr("task.single", lang)} />
          <TemplateBadge label={`#${template.sort_order}`} />
        </div>
      </div>
      <div className="flex gap-1 shrink-0">
        <button onClick={onEdit} className="text-xs text-forest-600 hover:underline">Edit</button>
        <span className="text-ink-300">·</span>
        <button onClick={onDelete} className="text-xs text-terracotta-600 hover:underline">Delete</button>
      </div>
    </div>
  );
}

function normalizeCategory(category: Template["category"]): TaskCategory {
  return category ?? "other";
}

function TemplateBadge({ label }: { label: string }) {
  return (
    <span className="text-[10px] uppercase tracking-[0.18em] bg-cream-100 text-ink-600 px-1.5 py-0.5 rounded">
      {label}
    </span>
  );
}

function TaskTypePicker({
  value,
  onChange,
  lang,
}: {
  value: TaskType;
  onChange: (value: TaskType) => void;
  lang: "en" | "es";
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <TypeButton active={value === "required"} onClick={() => onChange("required")} label={tr("task.required", lang)} />
      <TypeButton active={value === "optional"} onClick={() => onChange("optional")} label={tr("task.optional", lang)} />
      <TypeButton active={value === "prn"} onClick={() => onChange("prn")} label={tr("task.prn", lang)} />
    </div>
  );
}

function TypeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl px-3 py-2 text-sm font-medium transition border ${
        active
          ? "bg-forest-600 border-forest-600 text-cream-50"
          : "bg-cream-50 border-cream-200 text-ink-600 hover:bg-cream-100"
      }`}
    >
      {label}
    </button>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition";

function CategoryEditor({
  category,
  allCategories,
  templates,
}: {
  category: TaskCategoryOption;
  allCategories: TaskCategoryOption[];
  templates: Template[];
}) {
  const router = useRouter();
  const [label, setLabel] = useState(category.label);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reassignTo, setReassignTo] = useState("other");

  const categoryTemplates = templates.filter((t) => t.category === category.key);
  const hasTasks = categoryTemplates.length > 0;

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

  async function handleDelete() {
    setSaving(true);
    const response = await fetch(`/api/task-categories?id=${(category as any).id}&reassignTo=${reassignTo}`, {
      method: "DELETE",
    });
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    setSaving(false);
    setDeleting(false);
    if (!response.ok) {
      alert(result?.error ?? "Could not remove category.");
      return;
    }
    router.refresh();
  }

  if (deleting) {
    return (
      <div className="bg-cream-100 border border-cream-200 rounded-xl p-3 space-y-2 text-sm text-ink-700">
        <p className="font-medium text-ink-900">Remove category: {category.label}?</p>
        {hasTasks ? (
          <>
            <p className="text-xs text-ink-500">
              This category has {categoryTemplates.length} task{categoryTemplates.length === 1 ? "" : "s"}. Select where to move them:
            </p>
            <select
              value={reassignTo}
              onChange={(e) => setReassignTo(e.target.value)}
              className="w-full px-2 py-1 bg-white border border-cream-200 rounded-lg text-xs"
            >
              <option value="other">Uncategorized (Other)</option>
              {allCategories
                .filter((cat) => cat.key !== category.key && cat.key !== "other")
                .map((cat) => (
                  <option key={cat.key} value={cat.key}>
                    Move to: {cat.label}
                  </option>
                ))}
            </select>
          </>
        ) : (
          <p className="text-xs text-ink-500">This category has no tasks and will be safely removed.</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setDeleting(false)}
            className="flex-1 bg-white border border-cream-200 text-ink-700 py-1 rounded-lg text-xs font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="flex-1 bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 py-1 rounded-lg text-xs font-medium"
          >
            Confirm Delete
          </button>
        </div>
      </div>
    );
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
      {category.key !== "other" && (
        <button
          type="button"
          onClick={() => setDeleting(true)}
          className="bg-terracotta-400/10 text-terracotta-700 hover:bg-terracotta-400/20 px-3 py-2 rounded-xl text-xs font-medium"
        >
          Delete
        </button>
      )}
    </div>
  );
}

function importanceLabel(value: Template["importance"], lang: "en" | "es") {
  switch (value) {
    case "low":
      return tr("task.importanceLow", lang);
    case "high":
      return tr("task.importanceHigh", lang);
    case "critical":
      return tr("task.importanceCritical", lang);
    default:
      return tr("task.importanceMedium", lang);
  }
}

function timeOfDayLabel(value: NonNullable<Template["time_of_day"]>, lang: "en" | "es") {
  switch (value) {
    case "morning":
      return tr("task.morning", lang);
    case "early_afternoon":
      return tr("task.earlyAfternoon", lang);
    case "late_afternoon":
      return tr("task.lateAfternoon", lang);
    case "evening":
      return tr("task.evening", lang);
    case "bedtime":
      return tr("task.bedtime", lang);
  }
}
