export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function request<T>(path: string, input?: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    cache: 'no-store',
    ...(input === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        }),
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(result.error || 'No se pudo completar la operación.', response.status);
  return result as T;
}
