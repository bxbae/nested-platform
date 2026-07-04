import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "../lib/cn";
import { Badge } from "../atoms/Badge";

// ── SearchBar ── sticky/floating variants (organism Navbar composes it)
export interface SearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: "default" | "floating";
  onSubmitValue?: (value: string) => void;
}
export const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  ({ className, variant = "default", onSubmitValue, ...props }, ref) => (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-full border border-border bg-surface px-4",
        variant === "floating" ? "h-14 shadow-md" : "h-11 shadow-sm",
        "focus-within:border-secondary focus-within:ring-2 focus-within:ring-secondary/30",
        className
      )}
    >
      <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <input
        ref={ref}
        className="flex-1 bg-transparent text-[0.95rem] outline-none placeholder:text-muted-foreground"
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmitValue?.((e.target as HTMLInputElement).value);
        }}
        {...props}
      />
    </div>
  )
);
SearchBar.displayName = "SearchBar";

// ── PriceTag ── monthly rent, formatted KRW
export function PriceTag({
  amount,
  period = "월",
  className,
  size = "md",
}: {
  amount: number;
  period?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const formatted = new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(amount);
  return (
    <span className={cn("inline-flex items-baseline gap-1", className)}>
      <strong
        className={cn(
          "font-bold tracking-tight",
          size === "sm" ? "text-[0.95rem]" : size === "lg" ? "text-2xl" : "text-lg"
        )}
      >
        {formatted}
      </strong>
      <span className="text-sm text-muted-foreground">/ {period}</span>
    </span>
  );
}

// ── FilterChip ── chip carrying a removable applied filter
export function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove?: () => void;
}) {
  return (
    <Badge variant="outline" className="gap-1.5 py-1 pl-3 pr-1.5">
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${label} 필터 제거`}
          className="grid h-4 w-4 place-items-center rounded-full hover:bg-surface-2"
        >
          ×
        </button>
      )}
    </Badge>
  );
}
