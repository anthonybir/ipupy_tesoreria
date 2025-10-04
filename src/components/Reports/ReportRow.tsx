"use client";

import { useMemo, useState, type JSX } from "react";
import toast from "react-hot-toast";

import { useDeleteReport, useUpdateReport } from "@/hooks/useReportMutations";
import { formatCurrencyDisplay } from "@/lib/utils/currency";
import type { ReportRecord } from "@/types/api";

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente",
  enviado: "Enviado",
  procesado: "Procesado",
  borrador: "Borrador"
};

const statusBadges: Record<string, string> = {
  procesado: "bg-emerald-100 text-emerald-700",
  pendiente: "bg-amber-100 text-amber-700",
  enviado: "bg-sky-100 text-sky-700",
  borrador: "bg-slate-100 text-slate-600"
};

type ReportRowProps = {
  report: ReportRecord;
  onView: (report: ReportRecord) => void;
};

export function ReportRow({ report, onView }: ReportRowProps): JSX.Element {
  const updateReport = useUpdateReport(report.id);
  const deleteReport = useDeleteReport();
  const [isConfirming, setIsConfirming] = useState(false);

  const statusClass = statusBadges[report.status.toLowerCase()] ?? "bg-slate-100 text-slate-600";
  const statusLabel = statusLabels[report.status.toLowerCase()] ?? report.status;

  const isProcessing = updateReport.isPending || deleteReport.isPending;

  const periodLabel = useMemo(() => `${report.month}/${report.year}`, [report.month, report.year]);

  const handleStatusChange = async (nextStatus: string) => {
    if (report.status === nextStatus) {
      return;
    }

    try {
      await updateReport.mutateAsync({ estado: nextStatus });
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    }
  };

  const handleDelete = async () => {
    const confirmed = isConfirming || window.confirm("¿Eliminar este informe? Esta acción no se puede deshacer.");
    if (!confirmed) {
      return;
    }

    setIsConfirming(true);
    try {
      await deleteReport.mutateAsync({ reportId: report.id });
    } catch (error) {
      if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <tr className="hover:bg-slate-50">
      <td className="px-4 py-3 text-slate-700">
        <div className="font-semibold text-slate-900">{report.churchName}</div>
        <div className="text-xs text-slate-500">{report.metadata.city || "Ciudad no registrada"}</div>
      </td>
      <td className="px-4 py-3 text-slate-700">{periodLabel}</td>
      <td className="px-4 py-3 text-right text-slate-700">{formatCurrencyDisplay(report.totals.entries)}</td>
      <td className="px-4 py-3 text-right text-slate-700">{formatCurrencyDisplay(report.totals.exits)}</td>
      <td className="px-4 py-3 text-right text-slate-900 font-semibold">{formatCurrencyDisplay(report.totals.balance)}</td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ${statusClass}`}>
          {statusLabel}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onView(report)}
            disabled={isProcessing}
          >
            Ver detalle
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => handleStatusChange("procesado")}
            disabled={isProcessing || report.status.toLowerCase() === "procesado"}
          >
            Marcar procesado
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => handleStatusChange("pendiente")}
            disabled={isProcessing || report.status.toLowerCase() === "pendiente"}
          >
            Marcar pendiente
          </button>
          <button
            type="button"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleDelete}
            disabled={isProcessing}
          >
            {deleteReport.isPending ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </td>
    </tr>
  );
}
