"use client";

type SoundKind = "message" | "normal" | "urgent";

const FREQUENCIES: Record<SoundKind, number[]> = {
  message: [660, 880],
  normal: [520],
  urgent: [880, 660, 880],
};

let audioContext: AudioContext | null = null;

export async function playNotificationSound(kind: SoundKind) {
  if (typeof window === "undefined") return false;
  try {
    const enabledSetting = localStorage.getItem("notification_sound_enabled");
    if (enabledSetting === "false") {
      return false;
    }
    const volumeStr = localStorage.getItem("notification_sound_volume");
    const volume = volumeStr !== null ? parseFloat(volumeStr) : 0.8;

    const AudioContextClass = window.AudioContext;
    if (!AudioContextClass) return false;
    audioContext = audioContext ?? new AudioContextClass();
    if (audioContext.state === "suspended") {
      await audioContext.resume();
    }

    const start = audioContext.currentTime;
    FREQUENCIES[kind].forEach((frequency, index) => {
      if (!audioContext) return;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;

      // Adjust gain based on user volume preference (default 0.8, mapped to an appropriate peak gain)
      const peakGain = 0.3 * volume;

      gain.gain.setValueAtTime(0.0001, start + index * 0.16);
      gain.gain.exponentialRampToValueAtTime(peakGain, start + index * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + index * 0.16 + 0.14);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      // Support explicit audio volume setting if needed for standard HTML5 Audio objects
      // e.g. const audio = new Audio(); audio.volume = volume;
      
      oscillator.start(start + index * 0.16);
      oscillator.stop(start + index * 0.16 + 0.15);
    });
    return true;
  } catch {
    return false;
  }
}
