// ============================================================================
// JWT Authentication Middleware for Hono
// ============================================================================
// Validates Supabase JWT tokens on protected API routes.
// Webhook routes are NOT protected by this — they use Facebook's
// own signature-based verification (X-Hub-Signature-256).
//
// The middleware extracts the Bearer token from the Authorization header,
// verifies it against Supabase Auth, and attaches the authenticated user
// info to the Hono context for downstream handlers.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type { Context, Next } from 'hono';
import type { AppEnv } from '../types';

/**
 * Hono middleware that verifies Supabase JWT tokens.
 * 
 * Usage:
 *   app.use('/api/*', requireAuth);
 *   app.use('/test-chat', requireAuth);
 * 
 * After this middleware, the authenticated user is available via:
 *   const authUser = c.get('authUser');
 */
export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json(
      { error: 'Missing or invalid Authorization header. Expected: Bearer <token>' },
      401
    );
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    // Create a lightweight Supabase client to verify the token.
    // We use the service key to create the client, but auth.getUser(token)
    // validates the user's JWT — it does NOT grant service-role access.
    const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      console.warn('[Auth] JWT verification failed:', error?.message || 'No user found');
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    // Attach the authenticated user to the context
    c.set('authUser', {
      id: data.user.id,
      email: data.user.email,
    });

    await next();
  } catch (err: any) {
    console.error('[Auth] Unexpected error during JWT verification:', err.message);
    return c.json({ error: 'Authentication failed' }, 401);
  }
}
