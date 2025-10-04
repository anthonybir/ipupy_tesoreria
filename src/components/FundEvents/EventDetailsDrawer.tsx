'use client';

import { useMemo, useState } from 'react';

import { Drawer, EventStatusPill, StatusPill } from '@/components/Shared';
import { Button } from '@/components/ui/button';
import { BudgetManager } from '@/components/FundEvents/BudgetManager';
import { ActualsManager } from '@/components/FundEvents/ActualsManager';
import { useEventMutations, useFundEvent } from '@/hooks/useFundEvents';
import type { FundEvent, FundEventDetail } from '@/types/financial';

const STATUS_DESCRIPTIONS: Record<string, string> = {
  draft: 'Borrador. Aún puedes ajustar presupuesto y detalles.',
  pending_revision: 'Requiere revisión según observaciones del tesorero.',
  submitted: 'Pendiente de aprobación por tesorería nacional.',
  approved: 'Aprobado. Las transacciones ya fueron registradas en el libro diario.',
  rejected: 'Rechazado. Revisa los comentarios y vuelve a enviar.',
  cancelled: 'Cancelado. Se conserva el historial para auditoría.',
};

type EventDetailsDrawerProps = {
  eventId: string | null;
  initialEvent?: FundEvent | null;
  viewer: {
    profileId?: string;
    isAdmin: boolean;
    isTreasurer: boolean;
    isFundDirector: boolean;
  };
  onClose: () => void;
};

export function EventDetailsDrawer({ eventId, initialEvent, viewer, onClose }: EventDetailsDrawerProps): JSX.Element {
  const { submitEvent, approveEvent, rejectEvent } = useEventMutations();
  const { data: detailedEvent, isLoading } = useFundEvent(eventId);

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const event = useMemo<FundEvent | FundEventDetail | null>(() => {
    if (detailedEvent) return detailedEvent;
    return initialEvent ?? null;
  }, [detailedEvent, initialEvent]);

  if (!eventId || !event) {
    return null;
  }

  const canApprove = viewer.isAdmin || viewer.isTreasurer;
  const statusAllowsDraftActions = ['draft', 'pending_revision'].includes(event.status);
  const isOwner = event.audit.createdBy === viewer.profileId;
  const canSubmit = viewer.isFundDirector && isOwner && statusAllowsDraftActions;
  const canEdit = viewer.isAdmin || viewer.isTreasurer || (viewer.isFundDirector && isOwner && statusAllowsDraftActions);

  const handleSubmit = async () => {
    try {
      await submitEvent.mutateAsync(event.id);
      onClose();
    } catch (error) {
      console.error('Error submitting event:', error);
    }
  };

  const handleApprove = async () => {
    try {
      await approveEvent.mutateAsync({ eventId: event.id });
      setShowApproveModal(false);
      onClose();
    } catch (error) {
      console.error('Error approving event:', error);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) return;
    try {
      await rejectEvent.mutateAsync({ eventId: event.id, reason: rejectionReason });
      setShowRejectModal(false);
      setRejectionReason('');
      onClose();
    } catch (error) {
      console.error('Error rejecting event:', error);
    }
  };

  const statusDescription = STATUS_DESCRIPTIONS[event.status] ?? '';
  const auditHistory = 'history' in event.audit ? event.audit.history : undefined;

  return (
    <>
      <Drawer open={!!eventId} onClose={onClose} title={event.name}>
        <div className="space-y-6">
          <section className="space-y-2">
            <EventStatusPill status={event.status} />
            {statusDescription ? <p className="text-sm text-gray-600">{statusDescription}</p> : null}
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="font-medium text-gray-500">Fondo</dt>
                <dd className="text-gray-900">{event.fund.name}</dd>
              </div>
              {event.church.name ? (
                <div>
                  <dt className="font-medium text-gray-500">Iglesia</dt>
                  <dd className="text-gray-900">{event.church.name}</dd>
                </div>
              ) : null}
              <div>
                <dt className="font-medium text-gray-500">Fecha</dt>
                <dd className="text-gray-900">{new Date(event.eventDate).toLocaleDateString('es-PY')}</dd>
              </div>
              <div>
                <dt className="font-medium text-gray-500">Creado por</dt>
                <dd className="text-gray-900">{event.audit.createdByName ?? '—'}</dd>
              </div>
            </dl>
            {event.description ? (
              <p className="text-sm text-gray-700 border-t border-gray-200 pt-3">{event.description}</p>
            ) : null}
          </section>

          <BudgetManager eventId={event.id} canEdit={canEdit} />
          <ActualsManager event={event} canEdit={canEdit} />

          {auditHistory && auditHistory.length > 0 ? (
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-800">Historial</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                {auditHistory.map((entry) => (
                  <li key={entry.id} className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-700">{entry.newStatus}</p>
                      {entry.comment ? <p className="text-xs text-gray-500">{entry.comment}</p> : null}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(entry.changedAt).toLocaleString('es-PY')}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="flex gap-2 pt-4 border-t">
            {canSubmit ? (
              <Button onClick={handleSubmit} disabled={submitEvent.isPending || isLoading}>
                {submitEvent.isPending ? 'Enviando...' : 'Enviar para aprobación'}
              </Button>
            ) : null}

            {canApprove && event.status === 'submitted' ? (
              <div className="flex gap-2">
                <Button onClick={() => setShowApproveModal(true)} disabled={approveEvent.isPending}>
                  Aprobar
                </Button>
                <Button variant="secondary" onClick={() => setShowRejectModal(true)}>
                  Rechazar
                </Button>
              </div>
            ) : null}

            {!canSubmit && !canApprove ? (
              <StatusPill tone="info">Acciones limitadas según tu rol</StatusPill>
            ) : null}
          </div>
        </div>
      </Drawer>

      {showApproveModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold">Confirmar aprobación</h3>
            <p className="text-sm text-gray-600">
              Se registrarán las transacciones derivadas de este evento en el libro diario. ¿Deseas continuar?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowApproveModal(false)}>
                Cancelar
              </Button>
              <Button onClick={handleApprove} disabled={approveEvent.isPending}>
                {approveEvent.isPending ? 'Aprobando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {showRejectModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 space-y-4">
            <h3 className="text-lg font-semibold">Rechazar evento</h3>
            <p className="text-sm text-gray-600">Escribe el motivo del rechazo para que el director pueda corregirlo.</p>
            <textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              rows={4}
              placeholder="Motivo del rechazo..."
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowRejectModal(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || rejectEvent.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {rejectEvent.isPending ? 'Rechazando...' : 'Rechazar evento'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
