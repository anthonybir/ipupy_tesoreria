import type { Metadata } from 'next';

import ExportView from '@/components/Export/ExportView';

export const metadata: Metadata = {
  title: 'Exportaciones • IPU PY Tesorería',
  description: 'Descarga de informes y respaldos de la Tesorería Nacional',
};

export default function ExportPage(): JSX.Element {
  return <ExportView />;
}
