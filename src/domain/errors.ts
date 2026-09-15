export type ErrorCode =
  'validation' | 'unauthenticated' | 'forbidden' | 'not_found' | 'conflict' | 'rate_limited';
export class ApplicationError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}
export function reject(code: ErrorCode, message: string): never {
  throw new ApplicationError(code, message);
}
