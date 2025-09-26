"use client";

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils/cn';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[var(--absd-muted)] p-1 text-sm font-medium text-[var(--absd-wisdom)]',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex min-w-[120px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm transition-all data-[state=active]:bg-white data-[state=active]:text-[var(--absd-authority)] data-[state=active]:shadow-sm data-[state=inactive]:text-[var(--absd-wisdom)] hover:data-[state=inactive]:bg-[color-mix(in_oklab,var(--absd-authority) 8%,white)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--absd-authority)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--absd-muted)]',
      className
    )}
    {...props}
  >
    {children}
  </TabsPrimitive.Trigger>
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--absd-authority)] focus-visible:ring-offset-2 focus-visible:ring-offset-white',
      className
    )}
    {...props}
  >
    {children}
  </TabsPrimitive.Content>
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
