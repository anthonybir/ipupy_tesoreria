'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

type EmptyStateTone = 'neutral' | 'info' | 'success' | 'warning';

const toneStyles: Record<EmptyStateTone, string> = {
  neutral:
    'border border-[var(--absd-border)] bg-[color-mix(in_oklab,var(--absd-authority) 4%,white)] text-[rgba(15,23,42,0.65)]',
  info: 'border border-[color-mix(in_oklab,var(--absd-info) 40%,transparent)] bg-[color-mix(in_oklab,var(--absd-info) 12%,white)] text-[var(--absd-info)]',
  success:
    'border border-[color-mix(in_oklab,var(--absd-success) 35%,transparent)] bg-[color-mix(in_oklab,var(--absd-success) 12%,white)] text-[var(--absd-success)]',
  warning:
    'border border-[color-mix(in_oklab,var(--absd-warning) 35%,transparent)] bg-[color-mix(in_oklab,var(--absd-warning) 16%,white)] text-[var(--absd-warning)]',
};

type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  fullHeight?: boolean;
  tone?: EmptyStateTone;
  className?: string;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  fullHeight = false,
  tone = 'neutral',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'absd-state flex w-full flex-col items-center justify-center gap-4 text-center transition-colors duration-200',
        toneStyles[tone],
        fullHeight && 'min-h-[320px]',
        className,
      )}
    >
      {icon ? <div className="text-4xl">{icon}</div> : null}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--absd-ink)]">{title}</p>
        {description ? (
          <p className="text-xs text-[rgba(15,23,42,0.6)]">{description}</p>
        ) : null}
      </div>
      {action ?? null}
    </div>
  );
}
