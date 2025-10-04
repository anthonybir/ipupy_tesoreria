import type { JSX } from 'react';
import type { Metadata } from 'next';

import TransactionsView from '@/components/Transactions/TransactionsView';

export const metadata: Metadata = {
  title: 'Transacciones • IPU PY Tesorería',
  description: 'Gestión de transacciones financieras del sistema nacional de tesorería',
};

export default function TransactionsPage(): JSX.Element {
  return <TransactionsView />;
}
