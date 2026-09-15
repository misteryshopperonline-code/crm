import { reject } from './errors';
import type { Lead, PublicUser, User } from './models';
export function requireAdmin(actor: User): void {
  if (actor.role !== 'admin') reject('forbidden', 'Esta acción requiere un administrador.');
}
export function canSeeLead(actor: User, lead: Lead, users: User[]): boolean {
  if (actor.role === 'admin') return true;
  if (actor.role === 'executive') return lead.ownerId === actor.id;
  return !!actor.teamId && users.find((user) => user.id === lead.ownerId)?.teamId === actor.teamId;
}
export function canAssign(actor: User, target: User | undefined): target is User {
  return (
    !!target?.active &&
    !!target.passwordHash &&
    (actor.role === 'admin' ||
      (actor.role === 'supervisor' && !!actor.teamId && actor.teamId === target.teamId) ||
      (actor.role === 'executive' && actor.id === target.id))
  );
}
export function publicUser(user: User, includeEmail = true): PublicUser {
  return {
    id: user.id,
    name: user.name,
    ...(includeEmail ? { email: user.email } : {}),
    role: user.role,
    teamId: user.teamId,
    active: user.active,
    pending: !user.passwordHash,
  };
}
