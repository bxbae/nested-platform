type UserAvatarProps = {
  name?: string | null;
  avatarUrl?: string | null;
  avatarColor?: string | null;
  size?: number;
  fontSize?: number;
  className?: string;
};

export function UserAvatar({
  name,
  avatarUrl,
  avatarColor,
  size = 40,
  fontSize,
  className,
}: UserAvatarProps) {
  const fallback = (name?.trim().charAt(0) || "?").toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${name ?? "사용자"} 프로필 사진`}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          objectFit: "cover",
          display: "block",
          flexShrink: 0,
          border: "1px solid var(--border)",
        }}
      />
    );
  }

  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: avatarColor ?? "#FF5A5F",
        display: "inline-grid",
        placeItems: "center",
        color: "#fff",
        fontWeight: 700,
        fontSize: fontSize ?? Math.max(12, Math.round(size * 0.36)),
        flexShrink: 0,
      }}
    >
      {fallback}
    </span>
  );
}
