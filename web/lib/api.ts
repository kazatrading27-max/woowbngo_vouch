'use client';

import { getApiUrl, getToken, clearSession } from './auth-helpers';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const base = getApiUrl();
  const token = getToken();
  const res = await fetch(`${base}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    clearSession();
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!res.ok) {
    throw new ApiError(res.status, body?.message || `Request failed (${res.status})`);
  }
  return body as T;
}

export const get = <T>(path: string) => api<T>(path);
export const post = <T>(path: string, data?: unknown) =>
  api<T>(path, { method: 'POST', body: data !== undefined ? JSON.stringify(data) : undefined });
export const patch = <T>(path: string, data?: unknown) =>
  api<T>(path, { method: 'PATCH', body: data !== undefined ? JSON.stringify(data) : undefined });
export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });
