import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type TutorialPayload = {
  completed?: boolean;
  skipped?: boolean;
  onboardingChecklistDismissed?: boolean;
};

export async function POST(request: Request) {
  return updateTutorialState(request);
}

export async function PATCH(request: Request) {
  return updateTutorialState(request);
}

async function updateTutorialState(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as TutorialPayload;
  const update: Record<string, unknown> = {};
  if (typeof payload.completed === "boolean") {
    update.tutorial_completed = payload.completed;
    update.tutorial_completed_at = payload.completed ? new Date().toISOString() : null;
    if (!payload.completed) update.tutorial_skipped_at = null;
  } else if (typeof payload.skipped === "boolean") {
    update.tutorial_completed = true;
    update.tutorial_completed_at = new Date().toISOString();
    update.tutorial_skipped_at = payload.skipped ? new Date().toISOString() : null;
  }
  if (typeof payload.onboardingChecklistDismissed === "boolean") {
    update.onboarding_checklist_dismissed = payload.onboardingChecklistDismissed;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
