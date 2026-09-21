/// <reference types="vite/client" />

// API & WebSocket URL resolution supporting standalone deployment or decoupled frontend/backend

export const BACKEND_URL = ((import.meta as unknown as { env?: Record<string, string> }).env?.VITE_BACKEND_URL || '').replace(/\/$/, '');

export function apiUrl(endpoint: string): string {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${BACKEND_URL}${cleanEndpoint}`;
}

export function getWebSocketUrl(): string {
  if (BACKEND_URL) {
    const wsProto = BACKEND_URL.startsWith('https') ? 'wss:' : 'ws:';
    const host = BACKEND_URL.replace(/^https?:\/\//, '');
    return `${wsProto}//${host}`;
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}`;
}

export const TOKEN_STORAGE_KEY = 'khedira_auth_token';

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem('khedira_token');
  } catch {
    return null;
  }
}

export function setAuthToken(token: string) {
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    sessionStorage.setItem('khedira_token', token);
    // Remove any legacy key from localStorage to prevent cross-user bleed
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem('khedira_league_user_id');
  } catch (err) {
    console.error('Error saving auth token:', err);
  }
}

export function clearAuthToken() {
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem('khedira_token');
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem('khedira_league_user_id');
  } catch (err) {
    console.error('Error clearing auth token:', err);
  }
}

export async function secureFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(apiUrl(endpoint), {
    ...options,
    credentials: 'include', // sends HttpOnly cookies automatically
    headers
  });
}
