'use client';

import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { MagnifyingGlassIcon, PencilIcon, TrashIcon, PlusIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useProviders } from '@/hooks/useProviders';
import type { Provider, UseProvidersOptions } from '@/hooks/useProviders';
import { AddProviderDialog } from './AddProviderDialog';
import { EditProviderDialog } from './EditProviderDialog';
import { PageHeader } from '@/components/Shared';
import { Button } from '@/components/ui/button';

export function ProviderManagementView(): JSX.Element {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoria, setSelectedCategoria] = useState<string>('');
  const [showInactive, setShowInactive] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

  const providerFilters = useMemo<UseProvidersOptions>(() => {
    const filters: UseProvidersOptions = { limit: 100 };
    if (selectedCategoria) {
      filters.categoria = selectedCategoria;
    }
    if (!showInactive) {
      filters.es_activo = true;
    }
    return filters;
  }, [selectedCategoria, showInactive]);

  const { data, isLoading, deleteProvider, reactivateProvider } = useProviders(providerFilters);

  const providers = data?.data || [];

  const filteredProviders = providers.filter((provider) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      provider.nombre.toLowerCase().includes(search) ||
      provider.ruc.toLowerCase().includes(search) ||
      provider.razon_social?.toLowerCase().includes(search)
    );
  });

  const handleDelete = async (id: number, nombre: string) => {
    if (window.confirm(`¿Está seguro de desactivar el proveedor "${nombre}"?`)) {
      try {
        await deleteProvider.mutateAsync(id);
        toast.success(`Proveedor "${nombre}" desactivado correctamente`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error al desactivar proveedor');
      }
    }
  };

  const handleReactivate = async (id: number, nombre: string) => {
    if (window.confirm(`¿Está seguro de reactivar el proveedor "${nombre}"?`)) {
      try {
        await reactivateProvider.mutateAsync(id);
        toast.success(`Proveedor "${nombre}" reactivado correctamente`);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Error al reactivar proveedor');
      }
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestión de Proveedores"
        subtitle="Administra los proveedores y beneficiarios del sistema con registro centralizado de RUC"
        breadcrumbs={[
          { label: "Inicio", href: "/" },
          { label: "Proveedores" },
        ]}
        actions={
          <Button
            type="button"
            onClick={() => setShowAddDialog(true)}
            icon={<PlusIcon className="h-5 w-5" />}
            size="sm"
          >
            Nuevo Proveedor
          </Button>
        }
      />

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por nombre, RUC o razón social..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <select
              value={selectedCategoria}
              onChange={(e) => setSelectedCategoria(e.target.value)}
              className="rounded-lg border border-gray-300 px-4 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Todas las categorías</option>
              <option value="servicios_publicos">Servicios Públicos</option>
              <option value="honorarios">Honorarios</option>
              <option value="suministros">Suministros</option>
              <option value="construccion">Construcción</option>
              <option value="otros">Otros</option>
            </select>
            <label className="flex items-center gap-2 whitespace-nowrap text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Mostrar inactivos
            </label>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-gray-500">Cargando proveedores...</div>
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-sm text-gray-500">No se encontraron proveedores</div>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-sm text-indigo-600 hover:text-indigo-700"
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    RUC / Identificación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Contacto
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredProviders.map((provider) => (
                  <tr key={provider.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`font-medium ${provider.es_activo ? 'text-gray-900' : 'text-gray-400'}`}>
                          {provider.nombre}
                          {provider.es_especial && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-800">
                              Especial
                            </span>
                          )}
                          {!provider.es_activo && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                              Inactivo
                            </span>
                          )}
                        </span>
                        {provider.razon_social && (
                          <span className={`text-sm ${provider.es_activo ? 'text-gray-500' : 'text-gray-400'}`}>
                            {provider.razon_social}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-mono text-sm text-gray-900">
                          {provider.ruc}
                        </span>
                        <span className="text-xs text-gray-500">
                          {provider.tipo_identificacion}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {provider.categoria ? (
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                          {provider.categoria.replace(/_/g, ' ')}
                        </span>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col text-sm text-gray-600">
                        {provider.telefono && <span>{provider.telefono}</span>}
                        {provider.email && <span>{provider.email}</span>}
                        {!provider.telefono && !provider.email && (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingProvider(provider)}
                          className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                          title="Editar"
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        {provider.es_activo ? (
                          <button
                            onClick={() => handleDelete(provider.id, provider.nombre)}
                            className="rounded-lg p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                            title="Desactivar"
                          >
                            <TrashIcon className="h-5 w-5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(provider.id, provider.nombre)}
                            className="rounded-lg p-1 text-gray-400 hover:bg-green-100 hover:text-green-600"
                            title="Reactivar"
                          >
                            <ArrowPathIcon className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-slate-200 px-6 py-4">
          <p className="text-sm text-gray-500">
            Total: {filteredProviders.length} proveedor{filteredProviders.length !== 1 ? 'es' : ''}
          </p>
        </div>
      </div>

      <AddProviderDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onProviderCreated={() => setShowAddDialog(false)}
      />

      {editingProvider && (
        <EditProviderDialog
          isOpen={true}
          provider={editingProvider}
          onClose={() => setEditingProvider(null)}
          onProviderUpdated={() => setEditingProvider(null)}
        />
      )}
    </div>
  );
}