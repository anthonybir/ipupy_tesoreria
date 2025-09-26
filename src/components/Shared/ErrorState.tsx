'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

type ErrorStateVariant = 'error' | 'warning';

type ErrorStateProps = {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  variant?: ErrorStateVariant;
  className?: string;
};

const variantStyles: Record<ErrorStateVariant, string> = {
  error:
    'border border-[color-mix(in_oklab,var(--absd-error) 40%,transparent)] bg-[color-mix(in_oklab,var(--absd-error) 16%,white)] text-[var(--absd-error)]',
  warning:
    'border border-[color-mix(in_oklab,var(--absd-warning) 40%,transparent)] bg-[color-mix(in_oklab,var(--absd-warning) 16%,white)] text-[var(--absd-warning)]',
};

export function ErrorState({
  title = 'Ocurrió un error al cargar los datos',
  description,
  onRetry,
  retryLabel = 'Reintentar',
  variant = 'error',
  className,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        'absd-state flex w-full flex-col items-center justify-center gap-4 text-center transition-colors duration-200',
        variantStyles[variant],
        className,
      )}
    >
      <ExclamationTriangleIcon className="h-8 w-8" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--absd-ink)]">{title}</p>
        {description ? (
          <p className="max-w-md text-xs text-[rgba(15,23,42,0.68)]">{description}</p>
        ) : null}
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant={variant === 'warning' ? 'secondary' : 'danger'}
          size="sm"
          onClick={onRetry}
        >
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}
