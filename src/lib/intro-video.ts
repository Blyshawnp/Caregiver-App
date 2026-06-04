export function getSafeIntroVideoEmbedUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;
    if (url.hostname === "youtu.be") {
      const id = url.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (
      url.hostname === "youtube.com" ||
      url.hostname === "www.youtube.com" ||
      url.hostname === "m.youtube.com"
    ) {
      const id = url.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (url.pathname.startsWith("/embed/")) return url.toString();
    }
    if (url.hostname === "vimeo.com" || url.hostname === "www.vimeo.com") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (url.hostname === "player.vimeo.com" && url.pathname.startsWith("/video/")) {
      return url.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function isAllowedIntroVideoUrl(value: string | null | undefined) {
  return !value || getSafeIntroVideoEmbedUrl(value) !== null;
}
