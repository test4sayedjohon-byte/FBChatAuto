import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { MessageSquare, Users, Globe, Power, Clock, ArrowRight, Bot, User as UserIcon, Activity, Plus } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { calculateBillingCycle } from '../lib/billing';

const FacebookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const WhatsAppIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.731-1.456L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.394 9.806-9.799.002-2.596-1.004-5.038-2.836-6.872a9.69 9.69 0 0 0-6.868-2.846c-5.41 0-9.81 4.403-9.813 9.81-.001 1.547.411 3.056 1.196 4.39l-.993 3.626 3.72-.976c1.328.724 2.775 1.106 4.293 1.106zm10.998-7.51c-.29-.145-1.716-.847-1.978-.942-.262-.096-.453-.145-.644.145-.191.29-.74.942-.907 1.133-.166.19-.333.215-.624.07-2.904-1.447-4.78-2.187-5.76-3.864-.262-.449.262-.417.75-1.393.083-.166.042-.31-.02-.455-.062-.145-.453-1.09-.62-1.492-.162-.392-.326-.339-.453-.346-.118-.006-.253-.008-.389-.008-.136 0-.356.05-.542.253-.187.203-.712.696-.712 1.699 0 1.003.729 1.973.83 2.112.102.139 1.434 2.19 3.476 3.07.485.209.864.334 1.157.427.488.156.933.134 1.285.08.393-.06 1.716-.7 1.958-1.378.243-.678.243-1.258.17-1.378-.073-.12-.262-.192-.553-.337z"/>
  </svg>
);

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
  useDocumentTitle('Dashboard — AutometaBot');
  const { user, profile } = useAuth();
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
  const [pageConnections, setPageConnections] = useState<any[]>([]);
  const [messagesUsedThisCycle, setMessagesUsedThisCycle] = useState(0);
  const [billingCycle, setBillingCycle] = useState<any>(null);

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
      const [pgs, sessions, tokens, userSettings, purchasesData] = await Promise.all([
        supabase.from('page_connections').select('*').eq('user_id', user.id),
        supabase.from('chat_sessions').select('id, message_count').eq('user_id', user.id),
        supabase.from('chat_messages').select('token_count').eq('user_id', user.id),
        supabase.from('users').select('settings').eq('id', user.id).single(),
        supabase.from('purchases').select('*').eq('user_id', user.id),
      ]);

      const totalMessages = (sessions.data ?? []).reduce((sum: number, s: any) => sum + (s.message_count || 0), 0);
      const totalTokens = (tokens.data ?? []).reduce((sum: number, t: any) => sum + (t.token_count || 0), 0);
      
      if (userSettings.data?.settings) {
        setIsServiceActive(userSettings.data.settings.is_bot_active !== false);
      }

      const activeConns = pgs.data || [];
      setPageConnections(activeConns);

      const pHistory = purchasesData.data || [];
      const cycle = calculateBillingCycle(user.created_at, pHistory);
      setBillingCycle(cycle);

      const { count: cycleMessagesCount } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', cycle.startDate.toISOString())
        .lt('created_at', cycle.endDate.toISOString());

      setMessagesUsedThisCycle(cycleMessagesCount || 0);

      setStats({
        messages: totalMessages,
        words: Math.floor(totalTokens * 0.75), // Rough estimation: 1 token ≈ 0.75 words
        people: sessions.data?.length || 0,
        channels: activeConns.filter(c => c.is_active).length,
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
      <div className="page-header flex justify-between items-center flex-mobile-col flex-wrap" style={{ marginBottom: '32px', gap: '16px' }}>
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

      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="card stat-card" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="stat-label">
            <MessageSquare size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle', color: '#60a5fa' }} />
            Total Messages (All-time)
          </div>
          <div className="stat-value" style={{ fontSize: '2.2rem', fontWeight: '800' }}>{loading ? '—' : stats.messages.toLocaleString()}</div>
        </div>

        <div className="card stat-card" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="stat-label">
            <Users size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle', color: '#10b981' }} />
            People Contacted
          </div>
          <div className="stat-value" style={{ fontSize: '2.2rem', fontWeight: '800' }}>{loading ? '—' : stats.people.toLocaleString()}</div>
        </div>

        <div className="card stat-card" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="stat-label">
            <MessageSquare size={16} style={{ display: 'inline', marginRight: '8px', verticalAlign: 'middle', color: '#a855f7' }} />
            AI Words Generated
          </div>
          <div className="stat-value" style={{ fontSize: '2.2rem', fontWeight: '800' }}>{loading ? '—' : stats.words.toLocaleString()}</div>
        </div>
      </div>

      {/* Resource Quotas Section */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Meta Channels Quota */}
        <div className="card" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={18} style={{ color: 'var(--accent-primary)' }} />
              Connected Channels ({pageConnections.length} / {profile?.allowed_channels || 0})
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Each slot hosts a Facebook, Instagram, or WhatsApp link.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loading ? (
              <div style={{ padding: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading slots...</div>
            ) : (
              <>
                {pageConnections.map((conn) => {
                  const isWA = !!conn.whatsapp_phone_number_id;
                  const isIG = !!conn.instagram_account_id;
                  let platformName = 'Facebook';
                  let iconBg = 'rgba(24, 119, 242, 0.1)';
                  let iconColor = '#1877F2';
                  let platformIcon = <FacebookIcon />;

                  if (isWA) {
                    platformName = 'WhatsApp';
                    iconBg = 'rgba(37, 211, 102, 0.1)';
                    iconColor = '#25D366';
                    platformIcon = <WhatsAppIcon />;
                  } else if (isIG) {
                    platformName = 'Instagram';
                    iconBg = 'rgba(225, 48, 108, 0.1)';
                    iconColor = '#E1306C';
                    platformIcon = <InstagramIcon />;
                  }

                  return (
                    <div key={conn.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifySelf: 'center', justifyContent: 'center' }}>
                          {platformIcon}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                            {conn.page_name || 'Unnamed Channel'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{platformName} Connection</div>
                        </div>
                      </div>
                      <span className={`badge ${conn.is_active ? 'badge-success' : 'badge-error'}`} style={{ fontSize: '10px' }}>
                        {conn.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                  );
                })}

                {/* Empty slot placeholders */}
                {Array.from({ length: Math.max(0, (profile?.allowed_channels || 0) - pageConnections.length) }).map((_, idx) => (
                  <div 
                    key={`empty-${idx}`} 
                    onClick={() => navigate('/pages')}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '8px', 
                      padding: '12px 16px', 
                      border: '1.5px dashed var(--border-primary)', 
                      borderRadius: '10px',
                      cursor: 'pointer',
                      background: 'rgba(255, 255, 255, 0.01)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      fontWeight: '500',
                      transition: 'all 0.2s ease'
                    }}
                    className="empty-slot-hover"
                  >
                    <Plus size={16} /> Available Slot — Connect Channel
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Message Budget Card */}
        <div className="card" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MessageSquare size={18} style={{ color: '#3b82f6' }} />
              Message Budget Usage
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Automated messages remaining this billing cycle.</p>
          </div>

          {loading ? (
            <div style={{ padding: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading usage stats...</div>
          ) : (
            <div>
              {/* Giant remaining display */}
              {(() => {
                const messageLimit = profile?.monthly_message_limit ?? 0;
                const extraMessageLimit = profile?.extra_message_limit ?? 0;
                const totalMessageLimit = messageLimit === -1 ? -1 : (messageLimit + extraMessageLimit);
                const remainingMessages = totalMessageLimit === -1 ? -1 : Math.max(0, totalMessageLimit - messagesUsedThisCycle);

                return (
                  <>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
                      <span style={{ fontSize: '2.2rem', fontWeight: '900', color: 'var(--text-primary)', lineHeight: 1 }}>
                        {totalMessageLimit === -1 ? '∞' : remainingMessages.toLocaleString()}
                      </span>
                      <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
                        messages left
                      </span>
                    </div>

                    {/* Progress Bar */}
                    {totalMessageLimit !== -1 && totalMessageLimit > 0 && (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, (messagesUsedThisCycle / totalMessageLimit) * 100)}%`,
                            background: messagesUsedThisCycle >= totalMessageLimit ? 'var(--error)' : 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)',
                            borderRadius: '4px',
                            transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                          }} />
                        </div>
                      </div>
                    )}

                    {/* Usage Breakdown Details */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-light)', paddingTop: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Used this period</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{messagesUsedThisCycle.toLocaleString()} messages</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Total allowed budget</span>
                        <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                          {messageLimit === -1 ? 'Unlimited' : `${totalMessageLimit.toLocaleString()} messages`}
                          {extraMessageLimit > 0 && ` (${extraMessageLimit.toLocaleString()} gifted)`}
                        </span>
                      </div>
                      {billingCycle && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span>Current billing period</span>
                          <span style={{ color: 'var(--text-primary)', fontWeight: '600', textAlign: 'right' }}>
                            {billingCycle.startDate.toLocaleDateString()} – {billingCycle.endDate.toLocaleDateString()}
                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', marginTop: '2px', fontWeight: '500' }}>
                              ({billingCycle.daysRemaining} days left)
                            </div>
                          </span>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'var(--bg-secondary)' }}>
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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
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
