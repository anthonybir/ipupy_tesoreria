'use client';

import { useMemo } from 'react';
import { api } from '../../convex/_generated/api';

import { mapChurchDocumentToRaw, type ConvexChurchDocument } from '@/lib/convex-adapters';
import { normalizeChurchRecord, type ChurchRecord } from '@/types/api';
import { useConvexQueryState, type ConvexQueryState } from '@/hooks/useConvexQueryState';

export type AdminChurch = ChurchRecord & {
  last_report?: string | null;
};

type AdminChurchQueryResult = ConvexQueryState<AdminChurch[]> & { data: AdminChurch[] };

type AdminChurchMapperInput = ConvexChurchDocument[];

const mapConvexChurchesToAdmin = (churches: AdminChurchMapperInput): AdminChurch[] =>
  churches.map((doc) => {
    const raw = mapChurchDocumentToRaw(doc);
    const normalized = normalizeChurchRecord(raw);
    return {
      ...normalized,
      last_report: null,
    };
  });

export function useAdminChurches(): AdminChurchQueryResult {
  const queryResult = useConvexQueryState(
    api.churches.list,
    [],
    mapConvexChurchesToAdmin
  );

  const data = useMemo(() => queryResult.data ?? [], [queryResult.data]);

  return {
    ...queryResult,
    data,
  };
}
