type AvatarSize = "xs" | "sm" | "md" | "lg";

export type AvatarProfile = {
  full_name: string | null;
  avatar_url?: string | null;
  avatar_color?: string | null;
};

const sizeClasses: Record<AvatarSize, string> = {
  xs: "w-7 h-7 text-[10px]",
  sm: "w-9 h-9 text-xs",
  md: "w-11 h-11 text-base",
  lg: "w-14 h-14 text-2xl",
};

export default function UserAvatar({
  person,
  size = "md",
  className = "",
}: {
  person: AvatarProfile;
  size?: AvatarSize;
  className?: string;
}) {
  const name = person.full_name?.trim() || "Unknown";
  const initials = getInitials(name);
  const color = person.avatar_color ?? "#3F6053";
  const base =
    "rounded-full grid place-items-center font-display shrink-0 overflow-hidden ring-1 ring-black/5";

  if (person.avatar_url) {
    return (
      <span className={`${base} bg-cream-200 ${sizeClasses[size]} ${className}`}>
        <img
          src={person.avatar_url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </span>
    );
  }

  return (
    <span
      className={`${base} text-cream-50 ${sizeClasses[size]} ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function getInitials(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}
