import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-[var(--absd-authority)] text-white',
        secondary: 'border-transparent bg-[var(--absd-prosperity)] text-[var(--absd-authority)]',
        outline: 'border-[var(--absd-authority)] text-[var(--absd-authority)]',
        success: 'border-transparent bg-[var(--absd-success)] text-white',
        warning: 'border-transparent bg-[var(--absd-warning)] text-[var(--absd-ink)]',
        danger: 'border-transparent bg-[var(--absd-error)] text-white',
        muted: 'border-transparent bg-[var(--absd-muted)] text-[var(--absd-wisdom)]'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  )
);

Badge.displayName = 'Badge';
