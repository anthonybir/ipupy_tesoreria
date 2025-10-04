'use client';

import dynamic from 'next/dynamic';
import type { JSX } from 'react';

const ReportsView = dynamic(() => import('@/components/Reports/ReportsView'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Cargando informes...</p>
      </div>
    </div>
  )
});

export default function ReportsPage(): JSX.Element {
  return <ReportsView />;
}