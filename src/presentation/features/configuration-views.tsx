'use client';
import { useState } from 'react';
import type { Integration, RequiredField } from '@/domain/models';
import { useCrm } from '../hooks/crm-context';
import { Modal, PageTitle, AsyncForm, Field, values } from '../components/forms';
export function SettingsView() {
  const { data, mutate } = useCrm(),
    [saved, setSaved] = useState(false);
  const required: [RequiredField, string][] = [
    ['company', 'Empresa'],
    ['email', 'Correo'],
    ['phone', 'Teléfono'],
  ];
  if (data.currentUser.role !== 'admin') return null;
  return (
    <>
      <PageTitle
        title="A la medida de tu negocio."
        description="Define lo esencial una vez. El equipo sigue las mismas reglas."
      />
      <div className="panel settings">
        <AsyncForm
          label="Guardar configuración"
          onSubmit={async (form) => {
            await mutate('settings', { ...values(form), required: form.getAll('required') });
            setSaved(true);
          }}
        >
          <h2>Tu negocio</h2>
          <Field
            label="Nombre del negocio"
            name="business"
            required
            defaultValue={data.settings.business}
          />
          <Field label="Sector" name="industry" required defaultValue={data.settings.industry} />
          <Field
            label="Tiempo máximo para primer contacto (horas)"
            name="sla"
            type="number"
            min={1}
            max={720}
            required
            defaultValue={data.settings.sla}
          />
          <h2>Calidad de los datos</h2>
          <p>
            Nombre, responsable, estado y un medio de contacto son obligatorios. Todo lead abierto
            necesita próxima acción y fecha.
          </p>
          <h3>Campos obligatorios adicionales</h3>
          {required.map(([key, label]) => (
            <label className="check" key={key}>
              <input
                type="checkbox"
                name="required"
                value={key}
                defaultChecked={data.settings.required.includes(key)}
              />
              {label}
            </label>
          ))}
          <p className="muted">
            Las nuevas reglas se aplican al crear o gestionar leads. Revisa los registros anteriores
            antes de ampliar requisitos.
          </p>
        </AsyncForm>
        {saved && <p role="status">Configuración guardada.</p>}
      </div>
    </>
  );
}
export function AutomationsView() {
  const { data, mutate } = useCrm(),
    [error, setError] = useState(''),
    [pending, setPending] = useState('');
  if (data.currentUser.role !== 'admin') return null;
  return (
    <>
      <PageTitle
        title="El seguimiento continúa."
        description="Reglas internas que se ejecutan mientras el servidor está encendido."
      />
      <p className="error" role="alert">
        {error}
      </p>
      {data.rules.map((rule) => (
        <article className="panel rule" key={rule.id}>
          <div className="rule-icon">⚡</div>
          <div>
            <span className="tag">{rule.event}</span>
            <h2>{rule.name}</h2>
            <p>{rule.description}</p>
          </div>
          <button
            className={rule.enabled ? 'enabled' : ''}
            aria-pressed={rule.enabled}
            disabled={!!pending}
            onClick={async () => {
              setPending(rule.id);
              setError('');
              try {
                await mutate('rules', { id: rule.id, enabled: !rule.enabled });
              } catch (error) {
                setError(error instanceof Error ? error.message : 'No se pudo guardar.');
              } finally {
                setPending('');
              }
            }}
          >
            {pending === rule.id ? 'Guardando…' : rule.enabled ? 'Activa ✓' : 'Pausada'}
          </button>
        </article>
      ))}
      <div className="note">
        Siempre obligatorio: al registrar una gestión, indicar resultado y próxima acción con fecha,
        salvo que el lead se cierre. Las alertas de escalamiento aparecen en el tablero; no envían
        mensajes externos.
      </div>
    </>
  );
}
export function ChannelsView() {
  const { data, mutate } = useCrm(),
    [channel, setChannel] = useState<Integration | null>(null);
  if (data.currentUser.role !== 'admin') return null;
  return (
    <>
      <PageTitle
        title="Todas las conversaciones. Un mismo seguimiento."
        description="Prepara tus cuentas. La autenticación y el envío se habilitarán por canal."
      />
      <div className="grid">
        {data.integrations.map((integration, index) => (
          <article className="panel" key={integration.channel}>
            <div className="channel-icon">{['✉', '◉', '▤', '◈', '☎'][index]}</div>
            <h2>{integration.channel}</h2>
            <span className="tag neutral">{integration.status}</span>
            <p>{integration.provider || 'Selecciona el proveedor de tu negocio.'}</p>
            <button onClick={() => setChannel(integration)}>Configurar canal ↗</button>
          </article>
        ))}
      </div>
      <div className="note">
        No hay envíos ni recepción activos. No ingreses contraseñas o tokens aquí; la conexión
        segura con proveedores forma parte de una siguiente iteración.
      </div>
      {channel && (
        <Modal title={`Configurar ${channel.channel}`} onClose={() => setChannel(null)}>
          <p>Guarda los datos de referencia de tu proveedor.</p>
          <AsyncForm
            label="Guardar configuración"
            onSubmit={async (form) => {
              await mutate('integrations', { ...values(form), channel: channel.channel });
              setChannel(null);
            }}
          >
            <Field label="Proveedor" name="provider" required defaultValue={channel.provider} />
            <Field
              label="Identificador público de cuenta (sin claves)"
              name="account"
              required
              defaultValue={channel.account}
            />
          </AsyncForm>
        </Modal>
      )}
    </>
  );
}
