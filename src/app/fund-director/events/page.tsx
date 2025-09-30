'use client';

import { useEffect, useMemo, useState } from 'react';

import { useFundEvents } from '@/hooks/useFundEvents';
import { useProfile } from '@/hooks/useProfile';
import { PageHeader, StatCard, DataTable, EventStatusPill, StatusPill } from '@/components/Shared';
import { EventForm } from '@/components/FundEvents/EventForm';
import { EventDetailsDrawer } from '@/components/FundEvents/EventDetailsDrawer';
import type { EventStatus, FundEvent } from '@/types/financial';
import { Button } from '@/components/ui/button';

const tabs = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'review', label: 'Revisión' },
  { id: 'new', label: 'Nuevo Evento' },
  { id: 'history', label: 'Historial' },
] as const;

type TabId = (typeof tabs)[number]['id'];

const statusFilters: Array<{ value: 'all' | EventStatus; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'draft', label: 'Borradores' },
  { value: 'pending_revision', label: 'En revisión' },
  { value: 'submitted', label: 'Pendientes' },
  { value: 'approved', label: 'Aprobados' },
];

const reviewFilters: Array<{ value: EventStatus; label: string }> = [
  { value: 'submitted', label: 'Pendientes de aprobación' },
  { value: 'pending_revision', label: 'Observados' },
];

export default function FundEventsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [dashboardStatusFilter, setDashboardStatusFilter] = useState<'all' | EventStatus>('all');
  const [reviewStatus, setReviewStatus] = useState<EventStatus>('submitted');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<FundEvent | null>(null);

  const { profile, isAdmin, isTreasurer, isFundDirector, isReadOnly } = useProfile();

  const availableTabs = useMemo(
    () => tabs.filter((tab) => (tab.id === 'review' ? isTreasurer || isAdmin : true)),
    [isTreasurer, isAdmin]
  );

  useEffect(() => {
    if (activeTab === 'review' && !(isTreasurer || isAdmin)) {
      setActiveTab('dashboard');
    }
  }, [activeTab, isTreasurer, isAdmin]);

  const filters = useMemo(() => {
    if (activeTab === 'review') {
      return { status: reviewStatus };
    }
    if (dashboardStatusFilter === 'all') return undefined;
    return { status: dashboardStatusFilter };
  }, [activeTab, dashboardStatusFilter, reviewStatus]);

  const { data: eventsData, isLoading, isFetching } = useFundEvents(filters);

  const canCreate = (isFundDirector || isTreasurer || isAdmin) && !isReadOnly;

  const events = eventsData?.records || [];
  const stats = eventsData?.stats;

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    setSelectedEventId(null);
    setSelectedEvent(null);
    if (tab === 'review') {
      setReviewStatus('submitted');
    }
  };

  const handleEventClick = (event: FundEvent) => {
    setSelectedEventId(event.id);
    setSelectedEvent(event);
  };

  const handleSuccess = () => {
    setActiveTab('dashboard');
  };

  const closeDrawer = () => {
    setSelectedEventId(null);
    setSelectedEvent(null);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Gestión de Eventos"
        breadcrumbs={[
          { label: "Inicio", href: "/" },
          { label: "Eventos" },
        ]}
      />

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6 flex gap-2 border-b border-gray-200">
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 font-medium transition ${
                activeTab === tab.id
                  ? 'border-b-2 border-indigo-600 text-indigo-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {stats ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <StatCard label="Borradores" value={stats.draft} />
                <StatCard label="En Revisión" value={stats.pendingRevision} />
                <StatCard label="Pendientes" value={stats.submitted} />
                <StatCard label="Aprobados" value={stats.approved} />
                <StatCard label="Rechazados" value={stats.rejected} />
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {statusFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    size="sm"
                    variant={dashboardStatusFilter === filter.value ? 'primary' : 'secondary'}
                    onClick={() => setDashboardStatusFilter(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
              {isTreasurer || isAdmin ? (
                <StatusPill tone="info">
                  {dashboardStatusFilter === 'submitted'
                    ? 'Mostrando solicitudes pendientes de revisión'
                    : dashboardStatusFilter === 'all'
                    ? 'Filtra por estado para enfocar tu revisión'
                    : 'Filtro aplicado'}
                </StatusPill>
              ) : null}
            </div>

            {isLoading ? (
              <div className="py-12 text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
                <p className="mt-4 text-gray-600">Cargando eventos...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-lg bg-white py-12 text-center shadow">
                <p className="mb-4 text-gray-600">No hay eventos registrados con el filtro seleccionado.</p>
                {canCreate ? (
                  <Button onClick={() => setActiveTab('new')}>Crear evento</Button>
                ) : null}
              </div>
            ) : (
              <DataTable
                columns={[
                  {
                    id: 'name',
                    header: 'Evento',
                    render: (row) => (
                      <div>
                        <div className="font-medium text-gray-900">{row.name}</div>
                        <div className="text-sm text-gray-500">{row.fund.name}</div>
                      </div>
                    ),
                  },
                  {
                    id: 'eventDate',
                    header: 'Fecha',
                    render: (row) => new Date(row.eventDate).toLocaleDateString('es-PY'),
                  },
                  {
                    id: 'status',
                    header: 'Estado',
                    render: (row) => <EventStatusPill status={row.status} />,
                  },
                  {
                    id: 'budget',
                    header: 'Presupuesto',
                    render: (row) => `₲ ${row.budget.total.toLocaleString('es-PY')}`,
                  },
                  {
                    id: 'variance',
                    header: 'Variación',
                    render: (row) => (
                      <span className={row.actuals.variance >= 0 ? 'text-green-600' : 'text-red-600'}>
                        ₲ {row.actuals.variance.toLocaleString('es-PY')}
                      </span>
                    ),
                  },
                ]}
                data={events}
                onRowClick={handleEventClick}
              />
            )}
          </div>
        )}

        {activeTab === 'review' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg bg-white px-6 py-4 shadow">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Cola de aprobación</h3>
                <p className="text-sm text-gray-600">
                  Gestiona los eventos enviados por los directores de fondo y registra tus decisiones.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {reviewFilters.map((filter) => (
                  <Button
                    key={filter.value}
                    size="sm"
                    variant={reviewStatus === filter.value ? 'primary' : 'secondary'}
                    onClick={() => setReviewStatus(filter.value)}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <StatusPill tone="info">
                {reviewStatus === 'submitted'
                  ? `${events.length} eventos pendientes de aprobación`
                  : `${events.length} eventos requieren correcciones`}
              </StatusPill>
              {isFetching ? <span className="text-xs text-gray-500">Actualizando...</span> : null}
            </div>

            {isLoading ? (
              <div className="py-12 text-center">
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-indigo-600"></div>
                <p className="mt-4 text-gray-600">Cargando cola de revisión...</p>
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-lg bg-white py-12 text-center shadow">
                <p className="text-gray-600">
                  {reviewStatus === 'submitted'
                    ? 'No hay eventos pendientes de aprobación en este momento.'
                    : 'No hay eventos observados esperando ajustes.'}
                </p>
              </div>
            ) : (
              <DataTable
                columns={[
                  {
                    id: 'review-name',
                    header: 'Evento',
                    render: (row) => (
                      <div>
                        <div className="font-medium text-gray-900">{row.name}</div>
                        <div className="text-sm text-gray-500">{row.fund.name}</div>
                      </div>
                    ),
                  },
                  {
                    id: 'review-status',
                    header: 'Estado',
                    render: (row) => <EventStatusPill status={row.status} />,
                  },
                  {
                    id: 'review-owner',
                    header: 'Solicitante',
                    render: (row) => row.audit.createdByName ?? '—',
                  },
                  {
                    id: 'review-submitted',
                    header: reviewStatus === 'submitted' ? 'Enviado' : 'Creado',
                    render: (row) => {
                      const timestamp =
                        reviewStatus === 'submitted' ? row.audit.submittedAt : row.audit.createdAt;
                      return timestamp ? new Date(timestamp).toLocaleString('es-PY') : '—';
                    },
                  },
                  {
                    id: 'review-budget',
                    header: 'Presupuesto',
                    render: (row) => `₲ ${row.budget.total.toLocaleString('es-PY')}`,
                  },
                ]}
                data={events}
                onRowClick={handleEventClick}
              />
            )}
          </div>
        )}

        {activeTab === 'new' && (
          canCreate ? (
            <div className="bg-white rounded-lg shadow p-6">
              <EventForm onSuccess={handleSuccess} onCancel={() => setActiveTab('dashboard')} />
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <p className="text-gray-600">No tienes permisos para crear eventos.</p>
            </div>
          )
        )}

        {activeTab === 'history' && (
          <div className="bg-white rounded-lg shadow">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
              </div>
            ) : (
              <DataTable
                columns={[
                  {
                    id: 'name',
                    header: 'Evento',
                    render: (row) => (
                      <div>
                        <div className="font-medium text-gray-900">{row.name}</div>
                        <div className="text-sm text-gray-500">{row.fund.name}</div>
                      </div>
                    ),
                  },
                  {
                    id: 'eventDate',
                    header: 'Fecha',
                    render: (row) => new Date(row.eventDate).toLocaleDateString('es-PY'),
                  },
                  {
                    id: 'status',
                    header: 'Estado',
                    render: (row) => <EventStatusPill status={row.status} />,
                  },
                  {
                    id: 'createdAt',
                    header: 'Creado',
                    render: (row) => (
                      <div className="text-sm">
                        <div>{row.audit.createdByName}</div>
                        <div className="text-gray-500">
                          {new Date(row.audit.createdAt).toLocaleDateString('es-PY')}
                        </div>
                      </div>
                    ),
                  },
                ]}
                data={events}
                onRowClick={handleEventClick}
              />
            )}
          </div>
        )}
      </div>

      <EventDetailsDrawer
        eventId={selectedEventId}
        initialEvent={selectedEvent}
        viewer={{
          profileId: profile?.id,
          isAdmin,
          isTreasurer,
          isFundDirector,
        }}
        onClose={closeDrawer}
      />
    </div>
  );
}
