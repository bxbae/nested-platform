import * as React from "react";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "../atoms/Button";

// ── Breadcrumb ───────────────────────────────────────────────
export interface Crumb {
  label: string;
  href?: string;
}
export function Breadcrumb({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="flex items-center gap-1.5">
              {c.href && !last ? (
                <a href={c.href} className="hover:text-foreground hover:underline">
                  {c.label}
                </a>
              ) : (
                <span className={cn(last && "font-medium text-foreground")} aria-current={last ? "page" : undefined}>
                  {c.label}
                </span>
              )}
              {!last && <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ── Pagination ── admin tables (search uses infinite scroll)
export function Pagination({
  page,
  pageCount,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  onPageChange: (p: number) => void;
}) {
  const pages = React.useMemo(() => {
    const out: number[] = [];
    const from = Math.max(1, page - 2);
    const to = Math.min(pageCount, from + 4);
    for (let i = from; i <= to; i++) out.push(i);
    return out;
  }, [page, pageCount]);

  return (
    <nav aria-label="페이지네이션" className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label="이전 페이지"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((p) => (
        <Button
          key={p}
          variant={p === page ? "primary" : "ghost"}
          size="icon"
          aria-current={p === page ? "page" : undefined}
          onClick={() => onPageChange(p)}
        >
          {p}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="icon"
        aria-label="다음 페이지"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}

// ── StatCard ── dashboard metric
export function StatCard({
  label,
  value,
  delta,
  className,
}: {
  label: string;
  value: string;
  delta?: { value: string; positive?: boolean };
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-5 shadow-sm", className)}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      {delta && (
        <div className={cn("mt-1 text-sm font-medium", delta.positive ? "text-success" : "text-destructive")}>
          {delta.positive ? "▲" : "▼"} {delta.value}
        </div>
      )}
    </div>
  );
}

// ── EmptyState ── empty screen is an invitation to act
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center">
      {icon && <div className="text-muted-foreground">{icon}</div>}
      <div>
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}
