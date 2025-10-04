'use client';

import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { fetchJson } from '@/lib/api-client';
import type { ReportRecord } from '@/types/api';

const invalidateReportQueries = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['reports'], exact: false }).catch(() => {
    // ignore invalidate errors (mostly during teardown)
  });
};

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
};

export type UpdateReportPayload = Partial<CreateReportPayload> & {
  estado?: string;
  attachments?: {
    summary?: string | null;
    deposit?: string | null;
  };
};

export function useCreateReport(): UseMutationResult<ReportRecord, unknown, CreateReportPayload, unknown> {
  const queryClient = useQueryClient();

  return useMutation<ReportRecord, unknown, CreateReportPayload>({
    mutationFn: async (payload) => {
      const response = await fetchJson<{ success: boolean; report: ReportRecord }>('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!response.success) {
        throw new Error('No se pudo crear el informe.');
      }
      return response.report;
    },
    onSuccess: () => {
      invalidateReportQueries(queryClient);
      toast.success('Informe registrado exitosamente');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Ocurrió un error al registrar el informe';
      toast.error(message);
    }
  });
}

export function useUpdateReport(reportId: number): UseMutationResult<ReportRecord, unknown, UpdateReportPayload, unknown> {
  const queryClient = useQueryClient();

  return useMutation<ReportRecord, unknown, UpdateReportPayload>({
    mutationFn: async (payload) => {
      const params = new URLSearchParams({ id: String(reportId) });
      const response = await fetchJson<{ success: boolean; report: ReportRecord }>(`/api/reports?${params}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!response.success) {
        throw new Error('No se pudo actualizar el informe.');
      }
      return response.report;
    },
    onSuccess: () => {
      invalidateReportQueries(queryClient);
      toast.success('Informe actualizado');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el informe';
      toast.error(message);
    }
  });
}

export function useDeleteReport(): UseMutationResult<{ message: string }, unknown, { reportId: number }, unknown> {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, unknown, { reportId: number }>({
    mutationFn: async ({ reportId }) => {
      const params = new URLSearchParams({ id: String(reportId) });
      return fetchJson<{ message: string }>(`/api/reports?${params}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      invalidateReportQueries(queryClient);
      toast.success('Informe eliminado');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar el informe';
      toast.error(message);
    }
  });
}
