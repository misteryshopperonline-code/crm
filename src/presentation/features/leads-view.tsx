'use client';
import { useState } from 'react';
import Link from 'next/link';
import { leadPriority, matchesAttention, type AttentionGroup } from '@/domain/lead-priority';
import { urgency, type Urgency } from '@/domain/leads';
import { stages, type Lead } from '@/domain/models';
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
    [search, setSearch] = useState(''),
    [attention, setAttention] = useState<AttentionGroup>('all'),
    [stage, setStage] = useState('all');
  const [detail, setDetail] = useState<Lead | null>(null);
  const [editor, setEditor] = useState<{ type: 'lead' | 'reassign'; lead?: Lead } | null>(null);
  const list = data.leads
    .filter(
      (lead) =>
        (directory || urgency(lead) !== 'closed') &&
        (directory
          ? stage === 'all' || lead.stage === stage
          : matchesAttention(lead, attention, data.asOf, data.settings.calendar)) &&
        (directory ||
          filter !== 'all' ||
          ['today', 'overdue', 'missing'].includes(urgency(lead)) ||
          leadPriority(lead, data.asOf, data.settings.calendar).alert) &&
        (filter === 'all' || urgency(lead) === filter) &&
        `${lead.name} ${lead.company} ${lead.owner} ${lead.email} ${lead.phone}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      directory
        ? a.name.localeCompare(b.name, 'es')
        : leadPriority(b, data.asOf, data.settings.calendar).score -
            leadPriority(a, data.asOf, data.settings.calendar).score ||
          (Date.parse(a.due) || 0) - (Date.parse(b.due) || 0),
    );
  const filters: [Urgency | 'all', string][] = [
    ['all', 'Requieren atención'],
    ['overdue', 'Vencidos'],
    ['today', 'Próximas 24 h'],
    ['upcoming', 'Programados'],
    ['missing', 'Sin próxima acción'],
    ...(directory ? [['closed', 'Cerrados'] as [Urgency, string]] : []),
  ];
  return (
    <>
      <PageTitle
        title={directory ? 'Directorio de leads' : 'Mi día: qué atender ahora'}
        description={
          directory
            ? 'Busca contactos, revisa su estado comercial y consulta su historial.'
            : 'Empieza por los vencidos, los nuevos sin atender y los compromisos de las próximas 24 horas.'
        }
        action={
          <>
            {' '}
            {directory ? (
              <button className="primary" onClick={() => setEditor({ type: 'lead' })}>
                + Nuevo lead
              </button>
            ) : (
              <Link className="view-link" href="/leads">
                Buscar en todos los leads →
              </Link>
            )}{' '}
          </>
        }
      />
      {!directory && (
        <>
          <div className="attention-toolbar" aria-label="Tipo de seguimiento">
            {(
              [
                ['all', 'Toda la atención pendiente'],
                ['weekend', 'Fin de semana sin contacto'],
                ['first', 'Sin contacto efectivo'],
                ['followup', 'Con contacto efectivo'],
              ] as [AttentionGroup, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                aria-pressed={attention === key}
                onClick={() => {
                  setAttention(key);
                  setFilter('all');
                }}
              >
                {label}{' '}
                <strong>
                  {
                    data.leads.filter(
                      (lead) =>
                        (['today', 'overdue', 'missing'].includes(urgency(lead)) ||
                          leadPriority(lead, data.asOf, data.settings.calendar).alert) &&
                        matchesAttention(lead, key, data.asOf, data.settings.calendar),
                    ).length
                  }
                </strong>
              </button>
            ))}
          </div>
          <details className="priority-explanation">
            <summary>¿Cómo se ordenan las prioridades?</summary>
            <p>
              50 puntos por vencimiento o falta de próximo paso; 30 por llegada en fin de semana sin
              gestión; 20 por acción en próximas 24 horas y 20 por más de 48 horas sin contacto
              (hábiles si el calendario está activo); 15 por estado Calificado o Propuesta; 5 por
              correo y teléfono disponibles. Alta: desde 50; media: desde 20. Calendario: zona
              horaria y horario configurados en el negocio. El plazo de primer contacto vencido suma
              50 puntos adicionales. Los cerrados no generan alertas.
            </p>
          </details>
          <div className="metrics">
            {metrics.map(([key, title, description, color]) => (
              <button
                key={key}
                className={`metric ${color} ${filter === key ? 'selected' : ''}`}
                onClick={() => {
                  setFilter(key);
                  setAttention('all');
                }}
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
        </>
      )}
      <div className="toolbar">
        <div>
          <h2>
            {directory
              ? 'Contactos registrados'
              : filter === 'upcoming'
                ? 'Próximos compromisos'
                : 'Tu cola de trabajo'}{' '}
            <span className="number">{list.length}</span>
          </h2>
          <p>
            {directory
              ? 'Orden alfabético · Incluye leads activos y cerrados.'
              : 'Orden de prioridad · Registra la gestión y deja el siguiente paso.'}
          </p>
        </div>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={directory ? 'Nombre, empresa, correo o teléfono' : 'Buscar en esta cola'}
          aria-label="Buscar leads"
        />
      </div>
      {directory ? (
        <div className="directory-controls">
          <label>
            Estado comercial
            <select value={stage} onChange={(event) => setStage(event.target.value)}>
              <option value="all">Todos los estados</option>
              {stages.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <Link className="view-link" href="/agenda">
            Ver lo que requiere atención →
          </Link>
        </div>
      ) : (
        <div className="filters">
          {filters.map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setFilter(key);
                setAttention('all');
              }}
              className={filter === key ? 'chosen' : ''}
              aria-pressed={filter === key}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="lead-list">
        {list.length ? (
          list.map((lead) => (
            <article className="lead-row" key={lead.id}>
              <div className="person">
                <span className="avatar">{lead.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <h3>{lead.name}</h3>
                  {!directory && (
                    <>
                      <span
                        className={`priority-badge priority-${leadPriority(lead, data.asOf, data.settings.calendar).label.toLowerCase()}`}
                        title={leadPriority(lead, data.asOf, data.settings.calendar).reasons.join(
                          ' · ',
                        )}
                      >
                        Prioridad{' '}
                        {leadPriority(lead, data.asOf, data.settings.calendar).label.toLowerCase()}{' '}
                        · {leadPriority(lead, data.asOf, data.settings.calendar).score}
                      </span>
                      <p>
                        {leadPriority(lead, data.asOf, data.settings.calendar).managed
                          ? 'Contacto confirmado'
                          : 'Sin contacto efectivo'}
                        {leadPriority(lead, data.asOf, data.settings.calendar).weekend
                          ? ' · Llegó en fin de semana'
                          : ''}
                      </p>
                    </>
                  )}
                  <p>
                    {lead.company || 'Contacto individual'} · {lead.stage}
                  </p>
                </div>
              </div>
              <div>
                <strong>{directory ? lead.email || lead.phone : lead.action || lead.stage}</strong>
                <p>
                  {directory ? lead.phone || 'Sin teléfono' : lead.channel} · {lead.owner}
                </p>
              </div>
              <div>
                <span className={directory ? 'deadline' : `deadline ${urgency(lead)}`}>
                  {directory
                    ? `Última gestión: ${lead.last ? dateLabel(lead.last) : 'Sin gestión'}`
                    : dateLabel(lead.due)}
                </span>
                <p>
                  {lead.escalation
                    ? `Escalamiento nivel ${lead.escalation}`
                    : `${lead.attempts} gestiones registradas`}
                </p>
              </div>
              <div className="lead-actions">
                <button
                  onClick={() => (directory ? setDetail(lead) : setEditor({ type: 'lead', lead }))}
                >
                  {directory ? 'Ver ficha' : 'Registrar gestión ↗'}
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
                ? !directory && filter === 'all' && attention === 'all' && !search
                  ? 'No tienes acciones urgentes pendientes'
                  : 'No hay leads en esta vista'
                : 'Tu seguimiento empieza con un lead'}
            </h2>
            <p>
              {data.leads.length
                ? !directory && filter === 'all' && attention === 'all' && !search
                  ? 'Puedes revisar Programados o buscar cualquier contacto en Leads.'
                  : 'Cambia los filtros para ver otras oportunidades.'
                : 'Crea tu primer contacto con responsable y próximo paso.'}
            </p>
            {data.leads.length ? (
              <button
                onClick={() => {
                  setSearch('');
                  setFilter('all');
                  setAttention('all');
                  setStage('all');
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
      {!directory && (
        <div className="footnote">
          ◷ Las prioridades usan la hora del servidor y el calendario del negocio.
        </div>
      )}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <p>
            {detail.company || 'Contacto individual'} · {detail.stage}
          </p>
          <dl className="lead-detail">
            <dt>Responsable</dt>
            <dd>{detail.owner}</dd>
            <dt>Correo</dt>
            <dd>{detail.email || 'Sin correo'}</dd>
            <dt>Teléfono</dt>
            <dd>{detail.phone || 'Sin teléfono'}</dd>
            <dt>Próximo paso</dt>
            <dd>
              {detail.action || 'Sin acción'} · {dateLabel(detail.due)}
            </dd>
          </dl>
          <button
            className="primary"
            onClick={() => {
              setEditor({ type: 'lead', lead: detail });
              setDetail(null);
            }}
          >
            Registrar gestión
          </button>
          <h3 className="detail-history-title">Historial</h3>
          <div className="history">
            {data.history
              .filter((item) => item.leadId === detail.id)
              .map((item) => (
                <p key={item.id}>
                  <small>
                    {dateLabel(item.date)} · {item.owner}
                  </small>
                  <br />
                  {item.text}
                </p>
              ))}
          </div>
        </Modal>
      )}
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
