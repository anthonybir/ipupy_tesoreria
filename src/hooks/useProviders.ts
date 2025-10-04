import { useQuery, useMutation, useQueryClient, type UseQueryResult, type UseMutationResult } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api-client';

export type Provider = {
  id: number;
  ruc: string;
  nombre: string;
  tipo_identificacion: 'RUC' | 'NIS' | 'ISSAN' | 'CI';
  razon_social?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  email?: string | null;
  categoria?: 'servicios_publicos' | 'honorarios' | 'suministros' | 'construccion' | 'otros' | null;
  notas?: string | null;
  es_activo: boolean;
  es_especial: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
};

export type UseProvidersOptions = {
  categoria?: string;
  es_activo?: boolean;
  limit?: number;
  offset?: number;
};

type CreateProviderInput = {
  ruc: string;
  nombre: string;
  tipo_identificacion: 'RUC' | 'NIS' | 'ISSAN' | 'CI';
  razon_social?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  categoria?: 'servicios_publicos' | 'honorarios' | 'suministros' | 'construccion' | 'otros';
  notas?: string;
};

type UpdateProviderInput = {
  id: number;
  nombre?: string;
  razon_social?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  categoria?: 'servicios_publicos' | 'honorarios' | 'suministros' | 'construccion' | 'otros';
  notas?: string;
  es_activo?: boolean;
};

type UseProvidersResult = UseQueryResult<{ data: Provider[]; count: number }, Error> & {
  createProvider: UseMutationResult<{ data: Provider }, Error, CreateProviderInput, unknown>;
  updateProvider: UseMutationResult<{ data: Provider }, Error, UpdateProviderInput, unknown>;
  deleteProvider: UseMutationResult<{ success: boolean }, Error, number, unknown>;
  reactivateProvider: UseMutationResult<{ data: Provider }, Error, number, unknown>;
};

export function useProviders(options: UseProvidersOptions = {}): UseProvidersResult {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['providers', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.categoria) params.append('categoria', options.categoria);
      if (options.es_activo !== undefined) params.append('es_activo', String(options.es_activo));
      if (options.limit) params.append('limit', String(options.limit));
      if (options.offset) params.append('offset', String(options.offset));

      return fetchJson<{ data: Provider[]; count: number }>(`/api/providers?${params.toString()}`);
    },
  });

  const createProvider = useMutation({
    mutationFn: async (input: CreateProviderInput) => {
      return fetchJson<{ data: Provider }>('/api/providers', {
        method: 'POST',
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });

  const updateProvider = useMutation({
    mutationFn: async (input: UpdateProviderInput) => {
      return fetchJson<{ data: Provider }>('/api/providers', {
        method: 'PUT',
        body: JSON.stringify(input),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });

  const deleteProvider = useMutation({
    mutationFn: async (id: number) => {
      return fetchJson<{ success: boolean }>(`/api/providers?id=${id}`, {
        method: 'DELETE',
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });

  const reactivateProvider = useMutation({
    mutationFn: async (id: number) => {
      return fetchJson<{ data: Provider }>('/api/providers', {
        method: 'PUT',
        body: JSON.stringify({ id, es_activo: true }),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });

  return {
    ...query,
    createProvider,
    updateProvider,
    deleteProvider,
    reactivateProvider,
  };
}

export function useProviderSearch(searchQuery: string, categoria?: string): UseQueryResult<{ data: Provider[] }, Error> {
  return useQuery({
    queryKey: ['providers', 'search', searchQuery, categoria],
    queryFn: async () => {
      const params = new URLSearchParams({ q: searchQuery });
      if (categoria) params.append('categoria', categoria);

      return fetchJson<{ data: Provider[] }>(`/api/providers/search?${params.toString()}`);
    },
    enabled: searchQuery.length >= 2,
  });
}

export function useCheckRuc(ruc: string): UseQueryResult<{ exists: boolean; provider: Provider | null }, Error> {
  return useQuery({
    queryKey: ['providers', 'check-ruc', ruc],
    queryFn: async () => {
      return fetchJson<{ exists: boolean; provider: Provider | null }>(
        `/api/providers/check-ruc?ruc=${encodeURIComponent(ruc)}`
      );
    },
    enabled: ruc.length >= 3,
  });
}