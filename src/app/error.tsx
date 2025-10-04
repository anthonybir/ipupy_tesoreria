"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ErrorDetails = {
  errorId: string;
  timestamp: string;
  message: string;
  buildId: string;
};

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }): JSX.Element {
  const [errorDetails, setErrorDetails] = useState<ErrorDetails | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Generate unique error ID for tracking
    const errorId = `ERR-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const timestamp = new Date().toISOString();
    const buildId = document.cookie.match(/(?:^| )app_build_id=([^;]+)/)?.[1] || 'unknown';

    const details: ErrorDetails = {
      errorId,
      timestamp,
      message: error.message || 'Error desconocido',
      buildId,
    };

    setErrorDetails(details);

    // Log structured error for debugging
    console.error('[Global Error Boundary]', {
      errorId,
      timestamp,
      message: error.message,
      name: error.name,
      stack: error.stack,
      buildId,
      userAgent: navigator.userAgent,
      url: window.location.href,
    });

    // Optional: Send to error tracking service (e.g., Sentry)
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, { tags: { errorId } });
    // }
  }, [error]);

  const copyErrorDetails = () => {
    if (!errorDetails) {
      return;
    }

    const errorReport = [
      `Error ID: ${errorDetails.errorId}`,
      `Timestamp: ${errorDetails.timestamp}`,
      `Build: ${errorDetails.buildId}`,
      `Message: ${errorDetails.message}`,
      `URL: ${window.location.href}`,
      `Browser: ${navigator.userAgent}`,
    ].join('\n');

    navigator.clipboard.writeText(errorReport).then(
      () => {
        alert('Detalles del error copiados al portapapeles');
      },
      () => {
        console.error('Failed to copy error details');
      }
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-red-950 text-red-50 p-8 text-center">
      <div className="max-w-2xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Ocurrió un error inesperado</h1>
          <p className="text-red-200">
            Intenta recargar la página o vuelve al inicio mientras investigamos el problema.
          </p>
        </div>

        {errorDetails && (
          <div className="rounded-lg bg-red-900/50 border border-red-800 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-mono text-red-100">
                ID: {errorDetails.errorId}
              </p>
              <button
                type="button"
                onClick={copyErrorDetails}
                className="text-xs px-2 py-1 rounded bg-red-800 hover:bg-red-700 transition"
              >
                Copiar detalles
              </button>
            </div>
            <p className="text-xs text-red-200">
              {new Date(errorDetails.timestamp).toLocaleString('es-PY')}
            </p>

            {showDetails && (
              <div className="mt-3 p-3 rounded bg-red-950 border border-red-800">
                <p className="text-xs text-left font-mono text-red-100 whitespace-pre-wrap break-all">
                  {errorDetails.message}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-red-300 hover:text-red-100 underline"
            >
              {showDetails ? 'Ocultar' : 'Mostrar'} detalles técnicos
            </button>
          </div>
        )}

        <div className="flex gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded bg-red-500 px-6 py-3 font-medium text-white transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-red-950"
          >
            Reintentar
          </button>
          <Link
            href="/"
            className="rounded bg-red-800 px-6 py-3 font-medium text-white transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-2 focus:ring-offset-red-950"
          >
            Ir al inicio
          </Link>
        </div>

        <p className="text-xs text-red-300">
          Si el problema persiste, contacta a soporte técnico con el ID de error.
        </p>
      </div>
    </main>
  );
}
