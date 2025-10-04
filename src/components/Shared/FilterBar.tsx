import type { ReactNode, JSX } from "react";

export type FilterBarProps = {
  children: ReactNode;
  actions?: ReactNode;
};

export function FilterBar({ children, actions }: FilterBarProps): JSX.Element {
  return (
    <div className="absd-card flex flex-col gap-4 border border-[var(--absd-border)] bg-[var(--absd-surface)] px-5 py-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
      <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end lg:gap-4">
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
