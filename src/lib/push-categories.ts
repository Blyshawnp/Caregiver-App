export type NotificationCategory =
  | "messages"
  | "shift_assignments"
  | "trades"
  | "incidents"
  | "general";

export function categoryForNotificationKind(kind: string): NotificationCategory {
  if (kind === "message" || kind === "new_message") return "messages";
  if (kind.startsWith("trade_") || kind.includes("trade")) return "trades";
  if (kind.includes("incident")) return "incidents";
  if (
    kind.startsWith("shift_") ||
    kind === "force_check_out" ||
    kind === "time_adjusted" ||
    kind === "auto_check_out" ||
    kind === "check_in_reminder" ||
    kind === "checkout_reminder" ||
    kind === "check_in_flagged" ||
    kind === "check_out_flagged"
  ) {
    return "shift_assignments";
  }
  return "general";
}

export function soundForNotificationKind(kind: string) {
  if (kind === "message" || kind === "new_message") return "message";
  if (kind.includes("incident") && kind.includes("urgent")) return "urgent";
  if (kind.includes("incident")) return "urgent";
  return "normal";
}
