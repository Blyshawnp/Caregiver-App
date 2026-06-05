export type TaskImportance = "low" | "medium" | "high" | "critical";
export type TaskTimeMode = "unscheduled" | "time_of_day" | "exact_time";
export type TaskTimeOfDay =
  | "morning"
  | "early_afternoon"
  | "afternoon"
  | "late_afternoon"
  | "evening"
  | "bedtime";

const TIME_OF_DAY_ORDER: TaskTimeOfDay[] = [
  "morning",
  "early_afternoon",
  "afternoon",
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
    value === "afternoon" ||
    value === "late_afternoon" ||
    value === "evening" ||
    value === "bedtime"
    ? value
    : null;
}

function resolveTaskTiming(input: {
  timeMode?: string | null;
  timeOfDay?: string | null;
  scheduledTime?: string | null;
}) {
  const timeOfDay = normalizeTaskTimeOfDay(input.timeOfDay);
  const scheduledTime = input.scheduledTime?.trim() || null;

  // If timeMode is explicitly set, honor it
  if (input.timeMode === "exact_time" && scheduledTime) {
    return { mode: "exact_time" as const, timeOfDay: null, scheduledTime };
  }
  if (input.timeMode === "time_of_day" && timeOfDay) {
    return { mode: "time_of_day" as const, timeOfDay, scheduledTime: null };
  }
  if (input.timeMode === "unscheduled") {
    return { mode: "unscheduled" as const, timeOfDay: null, scheduledTime: null };
  }

  // Fallback if timeMode is null or missing
  if (scheduledTime) {
    return { mode: "exact_time" as const, timeOfDay: null, scheduledTime };
  }
  if (timeOfDay) {
    return { mode: "time_of_day" as const, timeOfDay, scheduledTime: null };
  }

  return { mode: "unscheduled" as const, timeOfDay: null, scheduledTime: null };
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
  const timing = resolveTaskTiming(input);
  if (timing.mode === "exact_time" && timing.scheduledTime) {
    return `time:${formatTaskClock(timing.scheduledTime)}`;
  }
  if (timing.mode === "time_of_day" && timing.timeOfDay) {
    return `tod:${timing.timeOfDay}`;
  }
  return "unscheduled";
}

export function getTaskTimeGroupSort(input: {
  timeMode?: string | null;
  timeOfDay?: string | null;
  scheduledTime?: string | null;
}) {
  const timing = resolveTaskTiming(input);
  if (timing.mode === "exact_time" && timing.scheduledTime) {
    const [hours, minutes] = timing.scheduledTime.split(":").map((part) => Number(part));
    return hours * 60 + minutes;
  }
  if (timing.mode === "time_of_day" && timing.timeOfDay) {
    return 24 * 60 + TIME_OF_DAY_ORDER.indexOf(timing.timeOfDay) * 60;
  }
  return 48 * 60;
}

export function getTaskTimeGroupLabel(input: {
  timeMode?: string | null;
  timeOfDay?: string | null;
  scheduledTime?: string | null;
}, lang: "en" | "es" = "en") {
  const timing = resolveTaskTiming(input);
  if (timing.mode === "exact_time" && timing.scheduledTime) {
    return formatTaskClock(timing.scheduledTime);
  }
  if (timing.mode === "time_of_day") {
    const timeOfDay = timing.timeOfDay;
    if (timeOfDay === "morning") return lang === "es" ? "Mañana" : "Morning";
    if (timeOfDay === "early_afternoon")
      return lang === "es" ? "Primera hora de la tarde" : "Early Afternoon";
    if (timeOfDay === "afternoon") return lang === "es" ? "Tarde" : "Afternoon";
    if (timeOfDay === "late_afternoon")
      return lang === "es" ? "Última hora de la tarde" : "Late Afternoon";
    if (timeOfDay === "evening") return lang === "es" ? "Noche" : "Evening";
    if (timeOfDay === "bedtime") return lang === "es" ? "Hora de dormir" : "Bedtime";
  }
  return lang === "es" ? "Sin horario" : "Unscheduled";
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
