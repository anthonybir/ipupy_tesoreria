import type { ReactNode } from "react";

export type FormFieldProps = {
  label: string;
  htmlFor: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function FormField({ label, htmlFor, required, hint, error, children }: FormFieldProps) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)]"
      >
        {label}
        {required && <span className="ml-1 text-[var(--absd-error)]">*</span>}
      </label>
      {children}
      {hint && !error && (
        <p id={hintId} className="text-xs text-[rgba(15,23,42,0.55)]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs text-[var(--absd-error)]">
          {error}
        </p>
      )}
    </div>
  );
}
