import type { ReactNode } from "react";

export type StatusPillTone = "neutral" | "success" | "warning" | "critical" | "info";

const toneClassNames: Record<StatusPillTone, string> = {
  neutral: "bg-[var(--absd-subtle)] text-[var(--absd-ink)]",
  success: "bg-[rgba(5,150,105,0.12)] text-[var(--absd-success)]",
  warning: "bg-[rgba(245,158,11,0.14)] text-[var(--absd-warning)]",
  critical: "bg-[rgba(239,68,68,0.14)] text-[var(--absd-error)]",
  info: "bg-[rgba(14,165,233,0.16)] text-[var(--absd-info)]",
};

export type StatusPillProps = {
  children: ReactNode;
  tone?: StatusPillTone;
  icon?: ReactNode;
};

export function StatusPill({ children, tone = "neutral", icon }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${toneClassNames[tone]}`}
    >
      {icon}
      {children}
    </span>
  );
}
