'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { roleNames } from '@/domain/models';
import { urgency } from '@/domain/leads';
import { useCrm } from '../hooks/crm-context';
import { AsyncForm, Field, Modal, values } from './forms';
const navigation = [
  { path: '/agenda', label: 'Mi día', icon: '◷' },
  { path: '/leads', label: 'Leads', icon: '▤' },
  { path: '/equipo', label: 'Equipo', icon: '♙' },
  { path: '/plantillas', label: 'Plantillas', icon: '▧' },
  { path: '/automatizaciones', label: 'Automatizaciones', icon: '⚡', admin: true },
  { path: '/canales', label: 'Canales', icon: '⇄', admin: true },
  { path: '/configuracion', label: 'Configuración', icon: '⚙', admin: true },
];
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const { data, mutate, logout } = useCrm(),
    path = usePathname();
  const [profile, setProfile] = useState(false),
    [error, setError] = useState('');
  const user = data.currentUser,
    current = navigation.find((item) => item.path === path);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Ir al contenido
      </a>
      <aside>
        <Link className="brand" href="/agenda">
          ▥ <strong>pulso</strong>
          <span>CRM</span>
        </Link>
        <div className="workspace">
          <span className="avatar">{data.settings.business.slice(0, 2).toUpperCase()}</span>
          <div>{data.settings.business}</div>
        </div>
        <div className="nav-label">ESPACIO DE TRABAJO</div>
        <nav aria-label="Navegación principal">
          {navigation
            .filter((item) => !item.admin || user.role === 'admin')
            .map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={path === item.path ? 'active' : ''}
                aria-current={path === item.path ? 'page' : undefined}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
                {item.path === '/agenda' && (
                  <small>
                    {
                      data.leads.filter((lead) =>
                        ['today', 'overdue', 'missing'].includes(urgency(lead)),
                      ).length
                    }
                  </small>
                )}
              </Link>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{roleNames[user.role]}</small>
            <button className="text-button" onClick={() => setProfile(true)}>
              Mi cuenta
            </button>
            <button
              className="text-button"
              onClick={() => void logout().catch((error) => setError(error.message))}
            >
              Salir
            </button>
            <p className="error" role="alert">
              {error}
            </p>
          </div>
        </div>
      </aside>
      <main id="main-content" tabIndex={-1}>
        <header>
          <span>
            Espacio comercial <b>/</b> {current?.label}
          </span>
          <span className="local">Edición local</span>
        </header>
        <section>
          {current?.admin && user.role !== 'admin' ? (
            <div className="panel">
              <h1>Acceso restringido</h1>
              <p>Esta sección requiere permisos de administrador.</p>
              <Link href="/agenda">Volver a mi día</Link>
            </div>
          ) : (
            children
          )}
        </section>
      </main>
      {profile && (
        <Modal title="Mi cuenta" onClose={() => setProfile(false)}>
          <p>
            {user.name} · {roleNames[user.role]}
          </p>
          <AsyncForm
            label="Cambiar contraseña"
            onSubmit={async (form) => {
              if (form.get('password') !== form.get('confirmPassword'))
                throw Error('Las contraseñas no coinciden.');
              await mutate('auth/password', values(form));
              setProfile(false);
            }}
          >
            <Field
              label="Contraseña actual"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
            />
            <Field
              label="Nueva contraseña"
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
            <Field
              label="Confirmar contraseña"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
            />
            <p>Se cerrarán tus otras sesiones.</p>
          </AsyncForm>
        </Modal>
      )}
    </>
  );
}
