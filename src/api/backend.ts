/**
 * SouqView – backend API client (proxies to your server).
 * Twelve Data, AI (Groq/DeepSeek) are called from the backend; this client
 * hits EXPO_PUBLIC_API_URL.
 * When signal/symbol are provided, uses resilient apiClient (retry, abort).
 */

import axios from 'axios';
import { apiGet } from './apiClient';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

/** 25s: stock-detail + profile + historical can be slow when backend or Twelve Data is under load. */
const BACKEND_TIMEOUT_MS = 25000;

/** On web, omit credentials so CORS doesn't require Allow-Credentials + exact origin. */
const isWeb = typeof window !== 'undefined';

export const backend = axios.create({
  baseURL: BASE_URL,
  timeout: BACKEND_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: !isWeb,
});

export type GetOptions = { signal?: AbortSignal; symbol?: string };

export async function get<T = unknown>(
  path: string,
  params?: object,
  options?: GetOptions
): Promise<T> {
  if (options?.signal !== undefined || options?.symbol !== undefined) {
    const paramsRecord: Record<string, string | number | undefined> = {};
    if (params && typeof params === 'object') {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== '') paramsRecord[k] = v as string | number | undefined;
      });
    }
    return apiGet<T>(path, paramsRecord, {
      signal: options.signal,
      symbol: options.symbol,
    });
  }
  const { data } = await backend.get(path, { params });
  return data as T;
}

export async function post<T = unknown>(path: string, body?: object): Promise<T> {
  const { data } = await backend.post(path, body);
  return data as T;
}
