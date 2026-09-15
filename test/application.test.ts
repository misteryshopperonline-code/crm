import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Repository, Dependencies } from '../src/application/ports';
import type { DatabaseModel, User } from '../src/domain/models';
import { initialState } from '../src/domain/defaults';
import { LeadService } from '../src/application/lead-service';
import { QueryService } from '../src/application/query-service';
import { ApplicationError } from '../src/domain/errors';
class MemoryRepository implements Repository {
  data: DatabaseModel = {
    state: initialState(() => 'template'),
    users: [],
    teams: [],
    sessions: [],
    attempts: [],
    audit: [],
  };
  read<T>(fn: (data: DatabaseModel) => T): T {
    return fn(structuredClone(this.data));
  }
  transaction<T>(fn: (data: DatabaseModel) => T): T {
    const next = structuredClone(this.data);
    const value = fn(next);
    this.data = next;
    return value;
  }
}
test('use cases operate without Next.js or SQLite and obey an injected clock', () => {
  const repository = new MemoryRepository();
  let now = Date.parse('2026-09-15T12:00:00Z'),
    sequence = 0;
  const user: User = {
    id: 'executive',
    name: 'Test',
    email: 'test@example.test',
    role: 'executive',
    active: true,
    teamId: 'team',
    passwordHash: 'hash',
    inviteHash: null,
    inviteExpires: null,
  };
  repository.data.users.push(user);
  repository.data.teams.push({ id: 'team', name: 'Team' });
  const deps: Dependencies = {
    repository,
    now: () => now,
    id: () => String(++sequence),
    security: {
      token: () => '',
      digest: (v) => v,
      hashPassword: async (v) => v,
      verifyPassword: async () => true,
    },
  };
  const leads = new LeadService(deps),
    queries = new QueryService(deps);
  leads.save(user.id, {
    name: 'Opportunity',
    email: 'lead@example.test',
    channel: 'Correo',
    stage: 'Nuevo',
  });
  const created = queries.snapshot(user.id).leads[0];
  assert.equal(created.due, '2026-09-16T12:00:00.000Z');
  now += 49 * 3600000;
  assert.equal(queries.snapshot(user.id).leads[0].escalation, 2);
  assert.throws(
    () => leads.save(user.id, { ...created, result: '', due: '2026-09-18T12:00:00Z' }),
    ApplicationError,
  );
  assert.equal(repository.data.state.leads[0].attempts, 0);
  repository.data.users[0].active = false;
  assert.throws(
    () => queries.snapshot(user.id),
    (error: unknown) => error instanceof ApplicationError && error.code === 'unauthenticated',
  );
});
