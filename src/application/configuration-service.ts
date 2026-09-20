import { calendarError } from '../domain/business-calendar';
import type { BusinessCalendar } from '../domain/models';
import { reject } from '../domain/errors';
import type { Input, RequiredField } from '../domain/models';
import { requireAdmin } from '../domain/permissions';
import { text } from '../domain/validation';
import type { Dependencies } from './ports';
import { currentUser } from './shared';
export class ConfigurationService {
  constructor(private readonly deps: Dependencies) {}
  saveTemplate(actorId: string, input: Input): void {
    this.deps.repository.transaction((data) => {
      const actor = currentUser(data, actorId);
      if (actor.role === 'executive')
        reject('forbidden', 'La edición de plantillas requiere supervisor o administrador.');
      const id = text(input.id),
        name = text(input.name, 100),
        subject = text(input.subject),
        body = text(input.body, 20000);
      if (!name || !subject || !body) reject('validation', 'Completa nombre, asunto y contenido.');
      if (/{{(?!nombre}}|empresa}}|ejecutivo}})[^}]*}}/.test(body + subject))
        reject('validation', 'Variables disponibles: nombre, empresa y ejecutivo.');
      const index = data.state.templates.findIndex((template) => template.id === id);
      if (id && index < 0) reject('not_found', 'Plantilla no encontrada.');
      const template = { id: id || this.deps.id(), name, subject, body };
      if (index < 0) data.state.templates.push(template);
      else data.state.templates[index] = template;
    });
  }
  saveSettings(actorId: string, input: Input): void {
    this.deps.repository.transaction((data) => {
      requireAdmin(currentUser(data, actorId));
      const business = text(input.business),
        industry = text(input.industry),
        sla = Number(input.sla);
      if (
        !business ||
        !industry ||
        !Number.isFinite(sla) ||
        sla < 1 ||
        sla > 720 ||
        !Array.isArray(input.required) ||
        input.required.some((key) => !['company', 'email', 'phone'].includes(key))
      )
        reject('validation', 'Revisa negocio, sector, campos y SLA (1–720 horas).');
      const calendar =
        input.calendar === undefined
          ? data.state.settings.calendar
          : (input.calendar as BusinessCalendar);
      if (calendar !== undefined) {
        if (!calendar || typeof calendar !== 'object')
          reject('validation', 'Calendario no válido.');
        const error = calendarError(calendar);
        if (error) reject('validation', error);
      }
      data.state.settings = {
        ...(calendar ? { calendar } : {}),
        business,
        industry,
        sla,
        required: input.required as RequiredField[],
      };
    });
  }
  saveRule(actorId: string, input: Input): void {
    this.deps.repository.transaction((data) => {
      requireAdmin(currentUser(data, actorId));
      const rule = data.state.rules.find((rule) => rule.id === input.id);
      if (!rule || typeof input.enabled !== 'boolean') reject('validation', 'Regla no válida.');
      rule.enabled = input.enabled;
    });
  }
  saveIntegration(actorId: string, input: Input): void {
    this.deps.repository.transaction((data) => {
      requireAdmin(currentUser(data, actorId));
      const integration = data.state.integrations.find((item) => item.channel === input.channel),
        provider = text(input.provider),
        account = text(input.account);
      if (!integration || !provider || !account)
        reject('validation', 'Completa proveedor e identificador de cuenta.');
      Object.assign(integration, {
        provider,
        account,
        status: 'Configuración guardada · conexión pendiente',
      });
    });
  }
}
