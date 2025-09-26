import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60 active:scale-[0.99]',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--absd-authority)] text-white hover:brightness-110 focus-visible:ring-[var(--absd-authority)]',
        secondary:
          'bg-[var(--absd-prosperity)] text-[var(--absd-authority)] hover:brightness-110 focus-visible:ring-[var(--absd-prosperity)]',
        outline:
          'border border-[var(--absd-authority)] text-[var(--absd-authority)] hover:bg-[color-mix(in_oklab,var(--absd-authority) 6%,white)] focus-visible:ring-[var(--absd-authority)]',
        ghost:
          'text-[var(--absd-authority)] hover:bg-[color-mix(in_oklab,var(--absd-authority) 8%,white)] focus-visible:ring-[var(--absd-authority)]',
        danger:
          'bg-[var(--absd-error)] text-white hover:brightness-110 focus-visible:ring-[var(--absd-error)]',
        success:
          'bg-[var(--absd-success)] text-white hover:brightness-110 focus-visible:ring-[var(--absd-success)]',
        link:
          'text-[var(--absd-authority)] underline underline-offset-4 hover:text-[color-mix(in_oklab,var(--absd-authority) 85%,white)] focus-visible:ring-[var(--absd-authority)]'
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
