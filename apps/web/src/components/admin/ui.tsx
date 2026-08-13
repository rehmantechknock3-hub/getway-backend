import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="mb-3 h-1.5 w-16 rounded-full bg-waynow-mark" />
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

const STAT_ACCENTS = [
  "from-brand-violet/20 via-transparent to-brand-blue/10",
  "from-brand-blue/20 via-transparent to-brand-cyan/15",
  "from-brand-cyan/20 via-transparent to-brand-violet/10",
  "from-brand-magenta/15 via-transparent to-brand-blue/15",
] as const;

export function StatCard({
  label,
  value,
  hint,
  href,
  accent = 0,
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  accent?: number;
}) {
  const wash = STAT_ACCENTS[accent % STAT_ACCENTS.length];
  const body = (
    <div className="group relative overflow-hidden rounded-2xl border border-white/80 bg-waynow-card p-5 shadow-panel transition duration-300 hover:-translate-y-0.5 hover:shadow-glow">
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${wash}`} />
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-waynow-mark opacity-20 blur-2xl transition group-hover:opacity-40" />
      <div className="relative">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-violet/80">
          {label}
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        {hint ? <p className="mt-2 text-sm text-slate-500">{hint}</p> : null}
      </div>
    </div>
  );
  if (!href) return body;
  return (
    <Link
      href={href}
      className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
    >
      {body}
    </Link>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-panel backdrop-blur-sm">
      {(title || actions) && (
        <div className="flex flex-col gap-3 border-b border-slate-100/80 bg-gradient-to-r from-brand-violet/5 via-transparent to-brand-cyan/5 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {title ? (
              <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-sm text-slate-500">{description}</p>
            ) : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-slate-100 text-slate-700",
    success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/70",
    warning: "bg-amber-50 text-amber-800 ring-1 ring-amber-200/70",
    danger: "bg-rose-50 text-rose-700 ring-1 ring-rose-200/70",
    info: "bg-gradient-to-r from-brand-violet/15 to-brand-blue/15 text-brand-blue-dark ring-1 ring-brand-blue/20",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-waynow-mark text-lg font-semibold text-white shadow-glow-sm">
        ✦
      </div>
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function RoadmapList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 px-5 py-5">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-3 rounded-xl border border-brand-violet/10 bg-gradient-to-r from-brand-violet/5 to-brand-cyan/5 px-4 py-3 text-sm text-slate-700"
        >
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-waynow-mark shadow-[0_0_8px_rgba(45,91,255,0.5)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function RefreshButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-brand-blue/20 bg-white/80 px-3.5 py-2 text-sm font-semibold text-brand-blue-dark shadow-sm transition hover:border-brand-violet/30 hover:bg-white hover:shadow-glow-sm"
    >
      Refresh
    </button>
  );
}
