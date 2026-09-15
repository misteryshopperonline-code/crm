'use client';
import { useState } from 'react';
import { channels, stages, type Lead } from '@/domain/models';
import { useCrm } from '../hooks/crm-context';
import { AsyncForm, Field, Select, dateLabel, values } from '../components/forms';
export function OwnerSelect({ label = 'Responsable', value }: { label?: string; value?: string }) {
  const { data } = useCrm();
  return (
    <Select label={label} name="ownerId" required defaultValue={value || data.currentUser.id}>
      {data.assignableUsers.map((user) => (
        <option key={user.id} value={user.id}>
          {user.name} ·{' '}
          {data.teams.find((team) => team.id === user.teamId)?.name || 'Administración'}
        </option>
      ))}
    </Select>
  );
}
export function LeadForm({ lead, onDone }: { lead?: Lead; onDone: () => void }) {
  const { data, mutate } = useCrm();
  const [nextDate] = useState(() => {
    const date = new Date(Date.now() + data.settings.sla * 3600000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  return (
    <>
      <p>Completa los datos y deja definido el próximo paso.</p>
      <AsyncForm
        label={lead ? 'Guardar gestión y siguiente paso' : 'Crear lead'}
        onSubmit={async (form) => {
          const input = values(form);
          await mutate('leads', {
            ...input,
            id: lead?.id,
            due: input.due ? new Date(String(input.due)).toISOString() : '',
          });
          onDone();
        }}
      >
        <div className="form-grid">
          <Field label="Nombre" name="name" required defaultValue={lead?.name} />
          <Field
            label="Empresa"
            name="company"
            required={data.settings.required.includes('company')}
            defaultValue={lead?.company}
          />
          <Field
            label="Correo"
            name="email"
            type="email"
            required={data.settings.required.includes('email')}
            defaultValue={lead?.email}
          />
          <Field
            label="Teléfono"
            name="phone"
            type="tel"
            required={data.settings.required.includes('phone')}
            defaultValue={lead?.phone}
          />
          {lead ? (
            <>
              <Field label="Responsable" value={lead.owner} readOnly />
              <input type="hidden" name="ownerId" value={lead.ownerId} />
            </>
          ) : (
            <OwnerSelect />
          )}
          <Select label="Estado" name="stage" defaultValue={lead?.stage || 'Nuevo'}>
            {stages.map((stage) => (
              <option key={stage}>{stage}</option>
            ))}
          </Select>
          <Select label="Canal preferido" name="channel" defaultValue={lead?.channel || 'Correo'}>
            {channels.map((channel) => (
              <option key={channel}>{channel}</option>
            ))}
          </Select>
          <Field
            label="Próxima acción"
            name="action"
            defaultValue={lead?.action || 'Primer contacto'}
          />
          <Field
            label="Fecha y hora próxima acción"
            name="due"
            type="datetime-local"
            defaultValue={nextDate}
          />
        </div>
        {lead && (
          <label>
            Resultado de esta gestión
            <textarea name="result" required placeholder="¿Qué ocurrió en el contacto?" />
          </label>
        )}
      </AsyncForm>
      {lead && (
        <>
          <h3>Historial</h3>
          <div className="history">
            {data.history
              .filter((item) => item.leadId === lead.id)
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
        </>
      )}
    </>
  );
}
export function ReassignForm({ lead, onDone }: { lead: Lead; onDone: () => void }) {
  const { mutate } = useCrm();
  return (
    <>
      <p>
        {lead.name} · Responsable actual: {lead.owner}
      </p>
      <AsyncForm
        label="Reasignar"
        onSubmit={async (form) => {
          await mutate('leads/reassign', { ...values(form), id: lead.id });
          onDone();
        }}
      >
        <OwnerSelect label="Nuevo responsable" value={lead.ownerId} />
        <Field label="Motivo" name="reason" required />
      </AsyncForm>
    </>
  );
}
