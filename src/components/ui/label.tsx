import * as React from 'react';

import { cn } from '@/lib/utils/cn';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  requiredIndicator?: boolean;
  helperText?: string;
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, requiredIndicator, helperText, ...props }, ref) => {
    const id = props.htmlFor ? `${props.htmlFor}-hint` : undefined;

    return (
      <div className="flex flex-col gap-1">
        <label
          ref={ref}
          className={cn(
            'text-sm font-medium leading-none text-[var(--absd-ink)] peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
            className
          )}
          {...props}
        >
          <span className="inline-flex items-center gap-1">
            {children}
            {requiredIndicator && <span className="text-[var(--absd-error)]">*</span>}
          </span>
        </label>
        {helperText && (
          <span id={id} className="text-xs text-[var(--absd-wisdom)]">
            {helperText}
          </span>
        )}
      </div>
    );
  }
);

Label.displayName = 'Label';
