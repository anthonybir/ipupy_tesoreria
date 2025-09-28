import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  EventFilters,
  CreateEventInput,
  FundEventsApiResponse,
  FundEventCollection,
  FundEventDetail,
  EventBudgetItem,
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
      const response = await fetch(url);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch fund events');
      }

      const data: FundEventsApiResponse = await response.json();
      return normalizeFundEventsResponse(data);
    },
  });
}

export function useFundEvent(eventId: string | null) {
  return useQuery<FundEventDetail | null>({
    queryKey: ['fund-event', eventId],
    queryFn: async () => {
      if (!eventId) return null;

      const response = await fetch(`/api/fund-events/${eventId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch event');
      }

      const result = await response.json();
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

      const response = await fetch(`/api/fund-events/${eventId}/budget`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch budget items');
      }

      const result = await response.json();
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

      const response = await fetch(`/api/fund-events/${eventId}/actuals`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch actuals');
      }

      const result = await response.json();
      return result.data || [];
    },
    enabled: !!eventId,
  });
}

export function useEventMutations() {
  const queryClient = useQueryClient();

  const createEvent = useMutation({
    mutationFn: async (data: CreateEventInput) => {
      const response = await fetch('/api/fund-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create event');
      }

      return response.json();
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
      const response = await fetch(`/api/fund-events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update event');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
      queryClient.invalidateQueries({ queryKey: ['fund-event', variables.eventId] });
    },
  });

  const deleteEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await fetch(`/api/fund-events/${eventId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete event');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
    },
  });

  const submitEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await fetch(`/api/fund-events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit' }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit event');
      }

      return response.json();
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
      const response = await fetch(`/api/fund-events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve', comment }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to approve event');
      }

      return response.json();
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
      const response = await fetch(`/api/fund-events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', rejection_reason: reason }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reject event');
      }

      return response.json();
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
      const response = await fetch(`/api/fund-events/${eventId}/actuals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add actual');
      }

      return response.json();
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
      const response = await fetch(`/api/fund-events/${eventId}/actuals/${actualId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update actual');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fund-event-actuals', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['fund-event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
    },
  });

  const deleteActual = useMutation({
    mutationFn: async ({ eventId, actualId }: { eventId: string; actualId: string }) => {
      const response = await fetch(`/api/fund-events/${eventId}/actuals/${actualId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete actual');
      }

      return response.json();
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
      const response = await fetch(`/api/fund-events/${eventId}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add budget item');
      }

      return response.json();
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
      const response = await fetch(`/api/fund-events/${eventId}/budget/${budgetItemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update budget item');
      }

      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['fund-event-budget', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['fund-event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['fund-events'] });
    },
  });

  const deleteBudgetItem = useMutation({
    mutationFn: async ({ eventId, budgetItemId }: { eventId: string; budgetItemId: string }) => {
      const response = await fetch(`/api/fund-events/${eventId}/budget/${budgetItemId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete budget item');
      }

      return response.json();
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