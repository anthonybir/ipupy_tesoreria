import * as React from 'react';

import { cn } from '@/lib/utils/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error = false, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          'flex h-10 w-full rounded-lg border border-[var(--absd-border)] bg-white px-3 py-2 text-sm text-[var(--absd-ink)] shadow-sm transition placeholder:text-[color-mix(in_oklab,var(--absd-wisdom) 60%,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--absd-authority)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60',
          error && 'border-[var(--absd-error)] focus-visible:ring-[var(--absd-error)]',
          className
        )}
        aria-invalid={error || undefined}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';
