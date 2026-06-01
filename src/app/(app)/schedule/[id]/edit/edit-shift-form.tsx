"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { type TaskCategoryOption } from "@/lib/task-categories";

type Caregiver = { id: string; full_name: string };
type ShiftType = { id: string; name: string; color: string };
type Client = { id: string; full_name: string };

type Shift = {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  caregiver_id: string | null;
  client_id: string | null;
  shift_type_id: string | null;
  bonus_amount: number | null;
  bonus_reason: string | null;
  notes: string | null;
};

type ShiftTodo = {
  id: string;
  task_name: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  is_optional: boolean;
  is_prn: boolean;
  importance: "low" | "medium" | "high" | "critical";
  time_mode: "unscheduled" | "time_of_day" | "exact_time";
  time_of_day: "morning" | "early_afternoon" | "late_afternoon" | "evening" | "bedtime" | null;
  scheduled_time: string | null;
  sort_order: number;
  notes: string | null;
  allow_repeat: boolean;
  category: string | null;
  status: string | null;
};

type Template = {
  id: string;
  task_name: string;
  description: string | null;
  default_for_new_shifts: boolean;
  sort_order: number;
  is_active: boolean;
  caregiver_id: string | null;
  category: string | null;
  is_optional: boolean;
  is_prn: boolean;
  importance: "low" | "medium" | "high" | "critical";
  time_mode: "unscheduled" | "time_of_day" | "exact_time";
  time_of_day: "morning" | "early_afternoon" | "late_afternoon" | "evening" | "bedtime" | null;
  scheduled_time: string | null;
  allow_repeat: boolean;
};

export default function EditShiftForm({
  shift,
  caregivers,
  shiftTypes,
  clients,
  initialTodos,
  templates,
  categories,
  organizationId,
}: {
  shift: Shift;
  caregivers: Caregiver[];
  shiftTypes: ShiftType[];
  clients: Client[];
  initialTodos: ShiftTodo[];
  templates: Template[];
  categories: TaskCategoryOption[];
  organizationId: string;
}) {
  const router = useRouter();

  const startDate = new Date(shift.scheduled_start);
  const endDate = new Date(shift.scheduled_end);

  const [date, setDate] = useState(formatDateLocal(startDate));
  const [startTime, setStartTime] = useState(formatTimeLocal(startDate));
  const [endTime, setEndTime] = useState(formatTimeLocal(endDate));
  const [clientId, setClientId] = useState(shift.client_id ?? "");
  const [caregiverId, setCaregiverId] = useState(shift.caregiver_id ?? "");
  const [shiftTypeId, setShiftTypeId] = useState(shift.shift_type_id ?? "");
  const [bonusAmount, setBonusAmount] = useState(
    shift.bonus_amount ? String(shift.bonus_amount) : ""
  );
  const [bonusReason, setBonusReason] = useState(shift.bonus_reason ?? "");
  const [notes, setNotes] = useState(shift.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Shift Todos State
  const [todos, setTodos] = useState<ShiftTodo[]>(initialTodos);
  const [libraryTemplates, setLibraryTemplates] = useState<Template[]>(templates);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerCategory, setPickerCategory] = useState("all");
  const [pickerType, setPickerType] = useState("all"); // required, optional, prn
  const [showCreateForm, setShowCreateForm] = useState(false);

  // New master task form state
  const [crtName, setCrtName] = useState("");
  const [crtDescription, setCrtDescription] = useState("");
  const [crtCategory, setCrtCategory] = useState("other");
  const [crtType, setCrtType] = useState<"required" | "optional" | "prn">("required");
  const [crtImportance, setCrtImportance] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [crtTimeMode, setCrtTimeMode] = useState<"unscheduled" | "time_of_day" | "exact_time">("unscheduled");
  const [crtTimeOfDay, setCrtTimeOfDay] = useState<"morning" | "early_afternoon" | "late_afternoon" | "evening" | "bedtime">("morning");
  const [crtScheduledTime, setCrtScheduledTime] = useState("12:00");
  const [crtSortOrder, setCrtSortOrder] = useState(0);
  const [crtAllowRepeat, setCrtAllowRepeat] = useState(true);

  async function removeTodo(todoId: string) {
    if (!confirm("Are you sure you want to remove this task from this shift?")) return;
    const supabase = createClient();
    const { error } = await supabase.from("shift_todos").delete().eq("id", todoId);
    if (error) {
      alert(error.message);
      return;
    }
    setTodos((prev) => prev.filter((t) => t.id !== todoId));
    router.refresh();
  }

  async function applyDefaultTasks() {
    const shiftDate = date;
    const parts = shiftDate.split("-").map(Number);
    const dayOfWeek = new Date(parts[0], parts[1] - 1, parts[2]).getDay();

    const activeDefaults = libraryTemplates.filter(
      (t) => t.default_for_new_shifts && t.is_active
    );

    const matchingTemplates = activeDefaults.filter((template: any) => {
      if (template.caregiver_id && template.caregiver_id !== caregiverId) return false;

      if (template.applies_to_all_clients === false) {
        if (template.client_id && template.client_id !== clientId) return false;
      }

      if (template.auto_add_start_date) {
        if (shiftDate < template.auto_add_start_date) return false;
      }
      if (template.auto_add_end_date) {
        if (shiftDate > template.auto_add_end_date) return false;
      }

      if (template.default_days_of_week && template.default_days_of_week.length > 0) {
        if (!template.default_days_of_week.includes(dayOfWeek)) return false;
      }

      return true;
    });

    const existingNames = new Set(todos.map((t) => t.task_name.toLowerCase().trim()));
    const toInsert = matchingTemplates.filter(
      (template) => !existingNames.has(template.task_name.toLowerCase().trim())
    );

    if (toInsert.length === 0) {
      alert("This shift is already up to date with matching default tasks.");
      return;
    }

    if (!confirm(`Found ${toInsert.length} matching default task(s) to add. Add them now?`)) {
      return;
    }

    const supabase = createClient();
    const insertedTodos: ShiftTodo[] = [];

    for (const template of toInsert) {
      const { data, error: insertError } = await supabase
        .from("shift_todos")
        .insert({
          shift_id: shift.id,
          template_id: template.id,
          task_name: template.task_name,
          description: template.description,
          is_optional: template.is_optional,
          is_prn: template.is_prn,
          importance: template.importance,
          time_mode: template.time_mode,
          time_of_day: template.time_of_day,
          scheduled_time: template.scheduled_time,
          sort_order: template.sort_order,
          allow_repeat: template.allow_repeat,
          category: template.category,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        alert(`Error adding ${template.task_name}: ${insertError.message}`);
        continue;
      }

      if (data) {
        insertedTodos.push(data as ShiftTodo);
      }
    }

    if (insertedTodos.length > 0) {
      setTodos((prev) => [...prev, ...insertedTodos]);
      alert(`Successfully added ${insertedTodos.length} default task(s).`);
      router.refresh();
    }
  }

  async function addTodoFromTemplate(template: Template) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("shift_todos")
      .insert({
        shift_id: shift.id,
        task_name: template.task_name,
        description: template.description,
        is_optional: template.is_optional,
        is_prn: template.is_prn,
        importance: template.importance,
        time_mode: template.time_mode,
        time_of_day: template.time_of_day,
        scheduled_time: template.scheduled_time,
        sort_order: template.sort_order,
        allow_repeat: template.allow_repeat,
        category: template.category,
        status: "pending",
      })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }
    if (data) {
      setTodos((prev) => [...prev, data as ShiftTodo]);
    }
    router.refresh();
  }

  async function createNewMasterAndShiftTask(e: React.FormEvent) {
    e.preventDefault();
    if (!crtName.trim()) return;

    const supabase = createClient();

    // 1. Insert into todo_templates
    const { data: newTemplate, error: templateError } = await supabase
      .from("todo_templates")
      .insert({
        organization_id: organizationId,
        task_name: crtName.trim(),
        description: crtDescription.trim() || null,
        default_for_new_shifts: false,
        sort_order: Number(crtSortOrder) || 0,
        category: crtCategory,
        is_optional: crtType === "optional",
        is_prn: crtType === "prn",
        importance: crtImportance,
        time_mode: crtTimeMode,
        time_of_day: crtTimeMode === "time_of_day" ? crtTimeOfDay : null,
        scheduled_time: crtTimeMode === "exact_time" ? crtScheduledTime : null,
        allow_repeat: crtAllowRepeat,
        is_active: true,
      })
      .select()
      .single();

    if (templateError) {
      alert(templateError.message);
      return;
    }

    // 2. Insert into shift_todos
    const { data: newTodo, error: todoError } = await supabase
      .from("shift_todos")
      .insert({
        shift_id: shift.id,
        task_name: crtName.trim(),
        description: crtDescription.trim() || null,
        is_optional: crtType === "optional",
        is_prn: crtType === "prn",
        importance: crtImportance,
        time_mode: crtTimeMode,
        time_of_day: crtTimeMode === "time_of_day" ? crtTimeOfDay : null,
        scheduled_time: crtTimeMode === "exact_time" ? crtScheduledTime : null,
        sort_order: Number(crtSortOrder) || 0,
        allow_repeat: crtAllowRepeat,
        category: crtCategory,
        status: "pending",
      })
      .select()
      .single();

    if (todoError) {
      alert(todoError.message);
      return;
    }

    if (newTemplate) {
      setLibraryTemplates((prev) => [...prev, newTemplate as Template]);
    }
    if (newTodo) {
      setTodos((prev) => [...prev, newTodo as ShiftTodo]);
    }

    // Reset create task form
    setCrtName("");
    setCrtDescription("");
    setCrtCategory("other");
    setCrtType("required");
    setCrtImportance("medium");
    setCrtTimeMode("unscheduled");
    setCrtTimeOfDay("morning");
    setCrtScheduledTime("12:00");
    setCrtSortOrder(0);
    setCrtAllowRepeat(true);
    setShowCreateForm(false);
    router.refresh();
  }

  const filteredTemplates = useMemo(() => {
    return libraryTemplates.filter((t) => {
      const matchSearch =
        t.task_name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
        (t.description || "").toLowerCase().includes(pickerSearch.toLowerCase());
      const matchCategory = pickerCategory === "all" || t.category === pickerCategory;
      const matchType =
        pickerType === "all" ||
        (pickerType === "optional" && t.is_optional) ||
        (pickerType === "prn" && t.is_prn) ||
        (pickerType === "required" && !t.is_optional && !t.is_prn);
      return matchSearch && matchCategory && matchType;
    });
  }, [libraryTemplates, pickerSearch, pickerCategory, pickerType]);

  const groupedTemplates = useMemo(() => {
    const groups = new Map<string, { label: string; key: string; templates: Template[] }>();
    categories.forEach((cat) => {
      groups.set(cat.key, { label: cat.label, key: cat.key, templates: [] });
    });
    if (!groups.has("other")) {
      groups.set("other", { label: "Other / Uncategorized", key: "other", templates: [] });
    }

    filteredTemplates.forEach((t) => {
      const catKey = t.category || "other";
      let grp = groups.get(catKey);
      if (!grp) {
        grp = { label: catKey, key: catKey, templates: [] };
        groups.set(catKey, grp);
      }
      grp.templates.push(t);
    });

    return [...groups.values()].filter((g) => g.templates.length > 0);
  }, [filteredTemplates, categories]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const startISO = combineDateTime(date, startTime);
    const endISO = combineDateTime(date, endTime);
    if (!startISO || !endISO) {
      setError("Please pick a valid date and times.");
      return;
    }
    if (new Date(endISO) <= new Date(startISO)) {
      setError("End time must be after start time.");
      return;
    }

    setSubmitting(true);
    const supabase = createClient();

    const caregiverChanged = (caregiverId || null) !== shift.caregiver_id;
    const updates: {
      client_id: string | null;
      caregiver_id: string | null;
      shift_type_id: string | null;
      scheduled_start: string;
      scheduled_end: string;
      bonus_amount: number;
      bonus_reason: string | null;
      notes: string | null;
      assignment_status?: "pending" | null;
    } = {
      client_id: clientId || null,
      caregiver_id: caregiverId || null,
      shift_type_id: shiftTypeId || null,
      scheduled_start: startISO,
      scheduled_end: endISO,
      bonus_amount: bonusAmount ? Number(bonusAmount) : 0,
      bonus_reason: bonusReason || null,
      notes: notes || null,
    };
    if (caregiverChanged) {
      updates.assignment_status = caregiverId ? "pending" : null;
    }

    const { error } = await supabase
      .from("shifts")
      .update(updates)
      .eq("id", shift.id);

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    router.push(`/schedule/${shift.id}`);
    router.refresh();
  }

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <Link
          href={`/schedule/${shift.id}`}
          className="text-sm text-forest-600 hover:underline mb-2 inline-block"
        >
          ← Back
        </Link>
        <h1 className="font-display text-3xl text-ink-900">Edit shift</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card title="When">
          <Field label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Start">
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className={inputCls}
              />
            </Field>
            <Field label="End">
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className={inputCls}
              />
            </Field>
          </div>
        </Card>

        <Card title="Who & what">
          <Field label="Client">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={inputCls}
            >
              <option value="">General availability</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Caregiver">
            <select
              value={caregiverId}
              onChange={(e) => setCaregiverId(e.target.value)}
              className={inputCls}
            >
              <option value="">Unassigned</option>
              {caregivers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Shift type">
            <select
              value={shiftTypeId}
              onChange={(e) => setShiftTypeId(e.target.value)}
              className={inputCls}
            >
              <option value="">Untyped</option>
              {shiftTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
        </Card>

        <Card title="Bonus & notes">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bonus $">
              <input
                type="number"
                step="0.01"
                min="0"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </Field>
            <Field label="Reason">
              <input
                type="text"
                value={bonusReason}
                onChange={(e) => setBonusReason(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className={inputCls}
            />
          </Field>
        </Card>

        <Card title="Shift Tasks">
          <div className="space-y-2 mb-3">
            {todos.length === 0 ? (
              <p className="text-sm text-ink-500 italic py-2">No tasks attached to this shift.</p>
            ) : (
              todos.map((todo) => {
                const badgeList = [
                  todo.is_optional ? "Optional" : "Required",
                  todo.is_prn ? "PRN" : null,
                  todo.importance !== "medium" ? todo.importance : null,
                  todo.time_mode === "exact_time" && todo.scheduled_time ? todo.scheduled_time : null,
                  todo.time_mode === "time_of_day" && todo.time_of_day ? todo.time_of_day : null,
                ].filter(Boolean) as string[];

                return (
                  <div key={todo.id} className="flex justify-between items-start bg-cream-50/50 border border-cream-100 rounded-xl p-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink-900 leading-tight truncate">{todo.task_name}</p>
                      {todo.description && <p className="text-xs text-ink-500 truncate">{todo.description}</p>}
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {badgeList.map(b => (
                          <Badge key={b} color={b === "Optional" ? "cream" : b === "PRN" ? "terracotta" : "cream"}>
                            {b}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTodo(todo.id)}
                      className="text-xs text-terracotta-600 hover:text-terracotta-700 font-medium px-2.5 py-1 hover:bg-terracotta-50 rounded-lg transition shrink-0 ml-2"
                    >
                      Remove
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowPicker(true)}
              className="flex-1 bg-cream-200 hover:bg-cream-200/80 text-ink-700 py-2.5 rounded-xl text-sm font-medium transition"
            >
              + Add from Library
            </button>
            <button
              type="button"
              onClick={applyDefaultTasks}
              className="flex-1 bg-forest-100 hover:bg-forest-200 text-forest-750 py-2.5 rounded-xl text-sm font-semibold transition"
            >
              Apply Default Tasks
            </button>
          </div>
        </Card>

        {error && (
          <div className="bg-terracotta-400/10 border border-terracotta-400/30 text-terracotta-600 rounded-2xl px-4 py-3 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-2.5">
          <Link
            href={`/schedule/${shift.id}`}
            className="flex-1 bg-cream-200 hover:bg-cream-200/70 text-ink-700 py-3.5 rounded-2xl font-medium text-center transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-3.5 rounded-2xl font-medium transition disabled:opacity-50 active:scale-[0.99]"
          >
            {submitting ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>

      {showPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/45 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-lifted p-6 max-h-[85vh] flex flex-col">
            <header className="flex justify-between items-center mb-4 shrink-0">
              <h2 className="font-display text-xl text-ink-900">Task library picker</h2>
              <button
                type="button"
                onClick={() => setShowPicker(false)}
                className="text-ink-400 hover:text-ink-600 text-sm font-medium"
              >
                Close
              </button>
            </header>

            {!showCreateForm ? (
              <>
                <div className="space-y-2.5 mb-4 shrink-0">
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={(e) => setPickerSearch(e.target.value)}
                    placeholder="Search master task library..."
                    className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-sm focus:outline-none focus:border-forest-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={pickerCategory}
                      onChange={(e) => setPickerCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-xs focus:outline-none"
                    >
                      <option value="all">All Categories</option>
                      {categories.map((cat) => (
                        <option key={cat.key} value={cat.key}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={pickerType}
                      onChange={(e) => setPickerType(e.target.value)}
                      className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-xs focus:outline-none"
                    >
                      <option value="all">All Types</option>
                      <option value="required">Required Only</option>
                      <option value="optional">Optional Only</option>
                      <option value="prn">PRN Only</option>
                    </select>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-[200px]">
                  {groupedTemplates.length === 0 ? (
                    <p className="text-sm text-ink-500 italic text-center py-8">
                      No matching templates found in the library.
                    </p>
                  ) : (
                    groupedTemplates.map((grp) => (
                      <div key={grp.key} className="space-y-2">
                        <h3 className="text-xs uppercase tracking-[0.18em] text-ink-500 border-b border-cream-100 pb-1">
                          {grp.label}
                        </h3>
                        <div className="space-y-2">
                          {grp.templates.map((tmpl) => {
                            const isAdded = todos.some(
                              (todo) =>
                                todo.task_name.toLowerCase() === tmpl.task_name.toLowerCase()
                            );
                            return (
                              <div
                                key={tmpl.id}
                                className="flex justify-between items-center bg-cream-50/30 border border-cream-100 p-2.5 rounded-xl"
                              >
                                <div className="min-w-0 pr-2 flex-1">
                                  <p className="text-sm font-medium text-ink-900 truncate">
                                    {tmpl.task_name}
                                  </p>
                                  {tmpl.description && (
                                    <p className="text-xs text-ink-500 truncate">
                                      {tmpl.description}
                                    </p>
                                  )}
                                  <div className="flex gap-1 mt-1">
                                    {tmpl.is_optional && <Badge color="cream">Optional</Badge>}
                                    {tmpl.is_prn && <Badge color="terracotta">PRN</Badge>}
                                    {tmpl.importance !== "medium" && <Badge>{tmpl.importance}</Badge>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                  {isAdded ? (
                                    <>
                                      <span className="text-xs text-forest-600 font-medium bg-forest-50 px-2 py-1 rounded">
                                        Added
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => addTodoFromTemplate(tmpl)}
                                        className="text-xs bg-cream-200 hover:bg-cream-300 text-ink-700 px-2.5 py-1 rounded-lg font-medium transition"
                                      >
                                        + Add duplicate
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => addTodoFromTemplate(tmpl)}
                                      className="text-xs bg-forest-600 hover:bg-forest-700 text-cream-50 px-3 py-1.5 rounded-lg font-medium transition"
                                    >
                                      Add Task
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="pt-4 border-t border-cream-200 shrink-0 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(true)}
                    className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-2.5 rounded-xl text-sm font-medium transition"
                  >
                    + Create & Add New Task
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={createNewMasterAndShiftTask} className="flex-1 overflow-y-auto pr-1 space-y-4">
                <h3 className="font-display text-sm font-medium text-ink-900 border-b border-cream-100 pb-2">
                  Create new template and add to shift
                </h3>

                <Field label="Task Name">
                  <input
                    type="text"
                    required
                    value={crtName}
                    onChange={(e) => setCrtName(e.target.value)}
                    placeholder="Task name (e.g. Clean coffee pot)"
                    className={inputCls}
                  />
                </Field>

                <Field label="Description / Details">
                  <textarea
                    value={crtDescription}
                    onChange={(e) => setCrtDescription(e.target.value)}
                    placeholder="Optional instructions..."
                    rows={2}
                    className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-sm resize-none focus:outline-none"
                  />
                </Field>

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setCrtType("required")}
                    className={`rounded-xl px-3 py-2 text-xs font-medium transition border ${
                      crtType === "required"
                        ? "bg-forest-600 border-forest-600 text-cream-50"
                        : "bg-cream-50 border-cream-200 text-ink-600"
                    }`}
                  >
                    Required
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrtType("optional")}
                    className={`rounded-xl px-3 py-2 text-xs font-medium transition border ${
                      crtType === "optional"
                        ? "bg-forest-600 border-forest-600 text-cream-50"
                        : "bg-cream-50 border-cream-200 text-ink-600"
                    }`}
                  >
                    Optional
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrtType("prn")}
                    className={`rounded-xl px-3 py-2 text-xs font-medium transition border ${
                      crtType === "prn"
                        ? "bg-forest-600 border-forest-600 text-cream-50"
                        : "bg-cream-50 border-cream-200 text-ink-600"
                    }`}
                  >
                    PRN
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Importance">
                    <select
                      value={crtImportance}
                      onChange={(e) => setCrtImportance(e.target.value as any)}
                      className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-xs focus:outline-none focus:border-forest-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </Field>
                  <Field label="Time mode">
                    <select
                      value={crtTimeMode}
                      onChange={(e) => setCrtTimeMode(e.target.value as any)}
                      className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-xs focus:outline-none focus:border-forest-500"
                    >
                      <option value="unscheduled">Unscheduled</option>
                      <option value="time_of_day">Time of Day</option>
                      <option value="exact_time">Exact Time</option>
                    </select>
                  </Field>
                </div>

                {crtTimeMode === "time_of_day" && (
                  <Field label="Time of day">
                    <select
                      value={crtTimeOfDay}
                      onChange={(e) => setCrtTimeOfDay(e.target.value as any)}
                      className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-xs focus:outline-none focus:border-forest-500"
                    >
                      <option value="morning">Morning</option>
                      <option value="early_afternoon">Early Afternoon</option>
                      <option value="late_afternoon">Late Afternoon</option>
                      <option value="evening">Evening</option>
                      <option value="bedtime">Bedtime</option>
                    </select>
                  </Field>
                )}

                {crtTimeMode === "exact_time" && (
                  <Field label="Exact time">
                    <input
                      type="time"
                      value={crtScheduledTime}
                      onChange={(e) => setCrtScheduledTime(e.target.value)}
                      className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-xs focus:outline-none focus:border-forest-500"
                    />
                  </Field>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Manual Sort Order">
                    <input
                      type="number"
                      value={crtSortOrder}
                      onChange={(e) => setCrtSortOrder(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-xs focus:outline-none focus:border-forest-500"
                    />
                  </Field>
                  <Field label="Category">
                    <select
                      value={crtCategory}
                      onChange={(e) => setCrtCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-xs focus:outline-none focus:border-forest-500"
                    >
                      {categories.map((cat) => (
                        <option key={cat.key} value={cat.key}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>

                <div className="flex gap-2.5 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 bg-cream-200 hover:bg-cream-300 text-ink-700 py-3 rounded-2xl text-sm font-medium transition"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-sm font-medium transition active:scale-[0.99]"
                  >
                    Save & Add Task
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

const inputCls =
  "w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-3xl shadow-soft p-5 grain-overlay">
      <div className="relative">
        <h2 className="font-display text-base text-ink-900 mb-3">{title}</h2>
        <div className="space-y-3">{children}</div>
      </div>
    </section>
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

function Badge({
  children,
  color = "cream",
}: {
  children: React.ReactNode;
  color?: "cream" | "forest" | "terracotta";
}) {
  const styles = {
    cream: "bg-cream-100 text-ink-600 border-cream-200",
    forest: "bg-forest-50/70 text-forest-700 border-forest-100",
    terracotta: "bg-terracotta-50/70 text-terracotta-700 border-terracotta-100",
  };
  return (
    <span
      className={`inline-block text-[10px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded border ${styles[color]}`}
    >
      {children}
    </span>
  );
}

function formatDateLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function formatTimeLocal(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function combineDateTime(date: string, time: string) {
  if (!date || !time) return null;
  const local = new Date(`${date}T${time}`);
  if (isNaN(local.getTime())) return null;
  return local.toISOString();
}
