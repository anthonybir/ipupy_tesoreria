import type { JSX } from 'react';
import type { Metadata } from 'next';
import SupabaseAuth from '@/components/Auth/SupabaseAuth';

export const metadata: Metadata = {
  title: 'Iniciar Sesión • IPU PY Tesorería',
  description: 'Sistema Nacional de Gestión Financiera'
};

export default function LoginPage(): JSX.Element {
  return <SupabaseAuth />;
}