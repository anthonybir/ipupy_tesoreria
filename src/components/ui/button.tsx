import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] shadow-sm hover:shadow-md',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--absd-authority)] text-white hover:brightness-110 hover:shadow-lg focus-visible:ring-[var(--absd-authority)] active:brightness-95',
        secondary:
          'bg-[var(--absd-prosperity)] text-[var(--absd-authority)] hover:brightness-105 hover:shadow-md focus-visible:ring-[var(--absd-prosperity)] border border-[rgba(0,37,86,0.15)]',
        outline:
          'border-2 border-[var(--absd-authority)] text-[var(--absd-authority)] bg-white hover:bg-[color-mix(in_oklab,var(--absd-authority) 8%,white)] focus-visible:ring-[var(--absd-authority)] hover:border-[color-mix(in_oklab,var(--absd-authority) 85%,white)]',
        ghost:
          'text-[var(--absd-authority)] hover:bg-[color-mix(in_oklab,var(--absd-authority) 10%,white)] focus-visible:ring-[var(--absd-authority)] shadow-none hover:shadow-sm',
        danger:
          'bg-[var(--absd-error)] text-white hover:brightness-110 hover:shadow-lg focus-visible:ring-[var(--absd-error)] active:brightness-95',
        success:
          'bg-[var(--absd-success)] text-white hover:brightness-110 hover:shadow-lg focus-visible:ring-[var(--absd-success)] active:brightness-95',
        link:
          'text-[var(--absd-authority)] underline underline-offset-4 hover:text-[color-mix(in_oklab,var(--absd-authority) 75%,black)] focus-visible:ring-[var(--absd-authority)] shadow-none hover:shadow-none'
      },
      size: {
        sm: 'h-9 rounded-md px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-6 text-base',
        xl: 'h-12 px-8 text-lg font-semibold',
        icon: 'h-10 w-10 rounded-lg'
      },
      density: {
        comfortable: '',
        compact: 'tracking-tight',
        spacious: 'tracking-wide'
      }
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
      density: 'comfortable'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      density,
      asChild = false,
      loading = false,
      icon,
      iconPosition = 'left',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    const isIconOnly = size === 'icon' && !children;

    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, density }), isIconOnly && 'p-0', className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {!loading && icon && iconPosition === 'left' && <span className="inline-flex">{icon}</span>}
        {children}
        {!loading && icon && iconPosition === 'right' && <span className="inline-flex">{icon}</span>}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

export { buttonVariants };
