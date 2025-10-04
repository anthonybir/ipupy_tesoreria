import type { ReactNode, JSX } from "react";

export type SkeletonProps = {
  className?: string;
  width?: string;
  height?: string;
  rounded?: "sm" | "md" | "lg" | "xl" | "full";
};

const roundedMap = {
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-full",
};

export function Skeleton({ className = "", width, height, rounded = "md" }: SkeletonProps): JSX.Element {
  const style = {
    width: width || "100%",
    height: height || "1rem",
  };

  return (
    <div
      className={`absd-skeleton ${roundedMap[rounded]} ${className}`}
      style={style}
      aria-busy="true"
      aria-live="polite"
    />
  );
}

export function SkeletonText({ lines = 3, className = "" }: { lines?: number; className?: string }): JSX.Element {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          width={index === lines - 1 ? "75%" : "100%"}
          height="0.875rem"
        />
      ))}
    </div>
  );
}

export function SkeletonCard({ children, className = "" }: { children?: ReactNode; className?: string }): JSX.Element {
  return (
    <div className={`absd-card p-6 space-y-4 ${className}`}>
      {children || (
        <>
          <div className="flex items-center justify-between">
            <Skeleton width="40%" height="1.5rem" />
            <Skeleton width="20%" height="1.5rem" />
          </div>
          <SkeletonText lines={2} />
        </>
      )}
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }): JSX.Element {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--absd-border)]">
      <table className="absd-table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index}>
                <Skeleton width="80%" height="0.875rem" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex}>
                  <Skeleton width="90%" height="1rem" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonStatCard(): JSX.Element {
  return (
    <div className="absd-card absd-span-compact flex flex-col gap-3 rounded-3xl border border-[var(--absd-border)] bg-[var(--absd-surface)] px-5 py-4 shadow-sm">
      <Skeleton width="60%" height="0.75rem" />
      <Skeleton width="50%" height="2rem" />
      <Skeleton width="80%" height="0.75rem" />
    </div>
  );
}

export function SkeletonPage(): JSX.Element {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="space-y-4">
        <Skeleton width="40%" height="2.5rem" />
        <Skeleton width="60%" height="1rem" />
      </div>

      {/* Stats skeleton */}
      <div className="absd-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <SkeletonStatCard key={index} />
        ))}
      </div>

      {/* Table skeleton */}
      <SkeletonCard>
        <SkeletonTable rows={5} columns={4} />
      </SkeletonCard>
    </div>
  );
}

export function SkeletonForm({ fields = 4 }: { fields?: number }): JSX.Element {
  return (
    <div className="space-y-6">
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          <Skeleton width="30%" height="1rem" />
          <Skeleton width="100%" height="2.5rem" rounded="lg" />
        </div>
      ))}
      <div className="flex justify-end gap-3">
        <Skeleton width="6rem" height="2.5rem" rounded="lg" />
        <Skeleton width="8rem" height="2.5rem" rounded="lg" />
      </div>
    </div>
  );
}