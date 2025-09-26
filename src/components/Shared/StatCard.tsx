import type { ReactNode } from "react";

export type StatCardProps = {
  label: string;
  value: ReactNode;
  description?: string;
  badge?: { label: string; tone?: "default" | "success" | "warning" | "critical" };
  tone?: "default" | "success" | "warning" | "critical";
};

export function StatCard({ label, value, description, badge, tone = "default" }: StatCardProps) {
  return (
    <article
      className="absd-card absd-span-compact flex flex-col gap-3 rounded-3xl border border-[var(--absd-border)] bg-[var(--absd-surface)] px-5 py-4 shadow-sm"
      data-tone={tone}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.6)]">
        {label}
      </span>
      <div className="flex items-baseline gap-2">
        <span className="absd-stat-value">{value}</span>
        {badge && (
          <span className="absd-pill" data-tone={badge.tone ?? tone}>
            {badge.label}
          </span>
        )}
      </div>
      {description && <p className="text-xs text-[rgba(15,23,42,0.6)]">{description}</p>}
    </article>
  );
}
