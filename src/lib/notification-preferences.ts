export type NotificationTone =
  | "default"
  | "soft_chime"
  | "bell"
  | "bright_alert"
  | "urgent_alert"
  | "silent"
  | "loud_chime"
  | "repeating_chime"
  | "urgent_tone";

export type NotificationPreferenceCategory =
  | "messages"
  | "shift_updates"
  | "urgent_alerts"
  | "documents"
  | "payments"
  | "schedule_requests"
  | "feedback"
  | "reminders";

export type NotificationCategoryPreference = {
  enabled: boolean;
  pushEnabled: boolean;
  inAppSoundEnabled: boolean;
  tone: NotificationTone;
  volume: number;
  quietHoursAllowed: boolean;
};

export type NotificationCategoryPreferenceMap = Record<
  NotificationPreferenceCategory,
  NotificationCategoryPreference
>;

export const TONE_OPTIONS: Array<{ id: NotificationTone; label: string }> = [
  { id: "default", label: "Default" },
  { id: "soft_chime", label: "Soft chime" },
  { id: "bell", label: "Bell" },
  { id: "bright_alert", label: "Bright alert" },
  { id: "urgent_alert", label: "Urgent alert" },
  { id: "loud_chime", label: "Loud chime" },
  { id: "repeating_chime", label: "Repeating chime" },
  { id: "urgent_tone", label: "Urgent tone" },
  { id: "silent", label: "Silent" },
];

export const NOTIFICATION_CATEGORY_OPTIONS: Array<{
  id: NotificationPreferenceCategory;
  label: string;
  description: string;
  urgent?: boolean;
}> = [
  {
    id: "messages",
    label: "Messages",
    description: "Direct messages and replies.",
  },
  {
    id: "shift_updates",
    label: "Shift updates",
    description: "Assignments, check-ins, check-outs, and shift changes.",
  },
  {
    id: "urgent_alerts",
    label: "Urgent/emergency alerts",
    description: "Incident and emergency-related alerts.",
    urgent: true,
  },
  {
    id: "documents",
    label: "Documents and print approvals",
    description: "Document updates, acknowledgments, and print requests.",
  },
  {
    id: "payments",
    label: "Payments and invoices",
    description: "Invoice, payroll, year-end, and payment updates.",
  },
  {
    id: "schedule_requests",
    label: "Schedule requests",
    description: "Coverage, trade, release, and approval requests.",
  },
  {
    id: "feedback",
    label: "Feedback/commendations",
    description: "Feedback, commendations, concerns, and complaints.",
  },
  {
    id: "reminders",
    label: "Reminders",
    description: "Task, medication, check-in, and checkout reminders.",
  },
];

export const DEFAULT_CATEGORY_PREFERENCES: NotificationCategoryPreferenceMap =
  Object.fromEntries(
    NOTIFICATION_CATEGORY_OPTIONS.map((category) => [
      category.id,
      {
        enabled: true,
        pushEnabled: true,
        inAppSoundEnabled: true,
        tone: category.id === "urgent_alerts" ? "urgent_alert" : "default",
        volume: category.id === "urgent_alerts" ? 0.9 : 0.75,
        quietHoursAllowed: category.id !== "urgent_alerts",
      },
    ])
  ) as NotificationCategoryPreferenceMap;

export function normalizeCategoryPreferences(
  value: unknown
): NotificationCategoryPreferenceMap {
  const input =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, Partial<NotificationCategoryPreference>>)
      : {};

  return Object.fromEntries(
    NOTIFICATION_CATEGORY_OPTIONS.map((category) => {
      const current = input[category.id] ?? {};
      const fallback = DEFAULT_CATEGORY_PREFERENCES[category.id];
      return [
        category.id,
        {
          enabled:
            typeof current.enabled === "boolean"
              ? current.enabled
              : fallback.enabled,
          pushEnabled:
            typeof current.pushEnabled === "boolean"
              ? current.pushEnabled
              : fallback.pushEnabled,
          inAppSoundEnabled:
            typeof current.inAppSoundEnabled === "boolean"
              ? current.inAppSoundEnabled
              : fallback.inAppSoundEnabled,
          tone: isTone(current.tone) ? current.tone : fallback.tone,
          volume:
            typeof current.volume === "number"
              ? Math.min(1, Math.max(0, current.volume))
              : fallback.volume,
          quietHoursAllowed:
            typeof current.quietHoursAllowed === "boolean"
              ? current.quietHoursAllowed
              : fallback.quietHoursAllowed,
        },
      ];
    })
  ) as NotificationCategoryPreferenceMap;
}

export function preferenceCategoryForNotificationKind(
  kind: string
): NotificationPreferenceCategory {
  const normalized = kind.toLowerCase();
  if (normalized === "message" || normalized === "new_message") return "messages";
  if (
    normalized.includes("urgent") ||
    normalized.includes("emergency") ||
    normalized.includes("incident")
  ) {
    return "urgent_alerts";
  }
  if (
    normalized.includes("document") ||
    normalized.includes("print") ||
    normalized.includes("acknowledg")
  ) {
    return "documents";
  }
  if (
    normalized.includes("invoice") ||
    normalized.includes("payment") ||
    normalized.includes("payroll") ||
    normalized.includes("year_end") ||
    normalized.includes("bonus")
  ) {
    return "payments";
  }
  if (
    normalized.includes("trade") ||
    normalized.includes("coverage") ||
    normalized.includes("proposal") ||
    normalized.includes("release") ||
    normalized.includes("request")
  ) {
    return "schedule_requests";
  }
  if (
    normalized.includes("feedback") ||
    normalized.includes("commendation") ||
    normalized.includes("concern") ||
    normalized.includes("complaint")
  ) {
    return "feedback";
  }
  if (
    normalized.includes("reminder") ||
    normalized.includes("task") ||
    normalized.includes("medication") ||
    normalized.includes("check_in") ||
    normalized.includes("checkout")
  ) {
    return "reminders";
  }
  return "shift_updates";
}

export function toneForNotificationKind(kind: string): NotificationTone {
  const category = preferenceCategoryForNotificationKind(kind);
  if (category === "urgent_alerts") return "urgent_alert";
  if (category === "messages") return "bell";
  if (category === "reminders") return "soft_chime";
  return "default";
}

function isTone(value: unknown): value is NotificationTone {
  return TONE_OPTIONS.some((tone) => tone.id === value);
}
