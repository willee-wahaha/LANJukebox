const API_BASE = '/api';

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `API 錯誤 (${response.status})`;
    try {
      const body = await response.json() as { error?: string; message?: string };
      message = body.error ?? body.message ?? message;
    } catch {
      // Response may not be JSON.
    }
    throw new Error(message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const jsonBody = (value: unknown): string => JSON.stringify(value);
