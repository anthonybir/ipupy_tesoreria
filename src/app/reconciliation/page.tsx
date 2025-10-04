import type { JSX } from 'react';
import type { Metadata } from 'next';

import { ReconciliationView } from '@/components/LibroMensual/ReconciliationView';

export const metadata: Metadata = {
  title: 'Conciliación de fondos • IPU PY Tesorería',
  description: 'Resumen de balances almacenados vs. calculados para cada fondo nacional',
};

export const dynamic = 'force-dynamic';

export default function ReconciliationPage(): JSX.Element {
  return <ReconciliationView />;
}
