import type { Metadata } from 'next';
import { Suspense } from 'react';

import ReportsView from '@/components/Reports/ReportsView';

export const metadata: Metadata = {
  title: 'Informes • IPU PY Tesorería',
  description: 'Consulta los reportes congregacionales registrados en el sistema nacional.'
};

export default function ReportsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando informes...</p>
        </div>
      </div>
    }>
      <ReportsView />
    </Suspense>
  );
}
