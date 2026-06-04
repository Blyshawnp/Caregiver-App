import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isAllowedIntroVideoUrl } from "@/lib/intro-video";

type IntroVideoPayload = {
  intro_video_url?: string | null;
  intro_video_enabled?: boolean;
  show_intro_video_on_first_login?: boolean;
};

export async function GET() {
  const context = await getContext();
  if ("response" in context) return context.response;
  const { admin, organizationId } = context;
  const { data, error } = await admin
    .from("organizations")
    .select("intro_video_url, intro_video_enabled, show_intro_video_on_first_login")
    .eq("id", organizationId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(
    data ?? {
      intro_video_url: null,
      intro_video_enabled: false,
      show_intro_video_on_first_login: false,
    }
  );
}

export async function PATCH(request: Request) {
  const context = await getContext();
  if ("response" in context) return context.response;
  const { admin, organizationId, role } = context;
  if (role !== "admin" && role !== "client") {
    return NextResponse.json({ error: "Only admins can update intro video settings." }, { status: 403 });
  }
  const payload = (await request.json().catch(() => ({}))) as IntroVideoPayload;
  const url = typeof payload.intro_video_url === "string" ? payload.intro_video_url.trim() : payload.intro_video_url ?? null;
  if (!isAllowedIntroVideoUrl(url)) {
    return NextResponse.json({ error: "Use a valid YouTube or Vimeo HTTPS URL." }, { status: 400 });
  }
  const update = {
    intro_video_url: url || null,
    intro_video_enabled: !!payload.intro_video_enabled,
    show_intro_video_on_first_login: !!payload.show_intro_video_on_first_login,
  };
  const { data, error } = await admin
    .from("organizations")
    .update(update)
    .eq("id", organizationId)
    .select("intro_video_url, intro_video_enabled, show_intro_video_on_first_login")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

async function getContext() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await admin
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .maybeSingle<{ role: string; organization_id: string | null }>();
  if (!profile?.organization_id) {
    return { response: NextResponse.json({ error: "Organization not found" }, { status: 403 }) };
  }
  return { admin, organizationId: profile.organization_id, role: profile.role };
}
