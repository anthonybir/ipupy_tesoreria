import type { ReactNode } from "react";
import { MiniLineChart } from './Charts/MiniLineChart';
import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/20/solid';

export type StatCardProps = {
  label: string;
  value: ReactNode;
  description?: string;
  badge?: { label: string; tone?: "default" | "success" | "warning" | "critical" };
  tone?: "default" | "success" | "warning" | "critical";
  trend?: {
    data: number[];
    direction?: 'up' | 'down';
    percentage?: number;
  };
  chart?: ReactNode;
};

export function StatCard({ label, value, description, badge, tone = "default", trend, chart }: StatCardProps) {
  return (
    <article
      className="absd-card absd-span-compact flex flex-col gap-3 rounded-3xl border border-[var(--absd-border)] bg-[var(--absd-surface)] px-5 py-4 shadow-sm transition-all hover:shadow-md"
      data-tone={tone}
    >
      <div className="flex items-start justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.6)]">
          {label}
        </span>
        {trend && (
          <div className="flex items-center gap-1">
            {trend.direction === 'up' && (
              <ArrowUpIcon className="h-4 w-4 text-[var(--absd-success)]" />
            )}
            {trend.direction === 'down' && (
              <ArrowDownIcon className="h-4 w-4 text-[var(--absd-error)]" />
            )}
            {trend.percentage !== undefined && (
              <span className={`text-xs font-semibold ${
                trend.direction === 'up' ? 'text-[var(--absd-success)]' : 'text-[var(--absd-error)]'
              }`}>
                {trend.percentage > 0 ? '+' : ''}{trend.percentage.toFixed(1)}%
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="absd-stat-value">{value}</span>
        {badge && (
          <span className="absd-pill" data-tone={badge.tone ?? tone}>
            {badge.label}
          </span>
        )}
      </div>
      {trend && trend.data.length > 0 && !chart && (
        <MiniLineChart
          data={trend.data}
          width={120}
          height={32}
          color={trend.direction === 'up' ? 'var(--absd-success)' : trend.direction === 'down' ? 'var(--absd-error)' : 'var(--absd-authority)'}
          strokeWidth={2}
        />
      )}
      {chart && <div className="mt-2">{chart}</div>}
      {description && <p className="text-xs text-[rgba(15,23,42,0.6)]">{description}</p>}
    </article>
  );
}
