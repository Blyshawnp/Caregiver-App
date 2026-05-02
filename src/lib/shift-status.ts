import type { AssignmentStatus } from "@/lib/db-types";

export type ShiftStatusKind =
  | "not_started"
  | "upcoming"
  | "ready_to_check_in"
  | "active_checked_in"
  | "past_unchecked"
  | "completed"
  | "open_available"
  | "open_expired";

export type ShiftStatus = {
  kind: ShiftStatusKind;
  label: string;
  description: string;
  isActive: boolean;
  isPast: boolean;
  isCompleted: boolean;
  isOpen: boolean;
  isExpired: boolean;
  canCheckIn: boolean;
  canClaim: boolean;
};

export type ShiftStatusInput = {
  scheduled_start: string;
  scheduled_end: string;
  caregiver_id?: string | null;
  assignment_status?: AssignmentStatus | null;
  is_released?: boolean | null;
};

export type ShiftCheckInInput = {
  check_in_time?: string | null;
  check_out_time?: string | null;
} | null;

const CHECK_IN_READY_WINDOW_MINUTES = 120;

export function getShiftStatus(
  shift: ShiftStatusInput,
  checkIn: ShiftCheckInInput,
  now = new Date()
): ShiftStatus {
  const start = new Date(shift.scheduled_start);
  const end = new Date(shift.scheduled_end);
  const hasCheckIn = !!checkIn?.check_in_time;
  const hasCheckOut = !!checkIn?.check_out_time;
  const isOpenShift = !shift.caregiver_id || !!shift.is_released;

  if (hasCheckIn && !hasCheckOut) {
    return makeStatus("active_checked_in");
  }

  if (hasCheckOut) {
    return makeStatus("completed");
  }

  if (isOpenShift) {
    return makeStatus(now > end ? "open_expired" : "open_available");
  }

  if (now > end) {
    return makeStatus("past_unchecked");
  }

  const readyAt = new Date(
    start.getTime() - CHECK_IN_READY_WINDOW_MINUTES * 60_000
  );

  if (
    shift.assignment_status !== "pending" &&
    shift.assignment_status !== "declined" &&
    now >= readyAt
  ) {
    return makeStatus("ready_to_check_in");
  }

  if (now < start && shift.assignment_status === "accepted") {
    return makeStatus("upcoming");
  }

  return makeStatus("not_started");
}

function makeStatus(kind: ShiftStatusKind): ShiftStatus {
  switch (kind) {
    case "active_checked_in":
      return {
        kind,
        label: "On shift now",
        description: "Checked in and not checked out",
        isActive: true,
        isPast: false,
        isCompleted: false,
        isOpen: false,
        isExpired: false,
        canCheckIn: false,
        canClaim: false,
      };
    case "completed":
      return {
        kind,
        label: "Checked out",
        description: "Completed",
        isActive: false,
        isPast: true,
        isCompleted: true,
        isOpen: false,
        isExpired: false,
        canCheckIn: false,
        canClaim: false,
      };
    case "open_available":
      return {
        kind,
        label: "Open",
        description: "Available to claim",
        isActive: false,
        isPast: false,
        isCompleted: false,
        isOpen: true,
        isExpired: false,
        canCheckIn: false,
        canClaim: true,
      };
    case "open_expired":
      return {
        kind,
        label: "Expired",
        description: "Past open shift",
        isActive: false,
        isPast: true,
        isCompleted: false,
        isOpen: true,
        isExpired: true,
        canCheckIn: false,
        canClaim: false,
      };
    case "past_unchecked":
      return {
        kind,
        label: "Missed",
        description: "Past without check-in",
        isActive: false,
        isPast: true,
        isCompleted: false,
        isOpen: false,
        isExpired: true,
        canCheckIn: false,
        canClaim: false,
      };
    case "ready_to_check_in":
      return {
        kind,
        label: "Scheduled",
        description: "Ready to check in",
        isActive: false,
        isPast: false,
        isCompleted: false,
        isOpen: false,
        isExpired: false,
        canCheckIn: true,
        canClaim: false,
      };
    case "upcoming":
      return {
        kind,
        label: "Scheduled",
        description: "Upcoming",
        isActive: false,
        isPast: false,
        isCompleted: false,
        isOpen: false,
        isExpired: false,
        canCheckIn: false,
        canClaim: false,
      };
    case "not_started":
      return {
        kind,
        label: "Scheduled",
        description: "Not started",
        isActive: false,
        isPast: false,
        isCompleted: false,
        isOpen: false,
        isExpired: false,
        canCheckIn: false,
        canClaim: false,
      };
  }
}
