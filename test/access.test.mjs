import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { once } from 'node:events';
import { createServer } from 'node:net';

// An isolated real HTTP server and SQLite database; no production data or account is touched.
test('authentication, isolation and user lifecycle over HTTP', { timeout: 60000 }, async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'pulso-test-'));
  const db = new DatabaseSync(join(dir, 'crm.sqlite'));
  const legacy = {
    id: 'legacy',
    name: 'Legacy',
    owner: 'Anterior',
    email: 'legacy@example.test',
    phone: '',
    stage: 'Nuevo',
    channel: 'Correo',
    action: 'Contactar',
    due: new Date(Date.now() + 86400000).toISOString(),
    attempts: 0,
  };
  db.exec('CREATE TABLE state(id INTEGER PRIMARY KEY,json TEXT NOT NULL)');
  db.prepare('INSERT INTO state VALUES (1,?)').run(
    JSON.stringify({
      leads: [legacy],
      history: [],
      templates: [],
      settings: { business: 'Test', industry: 'Test', sla: 24, required: [] },
      rules: [
        { id: 'first', enabled: true },
        { id: 'overdue', enabled: true },
      ],
      integrations: [],
    }),
  );
  db.close();
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(port)],
    {
      env: { ...process.env, DATA_DIR: dir, PORT: String(port), NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  t.after(async () => {
    child.kill();
    if (child.exitCode === null && child.signalCode === null) await once(child, 'exit');
    rmSync(dir, { recursive: true, force: true });
  });
  const origin = await new Promise((resolve, reject) => {
    let out = '',
      errors = '';
    child.stderr.on('data', (d) => {
      errors += d;
    });
    child.stdout.on('data', (d) => {
      out += d;
      if (out.includes('Ready in')) resolve('http://127.0.0.1:' + port);
    });
    child.once('exit', () => reject(Error('Test server exited before listening: ' + errors)));
    child.once('error', reject);
  });
  async function call(path, body, cookie = '', extra = {}) {
    const r = await fetch(origin + '/api/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: origin,
        ...(cookie ? { Cookie: cookie } : {}),
        ...extra,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: r.status,
      body: await r.json(),
      cookie: r.headers.get('set-cookie')?.split(';')[0],
      headers: r.headers,
    };
  }
  const password = 'a-test-only-long-passphrase';
  let admin, teamA, teamB, execA, execB, supervisor, leadId;
  async function invite(name, role, teamId) {
    const invited = await call(
      'users',
      { name, email: name + '@example.test', role, teamId, active: true },
      admin.cookie,
    );
    assert.equal(invited.status, 200, JSON.stringify(invited.body));
    const activation = await call('auth/activate', { token: invited.body.inviteToken, password });
    assert.equal(activation.status, 200, JSON.stringify(activation.body));
    return {
      ...activation,
      user: activation.body.currentUser,
      inviteToken: invited.body.inviteToken,
    };
  }
  await t.test('anonymous access, origin and setup gate', async () => {
    assert.equal((await call('state')).status, 401);
    assert.equal((await call('auth/status')).body.needsSetup, true);
    assert.equal(
      (
        await call('auth/setup', { name: 'Admin', email: 'admin@example.test', password }, '', {
          Origin: 'https://other.test',
        })
      ).status,
      403,
    );
    assert.equal(
      (await call('auth/setup', { name: 'Admin', email: 'admin@example.test', password: 'short' }))
        .status,
      422,
    );
    admin = await call('auth/setup', { name: 'Admin', email: 'admin@example.test', password });
    assert.equal(admin.status, 200);
    assert.match(admin.headers.get('set-cookie'), /HttpOnly/);
    assert.match(admin.headers.get('set-cookie'), /SameSite=Strict/i);
    teamA = admin.body.teams[0].id;
    assert.equal(
      (await call('auth/setup', { name: 'Other', email: 'other@example.test', password })).status,
      409,
    );
    assert.equal(admin.body.leads[0].ownerId, admin.body.currentUser.id);
    assert.equal(admin.body.leads[0].legacyOwner, 'Anterior');
    assert.ok(existsSync(join(dir, 'crm.before-auth.sqlite')));
    assert.equal(
      (await call('auth/login', { email: 'admin@example.test', password: 'wrong' })).status,
      401,
    );
  });
  await t.test('teams, invitations, single-use activation and secret redaction', async () => {
    const result = await call('teams', { name: 'Team B' }, admin.cookie);
    assert.equal(result.status, 200);
    teamB = result.body.teams.find((t) => t.name === 'Team B').id;
    assert.equal((await call('teams', { name: 'Team B' }, admin.cookie)).status, 409);
    execA = await invite('execA', 'executive', teamA);
    execB = await invite('execB', 'executive', teamB);
    supervisor = await invite('supervisor', 'supervisor', teamA);
    assert.equal((await call('auth/activate', { token: execA.inviteToken, password })).status, 422);
    const fresh = await call('state', undefined, admin.cookie);
    assert.equal(fresh.body.users.length, 4);
    assert.ok(!/passwordHash|inviteHash|inviteToken|sessions/.test(JSON.stringify(fresh.body)));
    assert.equal(
      (
        await call(
          'users',
          {
            name: 'invalid',
            email: 'invalid@example.test',
            role: 'superuser',
            active: true,
            teamId: teamA,
          },
          admin.cookie,
        )
      ).status,
      422,
    );
  });
  await t.test('server checks role permissions even when called outside the UI', async () => {
    for (const user of [execA, supervisor])
      for (const path of ['users', 'teams', 'settings', 'rules', 'integrations'])
        assert.equal((await call(path, {}, user.cookie)).status, 403, path);
    assert.equal(
      (await call('templates', { name: 'X', subject: 'Y', body: 'Z' }, execA.cookie)).status,
      403,
    );
    assert.equal(
      (await call('templates', { name: 'X', subject: 'Y', body: 'Z' }, supervisor.cookie)).status,
      200,
    );
  });
  await t.test('leads and histories are isolated by user and team', async () => {
    const payload = {
      name: 'Lead A',
      email: 'lead-a@example.test',
      phone: '',
      stage: 'Nuevo',
      channel: 'Correo',
      action: 'Contactar',
      due: new Date(Date.now() + 3600000).toISOString(),
    };
    assert.equal(
      (await call('leads', { ...payload, ownerId: execB.user.id }, execA.cookie)).status,
      403,
    );
    const created = await call('leads', { ...payload, ownerId: execA.user.id }, execA.cookie);
    assert.equal(created.status, 200);
    leadId = created.body.leads[0].id;
    assert.equal((await call('state', undefined, execB.cookie)).body.leads.length, 0);
    const supervised = await call('state', undefined, supervisor.cookie);
    assert.ok(supervised.body.leads.some((l) => l.id === leadId));
    assert.ok(!supervised.body.users.some((u) => u.id === execB.user.id));
    assert.equal(
      (await call('leads', { ...payload, id: leadId, result: 'Guessing ID' }, execB.cookie)).status,
      404,
    );
    assert.equal(
      (
        await call(
          'leads/reassign',
          { id: leadId, ownerId: execB.user.id, reason: 'Cross team' },
          supervisor.cookie,
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          'leads/reassign',
          { id: leadId, ownerId: supervisor.user.id, reason: 'Escalate' },
          execA.cookie,
        )
      ).status,
      403,
    );
    const updated = await call(
      'leads',
      {
        ...payload,
        id: leadId,
        ownerId: execA.user.id,
        outcome: 'Sin respuesta',
        result: 'Managed by supervisor',
      },
      supervisor.cookie,
    );
    assert.equal(updated.status, 200);
    assert.equal(updated.body.history[0].actorId, supervisor.user.id);
    assert.equal((await call('state', undefined, execB.cookie)).body.history.length, 0);
  });
  await t.test('reassignment preserves activity and blocks stranding records', async () => {
    const edit = { ...execA.user, active: false };
    assert.equal((await call('users', edit, admin.cookie)).status, 422);
    assert.equal(
      (await call('users', { ...execA.user, teamId: teamB, active: true }, admin.cookie)).status,
      422,
    );
    const reassign = await call(
      'leads/reassign',
      { id: leadId, ownerId: execB.user.id, reason: 'Transferencia de equipo' },
      admin.cookie,
    );
    assert.equal(reassign.status, 200);
    assert.equal(reassign.body.leads.find((l) => l.id === leadId).attempts, 1);
    assert.equal((await call('state', undefined, execA.cookie)).body.leads.length, 0);
    assert.ok(
      !(await call('state', undefined, supervisor.cookie)).body.leads.some((l) => l.id === leadId),
    );
    assert.equal((await call('state', undefined, execB.cookie)).body.leads[0].id, leadId);
    assert.equal((await call('users', edit, admin.cookie)).status, 200);
    assert.equal((await call('state', undefined, execA.cookie)).status, 401);
    assert.equal((await call('auth/login', { email: execA.user.email, password })).status, 401);
  });
  await t.test(
    'role changes revoke sessions and cannot remove own administrator access',
    async () => {
      assert.equal(
        (
          await call(
            'users',
            { ...admin.body.currentUser, role: 'executive', active: true },
            admin.cookie,
          )
        ).status,
        422,
      );
      assert.equal(
        (await call('users', { ...supervisor.user, role: 'executive', active: true }, admin.cookie))
          .status,
        200,
      );
      assert.equal((await call('state', undefined, supervisor.cookie)).status, 401);
      const login = await call('auth/login', { email: supervisor.user.email, password });
      assert.equal(login.status, 200);
      assert.equal(login.body.currentUser.role, 'executive');
      assert.equal(
        (await call('templates', { name: 'X', subject: 'Y', body: 'Z' }, login.cookie)).status,
        403,
      );
    },
  );
  await t.test('password rotation and logout invalidate old sessions', async () => {
    const next = 'another-test-only-passphrase';
    assert.equal(
      (await call('auth/password', { currentPassword: 'wrong', password: next }, execB.cookie))
        .status,
      422,
    );
    const changed = await call(
      'auth/password',
      { currentPassword: password, password: next },
      execB.cookie,
    );
    assert.equal(changed.status, 200);
    assert.equal((await call('state', undefined, execB.cookie)).status, 401);
    assert.equal((await call('auth/login', { email: execB.user.email, password })).status, 401);
    assert.equal((await call('state', undefined, changed.cookie)).status, 200);
    assert.equal((await call('auth/logout', {}, changed.cookie)).status, 200);
    assert.equal((await call('state', undefined, changed.cookie)).status, 401);
  });
  await t.test('renewed/expired invites, expired sessions and rate limiting', async () => {
    const pending = await call(
      'users',
      {
        name: 'Pending',
        email: 'pending@example.test',
        role: 'executive',
        teamId: teamA,
        active: true,
      },
      admin.cookie,
    );
    const user = pending.body.users.find((u) => u.name === 'Pending');
    assert.equal(
      (await call('users', { ...user, email: 'pending-updated@example.test' }, admin.cookie))
        .status,
      200,
    );
    assert.equal(
      (await call('auth/activate', { token: pending.body.inviteToken, password })).status,
      422,
    );
    const renewed = await call('users/invite', { id: user.id }, admin.cookie);
    assert.equal(renewed.status, 200);
    assert.equal(
      (await call('auth/activate', { token: pending.body.inviteToken, password })).status,
      422,
    );
    const inspect = new DatabaseSync(join(dir, 'crm.sqlite'));
    inspect.prepare('UPDATE users SET inviteExpires=0 WHERE id=?').run(user.id);
    assert.equal(
      (await call('auth/activate', { token: renewed.body.inviteToken, password })).status,
      422,
    );
    inspect.exec('UPDATE sessions SET expires=0');
    assert.equal((await call('state', undefined, admin.cookie)).status, 401);
    const stored = inspect
      .prepare('SELECT passwordHash FROM users WHERE email=?')
      .get('admin@example.test');
    assert.ok(!stored.passwordHash.includes(password));
    inspect.close();
    let result;
    for (let i = 0; i < 11; i++) {
      result = await call('auth/login', { email: 'nobody@example.test', password: 'wrong' });
      // A successful login to another account must not reset the target account's limit.
      assert.equal(
        (await call('auth/login', { email: 'admin@example.test', password })).status,
        200,
      );
    }
    assert.equal(result.status, 429);
  });
});
