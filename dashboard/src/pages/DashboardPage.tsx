import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { MessageSquare, Users, Globe, Power, Clock, ArrowRight, Bot, User as UserIcon, Activity } from 'lucide-react';

function timeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface Stats {
  messages: number;
  words: number;
  people: number;
  channels: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<Stats>({
    messages: 0,
    words: 0,
    people: 0,
    channels: 0,
  });
  const [loading, setLoading] = useState(true);
  const [isServiceActive, setIsServiceActive] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [feed, setFeed] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      loadStats();
      
      const messagesSubscription = supabase
        .channel('dashboard_feed')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${user.id}` }, () => {
           loadFeed();
        })
        .subscribe();
        
      return () => {
         supabase.removeChannel(messagesSubscription);
      }
    }
  }, [user]);

  async function loadFeed() {
    if (!user) return;
    const { data } = await supabase
      .from('chat_messages')
      .select(`
        id, role, content, created_at, session_id,
        chat_sessions ( sender_name, sender_avatar, page_id )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);
      
    if (data) setFeed(data);
  }

  async function loadStats() {
    if (!user) return;
    try {
      const [pgs, sessions, tokens, userSettings] = await Promise.all([
        supabase.from('page_connections').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('user_id', user.id),
        supabase.from('chat_sessions').select('id, message_count').eq('user_id', user.id),
        supabase.from('chat_messages').select('token_count').eq('user_id', user.id),
        supabase.from('users').select('settings').eq('id', user.id).single(),
      ]);

      const totalMessages = (sessions.data ?? []).reduce((sum: number, s: any) => sum + (s.message_count || 0), 0);
      const totalTokens = (tokens.data ?? []).reduce((sum: number, t: any) => sum + (t.token_count || 0), 0);
      
      if (userSettings.data?.settings) {
        setIsServiceActive(userSettings.data.settings.is_bot_active !== false);
      }

      setStats({
        messages: totalMessages,
        words: Math.floor(totalTokens * 0.75), // Rough estimation: 1 token ≈ 0.75 words
        people: sessions.data?.length || 0,
        channels: pgs.count ?? 0,
      });
      
      await loadFeed();
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
    <div className="animate-slideUp" style={{ paddingBottom: '40px' }}>
      <div className="page-header flex justify-between items-center" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '8px' }}>Welcome back, {firstName} 👋</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Here's an overview of your chatbot automation platform.</p>
        </div>
        <button
          onClick={toggleService}
          disabled={toggleLoading}
          className={`btn ${
            isServiceActive 
              ? 'btn-secondary' 
              : 'btn-danger'
          }`}
          style={{ 
            borderColor: isServiceActive ? 'var(--success)' : undefined,
            color: isServiceActive ? 'var(--success)' : undefined,
            background: isServiceActive ? 'rgba(34, 197, 94, 0.1)' : undefined,
            padding: '10px 20px',
            borderRadius: '50px',
            fontWeight: '600',
            boxShadow: isServiceActive ? '0 0 15px rgba(34,197,94,0.1)' : '0 0 15px rgba(239,68,68,0.1)'
          }}
        >
          <Power size={18} />
          {isServiceActive ? 'Service Active' : 'Service Paused'}
        </button>
      </div>

      <div className="stats-grid" style={{ marginBottom: '32px' }}>
        <div className="card stat-card" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="stat-label">
            <MessageSquare size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle', color: '#60a5fa' }} />
            Total Messages
          </div>
          <div className="stat-value" style={{ fontSize: '2.5rem', fontWeight: '800' }}>{loading ? '—' : stats.messages.toLocaleString()}</div>
        </div>

        <div className="card stat-card" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="stat-label">
            <Globe size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle', color: '#f43f5e' }} />
            Connected Channels
          </div>
          <div className="stat-value" style={{ fontSize: '2.5rem', fontWeight: '800' }}>{loading ? '—' : stats.channels.toLocaleString()}</div>
        </div>

        <div className="card stat-card" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="stat-label">
            <Users size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle', color: '#10b981' }} />
            People Contacted
          </div>
          <div className="stat-value" style={{ fontSize: '2.5rem', fontWeight: '800' }}>{loading ? '—' : stats.people.toLocaleString()}</div>
        </div>

        <div className="card stat-card" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="stat-label">
            <MessageSquare size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle', color: '#a855f7' }} />
            AI Words Generated
          </div>
          <div className="stat-value" style={{ fontSize: '2.5rem', fontWeight: '800' }}>{loading ? '—' : stats.words.toLocaleString()}</div>
        </div>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.2rem' }}>
            <Activity size={20} style={{ color: 'var(--accent-primary)' }} /> Live Activity Feed
          </h3>
          <button className="btn-ghost" style={{ fontSize: '0.85rem' }} onClick={() => navigate('/inbox')}>
            View All Inbox <ArrowRight size={14} style={{ marginLeft: '4px' }} />
          </button>
        </div>
        
        <div style={{ background: 'var(--bg-primary)' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading feed...</div>
          ) : feed.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>No messages yet. Connect a channel to start!</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {feed.map((msg, idx) => {
                // PostgREST returns related row or array depending on the cardinality. 
                // Since session_id is a foreign key, chat_sessions is a single object here.
                const session = msg.chat_sessions;
                const isAI = msg.role === 'assistant';
                const senderName = session?.sender_name || 'Facebook User';
                const avatar = isAI ? null : (session?.sender_avatar || null);
                
                return (
                  <div 
                    key={msg.id} 
                    onClick={() => navigate('/inbox', { state: { sessionId: msg.session_id } })}
                    style={{ 
                      padding: '16px 24px', 
                      display: 'flex', 
                      gap: '16px', 
                      borderBottom: idx === feed.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease',
                      background: isAI ? 'rgba(255,255,255,0.01)' : 'transparent'
                    }}
                    className="feed-item-hover"
                  >
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%', 
                      background: isAI ? 'rgba(249, 115, 22, 0.15)' : 'rgba(255,255,255,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      overflow: 'hidden',
                      color: isAI ? 'var(--accent-primary)' : 'var(--text-secondary)'
                    }}>
                      {isAI ? (
                        <Bot size={20} />
                      ) : avatar ? (
                        <img src={avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <UserIcon size={20} />
                      )}
                    </div>
                    
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontWeight: '600', color: isAI ? 'var(--accent-primary)' : 'var(--text-primary)', fontSize: '0.95rem' }}>
                          {isAI ? 'AI Assistant' : senderName}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Clock size={12} /> {timeAgo(msg.created_at)}
                        </span>
                      </div>
                      <p style={{ 
                        margin: 0, 
                        color: 'var(--text-secondary)', 
                        fontSize: '0.9rem',
                        lineHeight: '1.5',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {msg.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Required style block for the hover effect */}
      <style>{`
        .feed-item-hover:hover {
          background: rgba(255,255,255,0.05) !important;
        }
      `}</style>
    </div>
  );
}
