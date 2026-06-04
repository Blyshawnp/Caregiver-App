"use client";

import { useEffect, useState } from "react";

type IntroVideoSettingsState = {
  intro_video_url: string | null;
  intro_video_enabled: boolean;
  show_intro_video_on_first_login: boolean;
};

export default function IntroVideoSettings({ canManage }: { canManage: boolean }) {
  const [settings, setSettings] = useState<IntroVideoSettingsState>({
    intro_video_url: null,
    intro_video_enabled: false,
    show_intro_video_on_first_login: false,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/intro-video/settings", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setSettings({
            intro_video_url: data.intro_video_url ?? null,
            intro_video_enabled: !!data.intro_video_enabled,
            show_intro_video_on_first_login: !!data.show_intro_video_on_first_login,
          });
        }
      })
      .catch(() => null);
  }, []);

  async function save() {
    setSaving(true);
    setStatus(null);
    setError(null);
    const response = await fetch("/api/intro-video/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const data = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      setError(data?.error ?? "Intro video settings could not be saved.");
      return;
    }
    setSettings({
      intro_video_url: data.intro_video_url ?? null,
      intro_video_enabled: !!data.intro_video_enabled,
      show_intro_video_on_first_login: !!data.show_intro_video_on_first_login,
    });
    setStatus("Intro video settings saved.");
  }

  return (
    <section className="bg-white rounded-3xl p-6 shadow-soft border border-cream-150">
      <h2 className="font-display text-lg text-ink-900 mb-1">Introduction Video</h2>
      <p className="text-xs text-ink-500 mb-4">
        Add an optional YouTube or Vimeo intro video for the tutorial and Help page. If no valid video is configured, the app skips the video area.
      </p>
      {!canManage ? (
        <p className="text-xs text-ink-600 bg-cream-50 border border-cream-200 rounded-xl p-3">
          Intro video settings are managed by an admin.
        </p>
      ) : (
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-ink-700">
            Video URL
            <input
              type="url"
              value={settings.intro_video_url ?? ""}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  intro_video_url: event.target.value,
                }))
              }
              placeholder="https://www.youtube.com/watch?v=..."
              className="mt-1 w-full bg-cream-50 border border-cream-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-forest-600"
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs font-semibold text-ink-800">
            Enable intro video
            <input
              type="checkbox"
              checked={settings.intro_video_enabled}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  intro_video_enabled: event.target.checked,
                }))
              }
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs font-semibold text-ink-800">
            Show during first-login tutorial
            <input
              type="checkbox"
              checked={settings.show_intro_video_on_first_login}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  show_intro_video_on_first_login: event.target.checked,
                }))
              }
            />
          </label>
          {error && <p className="text-xs font-semibold text-terracotta-600">{error}</p>}
          {status && <p className="text-xs font-semibold text-forest-650">{status}</p>}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="bg-forest-600 hover:bg-forest-700 text-cream-50 px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save intro video"}
          </button>
        </div>
      )}
    </section>
  );
}
