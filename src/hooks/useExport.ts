'use client';

import { useMutation, type UseMutationResult } from '@tanstack/react-query';

import type { DataExportParams } from '@/types/financial';

type ExportResult = {
  blob: Blob;
  filename: string;
};

const extractFilename = (contentDisposition?: string | null): string | null => {
  if (!contentDisposition) {
    return null;
  }

  const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(contentDisposition);
  if (!match) {
    return null;
  }

  // match[1] is the encoded filename, match[2] is the plain filename
  if (match[1]) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }

  return match[2] ?? null;
};

const requestExport = async (params: DataExportParams): Promise<ExportResult> => {
  if (params.type === 'monthly' && params.month === undefined) {
    throw new Error('Debe seleccionar un mes para la exportación mensual');
  }

  const query = new URLSearchParams({
    action: 'export',
    type: params.type,
    year: String(params.year),
  });

  if (params.month !== undefined) {
    query.set('month', String(params.month));
  }

  const response = await fetch(`/api/data?${query.toString()}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') ?? '';
    let message = 'No se pudo generar la exportación de datos';

    if (contentType.includes('application/json')) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (data?.error) {
        message = data.error;
      }
    } else {
      const text = await response.text().catch(() => '');
      if (text) {
        message = text;
      }
    }

    throw new Error(message);
  }

  const blob = await response.blob();
  const filename =
    extractFilename(response.headers.get('content-disposition')) ??
    `ipu-tesoreria-${params.type}-${params.year}${
      params.month ? `-${String(params.month).padStart(2, '0')}` : ''
    }.xlsx`;

  return { blob, filename };
};

export function useExport(): UseMutationResult<ExportResult, Error, DataExportParams, unknown> {
  return useMutation<ExportResult, Error, DataExportParams>({
    mutationFn: requestExport,
  });
}
