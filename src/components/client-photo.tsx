"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type ClientPhotoProps = {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "w-10 h-10 text-sm",
  md: "w-14 h-14 text-lg",
  lg: "w-24 h-24 text-3xl",
};

export default function ClientPhoto({
  name,
  photoUrl,
  size = "md",
}: ClientPhotoProps) {
  const [failed, setFailed] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    setFailed(false);
  }, [photoUrl]);

  useEffect(() => {
    if (!previewOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPreviewOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewOpen]);

  useEffect(() => {
    if (previewOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [previewOpen]);

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const content = (
    <div
      className={`${sizeClasses[size]} rounded-2xl bg-forest-100 text-forest-700 overflow-hidden grid place-items-center font-display font-semibold shrink-0 border border-cream-200`}
    >
      {photoUrl && !failed ? (
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials || "?"
      )}
    </div>
  );

  const preview = previewOpen && photoUrl && !failed && mounted && createPortal(
    <div
      className="fixed inset-0 z-[1200] bg-ink-950/80 backdrop-blur-sm p-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-center justify-center cursor-pointer"
      onClick={() => setPreviewOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label={`${name} photo preview`}
    >
      <div
        className="bg-white rounded-3xl shadow-lifted w-[calc(100vw-2rem)] max-w-[420px] max-h-[85dvh] p-5 flex flex-col cursor-default"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-ink-900 truncate pr-2">
            {name}
          </h3>
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            className="bg-cream-100 hover:bg-cream-200 text-ink-700 px-3 py-1.5 rounded-xl text-xs font-semibold transition shrink-0"
          >
            Close
          </button>
        </div>

        {/* Image Container */}
        <div className="w-full flex justify-center items-center bg-cream-50 rounded-2xl p-2 overflow-hidden mb-4">
          <img
            src={photoUrl}
            alt={`${name} profile photo`}
            className="object-contain rounded-xl mx-auto"
            style={{ maxWidth: "min(280px, 70vw)", maxHeight: "min(320px, 45dvh)" }}
            onError={() => setFailed(true)}
          />
        </div>

        {/* Actions */}
        <div className="w-full flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen(false)}
            className="w-full text-center bg-cream-100 hover:bg-cream-200 text-ink-700 py-2.5 rounded-xl text-xs font-semibold transition"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

  if (photoUrl && !failed) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          className="rounded-2xl transition active:scale-95"
          aria-label={`Preview ${name} photo`}
        >
          {content}
        </button>
        {preview}
      </>
    );
  }

  return content;
}
