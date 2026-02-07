/**
 * SouqView – backend API client (proxies to your server).
 * Twelve Data, AI (Groq/DeepSeek) are called from the backend; this client
 * hits EXPO_PUBLIC_API_URL.
 */

import axios from 'axios';

const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

/** 25s: stock-detail + profile + historical can be slow when backend or Twelve Data is under load. */
const BACKEND_TIMEOUT_MS = 25000;

export const backend = axios.create({
  baseURL: BASE_URL,
  timeout: BACKEND_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

export async function get<T = unknown>(path: string, params?: object): Promise<T> {
  const { data } = await backend.get(path, { params });
  return data as T;
}

export async function post<T = unknown>(path: string, body?: object): Promise<T> {
  const { data } = await backend.post(path, body);
  return data as T;
}
