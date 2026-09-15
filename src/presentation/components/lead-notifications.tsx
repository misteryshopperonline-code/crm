'use client';
import { useState } from 'react';
import type { Lead } from '@/domain/models';
import { leadPriority } from '@/domain/lead-priority';
import { useCrm } from '../hooks/crm-context';
import { Modal } from './forms';
import { LeadForm } from '../features/lead-forms';

export function LeadNotifications() {
  const { data } = useCrm();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Lead | null>(null);
  const alerts = data.leads
    .map((lead) => ({ lead, priority: leadPriority(lead) }))
    .filter((item) => item.priority.alert)
    .sort((a, b) => b.priority.score - a.priority.score);
  return (
    <>
      <button
        className="notification-trigger"
        onClick={() => setOpen(true)}
        aria-label={`Notificaciones: ${alerts.length} leads requieren atención`}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M9 21h6" />
        </svg>
        Notificaciones <strong aria-live="polite">{alerts.length}</strong>
      </button>
      {open && (
        <Modal
          title="Leads que requieren atención"
          onClose={() => {
            setOpen(false);
            setSelected(null);
          }}
        >
          {selected ? (
            <>
              <button onClick={() => setSelected(null)}>Volver a notificaciones</button>
              <h3>{selected.name}</h3>
              <LeadForm lead={selected} onDone={() => setSelected(null)} />
            </>
          ) : (
            <>
              <p>
                Alertas activas, ordenadas por prioridad. Se actualizan al registrar una gestión o
                corregir el próximo paso.
              </p>
              {alerts.length ? (
                alerts.map(({ lead, priority }) => (
                  <button
                    className="notification-item"
                    key={lead.id}
                    onClick={() => setSelected(lead)}
                  >
                    <strong>
                      {lead.name} · Prioridad {priority.label.toLowerCase()}
                    </strong>
                    <span>{priority.reasons.join(' · ')}</span>
                    <span>
                      {priority.managed ? 'Continuar seguimiento' : 'Realizar primera gestión'} →
                    </span>
                  </button>
                ))
              ) : (
                <p role="status">No hay alertas pendientes.</p>
              )}
            </>
          )}
        </Modal>
      )}
    </>
  );
}
