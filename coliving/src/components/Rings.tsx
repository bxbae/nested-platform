export function Rings({ size = 26 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <circle cx="15" cy="20" r="11" stroke="var(--primary)" strokeWidth="2.4" />
      <circle cx="25" cy="20" r="11" stroke="var(--secondary)" strokeWidth="2.4" />
    </svg>
  );
}
