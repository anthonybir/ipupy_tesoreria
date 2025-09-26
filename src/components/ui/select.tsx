"use client";

import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';

import { cn } from '@/lib/utils/cn';

const Select = SelectPrimitive.Root;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      'flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-[var(--absd-border)] bg-white px-3 text-sm text-[var(--absd-ink)] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--absd-authority)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60',
      className
    )}
    {...props}
  >
    <SelectPrimitive.Value>{children}</SelectPrimitive.Value>
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 text-[var(--absd-wisdom)]" aria-hidden />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        'z-50 min-w-[220px] overflow-hidden rounded-lg border border-[var(--absd-border)] bg-white shadow-xl',
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.ScrollUpButton className="flex h-8 cursor-default items-center justify-center bg-[var(--absd-muted)] text-[var(--absd-wisdom)]">
        <ChevronUp className="h-4 w-4" aria-hidden />
      </SelectPrimitive.ScrollUpButton>
      <SelectPrimitive.Viewport className="p-1">
        {children}
      </SelectPrimitive.Viewport>
      <SelectPrimitive.ScrollDownButton className="flex h-8 cursor-default items-center justify-center bg-[var(--absd-muted)] text-[var(--absd-wisdom)]">
        <ChevronDown className="h-4 w-4" aria-hidden />
      </SelectPrimitive.ScrollDownButton>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-3 py-2 text-sm text-[var(--absd-ink)] outline-none transition focus:bg-[color-mix(in_oklab,var(--absd-authority) 8%,white)] data-[state=checked]:font-semibold',
      className
    )}
    {...props}
  >
    <SelectPrimitive.ItemIndicator className="absolute left-2 inline-flex items-center">
      <Check className="h-4 w-4" aria-hidden />
    </SelectPrimitive.ItemIndicator>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn('px-3 py-2 text-xs font-medium uppercase tracking-wide text-[var(--absd-wisdom)]', className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn('mx-1 my-1 h-px bg-[var(--absd-muted)]', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

const SelectValue = SelectPrimitive.Value;
const SelectGroup = SelectPrimitive.Group;

export {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectValue,
  SelectGroup,
};
