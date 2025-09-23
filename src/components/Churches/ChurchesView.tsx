'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { useChurches } from '@/hooks/useChurches';
import { ChurchForm } from '@/components/Churches/ChurchForm';

export default function ChurchesView() {
  const [search, setSearch] = useState('');
  const { data: churches = [], isLoading, isError, error, refetch, isFetching } = useChurches();

  const filteredChurches = useMemo(() => {
    if (!search.trim()) {
      return churches;
    }

    const term = search.trim().toLowerCase();
    return churches.filter((church) =>
      [church.name, church.city, church.pastor, church.phone, church.email]
        .map((value) => value ?? '')
        .some((value) => value.toLowerCase().includes(term))
    );
  }, [churches, search]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Directorio</span>
        <h1 className="text-3xl font-semibold text-slate-900">Iglesias activas</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Registra nuevas congregaciones, actualiza su información de contacto y consulta rápidamente el estado de sus reportes.
        </p>
      </header>

      <ChurchForm />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex flex-1 flex-col">
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500" htmlFor="search-churches">
              Buscar
            </label>
            <input
              id="search-churches"
              type="search"
              placeholder="Filtrar por nombre, ciudad o pastor"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>

          <button
            type="button"
            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? 'Actualizando…' : 'Refrescar'}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/[0.05]">
        <header className="flex flex-col gap-2 border-b border-slate-200 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Listado de iglesias</h2>
            <p className="text-sm text-slate-600">
              {isLoading ? 'Cargando iglesias…' : `${filteredChurches.length} registro${filteredChurches.length === 1 ? '' : 's'} visibles`}
            </p>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-slate-500">Iglesia</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-slate-500">Ciudad</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-slate-500">Pastor/a</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-slate-500">Contacto</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-slate-500">Estado</th>
                <th className="px-4 py-3 text-left font-medium uppercase tracking-wide text-slate-500">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">Cargando información…</td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-red-600">
                    {(error as Error).message || 'No se pudieron cargar las iglesias'}
                  </td>
                </tr>
              ) : filteredChurches.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                    No se encontraron iglesias que coincidan con la búsqueda.
                  </td>
                </tr>
              ) : (
                filteredChurches.map((church) => (
                  <tr key={church.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-900">
                      <div className="font-semibold">{church.name}</div>
                      {church.ruc && (
                        <div className="text-xs text-slate-500">RUC: {church.ruc}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{church.city || 'Sin registrar'}</td>
                    <td className="px-4 py-3 text-slate-700">
                      <div>{church.pastor}</div>
                      {church.position && (
                        <div className="text-xs text-slate-500">{church.position}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {church.phone ? <div>Tel: {church.phone}</div> : <div className="text-xs text-slate-500">Sin teléfono</div>}
                      {church.email && <div className="text-xs text-slate-500">{church.email}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${church.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {church.active ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/reports?tab=history&churchId=${church.id}`}
                        className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
                      >
                        Ver reportes
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
