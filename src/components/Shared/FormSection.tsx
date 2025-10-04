import type { ReactNode, JSX } from "react";

export type FormSectionProps = {
  title: string;
  description?: string;
  badge?: ReactNode;
  children: ReactNode;
};

export function FormSection({ title, description, badge, children }: FormSectionProps): JSX.Element {
  return (
    <section className="space-y-4 rounded-2xl border border-[var(--absd-border)] bg-[var(--absd-surface)] p-6 shadow-sm">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[rgba(15,23,42,0.65)]">
            {title}
          </h3>
          {description && <p className="text-xs text-[rgba(15,23,42,0.55)]">{description}</p>}
        </div>
        {badge}
      </header>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}
