import type { Lead } from './models';
import { urgency } from './leads';

export type AttentionGroup = 'all' | 'weekend' | 'first' | 'followup';
export function leadPriority(lead: Lead, now = Date.now()) {
  const state = urgency(lead, now);
  const managed = Boolean(
    lead.last ||
    lead.attempts > 0 ||
    ['Contactado', 'Calificado', 'Propuesta'].includes(lead.stage),
  );
  // Business calendar for this first release; independent of the operator's device.
  const weekday = Number.isFinite(Date.parse(lead.created))
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'America/Guayaquil', weekday: 'short' }).format(
        new Date(lead.created),
      )
    : '';
  const weekend = ['Sat', 'Sun'].includes(weekday);
  const reasons: string[] = [];
  let score = 0;
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };
  if (state !== 'closed') {
    if (state === 'missing') add(50, 'Sin próxima acción');
    if (state === 'overdue') add(50, 'Compromiso vencido');
    if (state === 'today') add(20, 'Próxima acción en menos de 24 horas');
    if (!managed && weekend) add(30, 'Llegó en fin de semana y sigue sin gestión');
    const age = now - Date.parse(managed ? lead.last || lead.created : lead.created);
    if (age >= 48 * 3600000)
      add(
        20,
        managed ? 'Más de 48 horas sin gestión' : 'Más de 48 horas esperando primera gestión',
      );
    if (lead.stage === 'Calificado' || lead.stage === 'Propuesta')
      add(15, `Estado comercial: ${lead.stage}`);
    if (lead.email && lead.phone) add(5, 'Correo y teléfono disponibles');
  }
  const label = score >= 50 ? 'Alta' : score >= 20 ? 'Media' : 'Normal';
  const alert =
    state !== 'closed' &&
    (state === 'overdue' ||
      state === 'missing' ||
      (!managed && (weekend || now - Date.parse(lead.created) >= 48 * 3600000)) ||
      (managed && state === 'today'));
  return { score, label, reasons, weekend, managed, alert, state };
}
export function matchesAttention(lead: Lead, group: AttentionGroup, now = Date.now()) {
  const priority = leadPriority(lead, now);
  if (group === 'all') return true;
  if (priority.state === 'closed') return false;
  if (group === 'weekend') return priority.weekend && !priority.managed;
  return group === 'first' ? !priority.managed : priority.managed;
}
