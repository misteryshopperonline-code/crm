import { reject } from '../domain/errors';
import type { DatabaseModel, User } from '../domain/models';
import type { Dependencies } from './ports';
export function currentUser(data: DatabaseModel, userId: string): User {
  const user = data.users.find((user) => user.id === userId && user.active && user.passwordHash);
  if (!user) reject('unauthenticated', 'Inicia sesión para continuar.');
  return user;
}
export function audit(
  data: DatabaseModel,
  deps: Dependencies,
  actorId: string,
  message: string,
): void {
  data.audit.unshift({
    id: deps.id(),
    date: new Date(deps.now()).toISOString(),
    actorId,
    text: message,
  });
}
