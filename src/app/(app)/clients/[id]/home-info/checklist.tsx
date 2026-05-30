import React from "react";

type ChecklistProps = {
  isGeofenceSet: boolean;
  isContactsAdded: boolean;
  isPetsConfigured: boolean;
  isGuideConfigured: boolean;
  isNotesAdded: boolean;
  isAllergiesConfigured: boolean;
};

export default function ClientChecklist({
  isGeofenceSet,
  isContactsAdded,
  isPetsConfigured,
  isGuideConfigured,
  isNotesAdded,
  isAllergiesConfigured,
}: ChecklistProps) {
  const items = [
    { label: "Address & Geofence configured", done: isGeofenceSet },
    { label: "Emergency contacts registered", done: isContactsAdded },
    { label: "Medication & allergy info logged", done: isAllergiesConfigured },
    { label: "Emergency preparedness guide active", done: isGuideConfigured },
    { label: "Pet records logged", done: isPetsConfigured },
    { label: "Home notes for caregivers added", done: isNotesAdded },
  ];

  const completedCount = items.filter((i) => i.done).length;
  const pct = Math.round((completedCount / items.length) * 100);

  return (
    <section className="bg-white rounded-3xl shadow-soft p-5 border border-cream-200/50 mb-5 grain-overlay">
      <div className="relative">
        <div className="flex justify-between items-baseline mb-3">
          <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink-900">
            Profile Completion Checklist
          </h2>
          <span className="text-xs font-semibold text-forest-700 bg-forest-50 px-2 py-0.5 rounded-lg">
            {completedCount} of {items.length} complete ({pct}%)
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2 bg-cream-100 rounded-full mb-4 overflow-hidden">
          <div
            className="h-full bg-forest-600 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          {items.map((item, idx) => (
            <li key={idx} className="flex items-center gap-2">
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center border font-bold text-[9px] shrink-0 ${
                  item.done
                    ? "bg-forest-600 border-forest-600 text-cream-50"
                    : "border-cream-300 text-ink-300"
                }`}
              >
                {item.done ? "✓" : ""}
              </span>
              <span className={item.done ? "text-ink-800 font-medium" : "text-ink-400"}>
                {item.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
