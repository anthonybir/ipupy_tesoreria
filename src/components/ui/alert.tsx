import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils/cn';

const alertVariants = cva(
  'relative w-full rounded-lg border px-4 py-3 text-sm shadow-sm',
  {
    variants: {
      variant: {
        default: 'border-[var(--absd-border)] bg-[var(--absd-surface)] text-[var(--absd-ink)]',
        success:
          'border-[color-mix(in_oklab,var(--absd-success) 35%,transparent)] bg-[color-mix(in_oklab,var(--absd-success) 12%,white)] text-[var(--absd-success)]',
        warning:
          'border-[color-mix(in_oklab,var(--absd-warning) 35%,transparent)] bg-[color-mix(in_oklab,var(--absd-warning) 15%,white)] text-[var(--absd-warning)]',
        danger:
          'border-[color-mix(in_oklab,var(--absd-error) 35%,transparent)] bg-[color-mix(in_oklab,var(--absd-error) 15%,white)] text-[var(--absd-error)]',
        info:
          'border-[color-mix(in_oklab,var(--absd-info) 35%,transparent)] bg-[color-mix(in_oklab,var(--absd-info) 15%,white)] text-[var(--absd-info)]'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, icon, children, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
      <div className="flex items-start gap-3">
        {icon && <span className="mt-0.5 text-base">{icon}</span>}
        <div className="grid gap-1">
          {children}
        </div>
      </div>
    </div>
  )
);
Alert.displayName = 'Alert';

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5 ref={ref} className={cn('text-sm font-semibold tracking-tight', className)} {...props} />
  )
);
AlertTitle.displayName = 'AlertTitle';

const AlertDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm leading-normal text-[rgba(15,23,42,0.68)]', className)} {...props} />
  )
);
AlertDescription.displayName = 'AlertDescription';

export { Alert, AlertTitle, AlertDescription };
