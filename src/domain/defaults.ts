import { channels, type CrmState } from './models';
export function initialState(id: () => string): CrmState {
  return {
    leads: [],
    history: [],
    templates: [
      {
        id: id(),
        name: 'Primer contacto',
        subject: 'Hola {{nombre}}, conversemos',
        body: 'Hola {{nombre}},\n\nGracias por tu interés en {{empresa}}. ¿Cuándo te vendría bien conversar?\n\nSaludos,\n{{ejecutivo}}',
      },
    ],
    settings: { business: 'Mi negocio', industry: 'Servicios', sla: 24, required: [] },
    rules: [
      {
        id: 'first',
        name: 'Primera gestión automática',
        event: 'Al crear un lead',
        description: 'Asigna primer contacto dentro del SLA configurado.',
        enabled: true,
      },
      {
        id: 'overdue',
        name: 'Escalar actividades vencidas',
        event: 'Cada minuto',
        description:
          'Marca nivel 1 al vencer y nivel 2 tras 24 horas. Alerta visible en el tablero.',
        enabled: true,
      },
    ],
    integrations: channels.map((channel) => ({
      channel,
      provider: '',
      account: '',
      status: 'Sin conectar',
    })),
  };
}
