'use client';

import { ArrowPathIcon } from '@heroicons/react/24/outline';
import type { ReactNode } from 'react';

type LoadingStateProps = {
  title?: string;
  description?: ReactNode;
  fullHeight?: boolean;
};

export function LoadingState({
  title = 'Cargando información...',
  description,
  fullHeight = false,
}: LoadingStateProps) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-6 py-12 text-center ${
        fullHeight ? 'min-h-[320px]' : ''
      }`}
    >
      <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {description ? (
        <p className="max-w-md text-xs text-slate-500">{description}</p>
      ) : null}
    </div>
  );
}
