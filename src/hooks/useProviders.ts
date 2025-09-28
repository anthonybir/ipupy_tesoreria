import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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

type UseProvidersOptions = {
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

export function useProviders(options: UseProvidersOptions = {}) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['providers', options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options.categoria) params.append('categoria', options.categoria);
      if (options.es_activo !== undefined) params.append('es_activo', String(options.es_activo));
      if (options.limit) params.append('limit', String(options.limit));
      if (options.offset) params.append('offset', String(options.offset));

      const response = await fetch(`/api/providers?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Error al cargar proveedores');
      }
      return response.json() as Promise<{ data: Provider[]; count: number }>;
    },
  });

  const createProvider = useMutation({
    mutationFn: async (input: CreateProviderInput) => {
      const response = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (response.status === 409) {
        throw new Error('Ya existe un proveedor con este RUC');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Error al crear proveedor');
      }

      return data as { data: Provider };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });

  const updateProvider = useMutation({
    mutationFn: async (input: UpdateProviderInput) => {
      const response = await fetch('/api/providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al actualizar proveedor');
      }

      return response.json() as Promise<{ data: Provider }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });

  const deleteProvider = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/providers?id=${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al eliminar proveedor');
      }

      return response.json() as Promise<{ success: boolean }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
    },
  });

  return {
    ...query,
    createProvider,
    updateProvider,
    deleteProvider,
  };
}

export function useProviderSearch(searchQuery: string, categoria?: string) {
  return useQuery({
    queryKey: ['providers', 'search', searchQuery, categoria],
    queryFn: async () => {
      const params = new URLSearchParams({ q: searchQuery });
      if (categoria) params.append('categoria', categoria);

      const response = await fetch(`/api/providers/search?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Error al buscar proveedores');
      }
      return response.json() as Promise<{ data: Provider[] }>;
    },
    enabled: searchQuery.length >= 2,
  });
}

export function useCheckRuc(ruc: string) {
  return useQuery({
    queryKey: ['providers', 'check-ruc', ruc],
    queryFn: async () => {
      const response = await fetch(`/api/providers/check-ruc?ruc=${encodeURIComponent(ruc)}`);
      if (!response.ok) {
        throw new Error('Error al verificar RUC');
      }
      return response.json() as Promise<{ exists: boolean; provider: Provider | null }>;
    },
    enabled: ruc.length >= 3,
  });
}