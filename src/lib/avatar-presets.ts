export type AvatarPresetId =
  | "cat"
  | "dinosaur"
  | "dog"
  | "fish"
  | "frog"
  | "koala"
  | "ladybug"
  | "panda"
  | "paw"
  | "pig"
  | "sea-turtle"
  | "star-fish"
  | "tiger";

export type AvatarPreset = {
  id: AvatarPresetId;
  label: string;
  path: string;
};

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: "cat", label: "Cat", path: "/avatar-presets/cat.png" },
  { id: "dinosaur", label: "Dinosaur", path: "/avatar-presets/dinosaur.png" },
  { id: "dog", label: "Dog", path: "/avatar-presets/dog.png" },
  { id: "fish", label: "Fish", path: "/avatar-presets/fish.png" },
  { id: "frog", label: "Frog", path: "/avatar-presets/frog.png" },
  { id: "koala", label: "Koala", path: "/avatar-presets/koala.png" },
  { id: "ladybug", label: "Ladybug", path: "/avatar-presets/ladybug.png" },
  { id: "panda", label: "Panda", path: "/avatar-presets/panda.png" },
  { id: "paw", label: "Paw", path: "/avatar-presets/paw.png" },
  { id: "pig", label: "Pig", path: "/avatar-presets/pig.png" },
  { id: "sea-turtle", label: "Sea Turtle", path: "/avatar-presets/sea-turtle.png" },
  { id: "star-fish", label: "Starfish", path: "/avatar-presets/star-fish.png" },
  { id: "tiger", label: "Tiger", path: "/avatar-presets/tiger.png" },
];

const PRESET_BY_ID = new Map(AVATAR_PRESETS.map((preset) => [preset.id, preset]));

const LEGACY_PRESET_MAP: Record<string, AvatarPresetId> = {
  bird: "paw",
  bunny: "paw",
  cat: "cat",
  dog: "dog",
  lion: "tiger",
  squirrel: "paw",
};

export function resolveAvatarPresetPath(value: string | null | undefined) {
  if (!value?.startsWith("/avatar-presets/")) return value ?? null;

  const filename = value.split("/").pop() ?? "";
  const id = filename.replace(/\.(svg|png|jpg|jpeg|webp)$/i, "");
  const preset = PRESET_BY_ID.get(id as AvatarPresetId);
  if (preset) return preset.path;

  const legacyPreset = LEGACY_PRESET_MAP[id];
  return legacyPreset ? PRESET_BY_ID.get(legacyPreset)?.path ?? null : value;
}

export function isAvatarPresetPath(value: string | null | undefined) {
  return Boolean(resolveAvatarPresetPath(value)?.startsWith("/avatar-presets/"));
}
