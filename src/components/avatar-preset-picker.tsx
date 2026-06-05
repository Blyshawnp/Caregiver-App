"use client";

import { useEffect, useRef, useState } from "react";
import {
  AVATAR_PRESETS,
  resolveAvatarPresetPath,
  type AvatarPreset,
} from "@/lib/avatar-presets";

type AvatarPresetGridProps = {
  selectedPath?: string | null;
  onSelect: (preset: AvatarPreset) => void;
  disabled?: boolean;
  selectedLabel?: string;
};

export function AvatarPresetGrid({
  selectedPath,
  onSelect,
  disabled = false,
  selectedLabel = "Avatar selected",
}: AvatarPresetGridProps) {
  const normalizedSelected = resolveAvatarPresetPath(selectedPath);

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      {AVATAR_PRESETS.map((preset) => {
        const selected = normalizedSelected === preset.path;
        return (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(preset)}
            className={`rounded-2xl border p-2 text-center transition disabled:opacity-60 ${
              selected
                ? "border-forest-600 bg-forest-50 ring-2 ring-forest-600/20"
                : "border-cream-200 bg-white hover:bg-cream-50"
            }`}
            aria-pressed={selected}
            aria-label={`${preset.label}${selected ? `, ${selectedLabel}` : ""}`}
          >
            <img
              src={preset.path}
              alt={`${preset.label} animal avatar`}
              className="mx-auto h-14 w-14 object-contain"
            />
            <span className="mt-1 block text-[11px] font-semibold text-ink-700">
              {preset.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

type AvatarPickerModalProps = {
  open: boolean;
  title: string;
  uploadLabel: string;
  chooseAvatarLabel: string;
  animalAvatarsLabel: string;
  saveAvatarLabel: string;
  removePhotoLabel: string;
  avatarSelectedLabel: string;
  attributionLabel: string;
  currentValue?: string | null;
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onUpload: (file: File) => Promise<boolean>;
  onSavePreset: (path: string) => Promise<boolean>;
  onRemove?: () => Promise<boolean>;
};

export default function AvatarPickerModal({
  open,
  title,
  uploadLabel,
  chooseAvatarLabel,
  animalAvatarsLabel,
  saveAvatarLabel,
  removePhotoLabel,
  avatarSelectedLabel,
  attributionLabel,
  currentValue,
  saving = false,
  error,
  onClose,
  onUpload,
  onSavePreset,
  onRemove,
}: AvatarPickerModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const resolved = resolveAvatarPresetPath(currentValue);
      setSelectedPath(resolved?.startsWith("/avatar-presets/") ? resolved : null);
    }
  }, [currentValue, open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    const ok = await onUpload(file);
    if (ok) onClose();
  }

  async function handleSavePreset() {
    if (!selectedPath) return;
    const ok = await onSavePreset(selectedPath);
    if (ok) onClose();
  }

  async function handleRemove() {
    if (!onRemove) return;
    const ok = await onRemove();
    if (ok) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[1200] bg-ink-950/75 backdrop-blur-sm p-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="fixed right-4 top-[max(env(safe-area-inset-top),1rem)] z-[1201] rounded-xl bg-white/95 px-3 py-2 text-sm font-medium text-ink-900 shadow-lifted transition hover:bg-white active:scale-[0.98]"
        aria-label="Close avatar picker"
      >
        Close
      </button>
      <div
        className="w-full max-w-lg max-h-[85dvh] overflow-y-auto rounded-3xl bg-white shadow-lifted border border-cream-200"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-5 border-b border-cream-200 flex items-center justify-between gap-3">
          <h2 className="font-display text-xl text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-cream-100 hover:bg-cream-200 text-ink-700 font-bold"
            aria-label="Close"
          >
            X
          </button>
        </div>

        <div className="p-5 space-y-5">
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">
              {uploadLabel}
            </h3>
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                void handleUpload(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => inputRef.current?.click()}
                className="rounded-xl bg-forest-600 hover:bg-forest-700 text-cream-50 px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
              >
                {uploadLabel}
              </button>
              {onRemove && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleRemove()}
                  className="rounded-xl bg-cream-100 hover:bg-cream-200 text-ink-700 px-4 py-2 text-sm font-semibold transition disabled:opacity-60"
                >
                  {removePhotoLabel}
                </button>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-ink-500">
                  {chooseAvatarLabel}
                </h3>
                <p className="text-sm text-ink-700 font-medium">{animalAvatarsLabel}</p>
              </div>
              <button
                type="button"
                disabled={saving || !selectedPath}
                onClick={() => void handleSavePreset()}
                className="rounded-xl bg-forest-600 hover:bg-forest-700 text-cream-50 px-4 py-2 text-sm font-semibold transition disabled:opacity-50"
              >
                {saveAvatarLabel}
              </button>
            </div>
            <AvatarPresetGrid
              selectedPath={selectedPath}
              onSelect={(preset) => setSelectedPath(preset.path)}
              disabled={saving}
              selectedLabel={avatarSelectedLabel}
            />
          </section>

          {error && <p className="text-sm text-terracotta-600 font-medium">{error}</p>}

          <p className="border-t border-cream-200 pt-3 text-[11px] text-ink-500">
            <a
              href="https://www.vecteezy.com/free-png/animal-icons"
              target="_blank"
              rel="noreferrer"
              className="text-forest-700 hover:underline"
            >
              {attributionLabel}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
