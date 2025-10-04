import type { ReactNode, JSX } from "react";
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  InformationCircleIcon,
  MinusCircleIcon,
} from "@heroicons/react/20/solid";

export type StatusPillTone = "neutral" | "success" | "warning" | "critical" | "info";

const toneClassNames: Record<StatusPillTone, string> = {
  neutral: "bg-[var(--absd-subtle)] text-[var(--absd-ink)] border border-[var(--absd-border)]",
  success: "bg-[rgba(5,150,105,0.12)] text-[var(--absd-success)] border border-[rgba(5,150,105,0.2)]",
  warning: "bg-[rgba(245,158,11,0.14)] text-[var(--absd-warning)] border border-[rgba(245,158,11,0.25)]",
  critical: "bg-[rgba(239,68,68,0.14)] text-[var(--absd-error)] border border-[rgba(239,68,68,0.25)]",
  info: "bg-[rgba(14,165,233,0.16)] text-[var(--absd-info)] border border-[rgba(14,165,233,0.25)]",
};

const toneIcons: Record<StatusPillTone, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  neutral: MinusCircleIcon,
  success: CheckCircleIcon,
  warning: ExclamationTriangleIcon,
  critical: XCircleIcon,
  info: InformationCircleIcon,
};

export type StatusPillProps = {
  children: ReactNode;
  tone?: StatusPillTone;
  icon?: ReactNode;
  showIcon?: boolean;
};

export function StatusPill({ children, tone = "neutral", icon, showIcon = true }: StatusPillProps): JSX.Element {
  const IconComponent = toneIcons[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all ${toneClassNames[tone]}`}
    >
      {showIcon && !icon && <IconComponent className="h-3.5 w-3.5" />}
      {icon}
      {children}
    </span>
  );
}

export type EventStatus = 'draft' | 'pending_revision' | 'submitted' | 'approved' | 'rejected' | 'cancelled';

const eventStatusConfig: Record<EventStatus, { label: string; tone: StatusPillTone }> = {
  draft: { label: 'Borrador', tone: 'neutral' },
  pending_revision: { label: 'Requiere Revisión', tone: 'warning' },
  submitted: { label: 'Pendiente', tone: 'info' },
  approved: { label: 'Aprobado', tone: 'success' },
  rejected: { label: 'Rechazado', tone: 'critical' },
  cancelled: { label: 'Cancelado', tone: 'neutral' },
};

export type EventStatusPillProps = {
  status: EventStatus;
};

export function EventStatusPill({ status }: EventStatusPillProps): JSX.Element {
  const config = eventStatusConfig[status];
  return (
    <StatusPill tone={config.tone}>
      {config.label}
    </StatusPill>
  );
}
