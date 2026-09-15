import { reject } from '../domain/errors';
import { email, isEmail, text, validatePassword } from '../domain/validation';
import type { DatabaseModel, Input, User } from '../domain/models';
import type { Dependencies } from './ports';
import { audit, currentUser } from './shared';
export interface AuthResult {
  userId: string;
  sessionToken: string;
}
export class AuthService {
  constructor(private readonly deps: Dependencies) {}
  needsSetup(): boolean {
    return this.deps.repository.read((data) => data.users.length === 0);
  }
  authenticate(sessionToken: string): string {
    if (!/^[a-f0-9]{64}$/.test(sessionToken))
      reject('unauthenticated', 'Inicia sesión para continuar.');
    return this.deps.repository.read((data) => {
      const session = data.sessions.find(
        (item) =>
          item.hash === this.deps.security.digest(sessionToken) && item.expires > this.deps.now(),
      );
      if (!session) reject('unauthenticated', 'Inicia sesión para continuar.');
      return currentUser(data, session.userId).id;
    });
  }
  private attempt(keys: string[]): void {
    this.deps.repository.transaction((data) => {
      data.attempts = data.attempts.filter((item) => item.until > this.deps.now());
      if (keys.some((key) => data.attempts.some((item) => item.key === key && item.count >= 10)))
        reject('rate_limited', 'Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.');
      for (const key of keys) {
        const item = data.attempts.find((item) => item.key === key);
        if (item) item.count++;
        else data.attempts.push({ key, count: 1, until: this.deps.now() + 15 * 60000 });
      }
    });
  }
  private session(data: DatabaseModel, userId: string, keys: string[] = []): AuthResult {
    const sessionToken = this.deps.security.token();
    data.sessions = data.sessions.filter((item) => item.expires > this.deps.now());
    data.sessions.push({
      hash: this.deps.security.digest(sessionToken),
      userId,
      expires: this.deps.now() + 12 * 3600000,
    });
    data.attempts = data.attempts.filter((item) => !keys.includes(item.key));
    return { userId, sessionToken };
  }
  async setup(input: Input): Promise<AuthResult> {
    const keys = ['local:setup'];
    this.attempt(keys);
    if (!this.needsSetup()) reject('conflict', 'El administrador inicial ya está configurado.');
    const name = text(input.name, 100),
      address = email(input.email);
    validatePassword(input.password);
    if (!name || !isEmail(address)) reject('validation', 'Completa nombre y correo válido.');
    const passwordHash = await this.deps.security.hashPassword(input.password);
    return this.deps.repository.transaction((data) => {
      if (data.users.length) reject('conflict', 'El administrador inicial ya está configurado.');
      const id = this.deps.id(),
        teamId = this.deps.id();
      data.teams.push({ id: teamId, name: 'Equipo comercial' });
      data.users.push({
        id,
        name,
        email: address,
        role: 'admin',
        teamId,
        active: true,
        passwordHash,
        inviteHash: null,
        inviteExpires: null,
      });
      for (const lead of data.state.leads)
        if (!lead.ownerId) {
          lead.legacyOwner = lead.owner;
          lead.ownerId = id;
          lead.owner = name;
        }
      audit(
        data,
        this.deps,
        id,
        'Configuró el espacio y asumió los leads anteriores para su reasignación.',
      );
      return this.session(data, id, keys);
    });
  }
  async login(input: Input): Promise<AuthResult> {
    const address = email(input.email),
      keys = ['local:login', `login-account:${this.deps.security.digest(address)}`];
    this.attempt(keys);
    const user = this.deps.repository.read((data) =>
      data.users.find((user) => user.email === address),
    );
    if (
      !(await this.deps.security.verifyPassword(input.password, user?.passwordHash ?? null)) ||
      !user?.active
    )
      reject('unauthenticated', 'Correo o contraseña incorrectos.');
    return this.deps.repository.transaction((data) => {
      const fresh = currentUser(data, user.id);
      if (fresh.passwordHash !== user.passwordHash)
        reject('unauthenticated', 'La cuenta cambió. Inténtalo de nuevo.');
      return this.session(data, fresh.id, keys);
    });
  }
  async activate(input: Input): Promise<AuthResult> {
    const keys = ['local:activate'];
    this.attempt(keys);
    validatePassword(input.password);
    const token = text(input.token, 64);
    if (!/^[a-f0-9]{64}$/.test(token))
      reject('validation', 'La invitación no es válida o ha vencido.');
    const passwordHash = await this.deps.security.hashPassword(input.password);
    return this.deps.repository.transaction((data) => {
      const user = data.users.find(
        (user) =>
          user.active &&
          user.inviteHash === this.deps.security.digest(token) &&
          (user.inviteExpires ?? 0) > this.deps.now(),
      );
      if (!user) reject('validation', 'La invitación no es válida o ha vencido.');
      user.passwordHash = passwordHash;
      user.inviteHash = null;
      user.inviteExpires = null;
      audit(data, this.deps, user.id, 'Activó su cuenta.');
      return this.session(data, user.id, keys);
    });
  }
  logout(sessionToken: string): void {
    this.deps.repository.transaction((data) => {
      data.sessions = data.sessions.filter(
        (item) => item.hash !== this.deps.security.digest(sessionToken),
      );
    });
  }
  async changePassword(userId: string, input: Input): Promise<AuthResult> {
    const keys = [`password:${userId}`];
    this.attempt(keys);
    const user: User = this.deps.repository.read((data) => currentUser(data, userId));
    if (!(await this.deps.security.verifyPassword(input.currentPassword, user.passwordHash)))
      reject('validation', 'La contraseña actual no es correcta.');
    validatePassword(input.password);
    const hash = await this.deps.security.hashPassword(input.password);
    return this.deps.repository.transaction((data) => {
      const fresh = currentUser(data, userId);
      if (fresh.passwordHash !== user.passwordHash)
        reject('unauthenticated', 'La cuenta cambió. Inicia sesión nuevamente.');
      fresh.passwordHash = hash;
      data.sessions = data.sessions.filter((item) => item.userId !== userId);
      audit(data, this.deps, userId, 'Cambió su contraseña e invalidó sus sesiones anteriores.');
      return this.session(data, userId, keys);
    });
  }
}
