import { channels, stages, type Lead, type Settings } from './models';
import { isEmail } from './validation';
export type Urgency = 'closed' | 'missing' | 'overdue' | 'today' | 'upcoming';
export function urgency(lead: Pick<Lead, 'stage' | 'due' | 'action'>, now = Date.now()): Urgency {
  if (['Ganado', 'No viable'].includes(lead.stage)) return 'closed';
  if (!lead.due || !lead.action || !Number.isFinite(Date.parse(lead.due))) return 'missing';
  const difference = Date.parse(lead.due) - now;
  return difference < 0 ? 'overdue' : difference < 86400000 ? 'today' : 'upcoming';
}
export function validateLead(
  lead: Pick<
    Lead,
    'name' | 'owner' | 'stage' | 'channel' | 'company' | 'email' | 'phone' | 'action' | 'due'
  >,
  settings: Pick<Settings, 'required'>,
  now = Date.now(),
): string[] {
  const errors: string[] = [];
  const labels = {
    name: 'nombre',
    owner: 'responsable',
    stage: 'estado',
    channel: 'canal',
    company: 'empresa',
    email: 'correo',
    phone: 'teléfono',
  };
  for (const key of ['name', 'owner', 'stage', 'channel', ...settings.required] as const)
    if (!lead[key]?.trim()) errors.push(`Completa ${labels[key]}.`);
  if (!(stages as readonly string[]).includes(lead.stage)) errors.push('Estado no válido.');
  if (!(channels as readonly string[]).includes(lead.channel)) errors.push('Canal no válido.');
  if (!lead.email && !lead.phone) errors.push('Registra al menos un correo o teléfono.');
  if (lead.email && !isEmail(lead.email)) errors.push('Correo no válido.');
  if (lead.phone && !/^\+?[0-9 ()-]{7,20}$/.test(lead.phone)) errors.push('Teléfono no válido.');
  if (lead.channel === 'Correo' && !lead.email) errors.push('El canal correo requiere un correo.');
  if (lead.channel !== 'Correo' && !lead.phone) errors.push('Este canal requiere teléfono.');
  if (!['Ganado', 'No viable'].includes(lead.stage)) {
    if (!lead.action?.trim()) errors.push('Define la próxima acción.');
    if (!Number.isFinite(Date.parse(lead.due)) || Date.parse(lead.due) <= now)
      errors.push('La próxima acción debe tener una fecha futura.');
  }
  return [...new Set(errors)];
}
export function isDuplicate(candidate: Lead, existing: Lead): boolean {
  return (
    existing.id !== candidate.id &&
    Boolean(
      (candidate.email && existing.email.toLowerCase() === candidate.email.toLowerCase()) ||
      (candidate.phone && existing.phone.replace(/\D/g, '') === candidate.phone.replace(/\D/g, '')),
    )
  );
}
