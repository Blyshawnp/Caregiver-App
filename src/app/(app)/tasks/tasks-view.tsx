"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon } from "@/components/icons";
import {
  deriveTaskCategory,
  normalizeTaskCategories,
  type TaskCategory,
  type TaskCategoryOption,
} from "@/lib/task-categories";
import {
  formatTaskClock,
  getTaskTimeGroupKey,
  getTaskTimeGroupLabel,
  getTaskTimeGroupSort,
  sortTasks,
} from "@/lib/task-scheduling";
import { t as tr } from "@/lib/i18n";

type Todo = {
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
  category?: TaskCategory | null;
  status?: string | null;
};

type TaskType = "required" | "optional" | "prn";

export default function TasksView({
  shiftId,
  todos,
  canManageTasks,
  canCompleteTasks,
  currentUserId,
  categories: categoryRows,
  lang,
}: {
  shiftId: string;
  todos: Todo[];
  canManageTasks: boolean;
  canCompleteTasks: boolean;
  currentUserId: string;
  categories: TaskCategoryOption[];
  lang: "en" | "es";
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [savingIds, setSavingIds] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskCategory, setNewTaskCategory] = useState<TaskCategory>("other");
  const [newTaskType, setNewTaskType] = useState<TaskType>("required");
  const [newImportance, setNewImportance] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [newTimeMode, setNewTimeMode] = useState<"unscheduled" | "time_of_day" | "exact_time">("unscheduled");
  const [newTimeOfDay, setNewTimeOfDay] = useState<"morning" | "early_afternoon" | "late_afternoon" | "evening" | "bedtime">("morning");
  const [newScheduledTime, setNewScheduledTime] = useState("12:00");
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [newAllowRepeat, setNewAllowRepeat] = useState(true);
  const categories = normalizeTaskCategories(categoryRows);

  const requiredTodos = todos.filter((t) => !t.is_optional && !t.is_prn);
  const completedCount = requiredTodos.filter((t) =>
    optimistic[t.id] !== undefined ? optimistic[t.id] : t.is_completed
  ).length;
  const progressPct = requiredTodos.length === 0 ? 0 : Math.round((completedCount / requiredTodos.length) * 100);

  const groupedTodos = useMemo(() => {
    const ordered = sortTasks(todos);
    const groups = new Map<
      string,
      {
        key: string;
        sort: number;
        label: string;
        tasks: Todo[];
      }
    >();

    ordered.forEach((todo) => {
      const key = getTaskTimeGroupKey({
        timeMode: todo.time_mode,
        timeOfDay: todo.time_of_day,
        scheduledTime: todo.scheduled_time,
      });
      const sort = getTaskTimeGroupSort({
        timeMode: todo.time_mode,
        timeOfDay: todo.time_of_day,
        scheduledTime: todo.scheduled_time,
      });
      const label = getTaskTimeGroupLabel(
        {
          timeMode: todo.time_mode,
          timeOfDay: todo.time_of_day,
          scheduledTime: todo.scheduled_time,
        },
        lang
      );
      const group = groups.get(key) ?? { key, sort, label, tasks: [] };
      group.tasks.push(todo);
      groups.set(key, group);
    });

    return [...groups.values()].sort((a, b) => a.sort - b.sort);
  }, [lang, todos]);

  async function toggle(todo: Todo) {
    if (!canCompleteTasks || savingIds[todo.id]) return;
    const newValue = !(optimistic[todo.id] ?? todo.is_completed);
    setOptimistic((p) => ({ ...p, [todo.id]: newValue }));
    setSavingIds((current) => ({ ...current, [todo.id]: true }));

    const supabase = createClient();
    const update: {
      is_completed: boolean;
      completed_at: string | null;
      completed_by: string | null;
      status: string;
    } = {
      is_completed: newValue,
      completed_at: newValue ? new Date().toISOString() : null,
      completed_by: newValue ? currentUserId : null,
      status: newValue ? 'completed' : 'pending',
    };
    const { error } = await supabase
      .from("shift_todos")
      .update(update)
      .eq("id", todo.id)
      .eq("shift_id", shiftId);

    if (error) {
      setOptimistic((p) => {
        const next = { ...p };
        delete next[todo.id];
        return next;
      });
      setSavingIds((current) => {
        const next = { ...current };
        delete next[todo.id];
        return next;
      });
      alert(error.message);
      return;
    }

    setSavingIds((current) => {
      const next = { ...current };
      delete next[todo.id];
      return next;
    });
    startTransition(() => router.refresh());
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskName.trim()) return;

    const supabase = createClient();
    const maxSort = Math.max(0, ...todos.map((t) => t.sort_order ?? 0));
    const { error } = await supabase.from("shift_todos").insert({
      shift_id: shiftId,
      task_name: newTaskName.trim(),
      description: newTaskDescription.trim() || null,
      is_optional: newTaskType === "optional",
      is_prn: newTaskType === "prn",
      importance: newImportance,
      time_mode: newTimeMode,
      time_of_day: newTimeMode === "time_of_day" ? newTimeOfDay : null,
      scheduled_time: newTimeMode === "exact_time" ? newScheduledTime : null,
      sort_order: Number.isFinite(newSortOrder) ? newSortOrder : maxSort + 10,
      allow_repeat: newAllowRepeat,
      category: newTaskCategory,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewTaskName("");
    setNewTaskDescription("");
    setNewTaskType("required");
    setNewImportance("medium");
    setNewTimeMode("unscheduled");
    setNewTimeOfDay("morning");
    setNewScheduledTime("12:00");
    setNewSortOrder(maxSort + 10);
    setNewAllowRepeat(true);
    setNewTaskCategory("other");
    setAdding(false);
    router.refresh();
  }

  async function deleteTask(id: string) {
    if (!canManageTasks) return;
    if (!confirm("Remove this task from this shift?")) return;
    const supabase = createClient();
    await supabase.from("shift_todos").delete().eq("id", id);
    router.refresh();
  }

  async function changeTaskCategory(id: string, category: TaskCategory) {
    if (!canManageTasks) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("shift_todos")
      .update({ category })
      .eq("id", id)
      .eq("shift_id", shiftId);

    if (error) {
      alert(error.message);
      return;
    }

    router.refresh();
  }

  async function updateTaskStatus(id: string, newStatus: string) {
    const supabase = createClient();
    const update: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'completed') {
      update.is_completed = true;
      update.completed_at = new Date().toISOString();
      update.completed_by = currentUserId;
    } else if (newStatus === 'not_needed' || newStatus === 'client_declined' || newStatus === 'skipped') {
      update.is_completed = false;
      update.completed_at = null;
      update.completed_by = null;
    }
    const { error } = await supabase
      .from('shift_todos')
      .update(update)
      .eq('id', id)
      .eq('shift_id', shiftId);
    if (error) {
      alert(error.message);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div>
      {todos.length > 0 && (
        <section className="bg-white rounded-3xl shadow-soft p-5 mb-4 grain-overlay">
          <div className="relative">
            <div className="flex justify-between items-baseline mb-2">
              <h2 className="font-display text-base">Progress</h2>
              <span className="text-sm text-ink-500">
                {completedCount} / {requiredTodos.length}
              </span>
            </div>
            <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-forest-600 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-ink-500 mt-3">
              {canCompleteTasks
                ? "Complete tasks here during the active shift."
                : "Only the assigned caregiver can complete tasks during an active shift."}
            </p>
          </div>
        </section>
      )}

      {todos.length === 0 && !adding && (
        <div className="bg-white rounded-3xl p-10 shadow-soft text-center mb-4 grain-overlay">
          <div className="relative">
            <p className="font-display text-lg mb-1">No tasks yet</p>
            <p className="text-sm text-ink-500">
              {canManageTasks
                ? "Tap below to add the first one."
                : "Nothing assigned for this shift."}
            </p>
          </div>
        </div>
      )}

      {groupedTodos.length > 0 && (
        <div className="space-y-5 mb-4">
          {groupedTodos.map((group) => (
            <section key={group.key}>
              <div className="flex items-baseline justify-between mb-2 px-1">
                <h2 className="text-xs uppercase tracking-[0.18em] text-ink-500">
                  {group.label} ({group.tasks.length})
                </h2>
              </div>
              <ul className="space-y-2">
                {group.tasks.map((todo) => (
                  <li key={todo.id}>
                    <TaskRow
                      todo={todo}
                      isComplete={optimistic[todo.id] ?? todo.is_completed}
                      isSaving={!!savingIds[todo.id]}
                      canCompleteTasks={canCompleteTasks}
                      canManageTasks={canManageTasks}
                      onToggle={() => toggle(todo)}
                      onDelete={() => deleteTask(todo.id)}
                      onChangeCategory={(category) => changeTaskCategory(todo.id, category)}
                      onUpdateStatus={(status: string) => updateTaskStatus(todo.id, status)}
                      categories={categories}
                      lang={lang}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {canManageTasks && (
        <>
          {adding ? (
            <form onSubmit={addTask} className="bg-white rounded-2xl shadow-soft p-4 space-y-3 mb-2">
              <div className="grid gap-3">
                <input
                  type="text"
                  autoFocus
                  value={newTaskName}
                  onChange={(e) => setNewTaskName(e.target.value)}
                  placeholder="What needs doing?"
                  className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition text-sm"
                  maxLength={140}
                />
                <textarea
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  placeholder="Optional details or instructions"
                  rows={2}
                  className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition text-sm resize-none"
                />
                <div className="grid grid-cols-3 gap-2">
                  <TypeButton active={newTaskType === "required"} onClick={() => setNewTaskType("required")} label={tr("task.required", lang)} />
                  <TypeButton active={newTaskType === "optional"} onClick={() => setNewTaskType("optional")} label={tr("task.optional", lang)} />
                  <TypeButton active={newTaskType === "prn"} onClick={() => setNewTaskType("prn")} label={tr("task.prn", lang)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
                      {tr("task.importance", lang)}
                    </span>
                    <select
                      value={newImportance}
                      onChange={(e) => setNewImportance(e.target.value as Todo["importance"])}
                      className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
                    >
                      <option value="low">{tr("task.importanceLow", lang)}</option>
                      <option value="medium">{tr("task.importanceMedium", lang)}</option>
                      <option value="high">{tr("task.importanceHigh", lang)}</option>
                      <option value="critical">{tr("task.importanceCritical", lang)}</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
                      {tr("task.timeMode", lang)}
                    </span>
                    <select
                      value={newTimeMode}
                      onChange={(e) => setNewTimeMode(e.target.value as Todo["time_mode"])}
                      className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
                    >
                      <option value="unscheduled">{tr("task.unscheduled", lang)}</option>
                      <option value="time_of_day">{tr("task.timeOfDay", lang)}</option>
                      <option value="exact_time">{tr("task.exactTime", lang)}</option>
                    </select>
                  </label>
                </div>
                {newTimeMode === "time_of_day" && (
                  <label className="block">
                    <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
                      {tr("task.timeOfDay", lang)}
                    </span>
                    <select
                      value={newTimeOfDay}
                      onChange={(e) =>
                        setNewTimeOfDay(e.target.value as NonNullable<Todo["time_of_day"]>)
                      }
                      className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
                    >
                      <option value="morning">{tr("task.morning", lang)}</option>
                      <option value="early_afternoon">{tr("task.earlyAfternoon", lang)}</option>
                      <option value="late_afternoon">{tr("task.lateAfternoon", lang)}</option>
                      <option value="evening">{tr("task.evening", lang)}</option>
                      <option value="bedtime">{tr("task.bedtime", lang)}</option>
                    </select>
                  </label>
                )}
                {newTimeMode === "exact_time" && (
                  <label className="block">
                    <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
                      {tr("task.exactTime", lang)}
                    </span>
                    <input
                      type="time"
                      value={newScheduledTime}
                      onChange={(e) => setNewScheduledTime(e.target.value)}
                      className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
                    />
                  </label>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
                      {tr("task.manualOrder", lang)}
                    </span>
                    <input
                      type="number"
                      value={newSortOrder}
                      onChange={(e) => setNewSortOrder(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-2 self-end pb-1.5 text-sm text-ink-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newAllowRepeat}
                      onChange={(e) => setNewAllowRepeat(e.target.checked)}
                      className="w-4 h-4 accent-forest-600"
                    />
                    {tr("task.allowRepeat", lang)}
                  </label>
                </div>
                <label className="block">
                  <span className="block text-xs font-medium text-ink-700 mb-1.5 tracking-wide uppercase">
                    Category
                  </span>
                  <select
                    value={newTaskCategory}
                    onChange={(e) => setNewTaskCategory(e.target.value as TaskCategory)}
                    className="w-full px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 text-sm"
                  >
                    {categories.map((category) => (
                      <option key={category.key} value={category.key}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAdding(false);
                    setNewTaskName("");
                    setNewTaskDescription("");
                    setNewTaskType("required");
                    setNewImportance("medium");
                    setNewTimeMode("unscheduled");
                    setNewTimeOfDay("morning");
                    setNewScheduledTime("12:00");
                    setNewSortOrder(0);
                    setNewAllowRepeat(true);
                    setNewTaskCategory("other");
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
              className="w-full flex items-center gap-2 bg-cream-200/60 hover:bg-cream-200 text-ink-700 px-4 py-3 rounded-2xl font-medium transition active:scale-[0.99]"
            >
              <span className="w-7 h-7 rounded-full bg-white text-forest-600 grid place-items-center">
                <PlusIcon size={16} />
              </span>
              Add a task
            </button>
          )}
        </>
      )}
    </div>
  );
}

function TaskRow({
  todo,
  isComplete,
  isSaving,
  canCompleteTasks,
  canManageTasks,
  onToggle,
  onDelete,
  onChangeCategory,
  onUpdateStatus,
  categories,
  lang,
}: {
  todo: Todo;
  isComplete: boolean;
  isSaving: boolean;
  canCompleteTasks: boolean;
  canManageTasks: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onChangeCategory: (category: TaskCategory) => void;
  onUpdateStatus: (status: string) => void;
  categories: TaskCategoryOption[];
  lang: "en" | "es";
}) {
  const category = todo.category ?? deriveTaskCategory({ taskName: todo.task_name, description: todo.description, notes: todo.notes });
  const badges = [
    todo.is_optional ? tr("task.optional", lang) : null,
    todo.is_prn ? tr("task.prn", lang) : null,
    todo.importance !== "medium" ? importanceLabel(todo.importance, lang) : null,
    todo.allow_repeat ? null : tr("task.single", lang),
  ].filter(Boolean) as string[];

  return (
    <div
      className={`flex items-start gap-3 bg-white rounded-2xl p-4 shadow-soft transition ${isComplete ? "opacity-60" : ""}`}
    >
      <button
        onClick={onToggle}
        disabled={!canCompleteTasks || isSaving}
        aria-label={isComplete ? "Mark incomplete" : "Mark complete"}
        className={`w-6 h-6 rounded-md border-2 grid place-items-center shrink-0 mt-0.5 transition ${
          isComplete
            ? "bg-forest-600 border-forest-600"
            : "border-ink-300 hover:border-forest-500"
        } ${!canCompleteTasks || isSaving ? "cursor-not-allowed" : "cursor-pointer active:scale-90"}`}
      >
        {isComplete && (
          <svg
            className="w-4 h-4 text-cream-50"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`text-ink-900 font-medium leading-snug ${isComplete ? "line-through text-ink-500" : ""}`}>
            {todo.task_name}
          </p>
          {todo.time_mode === "exact_time" && todo.scheduled_time && (
            <span className="text-[10px] uppercase tracking-[0.18em] bg-forest-100 text-forest-700 px-1.5 py-0.5 rounded">
              {formatTaskClock(todo.scheduled_time)}
            </span>
          )}
          {todo.time_mode === "time_of_day" && todo.time_of_day && (
            <span className="text-[10px] uppercase tracking-[0.18em] bg-forest-100 text-forest-700 px-1.5 py-0.5 rounded">
              {getTaskTimeGroupLabel(
                {
                  timeMode: todo.time_mode,
                  timeOfDay: todo.time_of_day,
                  scheduledTime: todo.scheduled_time,
                },
                lang
              )}
            </span>
          )}
        </div>
        {todo.description && <p className="text-xs text-ink-500 mt-0.5">{todo.description}</p>}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {badges.map((badge) => (
            <span key={badge} className="text-[10px] uppercase tracking-[0.18em] bg-cream-100 text-ink-600 px-1.5 py-0.5 rounded">
              {badge}
            </span>
          ))}
          <span className="text-[10px] uppercase tracking-[0.18em] bg-cream-100 text-ink-600 px-1.5 py-0.5 rounded">
            {categoryLabel(categories, category)}
          </span>
          <span className="text-[10px] uppercase tracking-[0.18em] bg-cream-100 text-ink-600 px-1.5 py-0.5 rounded">
            #{todo.sort_order}
          </span>
        </div>
        {todo.is_prn && canCompleteTasks && !isComplete && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            <button
              type="button"
              onClick={() => onUpdateStatus('not_needed')}
              className="text-[11px] bg-cream-200 hover:bg-cream-300 text-ink-700 px-2.5 py-1 rounded-lg font-medium transition"
            >
              Not needed this shift
            </button>
            <button
              type="button"
              onClick={() => onUpdateStatus('client_declined')}
              className="text-[11px] bg-cream-200 hover:bg-cream-300 text-ink-700 px-2.5 py-1 rounded-lg font-medium transition"
            >
              Client declined
            </button>
            <button
              type="button"
              onClick={() => onUpdateStatus('needs_follow_up')}
              className="text-[11px] bg-terracotta-400/15 hover:bg-terracotta-400/25 text-terracotta-700 px-2.5 py-1 rounded-lg font-medium transition"
            >
              Needs follow-up
            </button>
          </div>
        )}
        {todo.status && todo.status !== 'pending' && todo.status !== 'completed' && (
          <span className={`inline-block text-[10px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded mt-2 ${
            todo.status === 'needs_follow_up'
              ? 'bg-terracotta-400/15 text-terracotta-700'
              : 'bg-cream-200 text-ink-600'
          }`}>
            {todo.status === 'not_needed' ? 'Not needed' : todo.status === 'client_declined' ? 'Client declined' : todo.status === 'needs_follow_up' ? 'Needs follow-up' : todo.status.replace(/_/g, ' ')}
          </span>
        )}
        {isComplete && todo.completed_at && (
          <p className="text-xs text-ink-500 mt-1">Done {formatTime(new Date(todo.completed_at))}</p>
        )}
        {isSaving && <p className="text-xs text-ink-500 mt-1">Saving...</p>}
        {canManageTasks && (
          <label className="mt-2 inline-flex items-center gap-2 text-xs text-ink-500">
            Category
            <select
              value={category}
              onChange={(e) => onChangeCategory(e.target.value as TaskCategory)}
              className="bg-cream-50 border border-cream-200 rounded-lg px-2 py-1 text-xs text-ink-900 focus:outline-none focus:border-forest-500"
            >
              {categories.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {canManageTasks && (
        <button
          onClick={onDelete}
          aria-label="Delete task"
          className="text-ink-300 hover:text-terracotta-600 transition shrink-0 mt-0.5"
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
      )}
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

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function categoryLabel(categories: TaskCategoryOption[], key: string) {
  return categories.find((category) => category.key === key)?.label ?? key;
}

function importanceLabel(value: Todo["importance"], lang: "en" | "es") {
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
