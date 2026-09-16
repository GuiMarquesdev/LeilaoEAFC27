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
