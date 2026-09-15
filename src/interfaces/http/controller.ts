import { NextRequest, NextResponse } from 'next/server';
import { ApplicationError, type ErrorCode } from '../../domain/errors';
import type { Input } from '../../domain/models';
import { getContainer } from '../../infrastructure/container';
const statuses: Record<ErrorCode, number> = {
  validation: 422,
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
};
const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
async function readInput(request: Request): Promise<Input> {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'JSON requerido.');
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'Solicitud no válida.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 100000) {
      await reader.cancel();
      throw new HttpError(413, 'Solicitud demasiado grande.');
    }
    chunks.push(value);
  }
  let value: unknown;
  try {
    value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'JSON no válido.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new HttpError(400, 'Solicitud no válida.');
  return value as Input;
}
class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
function checkOrigin(request: NextRequest): void {
  const host = request.headers.get('host'),
    port = process.env.PORT || '4310';
  if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(host || ''))
    throw new HttpError(403, 'Host no permitido.');
  if (request.method !== 'GET' && request.headers.get('origin') !== `http://${host}`)
    throw new HttpError(403, 'Origen no permitido.');
}
function setSession(response: NextResponse, token: string): NextResponse {
  response.cookies.set('pulso_session', token, {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    maxAge: token ? 43200 : 0,
  });
  return response;
}
export async function handleRequest(request: NextRequest, path: string): Promise<NextResponse> {
  try {
    checkOrigin(request);
    const app = getContainer();
    if (request.method === 'GET' && path === 'auth/status')
      return json({ needsSetup: app.auth.needsSetup() });
    const sessionToken = request.cookies.get('pulso_session')?.value || '';
    if (request.method === 'GET' && path === 'state')
      return json(app.queries.snapshot(app.auth.authenticate(sessionToken)));
    if (request.method !== 'POST') return json({ error: 'Ruta no encontrada.' }, 404);
    const input = await readInput(request);
    if (path === 'auth/setup' || path === 'auth/login' || path === 'auth/activate') {
      const method = path.slice(5) as 'setup' | 'login' | 'activate';
      const result = await app.auth[method](input);
      return setSession(json(app.queries.snapshot(result.userId)), result.sessionToken);
    }
    const actorId = app.auth.authenticate(sessionToken);
    if (path === 'auth/logout') {
      app.auth.logout(sessionToken);
      return setSession(json({ ok: true }), '');
    }
    if (path === 'auth/password') {
      const result = await app.auth.changePassword(actorId, input);
      return setSession(json(app.queries.snapshot(result.userId)), result.sessionToken);
    }
    const commands: Record<string, () => void | string | undefined> = {
      teams: () => app.teams.saveTeam(actorId, input),
      users: () => app.teams.saveUser(actorId, input),
      'users/invite': () => app.teams.renewInvitation(actorId, input),
      leads: () => app.leads.save(actorId, input),
      'leads/reassign': () => app.leads.reassign(actorId, input),
      templates: () => app.configuration.saveTemplate(actorId, input),
      settings: () => app.configuration.saveSettings(actorId, input),
      rules: () => app.configuration.saveRule(actorId, input),
      integrations: () => app.configuration.saveIntegration(actorId, input),
    };
    const command = Object.hasOwn(commands, path) ? commands[path] : undefined;
    if (!command) return json({ error: 'Ruta no encontrada.' }, 404);
    const inviteToken = command();
    return json({ ...app.queries.snapshot(actorId), ...(inviteToken ? { inviteToken } : {}) });
  } catch (error) {
    if (error instanceof ApplicationError)
      return json({ error: error.message }, statuses[error.code]);
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error('Error interno de la API', error instanceof Error ? error.name : 'UnknownError');
    return json({ error: 'No se pudo completar la operación. Inténtalo de nuevo.' }, 500);
  }
}
