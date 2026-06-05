import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Users, MessageSquare, Activity, ShieldAlert, Database } from 'lucide-react';

interface SuperAdminStats {
  totalUsers: number;
  totalProviders: number;
  totalPages: number;
  totalMessages: number;
  activeSessions: number;
}

export default function SuperAdminStatsPage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<SuperAdminStats>({
    totalUsers: 0,
    totalProviders: 0,
    totalPages: 0,
    totalMessages: 0,
    activeSessions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.is_super_admin) {
      loadGlobalStats();
    }
  }, [profile]);

  async function loadGlobalStats() {
    try {
      const [users, provs, pgs, sessions] = await Promise.all([
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('ai_providers').select('id', { count: 'exact', head: true }),
        supabase.from('page_connections').select('id', { count: 'exact', head: true }),
        supabase.from('chat_sessions').select('id, message_count'),
      ]);

      const totalMessages = (sessions.data ?? []).reduce((sum: number, s: any) => sum + (s.message_count || 0), 0);
      const activeSessions = (sessions.data ?? []).length;

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
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Global Statistics 🌍</h1>
          <p>Super Admin overview of the entire FBChatAuto platform.</p>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="card stat-card">
          <div className="stat-label">
            <Users size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            Total Tenants
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
