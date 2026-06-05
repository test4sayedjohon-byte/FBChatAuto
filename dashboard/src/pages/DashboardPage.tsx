import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { MessageSquare, BookOpen, Cpu, Globe, Power } from 'lucide-react';

interface Stats {
  knowledgeFields: number;
  documents: number;
  providers: number;
  pages: number;
  totalMessages: number;
  activeSessions: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats>({
    knowledgeFields: 0,
    documents: 0,
    providers: 0,
    pages: 0,
    totalMessages: 0,
    activeSessions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isServiceActive, setIsServiceActive] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const [kf, docs, provs, pgs, sessions, userSettings] = await Promise.all([
        supabase.from('knowledge_fields').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('documents').select('id', { count: 'exact', head: true }),
        supabase.from('ai_providers').select('id', { count: 'exact', head: true }),
        supabase.from('page_connections').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('chat_sessions').select('id, message_count', { count: 'exact' }).eq('status', 'active'),
        supabase.from('users').select('settings').eq('id', user?.id).single(),
      ]);

      const totalMessages = (sessions.data ?? []).reduce((sum: number, s: any) => sum + (s.message_count || 0), 0);
      
      if (userSettings.data?.settings) {
        setIsServiceActive(userSettings.data.settings.is_bot_active !== false);
      }

      setStats({
        knowledgeFields: kf.count ?? 0,
        documents: docs.count ?? 0,
        providers: provs.count ?? 0,
        pages: pgs.count ?? 0,
        totalMessages,
        activeSessions: sessions.count ?? 0,
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

  const toggleService = async () => {
    if (!user) return;
    setToggleLoading(true);
    const newValue = !isServiceActive;
    
    // Fetch current settings first to merge them
    const { data } = await supabase.from('users').select('settings').eq('id', user.id).single();
    const currentSettings = data?.settings || {};
    
    const { error } = await supabase
      .from('users')
      .update({ settings: { ...currentSettings, is_bot_active: newValue } })
      .eq('id', user.id);
      
    if (!error) {
      setIsServiceActive(newValue);
    }
    setToggleLoading(false);
  };

  return (
    <div className="animate-slideUp">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Welcome back, {firstName} 👋</h1>
          <p>Here's an overview of your chatbot automation platform.</p>
        </div>
        <button
          onClick={toggleService}
          disabled={toggleLoading}
          className={`btn ${
            isServiceActive 
              ? 'btn-secondary' // we can style it green inline or just rely on secondary 
              : 'btn-danger'
          }`}
          style={{ 
            borderColor: isServiceActive ? 'var(--success)' : undefined,
            color: isServiceActive ? 'var(--success)' : undefined,
            background: isServiceActive ? 'rgba(34, 197, 94, 0.1)' : undefined
          }}
        >
          <Power size={18} />
          {isServiceActive ? 'Service Active' : 'Service Paused'}
        </button>
      </div>

      <div className="stats-grid">
        <div className="card stat-card">
          <div className="stat-label">
            <BookOpen size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            Knowledge Fields
          </div>
          <div className="stat-value">{loading ? '—' : stats.knowledgeFields}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">
            <Cpu size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            AI Providers
          </div>
          <div className="stat-value">{loading ? '—' : stats.providers}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">
            <Globe size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            Connected Pages
          </div>
          <div className="stat-value">{loading ? '—' : stats.pages}</div>
        </div>

        <div className="card stat-card">
          <div className="stat-label">
            <MessageSquare size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
            Active Sessions
          </div>
          <div className="stat-value">{loading ? '—' : stats.activeSessions}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>🚀 Quick Setup Guide</h3>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.8' }}>
            <p><strong>Step 1:</strong> Add an <a href="/providers">AI Provider</a> (OpenAI, Gemini, etc.)</p>
            <p><strong>Step 2:</strong> Add your <a href="/knowledge">Knowledge Fields</a> (business info)</p>
            <p><strong>Step 3:</strong> Upload <a href="/documents">Documents</a> for RAG (optional)</p>
            <p><strong>Step 4:</strong> Connect your <a href="/pages">Facebook Page</a></p>
            <p><strong>Step 5:</strong> Deploy the webhook & start chatting! 🎉</p>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>📊 Platform Stats</h3>
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '2' }}>
            <p>📄 Documents: <strong>{loading ? '...' : stats.documents}</strong></p>
            <p>💬 Total messages processed: <strong>{loading ? '...' : stats.totalMessages}</strong></p>
            <p>🤖 Active AI providers: <strong>{loading ? '...' : stats.providers}</strong></p>
            <p>📱 Connected Facebook pages: <strong>{loading ? '...' : stats.pages}</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}
