/**
 * SouqView – API client with sanitized URL logging for debugging.
 * Watchlist and stock data use EXPO_PUBLIC_API_URL (backend). Twelve Data is used on the backend.
 */

import axios from 'axios';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  'http://localhost:5000/api';

/** Build full URL for a path (no query yet) – for logging only, never log query params with secrets. */
export function getSanitizedUrl(path: string, params?: Record<string, string | number | undefined>): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const base = BASE_URL.replace(/\/+$/, '');
  const pathPart = cleanPath.replace(/^\/+/, '');
  let url = `${base}/${pathPart}`;
  if (params && Object.keys(params).length > 0) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') search.set(k, String(v));
    });
    const qs = search.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  const url = getSanitizedUrl(
    config.url || '',
    config.params as Record<string, string | number | undefined> | undefined
  );
  if (__DEV__) {
    console.log('[SouqView API]', config.method?.toUpperCase(), url);
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const fullUrl = error.config
      ? getSanitizedUrl(
          error.config.url || '',
          error.config.params as Record<string, string | number | undefined> | undefined
        )
      : BASE_URL;
    if (__DEV__) {
      console.log('[SouqView API] Failed request URL:', fullUrl);
    }
    return Promise.reject(error);
  }
);

export { client };
export default client;
