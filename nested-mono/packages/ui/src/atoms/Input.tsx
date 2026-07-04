import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "../lib/cn";

// ── Input ────────────────────────────────────────────────────
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}
export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, "aria-invalid": ariaInvalid, ...props }, ref) => (
    <input
      ref={ref}
      aria-invalid={invalid || ariaInvalid}
      className={cn(
        "flex h-11 w-full rounded-md border bg-surface px-3.5 py-2 text-[0.95rem] text-foreground placeholder:text-muted-foreground",
        "transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 focus-visible:border-secondary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid || ariaInvalid ? "border-destructive focus-visible:ring-destructive/30" : "border-input",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

// ── Textarea ─────────────────────────────────────────────────
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <textarea
      ref={ref}
      aria-invalid={invalid}
      className={cn(
        "flex min-h-[88px] w-full rounded-md border bg-surface px-3.5 py-2.5 text-[0.95rem] text-foreground placeholder:text-muted-foreground",
        "transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/40 focus-visible:border-secondary",
        "disabled:cursor-not-allowed disabled:opacity-50 resize-y",
        invalid ? "border-destructive" : "border-input",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

// ── Label ────────────────────────────────────────────────────
export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & { required?: boolean }
>(({ className, required, children, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-sm font-semibold text-muted-foreground peer-disabled:opacity-60",
      className
    )}
    {...props}
  >
    {children}
    {required && <span className="ml-0.5 text-destructive">*</span>}
  </LabelPrimitive.Root>
));
Label.displayName = "Label";
