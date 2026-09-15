import { randomBytes, scrypt as callback, timingSafeEqual, createHash } from 'node:crypto';
import type { Security } from '../application/ports';
const scrypt = (password: string, salt: string, size: number): Promise<Buffer> =>
  new Promise((resolve, reject) =>
    callback(password, salt, size, (error, key) => (error ? reject(error) : resolve(key))),
  );
export const nodeSecurity: Security = {
  token: () => randomBytes(32).toString('hex'),
  digest: (value) => createHash('sha256').update(value).digest('hex'),
  async hashPassword(password) {
    const salt = randomBytes(16).toString('hex');
    const hash = await scrypt(password, salt, 64);
    return `${salt}:${hash.toString('hex')}`;
  },
  async verifyPassword(password, stored) {
    if (typeof password !== 'string' || password.length > 128) return false;
    const [salt, hex] = (stored || `${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
    if (!/^[a-f0-9]{32}$/.test(salt) || !/^[a-f0-9]{128}$/.test(hex)) return false;
    const hash = await scrypt(password, salt, 64);
    return timingSafeEqual(hash, Buffer.from(hex, 'hex')) && !!stored;
  },
};
