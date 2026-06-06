import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Bot, User, Send, PauseCircle, PlayCircle, Loader2, X, AlertCircle } from 'lucide-react';

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

type ChatSession = {
  id: string;
  page_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_avatar: string | null;
  status: string;
  bot_paused: boolean;
  unread_count: number;
  last_message_at: string;
  metadata?: any;
};

type ChatMessage = {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
  metadata?: any;
};

export default function InboxPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>((location.state as any)?.sessionId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [scrollToTrigger, setScrollToTrigger] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Profiling Summary State
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [customerSummary, setCustomerSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [pages, setPages] = useState<Record<string, string>>({});

  const activeSession = sessions.find(s => s.id === activeSessionId);

  useEffect(() => {
    fetchSessions();

    const sessionsSubscription = supabase
      .channel('public:chat_sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions', filter: `user_id=eq.${user?.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setSessions(prev => [payload.new as ChatSession, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setSessions(prev => prev.map(s => s.id === payload.new.id ? payload.new as ChatSession : s).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()));
        }
      })
      .subscribe();

    const messagesSubscription = supabase
      .channel('public:chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${user?.id}` }, (payload) => {
        setMessages(prev => {
          // Only add if it belongs to the active session
          if (payload.new.session_id === activeSessionId) {
            return [...prev, payload.new as ChatMessage];
          }
          return prev;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionsSubscription);
      supabase.removeChannel(messagesSubscription);
    };
  }, [user?.id, activeSessionId]);

  useEffect(() => {
    if (activeSessionId) {
      fetchMessages(activeSessionId);
      // Optional: reset unread count here if we had an update policy
    }
  }, [activeSessionId]);

  useEffect(() => {
    if (scrollToTrigger) {
      // Find the most recent trigger message
      const revIndex = messages.slice().reverse().findIndex(m => m.metadata?.is_trigger_response);
      if (revIndex !== -1) {
        const triggerMsgIndex = messages.length - 1 - revIndex;
        const el = document.getElementById(`msg-${messages[triggerMsgIndex].id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight it briefly
          el.style.transition = 'background-color 0.5s';
          el.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
          setTimeout(() => {
            el.style.backgroundColor = 'transparent';
          }, 2000);
          setScrollToTrigger(false);
          return;
        }
      }
    }
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, scrollToTrigger]);

  const fetchSessions = async () => {
    if (!user) return;
    setLoadingSessions(true);
    
    // Fetch pages mapping
    const { data: pagesData } = await supabase.from('page_connections').select('page_id, page_name').eq('user_id', user.id);
    if (pagesData) {
      const pMap: Record<string, string> = {};
      pagesData.forEach(p => pMap[p.page_id] = p.page_name || p.page_id);
      setPages(pMap);
    }

    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false });

    if (!error && data) {
      setSessions(data);
    }
    setLoadingSessions(false);
  };

  const fetchMessages = async (sessionId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
    setLoadingMessages(false);
  };

  const fetchCustomerSummary = async () => {
    if (!activeSession) return;
    setLoadingSummary(true);
    setShowSummaryModal(true);
    
    const { data } = await supabase
      .from('customer_profiles')
      .select('summary')
      .eq('page_id', activeSession.page_id)
      .eq('sender_id', activeSession.sender_id)
      .maybeSingle();
      
    if (data?.summary) {
      setCustomerSummary(data.summary);
    } else {
      setCustomerSummary('No summary available for this customer yet. Ensure Profiling is enabled in Channel settings, and the customer has interacted recently.');
    }
    setLoadingSummary(false);
  };

  const toggleBot = async () => {
    if (!activeSession) return;
    const newPausedState = !activeSession.bot_paused;
    
    // Optimistic update
    setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, bot_paused: newPausedState } : s));

    try {
      const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://metachat.junoverseai.com';
      const response = await fetch(`${WORKER_URL}/api/chat/toggle-bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          botPaused: newPausedState
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to toggle bot');
      }
    } catch (err) {
      console.error(err);
      alert('Error toggling bot');
      // Revert on failure
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, bot_paused: !newPausedState } : s));
    }
  };

  const handleSend = async () => {
    if (!replyText.trim() || !activeSession) return;
    setSending(true);
    const textToSend = replyText.trim();
    
    // Clear input immediately for better UX
    setReplyText('');
    
    try {
      const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://metachat.junoverseai.com';
      const response = await fetch(`${WORKER_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSession.id,
          text: textToSend,
          pageId: activeSession.page_id,
          recipientId: activeSession.sender_id
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }
      
      // We rely entirely on Supabase Realtime to push the message into the UI!
    } catch (err) {
      console.error(err);
      alert('Error sending message');
      // Restore the text if it failed
      setReplyText(textToSend);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="inbox-container" style={{ display: 'flex', height: 'calc(100vh - 40px)', background: '#1A1D21', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      {/* Sidebar */}
      <div className="inbox-sidebar" style={{ width: '300px', borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Inbox</h2>
        </div>
        
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingSessions ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No conversations yet</div>
          ) : (
            sessions.map(session => (
              <div 
                key={session.id}
                onClick={() => setActiveSessionId(session.id)}
                style={{ 
                  padding: '16px 20px', 
                  borderBottom: '1px solid var(--border-color)', 
                  cursor: 'pointer',
                  background: activeSessionId === session.id ? 'var(--bg-secondary)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {session.sender_avatar ? (
                    <img src={session.sender_avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={20} color="white" />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div style={{ fontWeight: '500', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {session.sender_name || 'Anonymous User'}
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'normal', marginTop: '2px' }}>
                        Page: {pages[session.page_id] || 'Unknown'}
                      </div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                      {timeAgo(session.last_message_at)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {session.bot_paused ? (
                      <span style={{ fontSize: '10px', background: 'var(--error)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>PAUSED</span>
                    ) : (
                      <span style={{ fontSize: '10px', background: 'var(--accent-primary)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>BOT</span>
                    )}
                    {session.unread_count > 0 && (
                      <span style={{ fontSize: '10px', background: 'var(--text-secondary)', color: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold' }}>
                        {session.unread_count} new
                      </span>
                    )}
                    {session.metadata?.has_trigger && (
                      <span 
                        title="Trigger Word Detected - Click to View" 
                        style={{ color: 'var(--error)', display: 'flex', alignItems: 'center', marginLeft: '4px', cursor: 'pointer' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSessionId(session.id);
                          setScrollToTrigger(true);
                        }}
                      >
                        <AlertCircle size={14} />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="inbox-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
        {activeSession ? (
          <>
            {/* Chat Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {activeSession.sender_avatar ? (
                    <img src={activeSession.sender_avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={20} color="white" />
                  )}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>{activeSession.sender_name || 'Anonymous User'}</h3>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {activeSession.bot_paused ? 'Bot is currently paused' : 'Bot is active'} • Page: {pages[activeSession.page_id] || 'Unknown'}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-secondary"
                  onClick={fetchCustomerSummary}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <User size={16} />
                  Profile Summary
                </button>
                <button 
                  className={`btn ${activeSession.bot_paused ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={toggleBot}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {activeSession.bot_paused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
                  {activeSession.bot_paused ? 'Resume Bot' : 'Pause Bot'}
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {loadingMessages ? (
                <div style={{ margin: 'auto', color: 'var(--text-secondary)' }}><Loader2 className="spin" /></div>
              ) : (
                messages.map(msg => {
                  const isUser = msg.role === 'user';
                  const isHumanAgent = msg.role === 'human_agent';
                  const isBot = msg.role === 'assistant';
                  const isNote = msg.role === 'internal_note';
                  
                  return (
                    <div id={`msg-${msg.id}`} key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-start' : 'flex-end', padding: '4px' }}>
                      <div style={{ 
                        maxWidth: '70%', 
                        padding: '12px 16px', 
                        borderRadius: '16px',
                        borderBottomLeftRadius: isUser ? '4px' : '16px',
                        borderBottomRightRadius: !isUser ? '4px' : '16px',
                        background: isUser ? 'var(--bg-secondary)' : isNote ? '#FFFACD' : isHumanAgent ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                        color: isNote ? 'black' : 'white',
                        border: isUser || isHumanAgent ? '1px solid var(--border-primary)' : 'none'
                      }}>
                        {msg.content}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isBot && <Bot size={12} />}
                        {isHumanAgent && <User size={12} />}
                        <span>{isUser ? 'User' : isBot ? 'Bot' : isHumanAgent ? 'Agent' : 'Note'} • {timeAgo(msg.created_at)}</span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input Area */}
            <div style={{ padding: '20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                <textarea 
                  className="form-textarea" 
                  placeholder="Type a message..." 
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  style={{ 
                    flex: 1, 
                    minHeight: '44px', 
                    maxHeight: '120px', 
                    resize: 'none', 
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-lg)'
                  }}
                />
                <button 
                  className="btn btn-primary" 
                  onClick={handleSend} 
                  disabled={sending || !replyText.trim()}
                  style={{ height: '44px', width: '44px', padding: '0', borderRadius: 'var(--radius-lg)', flexShrink: 0 }}
                >
                  {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
            Select a conversation to start chatting
          </div>
        )}
      </div>

      {showSummaryModal && (
        <div className="modal-overlay" onClick={() => setShowSummaryModal(false)} style={{ zIndex: 100 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Customer Profile Summary</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowSummaryModal(false)}><X size={18}/></button>
            </div>
            <div className="modal-body">
              {loadingSummary ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Loader2 className="spin" size={24} style={{ margin: '0 auto 12px' }} />
                  <p>Fetching AI Profile...</p>
                </div>
              ) : (
                <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', lineHeight: '1.6' }}>
                  {customerSummary}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
