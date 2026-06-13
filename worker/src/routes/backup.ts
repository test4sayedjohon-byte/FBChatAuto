import { Hono } from 'hono';
import type { AppEnv } from '../types';
import { createSupabaseAdmin } from '../supabase';

const backup = new Hono<AppEnv>();

// ─── Password Verification ──────────────────────────────────────────────────
backup.post('/verify-password', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser || !authUser.id) return c.json({ error: 'Unauthorized' }, 401);

    const { password } = await c.req.json();
    if (!password) return c.json({ error: 'Password is required' }, 400);

    const supabase = createSupabaseAdmin(c.env);

    // 1. Verify calling user is super admin
    const { data: profile } = await supabase.from('users').select('role').eq('id', authUser.id).single();
    if (!profile || profile.role !== 'super_admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (!authUser.email) return c.json({ error: 'Admin email not found in session' }, 400);

    // 2. Authenticate password with Supabase Auth
    const { error } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password,
    });

    if (error) {
      return c.json({ error: 'Invalid password' }, 401);
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Export Table Chunk ──────────────────────────────────────────────────────
backup.post('/export-table', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser || !authUser.id) return c.json({ error: 'Unauthorized' }, 401);

    const { password, tableName, offset = 0, limit = 500 } = await c.req.json();
    if (!password || !tableName) return c.json({ error: 'Missing password or tableName' }, 400);

    const supabase = createSupabaseAdmin(c.env);

    // 1. Verify super admin role
    const { data: profile } = await supabase.from('users').select('role').eq('id', authUser.id).single();
    if (!profile || profile.role !== 'super_admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (!authUser.email) return c.json({ error: 'Admin email not found in session' }, 400);

    // 2. Authenticate password
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password,
    });
    if (authErr) return c.json({ error: 'Invalid password' }, 401);

    // 3. Fetch table slice
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(offset, offset + limit - 1);

    if (error) {
      return c.json({ error: `Error fetching table ${tableName}: ${error.message}` }, 500);
    }

    return c.json({ success: true, data });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Restore Batch of Rows ──────────────────────────────────────────────────
backup.post('/restore-batch', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser || !authUser.id) return c.json({ error: 'Unauthorized' }, 401);

    const { password, tableName, rows } = await c.req.json();
    if (!password || !tableName || !rows || !Array.isArray(rows)) {
      return c.json({ error: 'Missing parameters' }, 400);
    }

    const supabase = createSupabaseAdmin(c.env);

    // 1. Verify super admin role
    const { data: profile } = await supabase.from('users').select('role').eq('id', authUser.id).single();
    if (!profile || profile.role !== 'super_admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (!authUser.email) return c.json({ error: 'Admin email not found in session' }, 400);

    // 2. Authenticate password
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password,
    });
    if (authErr) return c.json({ error: 'Invalid password' }, 401);

    if (rows.length === 0) {
      return c.json({ success: true, count: 0 });
    }

    // 3. Special handling for auth recreation in users table
    let rowsToInsert = rows;
    if (tableName === 'users') {
      rowsToInsert = rows.map(r => ({
        ...r,
        assigned_chat_provider_id: null,
        assigned_fallback_chat_provider_id: null,
        assigned_embedding_provider_id: null,
        assigned_summarization_provider_id: null,
        assigned_agent_provider_id: null,
        assigned_vision_provider_id: null,
        assigned_image_provider_id: null,
        assigned_fallback_image_provider_id: null,
        assigned_content_provider_id: null,
        assigned_fallback_content_provider_id: null
      }));

      for (const userRow of rows) {
        if (!userRow.id || !userRow.email) continue;
        try {
          const { data: existingUser } = await supabase.auth.admin.getUserById(userRow.id);
          if (!existingUser || !existingUser.user) {
            const { error: createErr } = await supabase.auth.admin.createUser({
              id: userRow.id,
              email: userRow.email,
              email_confirm: true,
              password: crypto.randomUUID(), // User will use password recovery to reset it
              user_metadata: { display_name: userRow.display_name || '' }
            });
            if (createErr) {
              console.warn(`[Restore Users Auth] Warning for user ${userRow.email}:`, createErr.message);
            }
          }
        } catch (authChkErr: any) {
          console.warn(`[Restore Users Auth] Skip user checks for ${userRow.email}: ${authChkErr.message}`);
        }
      }
    }

    // 4. Batch upsert into public table
    const { error: upsertErr } = await supabase.from(tableName).upsert(rowsToInsert);
    if (upsertErr) {
      return c.json({ error: `Restore error in table ${tableName}: ${upsertErr.message}` }, 500);
    }

    return c.json({ success: true, count: rows.length });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// ─── Restore Finalize (Updates circular user -> provider references) ─────────
backup.post('/restore-finalize', async (c) => {
  try {
    const authUser = c.get('authUser');
    if (!authUser || !authUser.id) return c.json({ error: 'Unauthorized' }, 401);

    const { password, rows } = await c.req.json();
    if (!password || !rows || !Array.isArray(rows)) {
      return c.json({ error: 'Missing parameters' }, 400);
    }

    const supabase = createSupabaseAdmin(c.env);

    // 1. Verify super admin role
    const { data: profile } = await supabase.from('users').select('role').eq('id', authUser.id).single();
    if (!profile || profile.role !== 'super_admin') {
      return c.json({ error: 'Forbidden' }, 403);
    }

    if (!authUser.email) return c.json({ error: 'Admin email not found in session' }, 400);

    // 2. Authenticate password
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: authUser.email,
      password,
    });
    if (authErr) return c.json({ error: 'Invalid password' }, 401);

    // 3. Perform the updates to set circular references
    for (const userRow of rows) {
      if (!userRow.id) continue;
      const updatePayload = {
        assigned_chat_provider_id: userRow.assigned_chat_provider_id || null,
        assigned_fallback_chat_provider_id: userRow.assigned_fallback_chat_provider_id || null,
        assigned_embedding_provider_id: userRow.assigned_embedding_provider_id || null,
        assigned_summarization_provider_id: userRow.assigned_summarization_provider_id || null,
        assigned_agent_provider_id: userRow.assigned_agent_provider_id || null,
        assigned_vision_provider_id: userRow.assigned_vision_provider_id || null,
        assigned_image_provider_id: userRow.assigned_image_provider_id || null,
        assigned_fallback_image_provider_id: userRow.assigned_fallback_image_provider_id || null,
        assigned_content_provider_id: userRow.assigned_content_provider_id || null,
        assigned_fallback_content_provider_id: userRow.assigned_fallback_content_provider_id || null,
      };

      const { error } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', userRow.id);

      if (error) {
        console.error(`[Restore Finalize] Error updating user ${userRow.id}:`, error.message);
      }
    }

    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default backup;
