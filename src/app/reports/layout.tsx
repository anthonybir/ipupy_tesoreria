import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Informes • IPU PY Tesorería',
  description: 'Consulta los reportes congregacionales registrados en el sistema nacional.'
};

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}