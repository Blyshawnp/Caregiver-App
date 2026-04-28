"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PlusIcon } from "@/components/icons";

type Todo = {
  id: string;
  task_name: string;
  description: string | null;
  is_completed: boolean;
  completed_at: string | null;
  sort_order: number;
  notes: string | null;
};

export default function TasksView({
  shiftId,
  todos,
  canEdit,
  canCompleteTasks,
  currentUserId,
}: {
  shiftId: string;
  todos: Todo[];
  canEdit: boolean;
  canCompleteTasks: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);
  const [newTaskName, setNewTaskName] = useState("");

  const completedCount =
    todos.filter((t) =>
      optimistic[t.id] !== undefined ? optimistic[t.id] : t.is_completed
    ).length;
  const progressPct =
    todos.length === 0 ? 0 : Math.round((completedCount / todos.length) * 100);

  async function toggle(todo: Todo) {
    if (!canCompleteTasks) return;
    const newValue = !(optimistic[todo.id] ?? todo.is_completed);
    setOptimistic((p) => ({ ...p, [todo.id]: newValue }));

    const supabase = createClient();
    const update: {
      is_completed: boolean;
      completed_at: string | null;
      completed_by: string | null;
    } = {
      is_completed: newValue,
      completed_at: newValue ? new Date().toISOString() : null,
      completed_by: newValue ? currentUserId : null,
    };
    const { error } = await supabase
      .from("shift_todos")
      .update(update)
      .eq("id", todo.id);

    if (error) {
      setOptimistic((p) => {
        const next = { ...p };
        delete next[todo.id];
        return next;
      });
      alert(error.message);
      return;
    }

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
      sort_order: maxSort + 10,
    });

    if (error) {
      alert(error.message);
      return;
    }

    setNewTaskName("");
    setAdding(false);
    router.refresh();
  }

  async function deleteTask(id: string) {
    if (!confirm("Remove this task from this shift?")) return;
    const supabase = createClient();
    await supabase.from("shift_todos").delete().eq("id", id);
    router.refresh();
  }

  return (
    <div>
      {todos.length > 0 && (
        <section className="bg-white rounded-3xl shadow-soft p-5 mb-4 grain-overlay">
          <div className="relative">
            <div className="flex justify-between items-baseline mb-2">
              <h2 className="font-display text-base">Progress</h2>
              <span className="text-sm text-ink-500">
                {completedCount} / {todos.length}
              </span>
            </div>
            <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-forest-600 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </section>
      )}

      {todos.length === 0 && !adding && (
        <div className="bg-white rounded-3xl p-10 shadow-soft text-center mb-4 grain-overlay">
          <div className="relative">
            <p className="font-display text-lg mb-1">No tasks yet</p>
            <p className="text-sm text-ink-500">
              {canEdit
                ? "Tap below to add the first one."
                : "Nothing assigned for this shift."}
            </p>
          </div>
        </div>
      )}

      {todos.length > 0 && (
        <ul className="space-y-2 mb-4">
          {todos.map((t) => (
            <li key={t.id}>
              <TaskRow
                todo={t}
                isComplete={optimistic[t.id] ?? t.is_completed}
                canCompleteTasks={canCompleteTasks}
                canEdit={canEdit}
                onToggle={() => toggle(t)}
                onDelete={() => deleteTask(t.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <>
          {adding ? (
            <form onSubmit={addTask} className="bg-white rounded-2xl shadow-soft p-3 flex gap-2 mb-2">
              <input
                type="text"
                autoFocus
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="What needs doing?"
                className="flex-1 px-3 py-2 bg-cream-50 border border-cream-200 rounded-xl text-ink-900 placeholder:text-ink-300 focus:outline-none focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 transition text-sm"
                maxLength={140}
              />
              <button
                type="submit"
                disabled={!newTaskName.trim()}
                className="bg-forest-600 hover:bg-forest-700 disabled:opacity-50 text-cream-50 px-4 rounded-xl text-sm font-medium transition"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewTaskName("");
                }}
                className="bg-cream-200 hover:bg-cream-200/70 text-ink-700 px-3 rounded-xl text-sm font-medium transition"
              >
                Cancel
              </button>
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
  canCompleteTasks,
  canEdit,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  isComplete: boolean;
  canCompleteTasks: boolean;
  canEdit: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-start gap-3 bg-white rounded-2xl p-4 shadow-soft transition ${
        isComplete ? "opacity-60" : ""
      }`}
    >
      <button
        onClick={onToggle}
        disabled={!canCompleteTasks}
        aria-label={isComplete ? "Mark incomplete" : "Mark complete"}
        className={`w-6 h-6 rounded-md border-2 grid place-items-center shrink-0 mt-0.5 transition ${
          isComplete
            ? "bg-forest-600 border-forest-600"
            : "border-ink-300 hover:border-forest-500"
        } ${!canCompleteTasks ? "cursor-not-allowed" : "cursor-pointer active:scale-90"}`}
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
        <p
          className={`text-ink-900 font-medium leading-snug ${
            isComplete ? "line-through text-ink-500" : ""
          }`}
        >
          {todo.task_name}
        </p>
        {todo.description && (
          <p className="text-xs text-ink-500 mt-0.5">{todo.description}</p>
        )}
        {isComplete && todo.completed_at && (
          <p className="text-xs text-ink-500 mt-1">
            Done {formatTime(new Date(todo.completed_at))}
          </p>
        )}
      </div>

      {canEdit && (
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

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
