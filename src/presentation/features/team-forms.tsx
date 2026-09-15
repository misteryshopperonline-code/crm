'use client';
import { roleNames, type PublicUser, type Team } from '@/domain/models';
import { useCrm } from '../hooks/crm-context';
import { AsyncForm, Field, Select, values } from '../components/forms';
export function TeamForm({ team, onDone }: { team?: Team; onDone: () => void }) {
  const { mutate } = useCrm();
  return (
    <AsyncForm
      label="Guardar equipo"
      onSubmit={async (form) => {
        await mutate('teams', { ...values(form), id: team?.id });
        onDone();
      }}
    >
      <Field label="Nombre del equipo" name="name" required defaultValue={team?.name} />
    </AsyncForm>
  );
}
export function UserForm({
  user,
  onDone,
}: {
  user?: PublicUser;
  onDone: (token?: string) => void;
}) {
  const { data, mutate } = useCrm();
  return (
    <>
      <p>
        {user
          ? 'Los cambios de permisos cierran las sesiones del usuario.'
          : 'Cada persona elegirá su contraseña con una invitación de un solo uso.'}
      </p>
      <AsyncForm
        label={user ? 'Guardar usuario' : 'Crear invitación'}
        onSubmit={async (form) => {
          const result = await mutate('users', {
            ...values(form),
            id: user?.id,
            active: form.get('active') === 'on',
          });
          onDone(result.inviteToken);
        }}
      >
        <Field label="Nombre" name="name" required defaultValue={user?.name} />
        <Field label="Correo" name="email" type="email" required defaultValue={user?.email} />
        <div className="form-grid">
          <Select label="Rol" name="role" defaultValue={user?.role || 'executive'}>
            {Object.entries(roleNames).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select label="Equipo" name="teamId" defaultValue={user?.teamId ?? data.teams[0]?.id}>
            <option value="">Sin equipo (solo administrador)</option>
            {data.teams.map((team) => (
              <option value={team.id} key={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </div>
        <label className="check">
          <input type="checkbox" name="active" defaultChecked={user?.active ?? true} />
          Usuario activo
        </label>
        <div className="permission-hint">
          <strong>Alcance por rol</strong>
          <p>
            Ejecutivo: sus leads. Supervisor: leads de su equipo y plantillas. Administrador: todo
            el espacio y su configuración.
          </p>
        </div>
      </AsyncForm>
    </>
  );
}
export function Invitation({ url }: { url: string }) {
  return (
    <>
      <p>
        Comparte este enlace por un medio privado. Vence en 48 horas y solo puede utilizarse una
        vez. No se ha enviado ningún correo.
      </p>
      <Field label="Enlace de activación" readOnly value={url} />
      <p className="muted">
        Esta edición funciona en este equipo. El acceso desde otras computadoras requiere un
        despliegue posterior.
      </p>
    </>
  );
}
