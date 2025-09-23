const defaultOrigins = [
  'http://localhost:3000',
  'http://localhost:8000',
  'https://ipupytesoreria.vercel.app'
];

const getAllowedOrigins = (): string[] => {
  const custom = process.env.ALLOWED_ORIGINS;
  if (!custom) {
    return defaultOrigins;
  }
  return custom.split(',').map((origin) => origin.trim());
};

export const buildCorsHeaders = (origin?: string | null): HeadersInit => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };

  const allowedOrigins = getAllowedOrigins();
  if (origin && allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (allowedOrigins.length > 0) {
    headers['Access-Control-Allow-Origin'] = allowedOrigins[0];
  } else {
    headers['Access-Control-Allow-Origin'] = '*';
  }

  return headers;
};

export const handleCorsPreflight = (request: Request): Response | null => {
  if (request.method !== 'OPTIONS') {
    return null;
  }
  const headers = buildCorsHeaders(request.headers.get('origin'));
  return new Response(null, { status: 204, headers });
};

export const setCORSHeaders = (response: Response, origin?: string | null): void => {
  const headers = buildCorsHeaders(origin);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value as string);
  });
  const vary = response.headers.get('Vary');
  response.headers.set('Vary', vary ? `${vary}, Origin` : 'Origin');
};
