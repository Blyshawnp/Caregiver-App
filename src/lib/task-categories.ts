export type TaskCategory =
  | "adls"
  | "medication"
  | "meals"
  | "mobility"
  | "housekeeping"
  | "companionship"
  | "safety"
  | "other";

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  adls: "ADLs",
  medication: "Medication",
  meals: "Meals",
  mobility: "Mobility",
  housekeeping: "Housekeeping",
  companionship: "Companionship",
  safety: "Safety",
  other: "Other",
};

export const TASK_CATEGORY_ORDER: TaskCategory[] = [
  "adls",
  "medication",
  "meals",
  "mobility",
  "housekeeping",
  "companionship",
  "safety",
  "other",
];

export function deriveTaskCategory(input: {
  taskName: string;
  description?: string | null;
  notes?: string | null;
}): TaskCategory {
  const haystack = `${input.taskName} ${input.description ?? ""} ${input.notes ?? ""}`
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");

  if (matchesAny(haystack, ["med", "medication", "pill", "insulin", "rx", "dose"])) {
    return "medication";
  }
  if (matchesAny(haystack, ["meal", "breakfast", "lunch", "dinner", "snack", "food", "cook", "eat"])) {
    return "meals";
  }
  if (matchesAny(haystack, ["transfer", "walk", "wheelchair", "lift", "mobility", "ambulation", "exercise"])) {
    return "mobility";
  }
  if (matchesAny(haystack, ["bathe", "bath", "shower", "dress", "toilet", "groom", "brush", "hygiene"])) {
    return "adls";
  }
  if (matchesAny(haystack, ["laundry", "dishes", "clean", "trash", "sweep", "mop", "tidy", "housekeeping"])) {
    return "housekeeping";
  }
  if (matchesAny(haystack, ["companion", "visit", "conversation", "read", "game", "activity", "social"])) {
    return "companionship";
  }
  if (matchesAny(haystack, ["safety", "alarm", "door", "lock", "fall", "check", "monitor"])) {
    return "safety";
  }

  return "other";
}

function matchesAny(haystack: string, needles: string[]) {
  return needles.some((needle) => haystack.includes(needle));
}
