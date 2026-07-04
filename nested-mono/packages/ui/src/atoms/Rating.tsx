import * as React from "react";
import * as SwitchPrimitive from "@radix-ui/react-switch";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Star } from "lucide-react";
import { cn } from "../lib/cn";

// ── Rating ── read-only or interactive star rating
export interface RatingProps {
  value: number; // 0..5
  count?: number; // review count to show alongside
  onChange?: (v: number) => void;
  size?: number;
  className?: string;
}
export function Rating({ value, count, onChange, size = 16, className }: RatingProps) {
  const interactive = !!onChange;
  const [hover, setHover] = React.useState<number | null>(null);
  const shown = hover ?? value;
  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <div
        className="inline-flex"
        role={interactive ? "radiogroup" : "img"}
        aria-label={`평점 ${value} / 5`}
      >
        {[1, 2, 3, 4, 5].map((i) => {
          const filled = i <= Math.round(shown);
          const Star_ = (
            <Star
              width={size}
              height={size}
              className={cn(filled ? "fill-warning text-warning" : "fill-transparent text-border")}
            />
          );
          return interactive ? (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={i === Math.round(value)}
              aria-label={`${i}점`}
              className="p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onChange!(i)}
            >
              {Star_}
            </button>
          ) : (
            <span key={i}>{Star_}</span>
          );
        })}
      </div>
      {typeof count === "number" && (
        <span className="text-sm text-muted-foreground">({count})</span>
      )}
    </div>
  );
}

// ── Switch ───────────────────────────────────────────────────
export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-secondary data-[state=unchecked]:bg-border",
      className
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform",
        "data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";

// ── Tooltip ──────────────────────────────────────────────────
export const TooltipProvider = TooltipPrimitive.Provider;
export function Tooltip({
  content,
  children,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 rounded-md bg-foreground px-2.5 py-1.5 text-xs font-medium text-background shadow-md animate-in fade-in-0 zoom-in-95"
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-foreground" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
