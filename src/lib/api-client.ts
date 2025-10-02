export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

const mergeHeaders = (existing?: HeadersInit, extra?: HeadersInit): HeadersInit => {
  const headers = new Headers(existing);
  if (extra) {
    new Headers(extra).forEach((value, key) => {
      headers.set(key, value);
    });
  }
  return headers;
};

export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const baseInit: RequestInit = {
    credentials: 'include',
    cache: 'no-store',
    ...init
  };

  const headers = mergeHeaders(baseInit.headers, {
    Accept: 'application/json'
  });

  const response = await fetch(input, { ...baseInit, headers });
  const text = await response.text();

  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const errorMessage =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as Record<string, unknown>)['error'])
        : response.statusText || 'Error en la solicitud';

    throw new ApiError(errorMessage, response.status, data);
  }

  return data as T;
}
