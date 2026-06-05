"use client";

import { useEffect, useState } from "react";

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
        {previewOpen && (
          <div
            className="fixed inset-0 z-[1200] bg-ink-950/80 backdrop-blur-sm p-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)] flex items-center justify-center"
            onClick={() => setPreviewOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`${name} photo preview`}
          >
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="fixed right-4 top-[max(env(safe-area-inset-top),1rem)] z-[1201] bg-white/95 hover:bg-white text-ink-900 px-3 py-2 rounded-xl text-sm font-medium shadow-lifted"
              aria-label="Close photo preview"
            >
              Close
            </button>
            <div
              className="w-full max-w-3xl"
            >
              <div
                className="bg-white rounded-3xl shadow-lifted w-full max-h-[85dvh] p-3 flex flex-col"
                onClick={(event) => event.stopPropagation()}
              >
                <img
                  src={photoUrl}
                  alt={`${name} profile photo`}
                  className="w-full max-h-[76dvh] object-contain rounded-2xl bg-cream-100"
                  onError={() => setFailed(true)}
                />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return content;
}
