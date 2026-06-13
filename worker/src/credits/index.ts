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

/**
 * Refunds credits back to the user's extra_credits_balance.
 * Uses a safe fallback to direct database update if RPC is missing.
 */
export async function refundUserCredits(
  supabase: SupabaseClient,
  userId: string,
  amount: number
): Promise<void> {
  if (amount <= 0) return;
  try {
    const { error } = await supabase.rpc('refund_user_credits', {
      p_user_id: userId,
      p_amount: amount
    });
    
    if (error) {
      console.warn('[Credits] refund_user_credits RPC failed, attempting direct update:', error.message);
      // Fallback: direct update (safe since worker uses service_role admin client)
      const { data: user, error: getErr } = await supabase
        .from('users')
        .select('extra_credits_balance')
        .eq('id', userId)
        .single();
      
      if (!getErr && user) {
        const currentBalance = user.extra_credits_balance || 0;
        await supabase
          .from('users')
          .update({ extra_credits_balance: currentBalance + amount })
          .eq('id', userId);
      }
    }
  } catch (err) {
    console.error('[Credits] Exception in refundUserCredits:', err);
  }
}

