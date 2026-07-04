import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { Loader2 } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/cn";
import { Button, type ButtonProps } from "./Button";

// ── Avatar ───────────────────────────────────────────────────
const avatarSizes = cva("relative flex shrink-0 overflow-hidden rounded-full", {
  variants: { size: { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-14 w-14" } },
  defaultVariants: { size: "md" },
});
export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarSizes> {
  src?: string;
  name?: string;
  verified?: boolean;
}
export const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  AvatarProps
>(({ className, size, src, name, verified, ...props }, ref) => {
  const initials = (name ?? "")
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className={cn("relative inline-block", verified && "ring-2 ring-secondary rounded-full")}>
      <AvatarPrimitive.Root ref={ref} className={cn(avatarSizes({ size }), className)} {...props}>
        <AvatarPrimitive.Image src={src} alt={name ?? ""} className="h-full w-full object-cover" />
        <AvatarPrimitive.Fallback
          className="flex h-full w-full items-center justify-center bg-surface-2 text-sm font-semibold text-muted-foreground"
          delayMs={200}
        >
          {initials || "?"}
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
    </span>
  );
});
Avatar.displayName = "Avatar";

// ── Skeleton ─────────────────────────────────────────────────
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative overflow-hidden rounded-md bg-surface-2",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer",
        "after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent",
        className
      )}
      {...props}
    />
  );
}

// ── Spinner ──────────────────────────────────────────────────
export function Spinner({ className }: { className?: string }) {
  return (
    <Loader2
      className={cn("h-5 w-5 animate-spin text-muted-foreground", className)}
      role="status"
      aria-label="로딩 중"
    />
  );
}

// ── Divider ──────────────────────────────────────────────────
export function Divider({
  className,
  orientation = "horizontal",
}: {
  className?: string;
  orientation?: "horizontal" | "vertical";
}) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "bg-border",
        orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch",
        className
      )}
    />
  );
}

// ── IconButton ── 44px hit target enforced via size="icon"
export const IconButton = React.forwardRef<HTMLButtonElement, ButtonProps & { label: string }>(
  ({ label, variant = "ghost", ...props }, ref) => (
    <Button ref={ref} size="icon" variant={variant} aria-label={label} {...props} />
  )
);
IconButton.displayName = "IconButton";
