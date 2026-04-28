import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { format } from "date-fns";

export default async function ShiftsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="p-6">
        <p className="text-red-600">You must be logged in.</p>
      </main>
    );
  }

  // Load shifts with caregiver + client + shift type
  const { data: shifts, error } = await supabase
    .from("shifts")
    .select(`
      id,
      start_time,
      end_time,
      notes,
      bonus_amount,
      profiles:caregiver_id (
        full_name
      ),
      clients (
        name
      ),
      shift_types (
        name,
        color
      )
    `)
    .order("start_time", { ascending: true });

  if (error) {
    console.error(error);
    return (
      <main className="p-6">
        <p className="text-red-600">Error loading shifts.</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-5 py-10 max-w-2xl mx-auto">
      <header className="mb-10">
        <h1 className="font-display text-4xl text-ink-900 leading-tight">
          Upcoming Shifts
        </h1>
      </header>

      {shifts.length === 0 && (
        <p className="text-ink-600">No shifts scheduled.</p>
      )}

      <div className="space-y-5">
        {shifts.map((shift) => {
          const start = new Date(shift.start_time);
          const end = new Date(shift.end_time);

          return (
            <div
              key={shift.id}
              className="grain-overlay bg-cream-50 border border-cream-200 rounded-3xl p-5 shadow-sm"
            >
              {/* Shift Type */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="inline-block w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: shift.shift_types?.[0]?.color || "#2F4F3E",
                  }}
                />
                <h2 className="text-xl font-display">
                  {shift.shift_types?.name || "Shift"}
                </h2>
              </div>

              {/* Time */}
              <p className="text-ink-700 mb-1">
                {format(start, "h:mm a")} → {format(end, "h:mm a")}
              </p>

              {/* Caregiver + Client */}
              <p className="text-ink-600 mb-2">
                {shift.profiles?.full_name} • {shift.clients?.name}
              </p>

              {/* Notes */}
              <p className="text-ink-500 text-sm">
                <span className="font-semibold">Notes:</span>{" "}
                {shift.notes?.trim() ? shift.notes : "none"}
              </p>

              {/* Bonus */}
              {shift.bonus_amount && (
                <p className="text-ink-500 text-sm mt-1">
                  <span className="font-semibold">Bonus:</span> $
                  {shift.bonus_amount}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
