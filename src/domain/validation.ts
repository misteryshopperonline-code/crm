import { reject } from './errors';
export const text = (value: unknown, max = 500): string =>
  typeof value === 'string' && value.trim().length <= max ? value.trim() : '';
export const email = (value: unknown): string => text(value, 254).toLowerCase();
export const isEmail = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export function validatePassword(value: unknown): asserts value is string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128)
    reject('validation', 'Usa una contraseña de entre 12 y 128 caracteres.');
}
