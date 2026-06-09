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
    // 1. Fetch current credits
    const { data: user, error: userErr } = await supabase
      .from('users')
      .select('monthly_credits_limit, extra_credits_balance, credits_used_this_month, daily_credit_spend_cap, burn_rate_alert_sent_at')
      .eq('id', userId)
      .single();

    if (userErr || !user) {
      return { success: false, error: 'User profile not found.' };
    }

    const totalAllowed = (user.monthly_credits_limit ?? 1000) + (user.extra_credits_balance ?? 0);
    const currentUsed = user.credits_used_this_month ?? 0;

    // 2. Check if total monthly limit exceeded
    if (currentUsed + cost > totalAllowed) {
      return { success: false, error: 'Monthly credit limit exceeded.' };
    }

    // 3. Check daily spend cap
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { data: dailyLogs, error: logErr } = await supabase
      .from('comment_logs')
      .select('credits_deducted')
      .eq('user_id', userId)
      .gte('created_at', todayStart.toISOString());

    if (!logErr && dailyLogs) {
      const dailySpend = dailyLogs.reduce((acc, log) => acc + (log.credits_deducted ?? 0), 0);
      const dailyCap = user.daily_credit_spend_cap ?? 200;

      if (dailySpend + cost > dailyCap) {
        return { success: false, error: 'Daily credit spend limit cap reached.' };
      }
    }

    // 4. Update credit balance
    const nextUsed = currentUsed + cost;
    const updateData: any = { credits_used_this_month: nextUsed };

    // 5. Check 80% usage threshold alert
    if (nextUsed / totalAllowed >= 0.80 && !user.burn_rate_alert_sent_at) {
      updateData.burn_rate_alert_sent_at = new Date().toISOString();
      console.log(`[Credits] Alert: User ${userId} has consumed 80%+ of monthly credits.`);
      // Trigger notification service if available
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId);

    if (updateErr) {
      return { success: false, error: 'Failed to update credit balances.' };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
