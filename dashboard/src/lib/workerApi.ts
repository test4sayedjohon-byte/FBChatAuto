// ============================================================================
// Authenticated Worker API Client
// ============================================================================
// Provides a helper to call the Cloudflare Worker API with the current
// Supabase session's JWT attached as a Bearer token.
// ============================================================================

import { supabase } from './supabase';

export const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://metachat.junoverseai.com';

/**
 * Makes an authenticated POST request to the Worker API.
 * Automatically attaches the current user's Supabase JWT as a Bearer token.
 *
 * @throws Error if not authenticated or if the request fails
 */
export async function workerPost<T = any>(
  path: string,
  body: Record<string, any>
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in again.');
  }

  const response = await fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Makes an authenticated GET request to the Worker API.
 * Automatically attaches the current user's Supabase JWT as a Bearer token.
 *
 * @throws Error if not authenticated or if the request fails
 */
export async function workerGet<T = any>(
  path: string
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in again.');
  }

  const response = await fetch(`${WORKER_URL}${path}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Makes an authenticated PUT request to the Worker API.
 */
export async function workerPut<T = any>(
  path: string,
  body: Record<string, any>
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in again.');
  }

  const response = await fetch(`${WORKER_URL}${path}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Makes an authenticated DELETE request to the Worker API.
 */
export async function workerDelete<T = any>(
  path: string
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in again.');
  }

  const response = await fetch(`${WORKER_URL}${path}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

