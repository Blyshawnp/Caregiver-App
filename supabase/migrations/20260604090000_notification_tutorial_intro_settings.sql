alter table public.notification_preferences
  add column if not exists category_preferences jsonb not null default '{}'::jsonb,
  add column if not exists privacy_safe_bodies boolean not null default true,
  add column if not exists quiet_hours_start time null,
  add column if not exists quiet_hours_end time null,
  add column if not exists urgent_override_quiet_hours boolean not null default true;

alter table public.profiles
  add column if not exists tutorial_completed boolean not null default false,
  add column if not exists tutorial_completed_at timestamptz null,
  add column if not exists tutorial_skipped_at timestamptz null,
  add column if not exists onboarding_checklist_dismissed boolean not null default false;

alter table public.organizations
  add column if not exists intro_video_url text null,
  add column if not exists intro_video_enabled boolean not null default false,
  add column if not exists show_intro_video_on_first_login boolean not null default false;
