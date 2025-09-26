"use client";

import * as React from 'react';
import * as SwitchPrimitives from '@radix-ui/react-switch';

import { cn } from '@/lib/utils/cn';

export interface SwitchProps extends React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root> {
  withIcon?: boolean;
}

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  SwitchProps
>(({ className, withIcon = false, ...props }, ref) => (
  <SwitchPrimitives.Root
    ref={ref}
    className={cn(
      'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent bg-[var(--absd-muted)] transition-colors data-[state=checked]:bg-[var(--absd-authority)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--absd-authority)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60',
      className
    )}
    {...props}
  >
    <SwitchPrimitives.Thumb
      className={cn(
        'pointer-events-none grid h-5 w-5 place-content-center rounded-full bg-white text-xs text-[var(--absd-authority)] shadow transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0'
      )}
    >
      {withIcon && (
        <span
          aria-hidden
          className="transition-opacity data-[state=checked]:opacity-100 data-[state=unchecked]:opacity-0"
        >
          ✓
        </span>
      )}
    </SwitchPrimitives.Thumb>
  </SwitchPrimitives.Root>
));

Switch.displayName = SwitchPrimitives.Root.displayName;
