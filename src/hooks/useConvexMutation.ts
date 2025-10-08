'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useMutation, type ReactMutation } from 'convex/react';
import type { FunctionReference } from 'convex/server';

export type MutationArgs<M extends FunctionReference<'mutation'>> = Parameters<ReactMutation<M>>;

export type MutationResult<M extends FunctionReference<'mutation'>> = Awaited<ReturnType<ReactMutation<M>>>;

export type ConvexMutationOptions<M extends FunctionReference<'mutation'>> = {
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: (result: MutationResult<M>) => void;
  onError?: (error: Error) => void;
};

export type UseConvexMutationResult<M extends FunctionReference<'mutation'>> = {
  mutateAsync: (...args: MutationArgs<M>) => Promise<MutationResult<M>>;
  isPending: boolean;
  error: Error | null;
  reset: () => void;
  mutation: ReactMutation<M>;
};

/**
 * Wrapper around Convex `useMutation` that standardises error handling and
 * toast notifications across the app while still exposing the underlying
 * mutation reference for advanced use (optimistic updates, etc.).
 */
export function useConvexMutation<M extends FunctionReference<'mutation'>>(
  mutationRef: M,
  options: ConvexMutationOptions<M> = {}
): UseConvexMutationResult<M> {
  const { successMessage, errorMessage, onSuccess, onError } = options;
  const mutation = useMutation(mutationRef);
  const [isPending, setIsPending] = useState(false);
  const [errorState, setErrorState] = useState<Error | null>(null);

  const mutateAsync = useCallback(
    async (...args: MutationArgs<M>): Promise<MutationResult<M>> => {
      setIsPending(true);
      setErrorState(null);

      try {
        const result = (await mutation(
          ...(args as Parameters<typeof mutation>)
        )) as MutationResult<M>;

        if (successMessage) {
          toast.success(successMessage);
        }
        onSuccess?.(result);
        return result;
      } catch (rawError) {
        const normalized =
          rawError instanceof Error ? rawError : new Error('Convex mutation failed');
        setErrorState(normalized);
        if (errorMessage) {
          toast.error(errorMessage);
        }
        onError?.(normalized);
        throw normalized;
      } finally {
        setIsPending(false);
      }
    },
    [mutation, successMessage, errorMessage, onSuccess, onError]
  );

  const reset = useCallback(() => {
    setErrorState(null);
  }, []);

  return {
    mutateAsync,
    isPending,
    error: errorState,
    reset,
    mutation,
  };
}
