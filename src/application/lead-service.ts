import { addBusinessHours } from '../domain/business-calendar';
import { contactOutcomes, type ContactOutcome } from '../domain/models';
import { reject } from '../domain/errors';
import { validateLead, isDuplicate } from '../domain/leads';
import type { Input, Lead } from '../domain/models';
import { canAssign, canSeeLead } from '../domain/permissions';
import { text } from '../domain/validation';
import type { Dependencies } from './ports';
import { currentUser, audit } from './shared';
export class LeadService {
  constructor(private readonly deps: Dependencies) {}
  save(actorId: string, input: Input): void {
    this.deps.repository.transaction((data) => {
      const actor = currentUser(data, actorId),
        state = data.state,
        id = text(input.id);
      const old = state.leads.find((lead) => lead.id === id);
      if (id && (!old || !canSeeLead(actor, old, data.users)))
        reject('not_found', 'Lead no encontrado.');
      const ownerId = text(input.ownerId) || old?.ownerId || actor.id,
        target = data.users.find((user) => user.id === ownerId);
      if (!canAssign(actor, target))
        reject('forbidden', 'Selecciona un responsable activo dentro de tu alcance.');
      if (old && old.ownerId !== ownerId)
        reject('validation', 'Usa Reasignar para cambiar el responsable.');
      const outcome = text(input.outcome) as ContactOutcome;
      if (old && (!outcome || !(contactOutcomes as readonly string[]).includes(outcome)))
        reject('validation', 'Selecciona el resultado del contacto.');
      const effective = old && ['Contacto efectivo', 'Respuesta recibida'].includes(outcome);
      const date = new Date(this.deps.now()).toISOString();
      const lead: Lead = {
        firstContactAt: old?.firstContactAt || (effective ? date : null),
        lastContactAt: effective ? date : old?.lastContactAt || null,
        ...(old ? { lastOutcome: outcome } : {}),
        firstContactDue:
          old?.firstContactDue ||
          (old
            ? undefined
            : new Date(
                addBusinessHours(this.deps.now(), state.settings.sla, state.settings.calendar),
              ).toISOString()),
        id: old?.id || this.deps.id(),
        name: text(input.name),
        company: text(input.company),
        email: text(input.email),
        phone: text(input.phone),
        owner: target.name,
        ownerId: target.id,
        stage: text(input.stage),
        channel: text(input.channel),
        action: text(input.action),
        due: text(input.due),
        created: old?.created || new Date(this.deps.now()).toISOString(),
        last: old ? new Date(this.deps.now()).toISOString() : null,
        attempts: (old?.attempts || 0) + (old ? 1 : 0),
        escalation: 0,
        ...(old?.legacyOwner ? { legacyOwner: old.legacyOwner } : {}),
      };
      if (!old && state.rules.find((rule) => rule.id === 'first')?.enabled) {
        lead.action ||= 'Primer contacto';
        lead.due ||= lead.firstContactDue || '';
      }
      const errors = validateLead(lead, state.settings, this.deps.now());
      if (errors.length) reject('validation', errors.join(' '));
      if (state.leads.some((existing) => isDuplicate(lead, existing)))
        reject(
          'conflict',
          'No se puede guardar: el medio de contacto ya está registrado. Consulta al administrador.',
        );
      const result = text(input.result, 5000);
      if (old && !result) reject('validation', 'Registra el resultado de la gestión.');
      if (old) state.leads[state.leads.indexOf(old)] = lead;
      else state.leads.push(lead);
      state.history.unshift({
        id: this.deps.id(),
        leadId: lead.id,
        date: new Date(this.deps.now()).toISOString(),
        text: old ? result : 'Lead creado',
        ...(old ? { outcome } : {}),
        owner: actor.name,
        actorId: actor.id,
      });
    });
  }
  reassign(actorId: string, input: Input): void {
    this.deps.repository.transaction((data) => {
      const actor = currentUser(data, actorId),
        lead = data.state.leads.find((lead) => lead.id === input.id),
        target = data.users.find((user) => user.id === input.ownerId);
      if (!lead || !canSeeLead(actor, lead, data.users)) reject('not_found', 'Lead no encontrado.');
      if (actor.role === 'executive' || !canAssign(actor, target))
        reject('forbidden', 'No puedes reasignar a este usuario.');
      if (target.id === lead.ownerId) reject('validation', 'Selecciona un responsable diferente.');
      const reason = text(input.reason, 2000);
      if (!reason) reject('validation', 'Indica el motivo de la reasignación.');
      data.state.history.unshift({
        id: this.deps.id(),
        leadId: lead.id,
        date: new Date(this.deps.now()).toISOString(),
        owner: actor.name,
        actorId: actor.id,
        text: `Reasignación de ${lead.owner} a ${target.name}: ${reason}`,
      });
      lead.ownerId = target.id;
      lead.owner = target.name;
      audit(data, this.deps, actorId, `Reasignó el lead ${lead.id} a ${target.name}.`);
    });
  }
}
