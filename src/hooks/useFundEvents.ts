import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchJson } from '@/lib/api-client';
import type {
  EventFilters,
  CreateEventInput,
  FundEventsApiResponse,
  FundEventCollection,
  FundEventDetail,
  EventBudgetItem,
  RawFundEventDetail,
  RawEventBudgetItem,
} from '@/types/financial';
import {
  normalizeFundEventsResponse,
  normalizeFundEventDetail,
  normalizeEventBudgetItem,
} from '@/types/financial';

export function useFundEvents(filters?: EventFilters) {
  return useQuery<FundEventCollection>({
    queryKey: ['fund-events', filters ?? null],
    queryFn: async () => {
      const params = new URLSearchParams();

      if (filters?.status) params.append('status', filters.status);
      if (filters?.fundId) params.append('fund_id', filters.fundId.toString());
      if (filters?.churchId) params.append('church_id', filters.churchId.toString());
      if (filters?.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters?.dateTo) params.append('date_to', filters.dateTo);

      const queryString = params.toString();
      const url = `/api/fund-events${queryString ? `?${queryString}` : ''}`;

      const data = await fetchJson<FundEventsApiResponse>(url);
      return normalizeFundEventsResponse(data);
    },
  });
}

export function useFundEvent(eventId: string | null) {
  return useQuery<FundEventDetail | null>({
    queryKey: ['fund-event', eventId],
    queryFn: async () => {
      if (!eventId) return null;

      const result = await fetchJson<{ data: RawFundEventDetail }>(`/api/fund-events/${eventId}`);
      return normalizeFundEventDetail(result.data);
    },
    enabled: !!eventId,
  });
}

export function useFundEventBudgetItems(eventId: string | null) {
  return useQuery<EventBudgetItem[]>({
    queryKey: ['fund-event-budget', eventId],
    queryFn: async () => {
      if (!eventId) return [];

      const result = await fetchJson<{ data: RawEventBudgetItem[] }>(`/api/fund-events/${eventId}/budget`);
      return (result.data || []).map(normalizeEventBudgetItem);
    },
    enabled: !!eventId,
  });
}

export function useFundEventActuals(eventId: string | null) {
  return useQuery({
    queryKey: ['fund-event-actuals', eventId],
    queryFn: async () => {
      if (!eventId) return [];

      const result = await fetchJson<{ data: unknown[] }>(`/api/fund-events/${eventId}/actuals`);
      return result.data || [];
    },
    enabled: !!eventId,
  });
}

export function useEventMutations() {
  const queryClient = useQueryClient();

  const createEvent = useMutation({
    mutationFn: async (data: CreateEventInput) => {
      return fetchJson('/api/fund-events', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
    },
  });

  const updateEvent = useMutation({
    mutationFn: async ({
      eventId,
      data,
    }: {
      eventId: string;
      data: Partial<CreateEventInput>;
    }) => {
      return fetchJson(`/api/fund-events/${eventId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
      queryClient.invalidateQueries({ queryKey: ['fund-event', variables.eventId] });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      return fetchJson(`/api/fund-events/${eventId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
    },
  });

  const submitEvent = useMutation({
    mutationFn: async (eventId: string) => {
      return fetchJson(`/api/fund-events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'submit' }),
      });
    },
    onSuccess: (_data, eventId) => {
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
      queryClient.invalidateQueries({ queryKey: ['fund-event', eventId] });
    },
  });

  const approveEvent = useMutation({
    mutationFn: async ({
      eventId,
      comment,
    }: {
      eventId: string;
      comment?: string;
    }) => {
      return fetchJson(`/api/fund-events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'approve', comment }),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
      queryClient.invalidateQueries({ queryKey: ['fund-event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['funds'] });
    },
  });

  const rejectEvent = useMutation({
    mutationFn: async ({
      eventId,
      reason,
    }: {
      eventId: string;
      reason: string;
    }) => {
      return fetchJson(`/api/fund-events/${eventId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reject', rejection_reason: reason }),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
      queryClient.invalidateQueries({ queryKey: ['fund-event', variables.eventId] });
    },
  });

  const addActual = useMutation({
    mutationFn: async ({
      eventId,
      data,
    }: {
      eventId: string;
      data: {
        line_type: 'income' | 'expense';
        description: string;
        amount: number;
        receipt_url?: string;
        notes?: string;
      };
    }) => {
      return fetchJson(`/api/fund-events/${eventId}/actuals`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['fund-event-actuals', variables.eventId],
      });
      queryClient.invalidateQueries({ queryKey: ['fund-event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
    },
  });

  const updateActual = useMutation({
    mutationFn: async ({
      eventId,
      actualId,
      data,
    }: {
      eventId: string;
      actualId: string;
      data: Partial<{
        line_type: 'income' | 'expense';
        description: string;
        amount: number;
        receipt_url?: string;
        notes?: string;
      }>;
    }) => {
      return fetchJson(`/api/fund-events/${eventId}/actuals/${actualId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fund-event-actuals', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['fund-event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
    },
  });

  const deleteActual = useMutation({
    mutationFn: async ({ eventId, actualId }: { eventId: string; actualId: string }) => {
      return fetchJson(`/api/fund-events/${eventId}/actuals/${actualId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fund-event-actuals', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['fund-event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
    },
  });

  const addBudgetItem = useMutation({
    mutationFn: async ({
      eventId,
      data,
    }: {
      eventId: string;
      data: {
        category: string;
        description: string;
        projected_amount: number;
        notes?: string;
      };
    }) => {
      return fetchJson(`/api/fund-events/${eventId}/budget`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fund-event-budget', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['fund-event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
    },
  });

  const updateBudgetItem = useMutation({
    mutationFn: async ({
      eventId,
      budgetItemId,
      data,
    }: {
      eventId: string;
      budgetItemId: string;
      data: {
        category?: string;
        description?: string;
        projected_amount?: number;
        notes?: string;
      };
    }) => {
      return fetchJson(`/api/fund-events/${eventId}/budget/${budgetItemId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fund-event-budget', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['fund-event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
    },
  });

  const deleteBudgetItem = useMutation({
    mutationFn: async ({ eventId, budgetItemId }: { eventId: string; budgetItemId: string }) => {
      return fetchJson(`/api/fund-events/${eventId}/budget/${budgetItemId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fund-event-budget', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['fund-event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
    },
  });

  return {
    createEvent,
    updateEvent,
    deleteEvent,
    submitEvent,
    approveEvent,
    rejectEvent,
    addActual,
    updateActual,
    deleteActual,
    addBudgetItem,
    updateBudgetItem,
    deleteBudgetItem,
  };
}