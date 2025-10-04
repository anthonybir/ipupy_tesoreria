'use client';

import type { ReactNode, JSX } from 'react';

import { cn } from '@/lib/utils/cn';

type MetricTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

type MetricCardProps = {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  tone?: MetricTone;
  icon?: ReactNode;
  className?: string;
};

const toneClassNames: Record<MetricTone, string> = {
  neutral: 'bg-[color-mix(in_oklab,var(--absd-authority) 4%,white)] text-[var(--absd-ink)]',
  success: 'bg-[color-mix(in_oklab,var(--absd-success) 14%,white)] text-[var(--absd-success)]',
  warning: 'bg-[color-mix(in_oklab,var(--absd-warning) 18%,white)] text-[var(--absd-warning)]',
  danger: 'bg-[color-mix(in_oklab,var(--absd-error) 18%,white)] text-[var(--absd-error)]',
  info: 'bg-[color-mix(in_oklab,var(--absd-info) 16%,white)] text-[var(--absd-info)]',
};

export function MetricCard({ label, value, description, icon, tone = 'neutral', className }: MetricCardProps): JSX.Element {
  return (
    <article
      className={cn(
        'rounded-2xl border border-[var(--absd-border)] px-4 py-3 shadow-sm transition-colors duration-200',
        toneClassNames[tone],
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.6)]">
            {label}
          </p>
          <div className="text-xl font-semibold leading-tight">{value}</div>
          {description ? (
            <p className="text-xs text-[rgba(15,23,42,0.65)]">{description}</p>
          ) : null}
        </div>
        {icon ? <div className="text-lg text-[rgba(15,23,42,0.55)]">{icon}</div> : null}
      </div>
    </article>
  );
}
