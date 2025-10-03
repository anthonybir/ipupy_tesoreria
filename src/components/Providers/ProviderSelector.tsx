'use client';

import { useState, useEffect, Fragment, useCallback } from 'react';
import { Combobox, Transition } from '@headlessui/react';
import { CheckIcon, ChevronUpDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import { useProviderSearch, useCheckRuc, type Provider } from '@/hooks/useProviders';
import { AddProviderDialog } from './AddProviderDialog';

interface ProviderSelectorProps {
  value: Provider | null;
  onChange: (provider: Provider | null) => void;
  categoria?: 'servicios_publicos' | 'honorarios' | 'suministros' | 'construccion' | 'otros';
  placeholder?: string;
  required?: boolean;
}

export function ProviderSelector({
  value,
  onChange,
  categoria,
  placeholder = 'Buscar por nombre o RUC...',
  required = false,
}: ProviderSelectorProps) {
  const [query, setQuery] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [rucToCheck, setRucToCheck] = useState('');

  const searchQuery = useProviderSearch(query, categoria);
  const rucCheck = useCheckRuc(rucToCheck);

  const providers = searchQuery.data?.data || [];

  useEffect(() => {
    if (rucCheck.data?.exists && rucCheck.data.provider) {
      onChange(rucCheck.data.provider);
      setQuery('');
      setRucToCheck('');
    }
  }, [rucCheck.data, onChange]);

  const handleQueryChange = useCallback((newQuery: string) => {
    setQuery(newQuery);

    const trimmedQuery = newQuery.trim();
    if (trimmedQuery.length >= 5) {
      const isNumericRuc = /^\d+(-\d)?$/.test(trimmedQuery);
      if (isNumericRuc) {
        setRucToCheck(trimmedQuery);
      }
    }
  }, []);

  const handleSelectProvider = (provider: Provider | null) => {
    onChange(provider);
    setQuery('');
  };

  const handleAddNew = () => {
    setShowAddDialog(true);
  };

  const handleProviderCreated = (provider: Provider) => {
    onChange(provider);
    setShowAddDialog(false);
    setQuery('');
  };

  const displayValue = (provider: Provider | null) => {
    if (!provider) return '';
    return `${provider.nombre} - ${provider.ruc}`;
  };

  return (
    <>
      <Combobox value={value} onChange={handleSelectProvider}>
        <div className="relative">
          <div className="relative w-full">
            <Combobox.Input
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-10 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              displayValue={displayValue}
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder={placeholder}
              required={required}
            />
            <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </Combobox.Button>
          </div>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
            afterLeave={() => setQuery('')}
          >
            <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {query.length >= 2 && (
                <>
                  {rucCheck.data?.exists && (
                    <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                      ✓ Proveedor encontrado: {rucCheck.data.provider?.nombre}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleAddNew}
                    className="flex w-full items-center gap-2 border-b border-gray-200 px-4 py-2 text-left text-sm font-medium text-indigo-600 hover:bg-indigo-50"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Agregar nuevo proveedor
                  </button>

                  {(searchQuery.isLoading || rucCheck.isLoading) && (
                    <div className="px-4 py-2 text-sm text-gray-500">
                      Buscando...
                    </div>
                  )}

                  {providers.length === 0 && !searchQuery.isLoading && (
                    <div className="px-4 py-2 text-sm text-gray-500">
                      No se encontraron proveedores
                    </div>
                  )}

                  {providers.map((provider) => (
                    <Combobox.Option
                      key={provider.id}
                      className={({ active }) =>
                        `relative cursor-pointer select-none py-2 pl-10 pr-4 ${
                          active ? 'bg-indigo-100 text-indigo-900' : 'text-gray-900'
                        }`
                      }
                      value={provider}
                    >
                      {({ selected, active }) => (
                        <>
                          <div className="flex flex-col">
                            <span
                              className={`block truncate ${
                                selected ? 'font-medium' : 'font-normal'
                              }`}
                            >
                              {provider.nombre}
                              {provider.es_especial && (
                                <span className="ml-2 text-xs text-indigo-600">
                                  (Especial)
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-gray-500">
                              RUC: {provider.ruc}
                              {provider.categoria && ` • ${provider.categoria}`}
                            </span>
                          </div>
                          {selected ? (
                            <span
                              className={`absolute inset-y-0 left-0 flex items-center pl-3 ${
                                active ? 'text-indigo-600' : 'text-indigo-600'
                              }`}
                            >
                              <CheckIcon className="h-5 w-5" aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Combobox.Option>
                  ))}
                </>
              )}

              {query.length < 2 && (
                <div className="px-4 py-2 text-sm text-gray-500">
                  Escribe al menos 2 caracteres para buscar
                </div>
              )}
            </Combobox.Options>
          </Transition>
        </div>
      </Combobox>

      <AddProviderDialog
        isOpen={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onProviderCreated={handleProviderCreated}
        initialQuery={query}
        {...(categoria ? { categoria } : {})}
      />
    </>
  );
}