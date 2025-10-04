import type { Metadata } from 'next';

import ChurchesView from '@/components/Churches/ChurchesView';

export const metadata: Metadata = {
  title: 'Iglesias • IPU PY Tesorería',
  description: 'Directorio de iglesias activas registradas en el sistema nacional.'
};

export default function ChurchesPage(): JSX.Element {
  return <ChurchesView />;
}
