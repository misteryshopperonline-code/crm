import {randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt = promisify(scryptCallback);
export const roles = ['admin', 'supervisor', 'executive'];
export const roleNames = {admin:'Administrador', supervisor:'Supervisor', executive:'Ejecutivo'};
export const digest = value => createHash('sha256').update(value).digest('hex');
export const token = () => randomBytes(32).toString('hex');
export const publicUser = ({id,name,email,role,teamId,active,passwordHash}) => ({id,name,email,role,teamId,active:!!active,pending:!passwordHash});
export function passwordError(password) {
  return typeof password !== 'string' || password.length < 12 || password.length > 128
    ? 'Usa una contraseña de entre 12 y 128 caracteres.' : null;
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64);
  return `${salt}:${hash.toString('hex')}`;
}
export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 128) return false;
  const [salt, hex] = (stored || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  const hash = await scrypt(password, salt, 64);
  return timingSafeEqual(hash, Buffer.from(hex, 'hex')) && !!stored;
}
export function canSeeLead(actor, lead, users) {
  if (actor.role === 'admin') return true;
  if (actor.role === 'executive') return lead.ownerId === actor.id;
  const owner = users.find(u => u.id === lead.ownerId);
  return !!actor.teamId && owner?.teamId === actor.teamId;
}
export function canAssign(actor, target) {
  return !!target?.active && !!target.passwordHash && (actor.role === 'admin' ||
    (actor.role === 'supervisor' && !!actor.teamId && actor.teamId === target.teamId) ||
    (actor.role === 'executive' && actor.id === target.id));
}
export function initAuth(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','supervisor','executive')),
    teamId TEXT, active INTEGER NOT NULL DEFAULT 1, passwordHash TEXT,
    inviteHash TEXT, inviteExpires INTEGER
  );
  CREATE TABLE IF NOT EXISTS teams (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
  CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, userId TEXT NOT NULL, expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS auth_attempts (key TEXT PRIMARY KEY, count INTEGER NOT NULL, until INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS audit (id TEXT PRIMARY KEY, date TEXT NOT NULL, actorId TEXT NOT NULL, text TEXT NOT NULL);`);
  return {
    users: () => db.prepare('SELECT * FROM users ORDER BY name').all(),
    teams: () => db.prepare('SELECT * FROM teams ORDER BY name').all(),
    user: id => db.prepare('SELECT * FROM users WHERE id=?').get(id),
    audit(actorId,text) { db.prepare('INSERT INTO audit VALUES (?,?,?,?)').run(randomUUID(),new Date().toISOString(),actorId,text); },
    authenticate(cookie = '') {
      const value = cookie.split(';').map(s=>s.trim()).find(s=>s.startsWith('pulso_session='))?.slice(14);
      if (!value || !/^[a-f0-9]{64}$/.test(value)) return null;
      return db.prepare('SELECT u.* FROM users u JOIN sessions s ON s.userId=u.id WHERE s.hash=? AND s.expires>? AND u.active=1').get(digest(value),Date.now());
    },
    issueSession(userId,res) {
      const value=token();
      db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
      db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(value),userId,Date.now()+12*3600000);
      res.setHeader('Set-Cookie',`pulso_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200`);
    },
    invalidate(userId) { db.prepare('DELETE FROM sessions WHERE userId=?').run(userId); },
    clearCookie(res) { res.setHeader('Set-Cookie','pulso_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'); },
    limited(key) {
      const item=db.prepare('SELECT * FROM auth_attempts WHERE key=?').get(key);
      return item && item.until>Date.now() && item.count>=10;
    },
    attempt(key) {
      db.prepare('DELETE FROM auth_attempts WHERE until<=?').run(Date.now());
      db.prepare('INSERT INTO auth_attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(key,Date.now()+15*60000);
    },
    clearAttempts(key) { db.prepare('DELETE FROM auth_attempts WHERE key=?').run(key); }
  };
}
