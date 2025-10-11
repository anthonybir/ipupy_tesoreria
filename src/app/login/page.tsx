import type { JSX } from 'react';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import ConvexAuthLogin from '@/components/Auth/ConvexAuthLogin';

export const metadata: Metadata = {
  title: 'Iniciar Sesión • IPU PY Tesorería',
  description: 'Sistema Nacional de Gestión Financiera'
};

export default function LoginPage(): JSX.Element {
  return (
    <Suspense fallback={<LoginFallback />}>
      <ConvexAuthLogin />
    </Suspense>
  );
}

function LoginFallback(): JSX.Element {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-xl">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            IPU PY Tesorería
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Sistema Nacional de Gestión Financiera
          </p>
        </div>
        <div className="mt-8 flex justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-600" />
        </div>
      </div>
    </div>
  );
}
