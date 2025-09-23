import type { Metadata } from 'next';

import FundsView from '@/components/Funds/FundsView';

export const metadata: Metadata = {
  title: 'Fondos • IPU PY Tesorería',
  description: 'Administración de fondos nacionales y saldos operativos',
};

export default function FundsPage() {
  return <FundsView />;
}
