import { reject } from '../domain/errors';
import { roles, roleNames, type Input, type Role } from '../domain/models';
import { requireAdmin } from '../domain/permissions';
import { email, isEmail, text } from '../domain/validation';
import type { Dependencies } from './ports';
import { audit, currentUser } from './shared';
export class TeamService {
  constructor(private readonly deps: Dependencies) {}
  saveTeam(actorId: string, input: Input): void {
    this.deps.repository.transaction((data) => {
      requireAdmin(currentUser(data, actorId));
      const name = text(input.name, 100),
        id = text(input.id);
      if (!name) reject('validation', 'Indica un nombre de equipo.');
      if (
        data.teams.some((team) => team.id !== id && team.name.toLowerCase() === name.toLowerCase())
      )
        reject('conflict', 'Ya existe un equipo con ese nombre.');
      const existing = data.teams.find((team) => team.id === id);
      if (id && !existing) reject('not_found', 'Equipo no encontrado.');
      if (existing) existing.name = name;
      else data.teams.push({ id: this.deps.id(), name });
      audit(data, this.deps, actorId, `Guardó el equipo ${name}.`);
    });
  }
  saveUser(actorId: string, input: Input): string | undefined {
    return this.deps.repository.transaction((data) => {
      requireAdmin(currentUser(data, actorId));
      const name = text(input.name, 100),
        address = email(input.email),
        role = text(input.role) as Role,
        teamId = text(input.teamId, 100) || null,
        id = text(input.id);
      if (!name || !isEmail(address) || !roles.includes(role) || typeof input.active !== 'boolean')
        reject('validation', 'Completa nombre, correo, rol y estado.');
      if (
        (role !== 'admin' && !teamId) ||
        (teamId && !data.teams.some((team) => team.id === teamId))
      )
        reject('validation', 'Selecciona un equipo válido.');
      if (data.users.some((user) => user.email === address && user.id !== id))
        reject('conflict', 'Ese correo ya está registrado.');
      const old = data.users.find((user) => user.id === id);
      if (id && !old) reject('not_found', 'Usuario no encontrado.');
      if (old) {
        if (old.id === actorId && (!input.active || role !== 'admin'))
          reject('validation', 'No puedes quitarte tu propio acceso de administrador.');
        if (
          (!input.active || teamId !== old.teamId) &&
          data.state.leads.some((lead) => lead.ownerId === old.id)
        )
          reject(
            'validation',
            'Reasigna primero todos los leads de este usuario, incluidos los cerrados.',
          );
        if (old.role !== role || old.teamId !== teamId || !input.active || old.email !== address) {
          data.sessions = data.sessions.filter((session) => session.userId !== old.id);
          if (!old.passwordHash) {
            old.inviteHash = null;
            old.inviteExpires = null;
          }
        }
        Object.assign(old, { name, email: address, role, teamId, active: input.active });
        for (const lead of data.state.leads) if (lead.ownerId === old.id) lead.owner = name;
        audit(
          data,
          this.deps,
          actorId,
          `Actualizó a ${name}: ${roleNames[role]}, ${input.active ? 'activo' : 'desactivado'}.`,
        );
        return;
      }
      if (!input.active) reject('validation', 'Crea el usuario activo para poder invitarlo.');
      const invitation = this.deps.security.token();
      data.users.push({
        id: this.deps.id(),
        name,
        email: address,
        role,
        teamId,
        active: true,
        passwordHash: null,
        inviteHash: this.deps.security.digest(invitation),
        inviteExpires: this.deps.now() + 48 * 3600000,
      });
      audit(data, this.deps, actorId, `Invitó a ${name} con rol ${roleNames[role]}.`);
      return invitation;
    });
  }
  renewInvitation(actorId: string, input: Input): string {
    return this.deps.repository.transaction((data) => {
      requireAdmin(currentUser(data, actorId));
      const user = data.users.find((user) => user.id === input.id);
      if (!user || !user.active || user.passwordHash)
        reject('validation', 'Solo puedes renovar invitaciones de usuarios pendientes y activos.');
      const invitation = this.deps.security.token();
      user.inviteHash = this.deps.security.digest(invitation);
      user.inviteExpires = this.deps.now() + 48 * 3600000;
      audit(data, this.deps, actorId, `Renovó la invitación de ${user.name}.`);
      return invitation;
    });
  }
}
