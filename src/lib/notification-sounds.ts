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
      gain.gain.setValueAtTime(0.0001, start + index * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.06, start + index * 0.16 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + index * 0.16 + 0.14);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start(start + index * 0.16);
      oscillator.stop(start + index * 0.16 + 0.15);
    });
    return true;
  } catch {
    return false;
  }
}
