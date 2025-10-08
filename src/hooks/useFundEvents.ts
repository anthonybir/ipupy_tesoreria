"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import type { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";

import {
  mapFundEventsListResponse,
  mapFundEventDetailToRaw,
  type ConvexFundEventDocument,
  type ConvexFundEventDetailDocument,
} from "@/lib/convex-adapters";
import {
  normalizeFundEventsResponse,
  normalizeFundEventDetail,
  normalizeEventBudgetItem,
  type EventFilters,
  type CreateEventInput,
  type FundEventCollection,
  type FundEventDetail,
  type EventBudgetItem,
  type RawEventActual,
  type FundRecord,
} from "@/types/financial";
import { useFunds } from "@/hooks/useFunds";
import { useChurches } from "@/hooks/useChurches";
import {
  useConvexQueryState,
  type ConvexQueryState,
} from "@/hooks/useConvexQueryState";

type LookupMaps = {
  fundMap: Map<string, number>;
  churchMap: Map<string, number>;
};

type BiDirectionalMaps = {
  supabaseToConvex: Map<number, string>;
  convexToSupabase: Map<string, number>;
};

type UpdateEventVariables = {
  eventId: string;
  data: Partial<CreateEventInput>;
};

type DeleteEventVariables = string;
type SubmitEventVariables = string;
type ApproveEventVariables = { eventId: string; comment?: string };
type RejectEventVariables = { eventId: string; reason: string };

type AddActualVariables = {
  eventId: string;
  data: {
    line_type: "income" | "expense";
    description: string;
    amount: number;
    receipt_url?: string;
    notes?: string;
  };
};

type UpdateActualVariables = {
  eventId: string;
  actualId: string;
  data: Partial<{
    line_type: "income" | "expense";
    description: string;
    amount: number;
    receipt_url?: string;
    notes?: string;
  }>;
};

type DeleteActualVariables = { eventId: string; actualId: string };

type AddBudgetItemVariables = {
  eventId: string;
  data: {
    category: string;
    description: string;
    projected_amount: number;
    notes?: string;
  };
};

type UpdateBudgetItemVariables = {
  eventId: string;
  budgetItemId: string;
  data: Partial<{
    description: string;
    projected_amount: number;
    notes?: string;
  }>;
};

type DeleteBudgetItemVariables = { eventId: string; budgetItemId: string };

type AsyncMutationResult<Variables, Result = void> = {
  mutateAsync: (variables: Variables) => Promise<Result>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
};

type FundEventsQueryArgs = {
  status?: string;
  fund_id?: string;
  church_id?: string;
  date_from?: number;
  date_to?: number;
  limit?: number;
  offset?: number;
};

const EMPTY_COLLECTION: FundEventCollection = {
  records: [],
  stats: undefined,
};

const EMPTY_BUDGET_ITEMS: EventBudgetItem[] = [];
const EMPTY_ACTUALS: RawEventActual[] = [];

const buildFundMaps = (records: FundRecord[]): BiDirectionalMaps => {
  const supabaseToConvex = new Map<number, string>();
  const convexToSupabase = new Map<string, number>();

  for (const fund of records) {
    if (fund.convexId) {
      supabaseToConvex.set(fund.id, fund.convexId);
      convexToSupabase.set(fund.convexId, fund.id);
    }
  }

  return { supabaseToConvex, convexToSupabase };
};

const buildChurchMaps = (
  churches: Array<{ id: number; convexId: string | null }>
): BiDirectionalMaps => {
  const supabaseToConvex = new Map<number, string>();
  const convexToSupabase = new Map<string, number>();

  for (const church of churches) {
    if (church.convexId) {
      supabaseToConvex.set(church.id, church.convexId);
      convexToSupabase.set(church.convexId, church.id);
    }
  }

  return { supabaseToConvex, convexToSupabase };
};

const ensureTimestamp = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    throw new Error("Fecha inválida");
  }
  return parsed;
};

const useAsyncMutation = <Variables, Result = void>(
  handler: (variables: Variables) => Promise<Result>
): AsyncMutationResult<Variables, Result> => {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = useCallback(
    async (variables: Variables) => {
      setIsPending(true);
      setError(null);
      try {
        return await handler(variables);
      } catch (rawError) {
        const normalized =
          rawError instanceof Error
            ? rawError
            : new Error("Ocurrió un error al procesar la solicitud.");
        setError(normalized);
        throw normalized;
      } finally {
        setIsPending(false);
      }
    },
    [handler]
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { mutateAsync, isPending, error, reset };
};

const buildLookupMaps = (fundMaps: BiDirectionalMaps, churchMaps: BiDirectionalMaps): LookupMaps => ({
  fundMap: new Map(fundMaps.convexToSupabase),
  churchMap: new Map(churchMaps.convexToSupabase),
});

const buildListArgs = (
  filters: EventFilters | undefined,
  fundSupabaseToConvex: Map<number, string>,
  churchSupabaseToConvex: Map<number, string>
): readonly unknown[] => {
  if (!filters) {
    return [{}];
  }

  const args: FundEventsQueryArgs = {};

  if (filters.status) {
    args.status = filters.status;
  }

  if (filters.fundId) {
    const convexId = fundSupabaseToConvex.get(filters.fundId);
    if (convexId) {
      args.fund_id = convexId;
    }
  }

  if (filters.churchId) {
    const convexId = churchSupabaseToConvex.get(filters.churchId);
    if (convexId) {
      args.church_id = convexId;
    }
  }

  if (filters.dateFrom) {
    const timestamp = Date.parse(filters.dateFrom);
    if (!Number.isNaN(timestamp)) {
      args.date_from = timestamp;
    }
  }

  if (filters.dateTo) {
    const timestamp = Date.parse(filters.dateTo);
    if (!Number.isNaN(timestamp)) {
      args.date_to = timestamp;
    }
  }

  return Object.keys(args).length > 0 ? [args] : [{}];
};

export function useFundEvents(
  filters?: EventFilters
): ConvexQueryState<FundEventCollection> & { data: FundEventCollection } {
  const fundsQuery = useFunds({ includeInactive: true });
  const churchesQuery = useChurches();

  const fundMaps = useMemo(
    () => buildFundMaps(fundsQuery.data.records),
    [fundsQuery.data.records]
  );
  const churchMaps = useMemo(
    () => buildChurchMaps(churchesQuery.data),
    [churchesQuery.data]
  );

  const lookupMaps = useMemo(
    () => buildLookupMaps(fundMaps, churchMaps),
    [fundMaps, churchMaps]
  );

  const args = useMemo(
    () => buildListArgs(filters, fundMaps.supabaseToConvex, churchMaps.supabaseToConvex),
    [filters, fundMaps.supabaseToConvex, churchMaps.supabaseToConvex]
  );

  const queryResult = useConvexQueryState(
    api.fundEvents.list,
    args,
    (result: {
      data: ConvexFundEventDocument[];
      total: number;
      stats?: {
        draft?: number;
        submitted?: number;
        approved?: number;
        rejected?: number;
        pending_revision?: number;
      };
    }) => {
      const payload = mapFundEventsListResponse(result, lookupMaps);
      return normalizeFundEventsResponse(payload);
    }
  );

  const data = useMemo(() => queryResult.data ?? EMPTY_COLLECTION, [queryResult.data]);

  return {
    ...queryResult,
    data,
  };
}

export function useFundEvent(
  eventId: string | null
): ConvexQueryState<FundEventDetail | null> & { data: FundEventDetail | null } {
  const fundsQuery = useFunds({ includeInactive: true });
  const churchesQuery = useChurches();

  const lookupMaps = useMemo(
    () => buildLookupMaps(buildFundMaps(fundsQuery.data.records), buildChurchMaps(churchesQuery.data)),
    [fundsQuery.data.records, churchesQuery.data]
  );

  const args = useMemo(() => (eventId ? [{ id: eventId }] : []), [eventId]);

  const queryResult = useConvexQueryState(
    api.fundEvents.get,
    args,
    (event: ConvexFundEventDetailDocument) => {
      const raw = mapFundEventDetailToRaw(event, lookupMaps);
      return normalizeFundEventDetail(raw);
    },
    { enabled: Boolean(eventId) }
  );

  return {
    ...queryResult,
    data: queryResult.data ?? null,
  };
}

export function useFundEventBudgetItems(
  eventId: string | null
): ConvexQueryState<EventBudgetItem[]> & { data: EventBudgetItem[] } {
  const fundsQuery = useFunds({ includeInactive: true });
  const churchesQuery = useChurches();

  const lookupMaps = useMemo(
    () => buildLookupMaps(buildFundMaps(fundsQuery.data.records), buildChurchMaps(churchesQuery.data)),
    [fundsQuery.data.records, churchesQuery.data]
  );

  const args = useMemo(() => (eventId ? [{ id: eventId }] : []), [eventId]);

  const queryResult = useConvexQueryState(
    api.fundEvents.get,
    args,
    (event: ConvexFundEventDetailDocument) => {
      const raw = mapFundEventDetailToRaw(event, lookupMaps);
      return raw.budget_items.map(normalizeEventBudgetItem);
    },
    { enabled: Boolean(eventId) }
  );

  const data = useMemo(() => queryResult.data ?? EMPTY_BUDGET_ITEMS, [queryResult.data]);

  return {
    ...queryResult,
    data,
  };
}

export function useFundEventActuals(
  eventId: string | null
): ConvexQueryState<RawEventActual[]> & { data: RawEventActual[] } {
  const fundsQuery = useFunds({ includeInactive: true });
  const churchesQuery = useChurches();

  const lookupMaps = useMemo(
    () => buildLookupMaps(buildFundMaps(fundsQuery.data.records), buildChurchMaps(churchesQuery.data)),
    [fundsQuery.data.records, churchesQuery.data]
  );

  const args = useMemo(() => (eventId ? [{ id: eventId }] : []), [eventId]);

  const queryResult = useConvexQueryState(
    api.fundEvents.get,
    args,
    (event: ConvexFundEventDetailDocument) => {
      const raw = mapFundEventDetailToRaw(event, lookupMaps);
      return raw.actuals;
    },
    { enabled: Boolean(eventId) }
  );

  const data = useMemo(() => queryResult.data ?? EMPTY_ACTUALS, [queryResult.data]);

  return {
    ...queryResult,
    data,
  };
}

export const useEventMutations = (): {
  createEvent: AsyncMutationResult<CreateEventInput>;
  updateEvent: AsyncMutationResult<UpdateEventVariables>;
  deleteEvent: AsyncMutationResult<DeleteEventVariables>;
  submitEvent: AsyncMutationResult<SubmitEventVariables>;
  approveEvent: AsyncMutationResult<ApproveEventVariables>;
  rejectEvent: AsyncMutationResult<RejectEventVariables>;
  addActual: AsyncMutationResult<AddActualVariables>;
  updateActual: AsyncMutationResult<UpdateActualVariables>;
  deleteActual: AsyncMutationResult<DeleteActualVariables>;
  addBudgetItem: AsyncMutationResult<AddBudgetItemVariables>;
  updateBudgetItem: AsyncMutationResult<UpdateBudgetItemVariables>;
  deleteBudgetItem: AsyncMutationResult<DeleteBudgetItemVariables>;
} => {
  const fundsQuery = useFunds({ includeInactive: true });
  const churchesQuery = useChurches();

  const fundMaps = useMemo(
    () => buildFundMaps(fundsQuery.data.records),
    [fundsQuery.data.records]
  );
  const churchMaps = useMemo(
    () => buildChurchMaps(churchesQuery.data),
    [churchesQuery.data]
  );

  const ensureFundConvexId = useCallback(
    (supabaseId: number): string => {
      const convexId = fundMaps.supabaseToConvex.get(supabaseId);
      if (!convexId) {
        throw new Error("No se pudo encontrar el fondo seleccionado.");
      }
      return convexId;
    },
    [fundMaps.supabaseToConvex]
  );

  const ensureChurchConvexId = useCallback(
    (supabaseId: number): string => {
      const convexId = churchMaps.supabaseToConvex.get(supabaseId);
      if (!convexId) {
        throw new Error("No se pudo encontrar la iglesia seleccionada.");
      }
      return convexId;
    },
    [churchMaps.supabaseToConvex]
  );

  const createConvexEvent = useMutation(api.fundEvents.create);
  const updateConvexEvent = useMutation(api.fundEvents.update);
  const deleteConvexEvent = useMutation(api.fundEvents.deleteEvent);
  const submitConvexEvent = useMutation(api.fundEvents.submit);
  const approveConvexEvent = useMutation(api.fundEvents.approve);
  const rejectConvexEvent = useMutation(api.fundEvents.reject);
  const addBudgetItemConvex = useMutation(api.fundEvents.addBudgetItem);
  const updateBudgetItemConvex = useMutation(api.fundEvents.updateBudgetItem);
  const deleteBudgetItemConvex = useMutation(api.fundEvents.deleteBudgetItem);
  const addActualConvex = useMutation(api.fundEvents.addActual);
  const updateActualConvex = useMutation(api.fundEvents.updateActual);
  const deleteActualConvex = useMutation(api.fundEvents.deleteActual);

  const createEvent = useAsyncMutation<CreateEventInput>(async (payload) => {
    const fundConvexId = ensureFundConvexId(payload.fund_id);
    const churchConvexId =
      payload.church_id !== undefined && payload.church_id !== null
        ? ensureChurchConvexId(payload.church_id)
        : null;

    const eventDate = ensureTimestamp(payload.event_date);
    if (!eventDate) {
      throw new Error("La fecha del evento es requerida.");
    }

    const created = await createConvexEvent({
      fund_id: fundConvexId as Id<"funds">,
      ...(churchConvexId ? { church_id: churchConvexId as Id<"churches"> } : {}),
      name: payload.name,
      ...(payload.description ? { description: payload.description } : {}),
      event_date: eventDate,
    });

    if (!created?._id) {
      throw new Error("No se pudo crear el evento.");
    }

    if (payload.budget_items && payload.budget_items.length > 0) {
      for (const item of payload.budget_items) {
        await addBudgetItemConvex({
          event_id: created._id as Id<"fund_events">,
          category: item.category,
          description: item.description,
          projected_amount: item.projected_amount,
          ...(item.notes ? { notes: item.notes } : {}),
        });
      }
    }
  });

  const updateEvent = useAsyncMutation<UpdateEventVariables>(async ({ eventId, data }) => {
    const args: {
      id: Id<"fund_events">;
      name?: string;
      description?: string;
      event_date?: number;
      church_id?: Id<"churches">;
    } = { id: eventId as Id<"fund_events"> };

    if (data.name !== undefined) {
      args.name = data.name;
    }
    if (data.description !== undefined) {
      args.description = data.description;
    }
    if (data.event_date) {
      const timestamp = ensureTimestamp(data.event_date);
      if (timestamp !== undefined) {
        args.event_date = timestamp;
      }
    }
    if (data.church_id !== undefined && data.church_id !== null) {
      args.church_id = ensureChurchConvexId(data.church_id) as Id<"churches">;
    }

    await updateConvexEvent(args);
  });

  const deleteEvent = useAsyncMutation<DeleteEventVariables>(async (eventId) => {
    await deleteConvexEvent({ id: eventId as Id<"fund_events"> });
  });

  const submitEvent = useAsyncMutation<SubmitEventVariables>(async (eventId) => {
    await submitConvexEvent({ id: eventId as Id<"fund_events"> });
  });

  const approveEvent = useAsyncMutation<ApproveEventVariables>(async ({ eventId }) => {
    await approveConvexEvent({ id: eventId as Id<"fund_events"> });
  });

  const rejectEvent = useAsyncMutation<RejectEventVariables>(async ({ eventId, reason }) => {
    if (!reason.trim()) {
      throw new Error("Debes especificar un motivo de rechazo.");
    }
    await rejectConvexEvent({
      id: eventId as Id<"fund_events">,
      reason,
    });
  });

  const addActual = useAsyncMutation<AddActualVariables>(async ({ eventId, data }) => {
    if (data.amount <= 0) {
      throw new Error("El monto debe ser mayor a cero.");
    }
    await addActualConvex({
      event_id: eventId as Id<"fund_events">,
      line_type: data.line_type,
      description: data.description,
      amount: data.amount,
      ...(data.receipt_url ? { receipt_url: data.receipt_url } : {}),
      ...(data.notes ? { notes: data.notes } : {}),
    });
  });

  const updateActual = useAsyncMutation<UpdateActualVariables>(async ({ actualId, data }) => {
    const args: {
      id: Id<"fund_event_actuals">;
      description?: string;
      amount?: number;
      receipt_url?: string;
      notes?: string;
    } = {
      id: actualId as Id<"fund_event_actuals">,
    };

    if (data.description !== undefined) {
      args.description = data.description;
    }
    if (data.amount !== undefined) {
      if (data.amount <= 0) {
        throw new Error("El monto debe ser mayor a cero.");
      }
      args.amount = data.amount;
    }
    if (data.receipt_url !== undefined) {
      args.receipt_url = data.receipt_url;
    }
    if (data.notes !== undefined) {
      args.notes = data.notes;
    }

    await updateActualConvex(args);
  });

  const deleteActual = useAsyncMutation<DeleteActualVariables>(async ({ actualId }) => {
    await deleteActualConvex({ id: actualId as Id<"fund_event_actuals"> });
  });

  const addBudgetItem = useAsyncMutation<AddBudgetItemVariables>(async ({ eventId, data }) => {
    if (data.projected_amount <= 0) {
      throw new Error("El monto proyectado debe ser mayor a cero.");
    }
    await addBudgetItemConvex({
      event_id: eventId as Id<"fund_events">,
      category: data.category,
      description: data.description,
      projected_amount: data.projected_amount,
      ...(data.notes ? { notes: data.notes } : {}),
    });
  });

  const updateBudgetItem = useAsyncMutation<UpdateBudgetItemVariables>(
    async ({ budgetItemId, data }) => {
      const args: {
        id: Id<"fund_event_budget_items">;
        description?: string;
        projected_amount?: number;
        notes?: string;
      } = {
        id: budgetItemId as Id<"fund_event_budget_items">,
      };

      if (data.description !== undefined) {
        args.description = data.description;
      }
      if (data.projected_amount !== undefined) {
        if (data.projected_amount <= 0) {
          throw new Error("El monto proyectado debe ser mayor a cero.");
        }
        args.projected_amount = data.projected_amount;
      }
      if (data.notes !== undefined) {
        args.notes = data.notes;
      }

      await updateBudgetItemConvex(args);
    }
  );

  const deleteBudgetItem = useAsyncMutation<DeleteBudgetItemVariables>(async ({ budgetItemId }) => {
    await deleteBudgetItemConvex({ id: budgetItemId as Id<"fund_event_budget_items"> });
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
};
