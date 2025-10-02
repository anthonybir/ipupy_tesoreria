'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { useChurches } from '@/hooks/useChurches';
import { useDeactivateChurch } from '@/hooks/useChurchMutations';
import { ChurchForm } from '@/components/Churches/ChurchForm';
import { ChurchEditDialog } from '@/components/Churches/ChurchEditDialog';
import { Button } from '@/components/ui/button';
import { DataTable, FilterBar, FormField, PageHeader, SectionCard, StatusPill } from '@/components/Shared';
import type { DataTableColumn } from '@/components/Shared/DataTable';
import type { ChurchRecord } from '@/types/api';

export default function ChurchesView() {
  const [search, setSearch] = useState('');
  const [editingChurch, setEditingChurch] = useState<ChurchRecord | null>(null);
  const { data: churches = [], isLoading, isError, error, refetch, isFetching } = useChurches();
  const deactivateChurch = useDeactivateChurch();

  const filteredChurches = useMemo(() => {
    if (!search.trim()) {
      return churches;
    }

    const term = search.trim().toLowerCase();
    return churches.filter((church) => {
      const haystack = [
        church.name,
        church.city,
        church.pastor,
        church.phone,
        church.email,
        church.primaryPastor?.fullName,
        church.primaryPastor?.preferredName,
        church.primaryPastor?.email,
        church.primaryPastor?.phone,
        church.primaryPastor?.whatsapp,
        church.primaryPastor?.roleTitle,
        church.primaryPastor?.grado,
        church.primaryPastor?.nationalId,
        church.primaryPastor?.taxId
      ];

      return haystack
        .map((value) => value ?? '')
        .some((value) => value.toLowerCase().includes(term));
    });
  }, [churches, search]);

  const handleDeactivate = async (church: ChurchRecord) => {
    if (!confirm(`¿Está seguro de desactivar "${church.name}"?`)) return;

    try {
      await deactivateChurch.mutateAsync({ churchId: church.id });
      toast.success('Iglesia desactivada correctamente');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al desactivar');
    }
  };

  const columns: Array<DataTableColumn<ChurchRecord>> = [
    {
      id: 'church',
      header: 'Iglesia',
      render: (church) => (
        <div className="flex flex-col gap-1">
          <span className="font-semibold text-[var(--absd-ink)]">{church.name}</span>
          {church.ruc && <span className="text-xs text-[rgba(15,23,42,0.55)]">RUC: {church.ruc}</span>}
        </div>
      ),
    },
    {
      id: 'city',
      header: 'Ciudad',
      render: (church) => <span className="text-[var(--absd-ink)]">{church.city || 'Sin registrar'}</span>,
    },
    {
      id: 'pastor',
      header: 'Pastor/a',
      render: (church) => {
        const primary = church.primaryPastor;
        const role = primary?.roleTitle ?? church.position ?? null;
        const ordination = primary?.grado ?? church.grade ?? null;

        return (
          <div className="flex flex-col gap-1 text-[var(--absd-ink)]">
            <span>{primary?.fullName ?? church.pastor}</span>
            {role && (
              <span className="text-xs text-[rgba(15,23,42,0.55)]">{role}</span>
            )}
            {ordination && (
              <span className="text-xs text-[rgba(15,23,42,0.55)]">{ordination}</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'contact',
      header: 'Contacto',
      render: (church) => {
        const primary = church.primaryPastor;
        const phone = primary?.phone ?? church.phone;
        const whatsapp = primary?.whatsapp;
        const email = primary?.email ?? church.email;

        return (
          <div className="flex flex-col gap-1 text-[var(--absd-ink)]">
            {phone ? (
              <span>Tel: {phone}</span>
            ) : (
              <span className="text-xs text-[rgba(15,23,42,0.55)]">Sin teléfono</span>
            )}
            {whatsapp && (
              <span className="text-xs text-[rgba(15,23,42,0.55)]">WhatsApp: {whatsapp}</span>
            )}
            {email && (
              <span className="text-xs text-[rgba(15,23,42,0.55)]">{email}</span>
            )}
          </div>
        );
      },
    },
    {
      id: 'status',
      header: 'Estado',
      render: (church) => (
        <StatusPill tone={church.active ? 'success' : 'neutral'}>
          {church.active ? 'Activa' : 'Inactiva'}
        </StatusPill>
      ),
    },
    {
      id: 'actions',
      header: 'Acciones',
      render: (church) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditingChurch(church)}
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handleDeactivate(church)}
            disabled={!church.active}
          >
            {church.active ? 'Desactivar' : 'Inactiva'}
          </Button>
          <Link
            href={`/reports?tab=history&churchId=${church.id}`}
            className="inline-flex items-center rounded-lg border border-[var(--absd-border)] px-3 py-1.5 text-xs font-semibold text-[var(--absd-authority)] transition hover:border-[var(--absd-authority)] hover:text-[var(--absd-authority)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--absd-authority)]"
          >
            Ver reportes
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Iglesias activas"
        subtitle="Registra nuevas congregaciones, actualiza información de contacto y consulta el estado de sus reportes."
        breadcrumbs={[
          { label: "Inicio", href: "/" },
          { label: "Iglesias" },
        ]}
      />

      <ChurchForm />

      <FilterBar
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            loading={isFetching}
            onClick={() => refetch()}
          >
            Refrescar
          </Button>
        }
      >
        <FormField htmlFor="search-churches" label="Buscar">
          <input
            id="search-churches"
            type="search"
            placeholder="Filtrar por nombre, ciudad o pastor"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="rounded-xl border border-[var(--absd-border)] bg-white px-3 py-2 text-sm text-[var(--absd-ink)] shadow-sm focus:border-[var(--absd-authority)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklab,var(--absd-authority) 40%,white)]"
          />
        </FormField>
      </FilterBar>

      <SectionCard
        title="Listado de iglesias"
        description={
          isLoading
            ? 'Cargando iglesias…'
            : `${filteredChurches.length} registro${filteredChurches.length === 1 ? '' : 's'} visibles`
        }
      >
        {isError ? (
          <div className="rounded-2xl border border-[var(--absd-error)] bg-[rgba(239,68,68,0.08)] px-4 py-3 text-sm text-[var(--absd-error)]">
            {(error as Error).message || 'No se pudieron cargar las iglesias'}
          </div>
        ) : (
          <DataTable
            data={filteredChurches}
            columns={columns}
            loading={isLoading || isFetching}
            skeletonRows={6}
            emptyContent="No se encontraron iglesias que coincidan con la búsqueda."
          />
        )}
      </SectionCard>

      <ChurchEditDialog
        church={editingChurch}
        open={!!editingChurch}
        onClose={() => setEditingChurch(null)}
      />
    </div>
  );
}
