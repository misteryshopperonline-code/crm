import type { DatabaseModel } from '../domain/models';
/** Synchronous transactions must never contain asynchronous work. */
export interface Repository {
  read<T>(query: (data: DatabaseModel) => T): T;
  transaction<T>(operation: (data: DatabaseModel) => T): T;
}
export interface Security {
  hashPassword(password: string): Promise<string>;
  verifyPassword(password: unknown, stored: string | null): Promise<boolean>;
  token(): string;
  digest(value: string): string;
}
export interface Dependencies {
  repository: Repository;
  security: Security;
  now(): number;
  id(): string;
}
