import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import TasksView from "./tasks-view";
import { CheckSquareIcon } from "@/components/icons";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ shift?: string }>;
}) {
  const { shift: shiftParam } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single<{ id: string; role: "admin" | "client" | "caregiver" }>();

  if (!profile) redirect("/login");

  // Find the shift to focus on:
  // 1. Explicit ?shift=ID
  // 2. Currently checked in (caregiver)
  // 3. Next assigned upcoming shift (caregiver)
  // 4. Next any shift (admin/client)
  let shiftId: string | null = shiftParam ?? null;

  if (!shiftId) {
    if (profile.role === "caregiver") {
      const { data: active } = await supabase
        .from("shifts")
        .select("id, check_ins!inner(check_in_time, check_out_time)")
        .eq("caregiver_id", profile.id)
        .is("check_ins.check_out_time", null)
        .not("check_ins.check_in_time", "is", null)
        .limit(1)
        .maybeSingle();
      shiftId = (active as any)?.id ?? null;

      if (!shiftId) {
        const { data: upcoming } = await supabase
          .from("shifts")
          .select("id")
          .eq("caregiver_id", profile.id)
          .eq("assignment_status", "accepted")
          .gte("scheduled_end", new Date().toISOString())
          .order("scheduled_start", { ascending: true })
          .limit(1)
          .maybeSingle();
        shiftId = (upcoming as any)?.id ?? null;
      }
    } else {
      const { data: upcoming } = await supabase
        .from("shifts")
        .select("id")
        .gte("scheduled_end", new Date().toISOString())
        .order("scheduled_start", { ascending: true })
        .limit(1)
        .maybeSingle();
      shiftId = (upcoming as any)?.id ?? null;
    }
  }

  // Top of page also shows the master templates link for admin/client
  const canManageTemplates = profile.role !== "caregiver";

  if (!shiftId) {
    return (
      <main className="px-5 py-6 max-w-2xl mx-auto">
        <header className="mb-6">
          <h1 className="font-display text-3xl text-ink-900">Tasks</h1>
          <p className="text-ink-500 text-sm">
            Per-shift to-do lists
          </p>
        </header>
        <div className="bg-white rounded-3xl p-10 shadow-soft text-center grain-overlay mb-4">
          <div className="relative">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-cream-200 grid place-items-center text-ink-500">
              <CheckSquareIcon size={22} />
            </div>
            <p className="font-display text-lg mb-1">Nothing active</p>
            <p className="text-sm text-ink-500">
              {profile.role === "caregiver"
                ? "Tasks appear when you're on a shift or have an upcoming one."
                : "Tasks appear when there's an active or upcoming shift."}
            </p>
          </div>
        </div>
        {canManageTemplates && <ManageTemplatesLink />}
      </main>
    );
  }

  const { data: shift } = await supabase
    .from("shifts")
    .select(
      `
      id,
      caregiver_id,
      scheduled_start,
      scheduled_end,
      organization_id,
      clients ( full_name ),
      check_ins ( check_in_time, check_out_time ),
      shift_todos (
        id,
        task_name,
        description,
        is_completed,
        completed_at,
        sort_order,
        notes
      )
    `
    )
    .eq("id", shiftId)
    .single();

  if (!shift) redirect("/schedule");

  const shiftAny = shift as any;
  const todos = (shiftAny.shift_todos ?? []).sort((a: any, b: any) => {
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });

  const isAssignedCaregiver =
    profile.role === "caregiver" && profile.id === shiftAny.caregiver_id;
  const checkIn = shiftAny.check_ins?.[0];
  const isOnShift = !!checkIn?.check_in_time && !checkIn?.check_out_time;

  return (
    <main className="px-5 py-6 max-w-2xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl text-ink-900">Tasks</h1>
        <p className="text-ink-500 text-sm">
          {shiftAny.clients?.[0]?.full_name ?? "Client"} ·{" "}
          {formatDateTime(new Date(shiftAny.scheduled_start))}
          {isOnShift && (
            <span className="ml-2 text-[10px] uppercase tracking-wider bg-terracotta-500 text-cream-50 px-1.5 py-0.5 rounded font-medium">
              On shift
            </span>
          )}
        </p>
      </header>

      <TasksView
        shiftId={shiftAny.id}
        todos={todos}
        canEdit={isAssignedCaregiver || profile.role !== "caregiver"}
        canCompleteTasks={isAssignedCaregiver}
        currentUserId={profile.id}
      />

      {canManageTemplates && (
        <div className="mt-6">
          <ManageTemplatesLink />
        </div>
      )}
    </main>
  );
}

function ManageTemplatesLink() {
  return (
    <Link
      href="/tasks/templates"
      className="flex items-center gap-3 bg-white hover:bg-cream-50 px-5 py-4 rounded-2xl shadow-soft transition active:scale-[0.99]"
    >
      <span className="w-9 h-9 rounded-xl bg-forest-100 text-forest-600 grid place-items-center shrink-0">
        <CheckSquareIcon size={18} />
      </span>
      <div className="flex-1">
        <p className="font-medium text-ink-900">Master task templates</p>
        <p className="text-xs text-ink-500">
          Manage the master list of tasks
        </p>
      </div>
    </Link>
  );
}

function formatDateTime(d: Date) {
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
