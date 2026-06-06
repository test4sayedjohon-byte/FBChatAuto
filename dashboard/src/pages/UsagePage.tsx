import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

export default function UsagePage() {
  const { user, profile } = useAuth();
  const [totalMonthTokens, setTotalMonthTokens] = useState(0);

  const fetchThisMonthStrict = async () => {
    if (!user) return;
    try {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data } = await supabase.from('chat_messages')
        .select('token_count')
        .eq('user_id', user.id)
        .gte('created_at', start.toISOString());
        
      const tokens = (data || []).reduce((acc, row) => acc + (row.token_count || 0), 0);
      setTotalMonthTokens(tokens);
    } catch (err) {
      console.error('Failed to fetch strict month usage:', err);
    }
  };

  useEffect(() => {
    fetchThisMonthStrict();
  }, [user]);

  const monthlyLimit = profile?.monthly_token_limit ?? 500000;
  const isEnforced = profile?.strict_token_enforcement ?? true;
  const usagePercentage = Math.min(100, (totalMonthTokens / monthlyLimit) * 100);

  return (
    <div className="page-container animate-fadeIn">
      <header className="page-header">
        <h1>AI Usage & Limits</h1>
        <p>Monitor your token consumption and account limits.</p>
      </header>

      {/* Quota Progress */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', padding: '24px', borderRadius: '12px', marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
          <ShieldCheck size={18} style={{ color: 'var(--accent-primary)' }} /> Monthly Usage & Quota
        </h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Tokens Used This Month</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>
            {totalMonthTokens.toLocaleString()} / {monthlyLimit.toLocaleString()}
          </span>
        </div>
        
        <div style={{ height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
          <div style={{ 
            height: '100%', 
            width: `${usagePercentage}%`,
            background: totalMonthTokens >= monthlyLimit ? 'var(--error)' : (usagePercentage >= 80 ? '#f59e0b' : 'var(--accent-primary)'),
            transition: 'width 0.3s ease'
          }} />
        </div>

        {totalMonthTokens >= monthlyLimit && isEnforced && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#fca5a5', fontSize: '0.9rem' }}>
            <AlertTriangle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <strong>Limit Reached!</strong> Your account has reached its monthly AI token limit. New messages will be rejected until the start of the next month or until your limit is increased. Please contact support.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
