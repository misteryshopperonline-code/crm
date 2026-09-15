'use client';
import { useState } from 'react';
import { urgency, type Urgency } from '@/domain/leads';
import type { Lead } from '@/domain/models';
import { useCrm } from '../hooks/crm-context';
import { PageTitle, Modal, dateLabel } from '../components/forms';
import { LeadForm, ReassignForm } from './lead-forms';
const metrics: [Urgency, string, string, string][] = [
  ['overdue', 'Vencidos', 'Necesitan tu atención', 'red'],
  ['today', 'Próximas 24 horas', 'El siguiente paso es hoy', 'amber'],
  ['upcoming', 'Programados', 'Cada oportunidad en marcha', 'green'],
  ['missing', 'Sin próxima acción', 'Ningún lead debe quedar atrás', 'slate'],
];
export function LeadsView({ directory = false }: { directory?: boolean }) {
  const { data } = useCrm(),
    [filter, setFilter] = useState<Urgency | 'all'>('all'),
    [search, setSearch] = useState('');
  const [editor, setEditor] = useState<{ type: 'lead' | 'reassign'; lead?: Lead } | null>(null);
  const list = data.leads
    .filter(
      (lead) =>
        (directory || urgency(lead) !== 'closed') &&
        (filter === 'all' || urgency(lead) === filter) &&
        `${lead.name} ${lead.company} ${lead.owner}`.toLowerCase().includes(search.toLowerCase()),
    )
    .sort((a, b) => Date.parse(a.due) - Date.parse(b.due));
  const filters: [Urgency | 'all', string][] = [
    ['all', 'Todos'],
    ['overdue', 'Vencidos'],
    ['today', 'Próximas 24 h'],
    ['upcoming', 'Programados'],
    ['missing', 'Sin próxima acción'],
    ...(directory ? [['closed', 'Cerrados'] as [Urgency, string]] : []),
  ];
  return (
    <>
      <PageTitle
        title={directory ? 'Tu próxima oportunidad.' : 'Cada lead, un próximo paso.'}
        description="Prioriza lo pendiente y mantén cada conversación en movimiento."
        action={
          <button className="primary" onClick={() => setEditor({ type: 'lead' })}>
            + Nuevo lead
          </button>
        }
      />
      <div className="metrics">
        {metrics.map(([key, title, description, color]) => (
          <button
            key={key}
            className={`metric ${color} ${filter === key ? 'selected' : ''}`}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
          >
            <span>
              {title}
              <b>↗</b>
            </span>
            <strong>{data.leads.filter((lead) => urgency(lead) === key).length}</strong>
            <small>{description}</small>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <div>
          <h2>
            {directory ? 'Directorio de leads' : 'Tu agenda de seguimiento'}{' '}
            <span className="number">{list.length}</span>
          </h2>
          <p>Una gestión completa siempre deja el siguiente paso definido.</p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar lead, empresa o ejecutivo"
          aria-label="Buscar leads"
        />
      </div>
      <div className="filters">
        {filters.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={filter === key ? 'chosen' : ''}
            aria-pressed={filter === key}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="lead-list">
        {list.length ? (
          list.map((lead) => (
            <article className="lead-row" key={lead.id}>
              <div className="person">
                <span className="avatar">{lead.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <h3>{lead.name}</h3>
                  <p>
                    {lead.company || 'Contacto individual'} · {lead.stage}
                  </p>
                </div>
              </div>
              <div>
                <strong>{lead.action || lead.stage}</strong>
                <p>
                  {lead.channel} · {lead.owner}
                </p>
              </div>
              <div>
                <span className={`deadline ${urgency(lead)}`}>{dateLabel(lead.due)}</span>
                <p>
                  {lead.escalation
                    ? `Escalamiento nivel ${lead.escalation}`
                    : `${lead.attempts} gestiones registradas`}
                </p>
              </div>
              <div className="lead-actions">
                <button onClick={() => setEditor({ type: 'lead', lead })}>
                  Registrar gestión ↗
                </button>
                {data.currentUser.role !== 'executive' && (
                  <button
                    className="text-button"
                    onClick={() => setEditor({ type: 'reassign', lead })}
                  >
                    Reasignar
                  </button>
                )}
              </div>
            </article>
          ))
        ) : (
          <div className="empty">
            <span>✓</span>
            <h2>
              {data.leads.length
                ? 'No hay leads en esta vista'
                : 'Tu seguimiento empieza con un lead'}
            </h2>
            <p>
              {data.leads.length
                ? 'Cambia los filtros para ver otras oportunidades.'
                : 'Crea tu primer contacto con responsable y próximo paso.'}
            </p>
            {data.leads.length ? (
              <button
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                }}
              >
                Limpiar búsqueda y filtros
              </button>
            ) : (
              <button className="primary" onClick={() => setEditor({ type: 'lead' })}>
                + Crear lead
              </button>
            )}
          </div>
        )}
      </div>
      <div className="footnote">
        ◷ Las prioridades se calculan con la fecha y hora de este dispositivo.
      </div>
      {editor && (
        <Modal
          title={
            editor.type === 'reassign'
              ? 'Reasignar lead'
              : editor.lead
                ? 'Registrar gestión'
                : 'Nuevo lead'
          }
          onClose={() => setEditor(null)}
        >
          {editor.type === 'reassign' && editor.lead ? (
            <ReassignForm lead={editor.lead} onDone={() => setEditor(null)} />
          ) : (
            <LeadForm lead={editor.lead} onDone={() => setEditor(null)} />
          )}
        </Modal>
      )}
    </>
  );
}
