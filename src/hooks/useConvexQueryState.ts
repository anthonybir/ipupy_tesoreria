'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConvex } from 'convex/react';
import type { FunctionReference } from 'convex/server';

export type ConvexQueryState<Data> = {
  data: Data | undefined;
  error: Error | null;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => Promise<void>;
};

export type ConvexQueryOptions = {
  enabled?: boolean;
};

const serializeArgs = (args: readonly unknown[]): string => JSON.stringify(args);

export function useConvexQueryState<QueryRef extends FunctionReference<'query'>, Raw, Data>(
  queryRef: QueryRef,
  args: readonly unknown[],
  mapResult: (raw: Raw) => Data,
  options: ConvexQueryOptions = {}
): ConvexQueryState<Data> {
  const { enabled = true } = options;
  const convex = useConvex();

  const [data, setData] = useState<Data | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [isFetching, setIsFetching] = useState<boolean>(false);

  const serializedArgs = useMemo(() => serializeArgs(args), [args]);
  const stableArgs = useMemo(() => JSON.parse(serializedArgs) as readonly unknown[], [serializedArgs]);
  const mapFnRef = useRef(mapResult);
  mapFnRef.current = mapResult;

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return () => undefined;
    }

    let isMounted = true;
    // Type assertion needed for Convex internal API - using unknown[] for args spread
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const watch = (convex.watchQuery as any)(queryRef, ...(stableArgs as unknown[])) as {
      localQueryResult: () => Raw | undefined;
      onUpdate: (callback: () => void) => () => void;
    };

    const applyResult = () => {
      if (!isMounted) return;
      try {
        const rawResult = watch.localQueryResult();
        if (rawResult === undefined) {
          setIsLoading(true);
          return;
        }
        const mapped = mapFnRef.current(rawResult as Raw);
        setData(mapped);
        setError(null);
        setIsLoading(false);
      } catch (rawError) {
        const normalized = rawError instanceof Error ? rawError : new Error('Error al consultar Convex');
        setError(normalized);
        setIsLoading(false);
      }
    };

    const unsubscribe = watch.onUpdate(applyResult);

    // Try to synchronously read the cached result.
    applyResult();

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [convex, enabled, queryRef, stableArgs]);

  const refetch = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setIsFetching(true);
    try {
      // Type assertion needed for Convex internal API - using any for variadic function call
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawResult = (await (convex.query as any)(queryRef, ...(stableArgs as unknown[]))) as Raw;
      const mapped = mapFnRef.current(rawResult);
      setData(mapped);
      setError(null);
    } catch (rawError) {
      const normalized = rawError instanceof Error ? rawError : new Error('Error al consultar Convex');
      setError(normalized);
    } finally {
      setIsFetching(false);
      setIsLoading(false);
    }
  }, [convex, enabled, queryRef, stableArgs]);

  return {
    data,
    error,
    isLoading,
    isError: error !== null,
    isFetching,
    refetch,
  };
}
