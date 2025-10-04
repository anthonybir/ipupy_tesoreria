'use client';

import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';

import { fetchJson } from '@/lib/api-client';
import { type ChurchRecord, type RawChurchRecord, normalizeChurchRecord } from '@/types/api';

type Options = Pick<UseQueryOptions<ChurchRecord[], Error>, 'enabled'>;

const fetchChurches = async (): Promise<ChurchRecord[]> => {
  const data = await fetchJson<RawChurchRecord[]>('/api/churches');
  return data
    .map(normalizeChurchRecord)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
};

export function useChurches(options?: Options): UseQueryResult<ChurchRecord[], Error> {
  return useQuery({
    queryKey: ['churches'],
    queryFn: fetchChurches,
    staleTime: 5 * 60 * 1000,
    ...options
  });
}
