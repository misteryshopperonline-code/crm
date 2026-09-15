import 'server-only';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { AuthService } from '../application/auth-service';
import { LeadService } from '../application/lead-service';
import { TeamService } from '../application/team-service';
import { ConfigurationService } from '../application/configuration-service';
import { QueryService } from '../application/query-service';
import { SqliteRepository } from './sqlite-repository';
import { nodeSecurity } from './security';
function createContainer() {
  const deps = {
    repository: new SqliteRepository(
      resolve(/*turbopackIgnore: true*/ process.env.DATA_DIR || 'data'),
    ),
    security: nodeSecurity,
    now: Date.now,
    id: randomUUID,
  };
  return {
    auth: new AuthService(deps),
    leads: new LeadService(deps),
    teams: new TeamService(deps),
    configuration: new ConfigurationService(deps),
    queries: new QueryService(deps),
  };
}
type Container = ReturnType<typeof createContainer>;
const runtime = globalThis as typeof globalThis & {
  pulsoContainer?: Container;
  pulsoTimer?: ReturnType<typeof setInterval>;
};
export function getContainer(): Container {
  return (runtime.pulsoContainer ??= createContainer());
}
export function startScheduler(): void {
  if (runtime.pulsoTimer) return;
  runtime.pulsoTimer = setInterval(() => {
    try {
      getContainer().queries.refresh();
    } catch (error) {
      console.error(
        'No se pudo actualizar el escalamiento.',
        error instanceof Error ? error.name : 'UnknownError',
      );
    }
  }, 60000);
  runtime.pulsoTimer.unref();
}
