'use client';

import type { ReactNode } from 'react';

type EmptyStateProps = {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  fullHeight?: boolean;
};

export function EmptyState({
  title,
  description,
  icon,
  action,
  fullHeight = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center ${
        fullHeight ? 'min-h-[320px]' : ''
      }`}
    >
      {icon ? <div className="text-4xl">{icon}</div> : null}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        {description ? (
          <p className="text-xs text-slate-500">{description}</p>
        ) : null}
      </div>
      {action ?? null}
    </div>
  );
}
