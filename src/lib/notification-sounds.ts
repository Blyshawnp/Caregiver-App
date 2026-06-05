"use client";

import type { NotificationTone } from "@/lib/notification-preferences";

type SoundKind = "message" | "normal" | "urgent";

const FREQUENCIES: Record<SoundKind | NotificationTone, number[]> = {
  message: [660, 880],
  normal: [520],
  urgent: [880, 660, 880],
  default: [520],
  soft_chime: [440, 660],
  bell: [740, 988],
  bright_alert: [784, 1046],
  urgent_alert: [880, 660, 880],
  loud_chime: [880, 880, 880],
  repeating_chime: [587, 698, 587, 698],
  urgent_tone: [988, 784, 988, 784],
  silent: [],
};

let audioContext: AudioContext | null = null;

export async function playNotificationSound(kind: SoundKind) {
  if (typeof window !== "undefined") {
    const start = localStorage.getItem("pwa_quiet_hours_start");
    const end = localStorage.getItem("pwa_quiet_hours_end");
    if (isQuietHoursNow(start, end)) {
      const urgentBypass = localStorage.getItem("pwa_urgent_override_quiet_hours") !== "false";
      const isUrgent = kind === "urgent";
      if (!isUrgent || !urgentBypass) {
        return false;
      }
    }

    const customDefault = localStorage.getItem("pwa_in_app_alert_sound") as NotificationTone | null;
    const customVolume = localStorage.getItem("pwa_in_app_alert_volume");
    const volume = customVolume !== null ? parseFloat(customVolume) : undefined;
    
    if (customDefault && customDefault !== "default") {
      if (kind === "urgent") {
        return playNotificationTone("urgent_tone", volume ?? 0.9);
      }
      return playNotificationTone(customDefault, volume);
    }
  }
  return playNotificationTone(
    mapLegacySound(kind), 
    typeof window !== "undefined" && localStorage.getItem("pwa_in_app_alert_volume") 
      ? parseFloat(localStorage.getItem("pwa_in_app_alert_volume")!) 
      : undefined
  );
}

function isQuietHoursNow(start: string | null, end: string | null) {
  if (!start || !end) return false;
  const toMinutes = (val: string) => {
    const [h, m] = val.split(":").map(Number);
    return !Number.isFinite(h) || !Number.isFinite(m) ? null : h * 60 + m;
  };
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === null || endMinutes === null || startMinutes === endMinutes) return false;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (startMinutes < endMinutes) {
    return nowMinutes >= startMinutes && nowMinutes < endMinutes;
  }
  return nowMinutes >= startMinutes || nowMinutes < endMinutes;
}

export async function playNotificationTone(
  tone: NotificationTone,
  requestedVolume?: number
) {
  if (typeof window === "undefined") return false;
  try {
    if (tone === "silent") return false;
    const enabledSetting = localStorage.getItem("notification_sound_enabled");
    if (enabledSetting === "false") {
      return false;
    }
    const volumeStr = localStorage.getItem("notification_sound_volume");
    const volume =
      typeof requestedVolume === "number"
        ? requestedVolume
        : volumeStr !== null
          ? parseFloat(volumeStr)
          : 0.8;

    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return false;
    audioContext = audioContext ?? new AudioContextClass();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const start = audioContext.currentTime;
    FREQUENCIES[tone].forEach((frequency, index) => {
      if (!audioContext) return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      // Adjust gain based on user volume preference (default 0.8, mapped to a highly readable peak gain)
      const peakGain = 0.8 * volume;

      gain.gain.setValueAtTime(0.0001, start + index * 0.16);
      gain.gain.exponentialRampToValueAtTime(peakGain, start + index * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + index * 0.16 + 0.14);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      // Support explicit audio volume setting if needed for standard HTML5 Audio objects
      if (typeof Audio !== "undefined") {
        const audio = new Audio();
        audio.volume = volume;
      }
      
      oscillator.start(start + index * 0.16);
      oscillator.stop(start + index * 0.16 + 0.15);
    });
    return true;
  } catch {
    return false;
  }
}

function mapLegacySound(kind: SoundKind): NotificationTone {
  if (kind === "message") return "bell";
  if (kind === "urgent") return "urgent_alert";
  return "default";
}
