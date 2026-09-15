import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Repository } from '../application/ports';
import type {
  AuditEntry,
  Attempt,
  CrmState,
  DatabaseModel,
  Session,
  Team,
  User,
} from '../domain/models';
import { initialState } from '../domain/defaults';

/** Compatibility adapter for the v0.2 SQLite schema. No framework dependency. */
export class SqliteRepository implements Repository {
  private readonly db: DatabaseSync;
  constructor(directory: string) {
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    const filename = join(/* turbopackIgnore: true */ directory, 'crm.sqlite');
    this.db = new DatabaseSync(/* turbopackIgnore: true */ filename);
    this.db.exec('PRAGMA busy_timeout=5000');
    const existing = this.db.prepare("SELECT name FROM sqlite_master WHERE name='state'").get();
    const hasUsers = this.db.prepare("SELECT name FROM sqlite_master WHERE name='users'").get();
    const backup = join(
      directory,
      hasUsers ? 'crm.before-nextjs.sqlite' : 'crm.before-auth.sqlite',
    );
    // SQLite creates a consistent backup even if the original database uses a journal.
    if (existing && !existsSync(/* turbopackIgnore: true */ backup))
      this.db.prepare('VACUUM INTO ?').run(backup);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS state (id INTEGER PRIMARY KEY, json TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, role TEXT NOT NULL CHECK(role IN ('admin','supervisor','executive')), teamId TEXT, active INTEGER NOT NULL DEFAULT 1, passwordHash TEXT, inviteHash TEXT, inviteExpires INTEGER);
      CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
      CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, userId TEXT NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, date TEXT NOT NULL, actorId TEXT NOT NULL, text TEXT NOT NULL);
    `);
    this.db
      .prepare('INSERT OR IGNORE INTO state VALUES (1,?)')
      .run(JSON.stringify(initialState(randomUUID)));
  }
  private load(): DatabaseModel {
    const row = this.db.prepare('SELECT json FROM state WHERE id=1').get() as { json: string };
    const users = this.db.prepare('SELECT * FROM users ORDER BY name').all() as unknown as User[];
    return {
      state: JSON.parse(row.json) as CrmState,
      users: users.map((user) => ({ ...user, active: Boolean(user.active) })),
      teams: this.db.prepare('SELECT * FROM teams ORDER BY name').all() as unknown as Team[],
      sessions: this.db.prepare('SELECT * FROM sessions').all() as unknown as Session[],
      attempts: this.db.prepare('SELECT * FROM auth_attempts').all() as unknown as Attempt[],
      audit: this.db
        .prepare('SELECT * FROM audit ORDER BY date DESC')
        .all() as unknown as AuditEntry[],
    };
  }
  read<T>(query: (data: DatabaseModel) => T): T {
    this.db.exec('BEGIN');
    try {
      const result = query(this.load());
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  transaction<T>(operation: (data: DatabaseModel) => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const data = this.load();
      const result = operation(data);
      if (result instanceof Promise)
        throw new Error('Repository transactions must be synchronous.');
      this.save(data);
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
  private save(data: DatabaseModel): void {
    const stateJson = JSON.stringify(data.state);
    this.db.prepare('UPDATE state SET json=? WHERE id=1 AND json<>?').run(stateJson, stateJson);
    this.syncRows(
      'users',
      'id',
      data.users.map((user) => ({ ...user, active: Number(user.active) })),
    );
    this.syncRows(
      'teams',
      'id',
      data.teams.map((team) => ({ ...team })),
    );
    this.syncRows(
      'sessions',
      'hash',
      data.sessions.map((session) => ({ ...session })),
    );
    this.syncRows(
      'auth_attempts',
      'key',
      data.attempts.map((attempt) => ({ ...attempt })),
    );
    this.syncRows(
      'audit',
      'id',
      data.audit.map((entry) => ({ ...entry })),
    );
  }
  private syncRows(
    table: 'users' | 'teams' | 'sessions' | 'auth_attempts' | 'audit',
    key: string,
    rows: Record<string, SQLInputValue>[],
  ): void {
    const previous = this.db.prepare(`SELECT * FROM ${table}`).all();
    const existing = new Map(previous.map((row) => [String(row[key]), row]));
    const ids = new Set(rows.map((row) => String(row[key])));
    const remove = this.db.prepare(`DELETE FROM ${table} WHERE ${key}=?`);
    for (const row of previous) if (!ids.has(String(row[key]))) remove.run(row[key]);
    if (!rows.length) return;
    const columns = Object.keys(rows[0]);
    const changes = columns
      .filter((column) => column !== key)
      .map((column) => `${column}=excluded.${column}`)
      .join(',');
    const upsert = this.db.prepare(
      `INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')}) ON CONFLICT(${key}) DO UPDATE SET ${changes}`,
    );
    for (const row of rows) {
      const old = existing.get(String(row[key]));
      if (!old || columns.some((column) => old[column] !== row[column]))
        upsert.run(...columns.map((column) => row[column]));
    }
  }
  close(): void {
    this.db.close();
  }
}
