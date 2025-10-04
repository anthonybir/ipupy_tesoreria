'use client';

import { useState, useEffect, type JSX } from 'react';
import { Dialog } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useProviders, type Provider } from '@/hooks/useProviders';

interface EditProviderDialogProps {
  isOpen: boolean;
  provider: Provider;
  onClose: () => void;
  onProviderUpdated: () => void;
}

export function EditProviderDialog({
  isOpen,
  provider,
  onClose,
  onProviderUpdated,
}: EditProviderDialogProps): JSX.Element {
  const [formData, setFormData] = useState({
    nombre: provider.nombre,
    razon_social: provider.razon_social || '',
    direccion: provider.direccion || '',
    telefono: provider.telefono || '',
    email: provider.email || '',
    categoria: provider.categoria || ('otros' as 'servicios_publicos' | 'honorarios' | 'suministros' | 'construccion' | 'otros'),
    notas: provider.notas || '',
    es_activo: provider.es_activo,
  });

  const [error, setError] = useState('');

  const { updateProvider } = useProviders();

  useEffect(() => {
    setFormData({
      nombre: provider.nombre,
      razon_social: provider.razon_social || '',
      direccion: provider.direccion || '',
      telefono: provider.telefono || '',
      email: provider.email || '',
      categoria: provider.categoria || 'otros',
      notas: provider.notas || '',
      es_activo: provider.es_activo,
    });
  }, [provider]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await updateProvider.mutateAsync({
        id: provider.id,
        ...formData,
      });
      onProviderUpdated();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar proveedor');
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />

      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="mx-auto w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-200 pb-4">
            <div>
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Editar Proveedor
              </Dialog.Title>
              <p className="mt-1 text-sm text-gray-500">
                RUC: {provider.ruc} ({provider.tipo_identificacion})
              </p>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={formData.nombre}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, nombre: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Nombre del proveedor"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Razón Social
                </label>
                <input
                  type="text"
                  value={formData.razon_social}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      razon_social: e.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Razón social completa"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Categoría
                </label>
                <select
                  value={formData.categoria}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      categoria: e.target.value as typeof formData.categoria,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="servicios_publicos">Servicios Públicos</option>
                  <option value="honorarios">Honorarios</option>
                  <option value="suministros">Suministros</option>
                  <option value="construccion">Construcción</option>
                  <option value="otros">Otros</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Estado
                </label>
                <select
                  value={formData.es_activo ? 'true' : 'false'}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      es_activo: e.target.value === 'true',
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={formData.telefono}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, telefono: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="+595 XXX XXX XXX"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="correo@ejemplo.com"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Dirección
                </label>
                <input
                  type="text"
                  value={formData.direccion}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, direccion: e.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Dirección completa"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Notas
                </label>
                <textarea
                  value={formData.notas}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notas: e.target.value }))
                  }
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  placeholder="Notas adicionales"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={updateProvider.isPending}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {updateProvider.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}