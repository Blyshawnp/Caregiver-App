"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

/* ====================================================
   BULK DELETE MODAL
   ==================================================== */
export function BulkDeleteModal({
  selectedShifts,
  onClose,
  onDeleted,
}: {
  selectedShifts: any[];
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const supabase = createClient();
  const shiftIds = selectedShifts.map((s) => s.id);

  useEffect(() => {
    async function checkShifts() {
      try {
        const warningList: string[] = [];

        // Check for check-ins
        const hasCheckIns = selectedShifts.some((s) => s.has_check_in || s.is_complete);
        if (hasCheckIns) {
          warningList.push("Some selected shifts have check-in or checkout records.");
        }

        // Check for completed tasks in shift_todos
        const { data: completedTodos } = await supabase
          .from("shift_todos")
          .select("id")
          .in("shift_id", shiftIds)
          .eq("is_completed", true)
          .limit(1);

        if (completedTodos && completedTodos.length > 0) {
          warningList.push("Some selected shifts have completed tasks.");
        }

        // Check for caregiver feedback
        const { data: feedback } = await supabase
          .from("caregiver_feedback")
          .select("id")
          .in("shift_id", shiftIds)
          .limit(1);

        if (feedback && feedback.length > 0) {
          warningList.push("Some selected shifts have caregiver notes/feedback.");
        }

        // Check for client caregiver bonuses (if any)
        try {
          const { data: bonuses } = await supabase
            .from("client_caregiver_bonuses")
            .select("id")
            .in("shift_id", shiftIds)
            .limit(1);

          if (bonuses && bonuses.length > 0) {
            warningList.push("Some selected shifts have caregiver bonuses attached.");
          }
        } catch (e) {
          // ignore if table doesn't exist
        }

        setWarnings(warningList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    checkShifts();
  }, [selectedShifts]);

  async function handleDelete() {
    if (selectedShifts.some((s) => s.caregiver_id) && !reason.trim()) {
      setErrorMsg("Please provide a reason for deleting/cancelling scheduled shifts.");
      return;
    }

    setDeleting(true);
    setErrorMsg("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found.");

      if (profile.role === "caregiver" || profile.role === "family") {
        throw new Error("You do not have permission to perform bulk actions.");
      }

      // Hard delete the shifts
      const { error: deleteError } = await supabase
        .from("shifts")
        .delete()
        .in("id", shiftIds);

      if (deleteError) throw deleteError;

      // Log bulk action to activity_logs
      const { error: logError } = await supabase.from("activity_logs").insert({
        organization_id: profile.organization_id,
        actor_id: user.id,
        action_type: "bulk_delete_shifts",
        shift_count: shiftIds.length,
        reason: reason || null,
        metadata: { shift_ids: shiftIds },
      });

      if (logError) {
        console.error("Failed to log activity:", logError);
      }

      onDeleted();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to delete shifts.");
    } finally {
      setDeleting(false);
    }
  }

  const hasAssignedShifts = selectedShifts.some((s) => s.caregiver_id);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-lifted">
        <h2 className="font-display text-xl text-ink-900 mb-2">Delete Selected Shifts</h2>
        <p className="text-sm text-ink-500 mb-4">
          You have selected <strong className="text-ink-900">{selectedShifts.length}</strong> shift(s) to delete permanently.
        </p>

        {loading ? (
          <p className="text-xs text-ink-400 mb-4 animate-pulse">Analyzing shifts for records...</p>
        ) : warnings.length > 0 ? (
          <div className="bg-terracotta-500/10 border border-terracotta-500/20 rounded-2xl p-4 mb-4">
            <h4 className="text-xs uppercase tracking-wider text-terracotta-700 font-semibold mb-1.5">
              Warning - Associated Records Found:
            </h4>
            <ul className="list-disc pl-4 text-xs text-terracotta-700 space-y-1">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
            <p className="text-[11px] text-terracotta-600 mt-2 font-medium">
              Deleting these shifts will permanently remove all associated tasks, check-ins, and data. This action is irreversible.
            </p>
          </div>
        ) : null}

        {hasAssignedShifts && (
          <div className="mb-4">
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              Reason for Deleting Scheduled Shifts *
            </label>
            <textarea
              className="w-full bg-cream-50 border border-cream-200 rounded-xl p-2.5 text-sm focus:outline-none focus:border-forest-600"
              rows={2}
              placeholder="e.g. Client requested reschedule"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        {errorMsg && (
          <p className="text-xs text-terracotta-600 mb-4 font-medium">{errorMsg}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="flex-1 bg-cream-100 hover:bg-cream-200 text-ink-700 py-3 rounded-2xl text-sm font-semibold transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting || loading}
            className="flex-1 bg-terracotta-500 hover:bg-terracotta-600 text-cream-50 py-3 rounded-2xl text-sm font-semibold transition disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Delete Shifts"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ====================================================
   BULK ADD TASK MODAL
   ==================================================== */
export function BulkAddTaskModal({
  selectedShifts,
  onClose,
  onAdded,
}: {
  selectedShifts: any[];
  onClose: () => void;
  onAdded: (summary: { shiftsUpdated: number; tasksAdded: number; duplicatesSkipped: number }) => void;
}) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all"); // 'all', 'required', 'optional', 'prn'
  const [timeFilter, setTimeFilter] = useState("all"); // 'all', 'morning', 'afternoon', 'evening', 'bedtime', 'exact', 'unscheduled'
  
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const supabase = createClient();

  // Handle unsaved changes warning for this modal
  const hasChanges = selectedTemplateIds.size > 0;
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "You have selected tasks. Are you sure you want to close this form?";
        return e.returnValue;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasChanges]);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const { data, error } = await supabase
          .from("todo_templates")
          .select("*")
          .eq("is_active", true)
          .order("task_name", { ascending: true });

        if (error) throw error;
        setTemplates(data || []);
      } catch (err) {
        console.error("Failed to load task templates:", err);
      } finally {
        setLoading(false);
      }
    }
    loadTemplates();
  }, []);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        t.task_name.toLowerCase().includes(search.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(search.toLowerCase()));

      const matchesCategory =
        categoryFilter === "all" || t.category === categoryFilter;

      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "required" && !t.is_optional && !t.is_prn) ||
        (typeFilter === "optional" && t.is_optional && !t.is_prn) ||
        (typeFilter === "prn" && t.is_prn);

      const matchesTime =
        timeFilter === "all" ||
        (timeFilter === "unscheduled" && t.time_mode === "unscheduled") ||
        (timeFilter === "exact" && t.time_mode === "exact_time") ||
        (timeFilter === "morning" && t.time_of_day === "morning") ||
        (timeFilter === "early_afternoon" && t.time_of_day === "early_afternoon") ||
        (timeFilter === "late_afternoon" && t.time_of_day === "late_afternoon") ||
        (timeFilter === "evening" && t.time_of_day === "evening") ||
        (timeFilter === "bedtime" && t.time_of_day === "bedtime");

      return matchesSearch && matchesCategory && matchesType && matchesTime;
    });
  }, [templates, search, categoryFilter, typeFilter, timeFilter]);

  const handleToggleTemplate = (id: string) => {
    setSelectedTemplateIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  async function handleAdd() {
    if (selectedTemplateIds.size === 0) {
      setErrorMsg("Please select at least one task to add.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    const shiftIds = selectedShifts.map((s) => s.id);
    const selectedTemplates = templates.filter((t) => selectedTemplateIds.has(t.id));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated.");

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, role")
        .eq("id", user.id)
        .single();

      if (!profile) throw new Error("Profile not found.");

      if (profile.role === "caregiver" || profile.role === "family") {
        throw new Error("You do not have permission to perform bulk actions.");
      }

      // Fetch all existing shift_todos for duplication checks
      const { data: existingTodos, error: existingError } = await supabase
        .from("shift_todos")
        .select("shift_id, task_name")
        .in("shift_id", shiftIds);

      if (existingError) throw existingError;

      const existingMap = new Map<string, Set<string>>();
      (existingTodos || []).forEach((item) => {
        const set = existingMap.get(item.shift_id) ?? new Set<string>();
        set.add(item.task_name.toLowerCase().trim());
        existingMap.set(item.shift_id, set);
      });

      const todosToInsert: any[] = [];
      let duplicatesSkippedCount = 0;
      const shiftsUpdatedSet = new Set<string>();

      for (const shift of selectedShifts) {
        const existingNames = existingMap.get(shift.id) ?? new Set<string>();
        let updatedThisShift = false;

        for (const template of selectedTemplates) {
          const nameNormalized = template.task_name.toLowerCase().trim();
          const isDuplicate = existingNames.has(nameNormalized);

          if (isDuplicate && !allowDuplicates) {
            duplicatesSkippedCount++;
            continue;
          }

          todosToInsert.push({
            shift_id: shift.id,
            task_name: template.task_name,
            description: template.description,
            is_optional: template.is_optional,
            is_prn: template.is_prn,
            importance: template.importance || "medium",
            time_mode: template.time_mode || "unscheduled",
            time_of_day: template.time_of_day,
            scheduled_time: template.scheduled_time,
            sort_order: template.sort_order || 0,
            allow_repeat: template.allow_repeat ?? true,
            category: template.category || "other",
            status: "pending",
          });

          updatedThisShift = true;
        }

        if (updatedThisShift) {
          shiftsUpdatedSet.add(shift.id);
        }
      }

      if (todosToInsert.length > 0) {
        // Supabase limits single inserts, but chunking isn't needed here unless we have 10,000 items. Let's do a direct insert.
        const { error: insertError } = await supabase
          .from("shift_todos")
          .insert(todosToInsert);

        if (insertError) throw insertError;
      }

      // Log bulk add tasks to activity_logs
      const { error: logError } = await supabase.from("activity_logs").insert({
        organization_id: profile.organization_id,
        actor_id: user.id,
        action_type: "bulk_add_tasks",
        shift_count: shiftIds.length,
        metadata: {
          shift_ids: shiftIds,
          task_count: todosToInsert.length,
          templates_used: selectedTemplates.map((t) => t.task_name),
          duplicates_skipped: duplicatesSkippedCount,
        },
      });

      if (logError) {
        console.error("Failed to log activity:", logError);
      }

      onAdded({
        shiftsUpdated: shiftsUpdatedSet.size,
        tasksAdded: todosToInsert.length,
        duplicatesSkipped: duplicatesSkippedCount,
      });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add tasks.");
    } finally {
      setSubmitting(false);
    }
  }

  // Categories list
  const categories = [
    { value: "all", label: "All Categories" },
    { value: "personal_care", label: "Personal Care" },
    { value: "hygiene", label: "Hygiene" },
    { value: "meals", label: "Meals/Feeding" },
    { value: "medication", label: "Medication/Health" },
    { value: "mobility", label: "Mobility/Transfers" },
    { value: "housekeeping", label: "Housekeeping" },
    { value: "companionship", label: "Companionship" },
    { value: "admin", label: "Administrative" },
    { value: "other", label: "Other" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 max-w-lg w-full max-h-[85vh] flex flex-col shadow-lifted">
        <header className="mb-4">
          <h2 className="font-display text-xl text-ink-900">Add Tasks to Selected Shifts</h2>
          <p className="text-xs text-ink-500 mt-0.5">
            Adding tasks to <strong className="text-ink-900">{selectedShifts.length}</strong> selected shifts.
          </p>
        </header>

        {/* Filters */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <input
            type="text"
            className="col-span-2 w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-600"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-forest-600"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>

          <select
            className="bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-forest-600"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="required">Required Tasks</option>
            <option value="optional">Optional Tasks</option>
            <option value="prn">PRN Tasks</option>
          </select>

          <select
            className="col-span-2 bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-forest-600"
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
          >
            <option value="all">All Times of Day</option>
            <option value="unscheduled">Unscheduled</option>
            <option value="exact">Exact Scheduled Time</option>
            <option value="morning">Morning</option>
            <option value="early_afternoon">Early Afternoon</option>
            <option value="late_afternoon">Late Afternoon</option>
            <option value="evening">Evening</option>
            <option value="bedtime">Bedtime</option>
          </select>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto min-h-[150px] border border-cream-100 rounded-2xl mb-4 p-2 bg-cream-50/50">
          {loading ? (
            <p className="text-center text-xs text-ink-400 py-10">Loading templates...</p>
          ) : filteredTemplates.length === 0 ? (
            <p className="text-center text-xs text-ink-400 py-10">No matching task templates found.</p>
          ) : (
            <ul className="space-y-1">
              {filteredTemplates.map((t) => (
                <li key={t.id}>
                  <label className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-cream-100/50 cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={selectedTemplateIds.has(t.id)}
                      onChange={() => handleToggleTemplate(t.id)}
                      className="w-4 h-4 accent-forest-600 shrink-0 mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink-900 truncate">{t.task_name}</p>
                      {t.description && (
                        <p className="text-xs text-ink-500 truncate">{t.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="text-[9px] bg-cream-200 text-ink-600 px-1.5 py-0.5 rounded font-medium">
                          {t.category || "other"}
                        </span>
                        {t.is_prn && (
                          <span className="text-[9px] bg-terracotta-500/15 text-terracotta-700 px-1.5 py-0.5 rounded font-medium">
                            PRN
                          </span>
                        )}
                        {t.is_optional && !t.is_prn && (
                          <span className="text-[9px] bg-cream-200 text-ink-600 px-1.5 py-0.5 rounded font-medium">
                            Optional
                          </span>
                        )}
                        {!t.is_optional && !t.is_prn && (
                          <span className="text-[9px] bg-forest-100 text-forest-700 px-1.5 py-0.5 rounded font-medium">
                            Required
                          </span>
                        )}
                        {t.time_mode === "exact_time" && t.scheduled_time && (
                          <span className="text-[9px] bg-cream-200 text-ink-600 px-1.5 py-0.5 rounded font-medium">
                            {t.scheduled_time}
                          </span>
                        )}
                        {t.time_mode === "time_of_day" && t.time_of_day && (
                          <span className="text-[9px] bg-cream-200 text-ink-600 px-1.5 py-0.5 rounded font-medium">
                            {t.time_of_day.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Options */}
        <div className="mb-4 bg-cream-50 p-3 rounded-2xl border border-cream-150 flex items-center justify-between">
          <div className="min-w-0 pr-2">
            <p className="text-xs font-semibold text-ink-900">Add duplicates</p>
            <p className="text-[10px] text-ink-500">
              Add another instance of the task even if it already exists on the shift.
            </p>
          </div>
          <input
            type="checkbox"
            checked={allowDuplicates}
            onChange={(e) => setAllowDuplicates(e.target.checked)}
            className="w-4 h-4 accent-forest-600 shrink-0 cursor-pointer"
          />
        </div>

        {errorMsg && (
          <p className="text-xs text-terracotta-600 mb-3 font-medium">{errorMsg}</p>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 bg-cream-100 hover:bg-cream-200 text-ink-700 py-3 rounded-2xl text-sm font-semibold transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={submitting || selectedTemplateIds.size === 0}
            className="flex-1 bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-sm font-semibold transition disabled:opacity-50"
          >
            {submitting ? "Adding..." : `Add ${selectedTemplateIds.size} Task(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ====================================================
   BULK ADD SUMMARY MODAL
   ==================================================== */
export function BulkAddSummaryModal({
  summary,
  onClose,
}: {
  summary: { shiftsUpdated: number; tasksAdded: number; duplicatesSkipped: number };
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-lifted text-center">
        <div className="w-12 h-12 rounded-full bg-forest-100 text-forest-600 grid place-items-center mx-auto mb-3">
          ✓
        </div>
        <h2 className="font-display text-xl text-ink-900 mb-1.5">Tasks Added Successfully</h2>
        <p className="text-sm text-ink-500 mb-4">
          The requested tasks have been assigned to your selected shifts.
        </p>

        <div className="bg-cream-50 border border-cream-150 rounded-2xl p-4 mb-5 text-left space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-ink-500">Shifts Updated:</span>
            <span className="font-semibold text-ink-950">{summary.shiftsUpdated}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Tasks Added:</span>
            <span className="font-semibold text-ink-950">{summary.tasksAdded}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-500">Duplicates Skipped:</span>
            <span className="font-semibold text-ink-950">{summary.duplicatesSkipped}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full bg-forest-600 hover:bg-forest-700 text-cream-50 py-3 rounded-2xl text-sm font-semibold transition"
        >
          Close
        </button>
      </div>
    </div>
  );
}
