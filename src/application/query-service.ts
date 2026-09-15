import { urgency } from '../domain/leads';
import type { DatabaseModel, Snapshot } from '../domain/models';
import { canSeeLead, canAssign, publicUser } from '../domain/permissions';
import type { Dependencies } from './ports';
import { currentUser } from './shared';
export function refreshEscalations(data: DatabaseModel, now: number): void {
  for (const lead of data.state.leads)
    lead.escalation =
      data.state.rules.find((rule) => rule.id === 'overdue')?.enabled &&
      urgency(lead, now) === 'overdue'
        ? now - Date.parse(lead.due) > 86400000
          ? 2
          : 1
        : 0;
}
export class QueryService {
  constructor(private readonly deps: Dependencies) {}
  refresh(): void {
    this.deps.repository.transaction((data) => refreshEscalations(data, this.deps.now()));
  }
  snapshot(actorId: string): Snapshot {
    return this.deps.repository.transaction((data) => {
      const actor = currentUser(data, actorId),
        admin = actor.role === 'admin';
      refreshEscalations(data, this.deps.now());
      const leads = data.state.leads
        .filter((lead) => canSeeLead(actor, lead, data.users))
        .map((lead) => ({
          ...lead,
          owner: data.users.find((user) => user.id === lead.ownerId)?.name || lead.owner,
        }));
      const visible = new Set(leads.map((lead) => lead.id));
      return {
        ...data.state,
        leads,
        history: data.state.history.filter((item) => visible.has(item.leadId)),
        integrations: admin ? data.state.integrations : [],
        rules: admin ? data.state.rules : [],
        currentUser: publicUser(actor),
        users: data.users
          .filter(
            (user) =>
              admin ||
              user.id === actor.id ||
              (actor.role === 'supervisor' && !!actor.teamId && user.teamId === actor.teamId),
          )
          .map((user) => publicUser(user, admin)),
        assignableUsers: data.users
          .filter((user) => canAssign(actor, user))
          .map(({ id, name, teamId }) => ({ id, name, teamId })),
        teams: data.teams.filter((team) => admin || team.id === actor.teamId),
        audit: admin ? data.audit.slice(0, 100) : [],
      };
    });
  }
}
