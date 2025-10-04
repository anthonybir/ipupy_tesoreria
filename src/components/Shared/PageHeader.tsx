import type { ReactNode } from "react";
import Link from "next/link";

export type PageHeaderProps = {
  title: string;
  subtitle?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  badge?: { label: string; tone?: "default" | "info" | "success" | "warning" };
  actions?: ReactNode;
  children?: ReactNode;
};

export function PageHeader({
  title,
  subtitle,
  breadcrumbs,
  badge,
  actions,
  children,
}: PageHeaderProps): JSX.Element {
  return (
    <header className="space-y-4">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[rgba(15,23,42,0.65)]">
          {breadcrumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`} className="flex items-center gap-2">
              {index > 0 && <span aria-hidden="true">/</span>}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="rounded px-1 py-0.5 transition hover:bg-[color-mix(in_oklab,var(--absd-authority) 12%,white)] hover:text-[var(--absd-authority)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--absd-authority)]"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-semibold text-[var(--absd-ink)]">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="absd-title">{title}</h1>
            {badge && (
              <span
                className="absd-pill"
                data-tone={badge.tone ?? "default"}
              >
                {badge.label}
              </span>
            )}
          </div>
          {subtitle && <p className="absd-subtitle max-w-2xl">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
