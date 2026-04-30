"use client";

import { useEffect, useState } from "react";
import { ClockIcon } from "@/components/icons";

export default function LiveOnShiftCard({
  checkInTime,
  scheduledEnd,
}: {
  checkInTime: string;
  scheduledEnd: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const start = new Date(checkInTime);
  const end = new Date(scheduledEnd);
  const elapsedMin = Math.max(
    0,
    Math.floor((now.getTime() - start.getTime()) / 60_000)
  );
  const hours = Math.floor(elapsedMin / 60);
  const mins = elapsedMin % 60;
  const pastScheduled = now > end;

  return (
    <div className="bg-terracotta-500 text-cream-50 rounded-2xl px-5 py-4 flex items-center gap-4 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-12 -right-10 w-32 h-32 rounded-full bg-cream-50/10 blur-2xl"
      />
      <div className="relative w-9 h-9 rounded-full bg-cream-50/15 grid place-items-center shrink-0">
        <ClockIcon size={18} />
      </div>
      <div className="relative flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-[0.18em] text-cream-50/70 mb-0.5 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-cream-50 animate-pulse" />
          On shift now
        </p>
        <p className="font-display text-xl leading-tight">
          {hours > 0 ? `${hours}h ${mins}m` : `${mins} min`} elapsed
        </p>
        <p className="text-xs text-cream-50/80">
          Started {formatTime(start)}
          {pastScheduled && (
            <span className="ml-2 bg-cream-50/15 px-1.5 py-0.5 rounded font-medium">
              past scheduled end
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
