'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { request, ApiError } from '../api-client';
import { AsyncForm, Field, values } from '../components/forms';
type Mode = 'setup' | 'login' | 'activate';
export function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('login'),
    [token, setToken] = useState(''),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    async function initialize() {
      try {
        const invite = new URLSearchParams(location.hash.slice(1)).get('invite') || '';
        if (invite) history.replaceState(null, '', location.pathname);
        const status = await request<{ needsSetup: boolean }>('auth/status');
        if (!live) return;
        if (status.needsSetup) setMode('setup');
        else if (invite) {
          setToken(invite);
          setMode('activate');
        } else {
          try {
            await request('state');
            if (live) router.replace('/agenda');
          } catch (error) {
            if (!(error instanceof ApiError && error.status === 401)) throw error;
          }
        }
      } catch (error) {
        if (live) setError(error instanceof Error ? error.message : 'No se pudo cargar el CRM.');
      } finally {
        if (live) setLoading(false);
      }
    }
    void initialize();
    return () => {
      live = false;
    };
  }, [router]);
  return (
    <div className="auth-page">
      <section className="auth-screen">
        <div className="auth-brand">
          ▥ pulso <span>CRM</span>
        </div>
        <div className="auth-card">
          {loading ? (
            <p role="status">Cargando tu espacio…</p>
          ) : error ? (
            <>
              <p className="error" role="alert">
                {error}
              </p>
              <button onClick={() => location.reload()}>Reintentar</button>
            </>
          ) : (
            <>
              <span className="tag">TU EQUIPO, CONECTADO</span>
              <h1>
                {mode === 'setup'
                  ? 'Tu espacio empieza aquí.'
                  : mode === 'activate'
                    ? 'Bienvenido a tu equipo.'
                    : 'Retoma tu próximo paso.'}
              </h1>
              <p>
                {mode === 'setup'
                  ? 'Crea el administrador de este espacio. Los leads existentes se conservarán y quedarán a tu cargo para reasignarlos.'
                  : mode === 'activate'
                    ? 'Usa tu invitación y elige tu contraseña.'
                    : 'Inicia sesión para ver tus leads y pendientes.'}
              </p>
              <AsyncForm
                key={mode}
                label={
                  mode === 'setup'
                    ? 'Crear mi espacio'
                    : mode === 'activate'
                      ? 'Activar mi cuenta'
                      : 'Iniciar sesión'
                }
                onSubmit={async (form) => {
                  if (mode !== 'login' && form.get('password') !== form.get('confirmPassword'))
                    throw Error('Las contraseñas no coinciden.');
                  await request('auth/' + mode, values(form));
                  router.replace('/agenda');
                }}
              >
                {mode === 'setup' && (
                  <Field label="Tu nombre" name="name" required autoComplete="name" />
                )}
                {mode === 'activate' ? (
                  <Field label="Código de invitación" name="token" required defaultValue={token} />
                ) : (
                  <Field
                    label="Correo"
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                  />
                )}
                <Field
                  label="Contraseña"
                  name="password"
                  type="password"
                  required
                  minLength={mode === 'login' ? undefined : 12}
                  maxLength={128}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                />
                {mode !== 'login' && (
                  <>
                    <Field
                      label="Confirmar contraseña"
                      name="confirmPassword"
                      type="password"
                      required
                      autoComplete="new-password"
                    />
                    <p>Entre 12 y 128 caracteres. Puedes usar una frase larga.</p>
                  </>
                )}
              </AsyncForm>
              {mode === 'login' && (
                <button className="text-button" onClick={() => setMode('activate')}>
                  Tengo una invitación
                </button>
              )}
              {mode === 'activate' && (
                <button className="text-button" onClick={() => setMode('login')}>
                  Volver al inicio de sesión
                </button>
              )}
              <div className="auth-note">Espacio local · Tus datos permanecen en este equipo</div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
