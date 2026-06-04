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
            className="fixed inset-0 z-[1000] bg-ink-950/75 backdrop-blur-sm overflow-y-auto p-4 pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]"
            onClick={() => setPreviewOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={`${name} photo preview`}
          >
            <div
              className="min-h-[calc(100dvh-2rem)] flex items-center justify-center"
            >
              <div
                className="bg-white rounded-3xl shadow-lifted max-w-3xl w-full max-h-[92dvh] p-4 flex flex-col"
                onClick={(event) => event.stopPropagation()}
              >
                <img
                  src={photoUrl}
                  alt={`${name} profile photo`}
                  className="w-full max-h-[80dvh] object-contain rounded-2xl bg-cream-100"
                  onError={() => setFailed(true)}
                />
                <button
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  className="mt-3 w-full bg-cream-100 hover:bg-cream-200 text-ink-800 py-2.5 rounded-xl text-sm font-medium transition"
                  aria-label="Close photo preview"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return content;
}
