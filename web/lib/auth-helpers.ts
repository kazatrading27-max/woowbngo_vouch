export function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL || '';
  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'NEXT_PUBLIC_API_URL is not configured in this build. Set it before building (e.g. https://your-api.vercel.app).',
      );
    }
    if (typeof window !== 'undefined') {
      return `${window.location.protocol}//${window.location.hostname}:3001`;
    }
  }
  return url;
}

const TOKEN_KEY = 'wb_token';
const USER_KEY = 'wb_user';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getUserJson(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(USER_KEY);
}

export function saveSession(token: string, user: unknown) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function parseUser<T>(): T | null {
  const raw = getUserJson();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
