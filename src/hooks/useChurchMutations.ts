'use client';

import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

import { fetchJson } from '@/lib/api-client';
import type { ChurchRecord } from '@/types/api';

const invalidateChurches = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ queryKey: ['churches'], exact: false }).catch(() => {});
};

type PrimaryPastorPayload = {
  fullName?: string;
  preferredName?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  nationalId?: string | null;
  taxId?: string | null;
  grado?: string | null;
  roleTitle?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  notes?: string | null;
  isPrimary?: boolean | null;
};

export type CreateChurchPayload = {
  name: string;
  city: string;
  pastor: string;
  phone?: string;
  email?: string;
  ruc?: string;
  cedula?: string;
  grado?: string;
  posicion?: string;
  active?: boolean;
  primaryPastor?: PrimaryPastorPayload;
};

export type UpdateChurchPayload = Partial<CreateChurchPayload>;

export function useCreateChurch() {
  const queryClient = useQueryClient();

  return useMutation<ChurchRecord, unknown, CreateChurchPayload>({
    mutationFn: async (payload) => {
      const response = await fetchJson<ChurchRecord>('/api/churches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      return response;
    },
    onSuccess: () => {
      invalidateChurches(queryClient);
      toast.success('Iglesia registrada exitosamente');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo registrar la iglesia';
      toast.error(message);
    }
  });
}

export function useUpdateChurch(churchId: number) {
  const queryClient = useQueryClient();

  return useMutation<ChurchRecord, unknown, UpdateChurchPayload>({
    mutationFn: async (payload) => {
      const params = new URLSearchParams({ id: String(churchId) });
      const response = await fetchJson<ChurchRecord>(`/api/churches?${params}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      return response;
    },
    onSuccess: () => {
      invalidateChurches(queryClient);
      toast.success('Iglesia actualizada');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar la iglesia';
      toast.error(message);
    }
  });
}

export function useDeactivateChurch() {
  const queryClient = useQueryClient();

  return useMutation<{ message: string }, unknown, { churchId: number }>({
    mutationFn: async ({ churchId }) => {
      const params = new URLSearchParams({ id: String(churchId) });
      return fetchJson<{ message: string }>(`/api/churches?${params}`, {
        method: 'DELETE'
      });
    },
    onSuccess: () => {
      invalidateChurches(queryClient);
      toast.success('Iglesia desactivada');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'No se pudo desactivar la iglesia';
      toast.error(message);
    }
  });
}
