'use client';

import { useQuery, UseQueryOptions } from '@tanstack/react-query';

import { fetchJson } from '@/lib/api-client';
import { ChurchRecord, RawChurchRecord, normalizeChurchRecord } from '@/types/api';

type Options = Pick<UseQueryOptions<ChurchRecord[], Error>, 'enabled'>;

const fetchChurches = async (): Promise<ChurchRecord[]> => {
  const data = await fetchJson<RawChurchRecord[]>('/api/churches');
  return data
    .map(normalizeChurchRecord)
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
};

export function useChurches(options?: Options) {
  return useQuery({
    queryKey: ['churches'],
    queryFn: fetchChurches,
    staleTime: 5 * 60 * 1000,
    ...options
  });
}
