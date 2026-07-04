import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";

// ── Badge ── status meaning always pairs color + text (never color alone, AA)
export const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        neutral: "bg-surface-2 text-muted-foreground",
        primary: "bg-primary/12 text-primary",
        secondary: "bg-secondary/12 text-secondary",
        success: "bg-success/15 text-[rgb(30_140_60)] dark:text-success",
        warning: "bg-warning/18 text-[rgb(150_100_0)] dark:text-warning",
        destructive: "bg-destructive/12 text-destructive",
        outline: "border border-border text-foreground",
      },
    },
    defaultVariants: { variant: "neutral" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// ── Chip ── interactive filter pill (selectable)
export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}
export const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, active, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-surface text-muted-foreground hover:border-foreground",
        className
      )}
      {...props}
    />
  )
);
Chip.displayName = "Chip";
