import type { Metadata } from 'next';

import LedgerView from '@/components/Ledger/LedgerView';

export const metadata: Metadata = {
  title: 'Libro mensual • IPU PY Tesorería',
  description: 'Seguimiento de movimientos automáticos y manuales por fondo y reporte',
};

export default function LedgerPage(): JSX.Element {
  return <LedgerView />;
}
