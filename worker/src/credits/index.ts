// ============================================================================
// Credits Management System — Caps, Allocations & Spend Protections
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';

export async function verifyAndDeductCredits(
  supabase: SupabaseClient,
  userId: string,
  cost: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('verify_and_deduct_user_credits', {
      p_user_id: userId,
      p_cost: cost
    });

    if (error) {
      console.error('[Credits] RPC Error:', error);
      return { success: false, error: error.message };
    }

    if (!data || !data.success) {
      return { success: false, error: data?.error || 'Failed to deduct credits.' };
    }

    return { success: true };
  } catch (err: any) {
    console.error('[Credits] Exception in verifyAndDeductCredits:', err);
    return { success: false, error: err.message };
  }
}

