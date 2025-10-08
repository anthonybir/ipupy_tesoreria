'use client';

import { useMemo } from 'react';
import { api } from '../../convex/_generated/api';

import { mapChurchDocumentToRaw, type ConvexChurchDocument } from '@/lib/convex-adapters';
import { normalizeChurchRecord, type ChurchRecord } from '@/types/api';
import { useConvexQueryState, type ConvexQueryState } from '@/hooks/useConvexQueryState';

type Options = {
  enabled?: boolean;
};

type UseChurchesResult = ConvexQueryState<ChurchRecord[]> & { data: ChurchRecord[] };

const mapChurches = (raw: Array<ReturnType<typeof mapChurchDocumentToRaw>>): ChurchRecord[] =>
  raw
    .map(normalizeChurchRecord)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));

export function useChurches(options?: Options): UseChurchesResult {
  const queryResult = useConvexQueryState(
    api.churches.list,
    [],
    (churches: Array<ConvexChurchDocument>) =>
      mapChurches(churches.map(mapChurchDocumentToRaw)),
    { enabled: options?.enabled ?? true }
  );

  const data = useMemo(() => queryResult.data ?? [], [queryResult.data]);

  return {
    ...queryResult,
    data,
  };
}
