import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileLayout from "../profile-layout";

export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role, email, phone, avatar_url, avatar_color")
    .eq("id", id)
    .single();

  if (!profile) return notFound();

  return <ProfileLayout profile={profile} />;
}
