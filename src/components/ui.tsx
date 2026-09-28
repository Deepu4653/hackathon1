import type { ReactNode } from "react";
import { clsx } from "clsx";

/* --------------------------------------------------------------------------
   Small, dependency-light UI kit. Every component is server-renderable and
   accessible by default (labels, roles, focus styles, 44px+ tap targets).
   -------------------------------------------------------------------------- */

export function Card({
  children,
  className,
  id,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag
      id={id}
      className={clsx(
        "rounded-[var(--radius-card)] border border-ink-200/80 bg-white shadow-[var(--shadow-card)]",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-4 py-3.5 sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-field-50 text-field-700">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-ink-900 sm:text-[1.05rem]">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-sm text-ink-500">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("px-4 py-4 sm:px-5", className)}>{children}</div>;
}

const badgeTones = {
  neutral: "bg-ink-100 text-ink-700",
  green: "bg-field-100 text-field-800",
  amber: "bg-soil-100 text-soil-800",
  red: "bg-danger-100 text-danger-700",
  blue: "bg-info-100 text-info-600",
} as const;

export function Badge({
  children,
  tone = "neutral",
  icon,
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof badgeTones;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        badgeTones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "green",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "green" | "amber" | "neutral" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "bg-field-50 text-field-700"
      : tone === "amber"
        ? "bg-soil-100 text-soil-700"
        : tone === "red"
          ? "bg-danger-100 text-danger-700"
          : "bg-ink-100 text-ink-700";
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-ink-500">{label}</p>
        {icon ? <span className={clsx("grid size-8 place-items-center rounded-lg", toneClass)}>{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight text-ink-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </Card>
  );
}

export function Callout({
  tone = "info",
  title,
  children,
  icon,
}: {
  tone?: "info" | "warning" | "critical" | "success";
  title?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
}) {
  const tones = {
    info: "border-info-100 bg-info-50 text-info-600",
    warning: "border-soil-200 bg-soil-50 text-soil-800",
    critical: "border-danger-100 bg-danger-50 text-danger-700",
    success: "border-field-200 bg-field-50 text-field-800",
  } as const;

  return (
    <div className={clsx("rounded-xl border px-4 py-3 text-sm", tones[tone])} role={tone === "critical" ? "alert" : "status"}>
      <div className="flex items-start gap-2.5">
        {icon ? <span className="mt-0.5 shrink-0">{icon}</span> : null}
        <div className="min-w-0">
          {title ? <p className="font-semibold">{title}</p> : null}
          {children ? <div className={clsx(title && "mt-1", "leading-relaxed")}>{children}</div> : null}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed border-ink-200 bg-white/60 px-6 py-10 text-center">
      {icon ? <span className="grid size-12 place-items-center rounded-full bg-field-50 text-field-600">{icon}</span> : null}
      <div>
        <p className="font-semibold text-ink-800">{title}</p>
        {body ? <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  badge,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {badge ? <div className="mb-2">{badge}</div> : null}
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-[1.75rem]">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-ink-500 sm:text-base">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex shrink-0 flex-wrap gap-2" data-primary-action>{action}</div> : null}
    </header>
  );
}

export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx("space-y-2 text-sm leading-relaxed text-ink-700", className)}>{children}</div>;
}

export function DataRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink-100 py-2 last:border-0">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="text-right text-sm font-semibold text-ink-800">{value}</dd>
    </div>
  );
}

export function formatNumber(value: number | string | null | undefined, digits = 1): string {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return "—";
  return parsed.toLocaleString("en-IN", { maximumFractionDigits: digits });
}

export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return "—";
  return `₹${parsed.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatDate(value: string | Date | null | undefined, locale = "en-IN"): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | Date | null | undefined, locale = "en-IN"): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
