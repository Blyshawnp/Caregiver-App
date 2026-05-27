export type TaskImportance = "low" | "medium" | "high" | "critical";
export type TaskTimeMode = "unscheduled" | "time_of_day" | "exact_time";
export type TaskTimeOfDay = "morning" | "early_afternoon" | "late_afternoon" | "evening" | "bedtime";

const TIME_OF_DAY_ORDER: TaskTimeOfDay[] = [
  "morning",
  "early_afternoon",
  "late_afternoon",
  "evening",
  "bedtime",
];

const IMPORTANCE_ORDER: TaskImportance[] = ["critical", "high", "medium", "low"];

export function normalizeTaskImportance(value?: string | null): TaskImportance {
  return value === "low" || value === "medium" || value === "high" || value === "critical"
    ? value
    : "medium";
}

export function normalizeTaskTimeMode(value?: string | null): TaskTimeMode {
  return value === "time_of_day" || value === "exact_time" ? value : "unscheduled";
}

export function normalizeTaskTimeOfDay(value?: string | null): TaskTimeOfDay | null {
  return value === "morning" ||
    value === "early_afternoon" ||
    value === "late_afternoon" ||
    value === "evening" ||
    value === "bedtime"
    ? value
    : null;
}

export function getTaskImportanceRank(value?: string | null) {
  const normalized = normalizeTaskImportance(value);
  return IMPORTANCE_ORDER.indexOf(normalized);
}

export function getTaskTimeGroupKey(input: {
  timeMode?: string | null;
  timeOfDay?: string | null;
  scheduledTime?: string | null;
}) {
  const mode = normalizeTaskTimeMode(input.timeMode);
  if (mode === "exact_time" && input.scheduledTime) {
    return `time:${formatTaskClock(input.scheduledTime)}`;
  }
  if (mode === "time_of_day") {
    return `tod:${normalizeTaskTimeOfDay(input.timeOfDay) ?? "unscheduled"}`;
  }
  return "unscheduled";
}

export function getTaskTimeGroupSort(input: {
  timeMode?: string | null;
  timeOfDay?: string | null;
  scheduledTime?: string | null;
}) {
  const mode = normalizeTaskTimeMode(input.timeMode);
  if (mode === "exact_time" && input.scheduledTime) {
    const [hours, minutes] = input.scheduledTime.split(":").map((part) => Number(part));
    return hours * 60 + minutes;
  }
  if (mode === "time_of_day") {
    const timeOfDay = normalizeTaskTimeOfDay(input.timeOfDay);
    return 24 * 60 + Math.max(0, TIME_OF_DAY_ORDER.indexOf(timeOfDay ?? "morning")) * 60;
  }
  return 48 * 60;
}

export function getTaskTimeGroupLabel(input: {
  timeMode?: string | null;
  timeOfDay?: string | null;
  scheduledTime?: string | null;
}, lang: "en" | "es" = "en") {
  const mode = normalizeTaskTimeMode(input.timeMode);
  if (mode === "exact_time" && input.scheduledTime) {
    return formatTaskClock(input.scheduledTime);
  }
  if (mode === "time_of_day") {
    const timeOfDay = normalizeTaskTimeOfDay(input.timeOfDay);
    if (timeOfDay === "morning") return lang === "es" ? "Mañana" : "Morning";
    if (timeOfDay === "early_afternoon")
      return lang === "es" ? "Tarde temprana" : "Early afternoon";
    if (timeOfDay === "late_afternoon")
      return lang === "es" ? "Tarde" : "Late afternoon";
    if (timeOfDay === "evening") return lang === "es" ? "Noche" : "Evening";
    if (timeOfDay === "bedtime") return lang === "es" ? "Hora de dormir" : "Bedtime";
  }
  return lang === "es" ? "Sin programar" : "Unscheduled";
}

export function sortTasks<T extends {
  time_mode?: string | null;
  time_of_day?: string | null;
  scheduled_time?: string | null;
  importance?: string | null;
  sort_order?: number | null;
  is_completed?: boolean;
  task_name?: string;
}>(tasks: T[]) {
  return [...tasks].sort((a, b) => {
    const aGroup = getTaskTimeGroupSort({
      timeMode: a.time_mode,
      timeOfDay: a.time_of_day,
      scheduledTime: a.scheduled_time,
    });
    const bGroup = getTaskTimeGroupSort({
      timeMode: b.time_mode,
      timeOfDay: b.time_of_day,
      scheduledTime: b.scheduled_time,
    });
    if (aGroup !== bGroup) return aGroup - bGroup;

    const aImportance = getTaskImportanceRank(a.importance);
    const bImportance = getTaskImportanceRank(b.importance);
    if (aImportance !== bImportance) return aImportance - bImportance;

    const aSort = a.sort_order ?? 0;
    const bSort = b.sort_order ?? 0;
    if (aSort !== bSort) return aSort - bSort;

    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;

    return (a.task_name ?? "").localeCompare(b.task_name ?? "");
  });
}

export function formatTaskClock(time: string) {
  const [hoursRaw, minutesRaw] = time.split(":");
  const hours = Number(hoursRaw);
  const minutes = Number(minutesRaw);
  const suffix = hours >= 12 ? "PM" : "AM";
  const displayHours = ((hours + 11) % 12) + 1;
  return `${displayHours}:${String(minutes).padStart(2, "0")} ${suffix}`;
}
