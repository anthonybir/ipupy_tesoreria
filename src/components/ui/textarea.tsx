import * as React from "react";

import { cn } from "@/lib/utils/cn";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error = false, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-[120px] w-full rounded-lg border border-[var(--absd-border)] bg-white px-3 py-2 text-sm text-[var(--absd-ink)] shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--absd-authority)] focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60",
        error && "border-[var(--absd-error)] focus-visible:ring-[var(--absd-error)]",
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = "Textarea";
