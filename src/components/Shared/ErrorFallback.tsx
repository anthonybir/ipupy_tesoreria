'use client';

/**
 * ErrorFallback Component
 *
 * Displays a user-friendly error message when data fails to load.
 * Can be used for individual page sections instead of crashing the entire app.
 */

import { useState } from 'react';

type ErrorFallbackProps = {
  title?: string;
  message?: string;
  error?: Error | null;
  onRetry?: () => void;
  showDetails?: boolean;
};

export function ErrorFallback({
  title = 'No se pudieron cargar los datos',
  message = 'Ocurrió un error al conectar con el servidor. Por favor, intenta nuevamente.',
  error = null,
  onRetry,
  showDetails = false,
}: ErrorFallbackProps): JSX.Element {
  const [detailsVisible, setDetailsVisible] = useState(false);

  return (
    <div className="rounded-2xl border border-[var(--absd-border)] bg-white p-8 text-center">
      <div className="mx-auto max-w-md space-y-4">
        {/* Icon */}
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <svg
            className="h-6 w-6 text-red-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-[var(--absd-ink)]">{title}</h3>

        {/* Message */}
        <p className="text-sm text-[rgba(15,23,42,0.7)]">{message}</p>

        {/* Error details (collapsible) */}
        {showDetails && error && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setDetailsVisible(!detailsVisible)}
              className="text-xs text-[rgba(15,23,42,0.6)] hover:text-[rgba(15,23,42,0.8)] underline"
            >
              {detailsVisible ? 'Ocultar' : 'Mostrar'} detalles técnicos
            </button>

            {detailsVisible && (
              <div className="mt-3 rounded-lg bg-[var(--absd-subtle)] p-3 text-left">
                <p className="text-xs font-mono text-[rgba(15,23,42,0.7)] whitespace-pre-wrap break-all">
                  {error.message}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Retry button */}
        {onRetry && (
          <div className="pt-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--absd-authority)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--absd-authority)]"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Minimal error state for inline use
 */
export function InlineErrorMessage({ message }: { message: string }): JSX.Element {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <p className="text-sm text-red-800">{message}</p>
    </div>
  );
}

/**
 * Empty state component for when there's no data (not an error)
 */
export function EmptyState({
  title = 'No hay datos disponibles',
  message = 'Aún no hay información para mostrar.',
  icon = 'inbox',
}: {
  title?: string;
  message?: string;
  icon?: 'inbox' | 'search' | 'folder';
}): JSX.Element {
  const iconPaths = {
    inbox: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588L2.35 13.177a2.25 2.25 0 00-.1.661z"
      />
    ),
    search: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    ),
    folder: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
      />
    ),
  };

  return (
    <div className="rounded-2xl border border-[var(--absd-border)] bg-white p-12 text-center">
      <div className="mx-auto max-w-md space-y-3">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--absd-subtle)]">
          <svg
            className="h-6 w-6 text-[rgba(15,23,42,0.4)]"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            {iconPaths[icon]}
          </svg>
        </div>
        <h3 className="text-base font-semibold text-[var(--absd-ink)]">{title}</h3>
        <p className="text-sm text-[rgba(15,23,42,0.6)]">{message}</p>
      </div>
    </div>
  );
}
