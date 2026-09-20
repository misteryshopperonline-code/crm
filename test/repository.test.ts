import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SqliteRepository } from '../src/infrastructure/sqlite-repository';

test('SQLite retains existing accounts and sessions, rolls back failures and reloads between writers', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pulso-repository-'));
  const first = new SqliteRepository(directory);
  first.transaction((data) => {
    data.users.push({
      id: 'existing',
      name: 'User',
      email: 'user@example.test',
      role: 'admin',
      teamId: null,
      active: true,
      passwordHash: 'unchanged-hash',
      inviteHash: null,
      inviteExpires: null,
    });
    data.sessions.push({
      hash: 'existing-session-hash',
      userId: 'existing',
      expires: Date.now() + 3600000,
    });
    data.state.settings.business = 'Existing business';
  });
  const second = new SqliteRepository(directory);
  try {
    assert.ok(existsSync(join(directory, 'crm.before-nextjs.sqlite')));
    assert.equal(
      second.read((data) => data.users[0].passwordHash),
      'unchanged-hash',
    );
    assert.equal(
      second.read((data) => data.sessions[0].hash),
      'existing-session-hash',
    );
    assert.throws(() =>
      first.transaction((data) => {
        data.state.settings.business = 'Failed';
        throw Error('rollback');
      }),
    );
    assert.equal(
      second.read((data) => data.state.settings.business),
      'Existing business',
    );
    first.transaction((data) => {
      data.state.settings.business = 'First update';
    });
    second.transaction((data) => {
      data.state.settings.industry = 'Second update';
    });
    assert.equal(
      first.read((data) => data.state.settings.business),
      'First update',
    );
    assert.equal(
      first.read((data) => data.state.settings.industry),
      'Second update',
    );
  } finally {
    first.close();
    second.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
