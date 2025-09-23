'use client';

import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';

type ErrorStateProps = {
  title?: string;
  description?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorState({
  title = 'Ocurrió un error al cargar los datos',
  description,
  onRetry,
  retryLabel = 'Reintentar',
}: ErrorStateProps) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-4 rounded-xl border border-rose-200 bg-rose-50/60 px-6 py-10 text-center">
      <ExclamationTriangleIcon className="h-8 w-8 text-rose-500" aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-semibold text-rose-600">{title}</p>
        {description ? (
          <p className="max-w-md text-xs text-rose-500">{description}</p>
        ) : null}
      </div>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full bg-rose-500 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-rose-600"
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
