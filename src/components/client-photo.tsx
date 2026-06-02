type ClientPhotoProps = {
  name: string;
  photoUrl?: string | null;
  size?: "sm" | "md" | "lg";
};

const sizeClasses = {
  sm: "w-10 h-10 text-sm",
  md: "w-14 h-14 text-lg",
  lg: "w-24 h-24 text-3xl",
};

export default function ClientPhoto({
  name,
  photoUrl,
  size = "md",
}: ClientPhotoProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={`${sizeClasses[size]} rounded-2xl bg-forest-100 text-forest-700 overflow-hidden grid place-items-center font-display font-semibold shrink-0 border border-cream-200`}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
      ) : (
        initials || "?"
      )}
    </div>
  );
}
