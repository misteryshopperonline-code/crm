import { addBusinessHours, defaultCalendar } from './business-calendar';
import type { Lead } from './models';
import { urgency } from './leads';

export type AttentionGroup = 'all' | 'weekend' | 'first' | 'followup';
export function leadPriority(lead: Lead, now = Date.now(), calendar = defaultCalendar) {
  const state = urgency(lead, now);
  const managed = Boolean(lead.firstContactAt);
  // Business calendar for this first release; independent of the operator's device.
  const weekday = Number.isFinite(Date.parse(lead.created))
    ? new Intl.DateTimeFormat('en-US', { timeZone: calendar.timeZone, weekday: 'short' }).format(
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
    if (!managed && lead.firstContactDue && now > Date.parse(lead.firstContactDue))
      add(50, 'Plazo de primer contacto vencido');
    if (!managed && weekend) add(30, 'Llegó en fin de semana y sigue sin contacto efectivo');
    const age =
      now -
      Date.parse(
        managed ? lead.lastContactAt || lead.firstContactAt || lead.created : lead.created,
      );
    if (
      Number.isFinite(age) &&
      now >=
        addBusinessHours(
          Date.parse(
            managed ? lead.lastContactAt || lead.firstContactAt || lead.created : lead.created,
          ),
          48,
          calendar,
        )
    )
      add(
        20,
        managed
          ? 'Más de 48 horas sin contacto efectivo'
          : 'Más de 48 horas esperando primer contacto efectivo',
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
      (!managed && !!lead.firstContactDue && now > Date.parse(lead.firstContactDue)) ||
      (!managed &&
        (weekend ||
          (Number.isFinite(Date.parse(lead.created)) &&
            now >= addBusinessHours(Date.parse(lead.created), 48, calendar)))) ||
      (managed && state === 'today'));
  return { score, label, reasons, weekend, managed, alert, state };
}
export function matchesAttention(
  lead: Lead,
  group: AttentionGroup,
  now = Date.now(),
  calendar = defaultCalendar,
) {
  const priority = leadPriority(lead, now, calendar);
  if (group === 'all') return true;
  if (priority.state === 'closed') return false;
  if (group === 'weekend') return priority.weekend && !priority.managed;
  return group === 'first' ? !priority.managed : priority.managed;
}
