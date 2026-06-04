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
  silent: [],
};

let audioContext: AudioContext | null = null;

export async function playNotificationSound(kind: SoundKind) {
  return playNotificationTone(mapLegacySound(kind));
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
