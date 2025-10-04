import type { ReactNode } from "react";

export type SectionCardProps = {
  title?: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  padding?: "sm" | "md" | "lg";
  children: ReactNode;
};

const paddingMap = {
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

export function SectionCard({
  title,
  description,
  leading,
  actions,
  padding = "md",
  children,
}: SectionCardProps): JSX.Element {
  return (
    <section className={`absd-card ${paddingMap[padding]} space-y-4`}>
      {(title || description || leading || actions) && (
        <header className="flex flex-col gap-4 border-b border-[var(--absd-border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            {leading && <div className="rounded-full bg-[color-mix(in_oklab,var(--absd-authority) 8%,white)] p-2 text-[var(--absd-authority)]">{leading}</div>}
            <div className="space-y-1">
              {title && (
                <h2 className="text-base font-semibold text-[var(--absd-ink)]">
                  {title}
                </h2>
              )}
              {description && (
                <p className="text-sm text-[rgba(15,23,42,0.65)]">{description}</p>
              )}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}
