'use client';

import type { ReactNode, JSX } from 'react';

import { cn } from '@/lib/utils/cn';

type ToolbarProps = {
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
  variant?: 'filters' | 'default';
};

const variantClassNames: Record<NonNullable<ToolbarProps['variant']>, string> = {
  default: 'bg-[var(--absd-surface)]',
  filters: 'bg-[color-mix(in_oklab,var(--absd-authority) 4%,white)]',
};

export function Toolbar({ children, actions, className, variant = 'default' }: ToolbarProps): JSX.Element {
  return (
    <section
      className={cn(
        'absd-card flex flex-col gap-4 border border-[var(--absd-border)] px-5 py-4 shadow-sm lg:flex-row lg:items-end lg:justify-between',
        variantClassNames[variant],
        className,
      )}
    >
      <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end lg:gap-4">
        {children}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}
