import manifest from "../../../../../public/manifest.json";

export function GET() {
  return Response.json(manifest, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
