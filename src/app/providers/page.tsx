import { ProviderManagementView } from '@/components/Providers/ProviderManagementView';

export const metadata = {
  title: 'Proveedores | IPU PY Tesorería',
  description: 'Gestión de proveedores y beneficiarios',
};

export default function ProvidersPage(): JSX.Element {
  return (
    <div className="absd-container py-8">
      <ProviderManagementView />
    </div>
  );
}