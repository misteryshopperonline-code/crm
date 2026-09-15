'use client';
import { useState } from 'react';
import { roleNames, type PublicUser, type Team } from '@/domain/models';
import { urgency } from '@/domain/leads';
import { useCrm } from '../hooks/crm-context';
import { Modal, PageTitle, dateLabel } from '../components/forms';
import { TeamForm, UserForm, Invitation } from './team-forms';
type Editor =
  | { type: 'team'; team?: Team }
  | { type: 'user'; user?: PublicUser }
  | { type: 'invitation'; url: string };
export function TeamView() {
  const { data, mutate } = useCrm(),
    admin = data.currentUser.role === 'admin';
  const [editor, setEditor] = useState<Editor | null>(null),
    [error, setError] = useState('');
  function finish(token?: string) {
    setEditor(token ? { type: 'invitation', url: location.origin + '/#invite=' + token } : null);
  }
  return (
    <>
      <PageTitle
        title={admin ? 'Un equipo. Cada responsabilidad clara.' : 'Tu equipo, al día.'}
        description={
          admin
            ? 'Organiza personas, permisos y carga de seguimiento.'
            : 'El estado del seguimiento dentro de tu alcance.'
        }
        action={
          admin && (
            <button className="primary" onClick={() => setEditor({ type: 'user' })}>
              + Invitar persona
            </button>
          )
        }
      />
      <p role="alert" className="error">
        {error}
      </p>
      <div className="team-toolbar">
        <h2>{admin ? 'Equipos' : 'Tu equipo'}</h2>
        {admin && <button onClick={() => setEditor({ type: 'team' })}>+ Nuevo equipo</button>}
      </div>
      <div className="team-grid">
        {data.teams.map((team) => (
          <article className="panel" key={team.id}>
            <span className="tag">EQUIPO</span>
            <h2>{team.name}</h2>
            <p>
              {
                data.users.filter((user) => user.teamId === team.id && user.active && !user.pending)
                  .length
              }{' '}
              personas activas
            </p>
            {admin && (
              <button onClick={() => setEditor({ type: 'team', team })}>Editar equipo</button>
            )}
          </article>
        ))}
      </div>
      <div className="team-toolbar">
        <h2>Personas y seguimiento</h2>
        <span className="muted">{data.users.length} personas visibles</span>
      </div>
      <div className="people-list">
        {data.users.map((user) => {
          const leads = data.leads.filter((lead) => lead.ownerId === user.id),
            overdue = leads.filter((lead) => urgency(lead) === 'overdue').length;
          return (
            <article className="person-row" key={user.id}>
              <div className="person">
                <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
                <div>
                  <h3>{user.name}</h3>
                  <p>
                    {roleNames[user.role]} ·{' '}
                    {data.teams.find((team) => team.id === user.teamId)?.name || 'Administración'}
                  </p>
                  {admin && <p>{user.email}</p>}
                </div>
              </div>
              <span className={`tag ${!user.active || user.pending ? 'neutral' : ''}`}>
                {!user.active ? 'Desactivado' : user.pending ? 'Invitación pendiente' : 'Activo'}
              </span>
              <div>
                <strong>
                  {leads.filter((lead) => urgency(lead) !== 'closed').length} abiertos
                </strong>
                <p className={overdue ? 'error' : ''}>{overdue} vencidos</p>
              </div>
              {admin && (
                <div className="actions">
                  <button onClick={() => setEditor({ type: 'user', user })}>Editar</button>
                  {user.pending && user.active && (
                    <button
                      onClick={async () => {
                        try {
                          setError('');
                          finish((await mutate('users/invite', { id: user.id })).inviteToken);
                        } catch (error) {
                          setError(error instanceof Error ? error.message : 'No se pudo renovar.');
                        }
                      }}
                    >
                      Renovar invitación
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {admin && (
        <>
          <div className="team-toolbar">
            <h2>Actividad administrativa</h2>
          </div>
          <div className="panel audit-list">
            {data.audit.length
              ? data.audit.map((item) => (
                  <p key={item.id}>
                    <small>
                      {dateLabel(item.date)} ·{' '}
                      {data.users.find((user) => user.id === item.actorId)?.name || 'Usuario'}
                    </small>
                    <br />
                    {item.text}
                  </p>
                ))
              : 'Aún no hay cambios registrados.'}
          </div>
        </>
      )}
      {editor && (
        <Modal
          title={
            editor.type === 'team'
              ? editor.team
                ? 'Editar equipo'
                : 'Nuevo equipo'
              : editor.type === 'user'
                ? editor.user
                  ? 'Editar usuario'
                  : 'Invitar a una persona'
                : 'Listo para sumarse al equipo'
          }
          onClose={() => setEditor(null)}
        >
          {editor.type === 'team' ? (
            <TeamForm team={editor.team} onDone={() => setEditor(null)} />
          ) : editor.type === 'user' ? (
            <UserForm user={editor.user} onDone={finish} />
          ) : (
            <Invitation url={editor.url} />
          )}
        </Modal>
      )}
    </>
  );
}
