"use client";

type NotificationRequest =
  | {
      type: "check_in_flagged" | "check_out_flagged";
      shiftId: string;
      flagReason: string | null;
    }
  | {
      type: "shift_released";
      shiftId: string;
      reason?: string | null;
    }
  | {
      type: "shift_claimed";
      shiftId: string;
    }
  | {
      type: "left_geofence" | "auto_check_out";
      shiftId: string;
      distanceMeters: number;
    }
  | {
      type: "time_adjusted";
      shiftId: string;
      reason: string;
    }
  | {
      type: "force_check_out";
      shiftId: string;
      reason?: string | null;
    }
  | {
      type: "new_message";
      recipientId: string;
      preview: string;
    };

export async function sendNotificationEvent(payload: NotificationRequest) {
  try {
    await fetch("/api/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Notifications are best effort.
  }
}
