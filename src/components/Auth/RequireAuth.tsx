'use client';

import { type ReactNode } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/Auth/SupabaseAuthProvider';

interface RequireAuthProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function RequireAuth({ children, fallback }: RequireAuthProps) {
  const { user, loading } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  // User is not authenticated
  if (!user) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
          <div className="text-center">
            <div className="mb-4 text-5xl">🔒</div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Autenticación Requerida
            </h2>
            <p className="text-slate-600 mb-6">
              Necesitas iniciar sesión para acceder a esta página.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center justify-center w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Iniciar Sesión
            </Link>
            <p className="mt-4 text-sm text-slate-500">
              Si no tienes una cuenta, contacta al administrador del sistema.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // User is authenticated, show the protected content
  return <>{children}</>;
}

// Export a simpler login prompt component that can be used elsewhere
export function LoginPrompt() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mb-4 text-4xl">🔐</div>
      <h3 className="text-lg font-semibold text-amber-900 mb-2">
        Contenido Protegido
      </h3>
      <p className="text-sm text-amber-700 mb-4">
        Inicia sesión para ver esta información.
      </p>
      <Link
        href="/login"
        className="inline-flex items-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700"
      >
        Iniciar Sesión
      </Link>
    </div>
  );
}