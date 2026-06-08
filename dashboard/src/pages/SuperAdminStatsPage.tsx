import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Users, MessageSquare, Activity, ShieldAlert, Database, AlertTriangle } from 'lucide-react';

interface SuperAdminStats {
  totalUsers: number;
  totalProviders: number;
  totalPages: number;
  totalMessages: number;
  activeSessions: number;
}

export default function SuperAdminStatsPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<SuperAdminStats>({
    totalUsers: 0,
    totalProviders: 0,
    totalPages: 0,
    totalMessages: 0,
    activeSessions: 0,
  });
  const [pendingPurchases, setPendingPurchases] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.is_super_admin) {
      loadGlobalStats();
    }
  }, [profile]);

  async function loadGlobalStats() {
    try {
      const [users, provs, pgs, sessions, purchases] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('ai_providers').select('id', { count: 'exact', head: true }),
        supabase.from('page_connections').select('id', { count: 'exact', head: true }),
        supabase.from('chat_sessions').select('id, message_count'),
        supabase.from('purchases').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      const totalMessages = (sessions.data ?? []).reduce((sum: number, s: any) => sum + (s.message_count || 0), 0);
      const activeSessions = (sessions.data ?? []).length;

      setPendingPurchases(purchases.count ?? 0);

      setStats({
        totalUsers: users.count ?? 0,
        totalProviders: provs.count ?? 0,
        totalPages: pgs.count ?? 0,
        totalMessages,
        activeSessions,
      });
    } catch (err) {
      console.error('Failed to load global stats:', err);
    } finally {
      setLoading(false);
    }
  }

  if (profile && !profile.is_super_admin) {
    return (
      <div className="card" style={{padding:'48px',textAlign:'center',color:'var(--text-secondary)'}}>
        <ShieldAlert size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
        <h3>Access Denied</h3>
        <p>You must be a super admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="animate-slideUp">
      <style>{`
        @media (max-width: 600px) {
          .stats-grid-responsive {
            grid-template-columns: 1fr !important;
          }
          .warning-banner-flex {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .warning-banner-flex button {
            width: 100% !important;
          }
        }
      `}</style>
      <div className="page-header flex justify-between items-center" style={{ marginBottom: pendingPurchases > 0 ? '16px' : '32px' }}>
        <div>
          <h1>Global Statistics 🌍</h1>
          <p>Super Admin overview of the entire AutometaBot platform.</p>
        </div>
      </div>

      {pendingPurchases > 0 && (
        <div className="warning-banner-flex" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--error)', padding: '16px 24px', borderRadius: 'var(--radius-md)', marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <AlertTriangle style={{ color: 'var(--error)', flexShrink: 0 }} size={24} />
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, color: 'var(--error)', fontSize: '1rem', fontWeight: 'bold' }}>Action Required</h4>
            <p style={{ margin: '4px 0 0', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
              You have <strong>{pendingPurchases} pending purchase{pendingPurchases !== 1 ? 's' : ''}</strong> that require your approval.
            </p>
          </div>
          <button className="btn btn-danger" onClick={() => navigate('/super-purchases')}>Review Now</button>
        </div>
      )}

      <div className="stats-grid stats-grid-responsive" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="card stat-card">
          <div className="stat-label">
            <Users size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            Total Users
          </div>
          <div className="stat-value">{loading ? '—' : stats.totalUsers}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">
            <Database size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            AI Providers (Global & Specific)
          </div>
          <div className="stat-value">{loading ? '—' : stats.totalProviders}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">
            <Activity size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            Connected FB Pages
          </div>
          <div className="stat-value">{loading ? '—' : stats.totalPages}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">
            <MessageSquare size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            Total Messages Processed
          </div>
          <div className="stat-value">{loading ? '—' : stats.totalMessages}</div>
        </div>
      </div>
    </div>
  );
}
