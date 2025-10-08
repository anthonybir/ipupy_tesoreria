"use client";

import { useCallback } from "react";

import { api } from "../../convex/_generated/api";
import {
  mapReportDocumentToRaw,
  type ConvexReportDocument,
} from "@/lib/convex-adapters";
import type { Id } from "../../convex/_generated/dataModel";
import {
  normalizeReportRecord,
  type ReportRecord,
} from "@/types/api";
import { useChurches } from "@/hooks/useChurches";
import {
  useConvexMutation,
  type MutationArgs,
  type UseConvexMutationResult,
} from "@/hooks/useConvexMutation";

type ConvexId = string;

const toNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const toTimestamp = (value?: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

const mapCreatePayload = (
  payload: CreateReportPayload,
  churchConvexId: ConvexId
): CreateArgs[0] => {
  const args: Record<string, unknown> = {
    church_id: churchConvexId as Id<'churches'>,
    month: Number(payload.month),
    year: Number(payload.year),
    diezmos: Number(payload.diezmos),
    ofrendas: Number(payload.ofrendas),
  };

  const numericFields: Array<keyof CreateReportPayload> = [
    "anexos",
    "caballeros",
    "damas",
    "jovenes",
    "ninos",
    "otros",
    "misiones",
    "lazos_amor",
    "mision_posible",
    "apy",
    "iba",
    "energia_electrica",
    "agua",
    "recoleccion_basura",
    "servicios",
    "mantenimiento",
    "materiales",
    "otros_gastos",
    "monto_depositado",
    "honorarios_pastoral",
    "total_designado",
    "diezmo_nacional_calculado",
    "total_operativo",
    "total_salidas_calculadas",
    "saldo_calculado",
  ];

  for (const field of numericFields) {
    const value = toNumber(payload[field]);
    if (value !== undefined) {
      args[field] = value;
    }
  }

  if (payload['fecha_deposito']) {
    const timestamp = toTimestamp(payload['fecha_deposito']);
    if (timestamp !== undefined) {
      args['fecha_deposito'] = timestamp;
    }
  }

  if (payload['numero_deposito']) {
    args['numero_deposito'] = payload['numero_deposito'];
  }
  if (payload['observaciones']) {
    args['observaciones'] = payload['observaciones'];
  }

  return args as CreateArgs[0];
};

const mapUpdatePayload = (
  payload: UpdateReportVariables,
  reportConvexId: ConvexId
): UpdateArgs[0] => {
  const { estado: _estado, ...sanitizedPayload } = payload;
  const args: Record<string, unknown> = {
    id: reportConvexId as Id<'reports'>,
  };

  // NOTE: estado is NOT part of the update mutation args in convex/reports.ts
  // Status changes MUST go through approve/reject mutations instead
  // Forwarding estado here breaks status toggles with "Unexpected property estado"

  const numericFields: Array<keyof UpdateReportPayload> = [
    "diezmos",
    "ofrendas",
    "anexos",
    "caballeros",
    "damas",
    "jovenes",
    "ninos",
    "otros",
    "misiones",
    "lazos_amor",
    "mision_posible",
    "apy",
    "iba",
    "energia_electrica",
    "agua",
    "recoleccion_basura",
    "servicios",
    "mantenimiento",
    "materiales",
    "otros_gastos",
    "monto_depositado",
    "honorarios_pastoral",
    "total_designado",
    "diezmo_nacional_calculado",
    "total_operativo",
    "total_salidas_calculadas",
    "saldo_calculado",
  ];

  for (const field of numericFields) {
    // TypeScript needs explicit check that field exists in sanitizedPayload after destructuring
    if (field in sanitizedPayload) {
      const value = toNumber(sanitizedPayload[field as keyof typeof sanitizedPayload]);
      if (value !== undefined) {
        args[field] = value;
      }
    }
  }

  if (sanitizedPayload['fecha_deposito'] !== undefined) {
    const timestamp = toTimestamp(sanitizedPayload['fecha_deposito'] ?? undefined);
    if (timestamp !== undefined) {
      args['fecha_deposito'] = timestamp;
    }
  }
  if (sanitizedPayload['numero_deposito'] !== undefined) {
    args['numero_deposito'] = sanitizedPayload['numero_deposito'] ?? null;
  }
  if (sanitizedPayload['observaciones'] !== undefined) {
    args['observaciones'] = sanitizedPayload['observaciones'] ?? null;
  }
  if (sanitizedPayload['transactionsCreated'] !== undefined) {
    args['transactions_created'] = sanitizedPayload['transactionsCreated'];
  }

  return args as UpdateArgs[0];
};

const mapConvexReportToRecord = (report: ConvexReportDocument): ReportRecord =>
  normalizeReportRecord(mapReportDocumentToRaw(report));

type CreateReportHookResult = {
  mutateAsync: (payload: CreateReportPayload) => Promise<ReportRecord>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
  mutation: UseConvexMutationResult<typeof api.reports.create>["mutation"];
};

type UpdateReportHookResult = {
  mutateAsync: (payload: UpdateReportVariables) => Promise<ReportRecord>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
  mutation: UseConvexMutationResult<typeof api.reports.update>["mutation"];
};

type DeleteReportHookResult = {
  mutateAsync: (variables: DeleteReportVariables) => Promise<{ message: string }>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
  mutation: UseConvexMutationResult<typeof api.reports.deleteReport>["mutation"];
};

const ensureConvexId = (
  label: string,
  convexId: string | null | undefined
): string => {
  if (!convexId) {
    throw new Error(`No se pudo determinar el identificador Convex del ${label}.`);
  }
  return convexId;
};

const findChurchConvexId = (
  churches: Array<{ id: number; convexId: string | null }>,
  supabaseId: number
): string => {
  const match = churches.find((church) => church.id === supabaseId);
  if (!match || !match.convexId) {
    throw new Error("No se pudo encontrar la iglesia seleccionada en Convex.");
  }
  return match.convexId;
};

type CreateArgs = MutationArgs<typeof api.reports.create>;
type UpdateArgs = MutationArgs<typeof api.reports.update>;

export type CreateReportPayload = {
  church_id: number;
  month: number;
  year: number;
  diezmos: number;
  ofrendas: number;
  anexos?: number;
  caballeros?: number;
  damas?: number;
  jovenes?: number;
  ninos?: number;
  otros?: number;
  misiones?: number;
  lazos_amor?: number;
  mision_posible?: number;
  apy?: number;
  iba?: number;
  energia_electrica?: number;
  agua?: number;
  recoleccion_basura?: number;
  servicios?: number;
  mantenimiento?: number;
  materiales?: number;
  otros_gastos?: number;
  monto_depositado?: number;
  honorarios_pastoral?: number;
  numero_deposito?: string;
  fecha_deposito?: string;
  observaciones?: string;
  total_designado?: number;
  diezmo_nacional_calculado?: number;
  total_operativo?: number;
  total_salidas_calculadas?: number;
  saldo_calculado?: number;
  estado?: string;
  aportantes?: Array<{
    first_name: string;
    last_name: string;
    document: string;
    amount: number;
  }>;
  attachments?: {
    summary?: string;
    deposit?: string;
  };
  transactionsCreated?: boolean;
};

export type UpdateReportPayload = Partial<CreateReportPayload> & {
  estado?: string;
  attachments?: {
    summary?: string | null;
    deposit?: string | null;
  };
};

export type UpdateReportVariables = UpdateReportPayload & {
  reportId: number;
  convexId?: string | null;
};

export type DeleteReportVariables = {
  reportId: number;
  convexId?: string | null;
};

const mapCreateResult = (result: unknown): ReportRecord =>
  mapConvexReportToRecord(result as ConvexReportDocument);

const mapUpdateResult = (result: unknown): ReportRecord =>
  mapConvexReportToRecord(result as ConvexReportDocument);

export function useCreateReport(): CreateReportHookResult {
  const { data: churches } = useChurches();

  const mutation = useConvexMutation(api.reports.create, {
    successMessage: "Informe registrado exitosamente",
    errorMessage: "Ocurrió un error al registrar el informe",
  });

  const mutateAsync = useCallback(
    async (payload: CreateReportPayload): Promise<ReportRecord> => {
      const churchConvexId = findChurchConvexId(churches, payload.church_id);
      const args = mapCreatePayload(payload, churchConvexId);
      const result = await mutation.mutateAsync(args as CreateArgs[0]);
      return mapCreateResult(result);
    },
    [churches, mutation]
  );

  return {
    mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
    mutation: mutation.mutation,
  };
}

export function useUpdateReport(): UpdateReportHookResult {
  const updateMutation = useConvexMutation(api.reports.update, {
    successMessage: "Informe actualizado",
    errorMessage: "No se pudo actualizar el informe",
  });
  const approveMutation = useConvexMutation(api.reports.approve, {
    successMessage: "Informe aprobado",
    errorMessage: "No se pudo aprobar el informe",
  });
  const rejectMutation = useConvexMutation(api.reports.reject, {
    successMessage: "Informe rechazado",
    errorMessage: "No se pudo rechazar el informe",
  });

  const mutateAsync = useCallback(
    async (payload: UpdateReportVariables): Promise<ReportRecord> => {
      const convexId = ensureConvexId("informe", payload.convexId);

      // Route status transitions to dedicated mutations (matches previous /api/reports behavior)
      if (payload.estado) {
        const estado = payload.estado.toLowerCase();

        // "aprobado" or "procesado" both route to approve mutation
        if (estado.includes("aprob") || estado === "procesado") {
          const result = await approveMutation.mutateAsync({ id: convexId as Id<'reports'> });
          return mapUpdateResult(result);
        }

        // "rechazado" routes to reject mutation
        if (estado.includes("rechaz")) {
          const reason = payload.observaciones ?? "Reporte rechazado";
          const result = await rejectMutation.mutateAsync({
            id: convexId as Id<'reports'>,
            observaciones: reason,
          });
          return mapUpdateResult(result);
        }
      }

      // All other updates (including field edits without status changes) go through generic update
      const args = mapUpdatePayload(payload, convexId);
      const result = await updateMutation.mutateAsync(args as UpdateArgs[0]);
      return mapUpdateResult(result);
    },
    [approveMutation, rejectMutation, updateMutation]
  );

  const isPending =
    updateMutation.isPending ||
    approveMutation.isPending ||
    rejectMutation.isPending;
  const error = updateMutation.error || approveMutation.error || rejectMutation.error;

  const reset = useCallback(() => {
    updateMutation.reset();
    approveMutation.reset();
    rejectMutation.reset();
  }, [updateMutation, approveMutation, rejectMutation]);

  return {
    mutateAsync,
    isPending,
    error,
    reset,
    mutation: updateMutation.mutation,
  };
}

export function useDeleteReport(): DeleteReportHookResult {
  const mutation = useConvexMutation(api.reports.deleteReport, {
    successMessage: "Informe eliminado",
    errorMessage: "No se pudo eliminar el informe",
  });

  const mutateAsync = useCallback(
    async ({ convexId }: DeleteReportVariables) => {
      const resolvedConvexId = ensureConvexId("informe", convexId);
      await mutation.mutateAsync({ id: resolvedConvexId as Id<'reports'> });
      return { message: "Informe eliminado" };
    },
    [mutation]
  );

  return {
    mutateAsync,
    isPending: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
    mutation: mutation.mutation,
  };
}
