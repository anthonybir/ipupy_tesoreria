'use client';

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils/cn';

type LoadingStateTone = 'primary' | 'info';

type LoadingStateProps = {
  title?: string;
  description?: ReactNode;
  fullHeight?: boolean;
  tone?: LoadingStateTone;
  className?: string;
};

const toneClassNames: Record<LoadingStateTone, string> = {
  primary:
    'border border-[color-mix(in_oklab,var(--absd-authority) 38%,transparent)] bg-[color-mix(in_oklab,var(--absd-authority) 10%,white)] text-[var(--absd-authority)]',
  info: 'border border-[color-mix(in_oklab,var(--absd-info) 38%,transparent)] bg-[color-mix(in_oklab,var(--absd-info) 12%,white)] text-[var(--absd-info)]',
};

export function LoadingState({
  title = 'Cargando información...',
  description,
  fullHeight = false,
  tone = 'primary',
  className,
}: LoadingStateProps): JSX.Element {
  return (
    <div
      className={cn(
        'absd-state flex w-full flex-col items-center justify-center gap-3 text-center transition-colors duration-200',
        toneClassNames[tone],
        fullHeight && 'min-h-[320px]',
        className,
      )}
    >
      <ArrowPathIcon className="h-8 w-8 animate-spin" aria-hidden="true" />
      <p className="text-sm font-medium text-[var(--absd-ink)]">{title}</p>
      {description ? (
        <p className="max-w-md text-xs text-[rgba(15,23,42,0.6)]">{description}</p>
      ) : null}
    </div>
  );
}
