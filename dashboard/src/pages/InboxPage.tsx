import { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from '../hooks/useToast';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { workerPost } from '../lib/workerApi';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { Bot, User, Send, PauseCircle, PlayCircle, Loader2, X, AlertCircle, ChevronUp, ArrowLeft, FileText, Copy, BrainCircuit } from 'lucide-react';

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

function renderMarkdown(text: string | null) {
  if (!text) return null;

  // Split content into lines
  const lines = text.split('\n');

  return lines.map((line, idx) => {
    let content = line.trim();
    if (!content) {
      return <div key={idx} style={{ height: '8px' }} />;
    }

    // Check if it is a list item
    const isBullet = content.startsWith('* ') || content.startsWith('- ') || content.startsWith('• ');
    if (isBullet) {
      content = content.substring(2);
    }

    // Check for inline asterisk separators (e.g. * **Customer Name:** * **Product Interest:**)
    // Sometimes the AI splits inline parameters with ` * ` on a single line.
    // If it has multiple asterisks with spaces, we'll render it cleanly by splitting.
    const parseInline = (str: string) => {
      // Split by ** for bold
      const boldParts = str.split('**');
      return boldParts.map((bPart, bIdx) => {
        const isBold = bIdx % 2 === 1;
        
        // Search for single * for italics
        const italicParts = bPart.split('*');
        const renderedItalics = italicParts.map((iPart, iIdx) => {
          const isItalic = iIdx % 2 === 1;
          if (isItalic) {
            return <em key={iIdx}>{iPart}</em>;
          }
          return iPart;
        });

        if (isBold) {
          return <strong key={bIdx}>{renderedItalics}</strong>;
        }
        return renderedItalics;
      });
    };

    // Header detection
    if (content.startsWith('#')) {
      const level = content.match(/^#+/)?.[0].length || 1;
      const headerText = content.replace(/^#+\s*/, '');
      const headerStyle = {
        margin: '12px 0 6px 0',
        fontWeight: 600,
        fontSize: level === 1 ? '1.3rem' : level === 2 ? '1.15rem' : '1rem'
      };
      if (level === 1) return <h3 key={idx} style={headerStyle}>{parseInline(headerText)}</h3>;
      if (level === 2) return <h4 key={idx} style={headerStyle}>{parseInline(headerText)}</h4>;
      return <h5 key={idx} style={headerStyle}>{parseInline(headerText)}</h5>;
    }

    if (isBullet) {
      return (
        <ul key={idx} style={{ margin: '4px 0 4px 12px', paddingLeft: '8px', listStyleType: 'disc' }}>
          <li style={{ color: 'inherit' }}>{parseInline(content)}</li>
        </ul>
      );
    }

    // If a line has standard inline asterisks separators, replace them with a bullet-like layout or clean spaces
    if (content.includes(' * ')) {
      const parts = content.split(' * ');
      return (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '4px 0' }}>
          {parts.map((part, pIdx) => (
            <div key={pIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <span style={{ opacity: 0.5 }}>•</span>
              <div>{parseInline(part.trim())}</div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <p key={idx} style={{ margin: '0 0 8px 0', minHeight: '1em', lineHeight: '1.5' }}>
        {parseInline(content)}
      </p>
    );
  });
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
  useDocumentTitle('Inbox — AutometaBot');
  const { user } = useAuth();
  const location = useLocation();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  
  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    toast.success('ID copied to clipboard!');
  };
  const [activeSessionId, setActiveSessionId] = useState<string | null>((location.state as any)?.sessionId || null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [scrollToTrigger, setScrollToTrigger] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Mobile responsiveness display states
  const showSidebar = !isMobile || activeSessionId === null;
  const showMain = !isMobile || activeSessionId !== null;

  // Profiling Summary State
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [customerSummary, setCustomerSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  const [pages, setPages] = useState<Record<string, string>>({});
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [intentFilter, setIntentFilter] = useState('all');
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Pagination states for chat sessions
  const [sessionsPage, setSessionsPage] = useState(0);
  const [hasMoreSessions, setHasMoreSessions] = useState(false);

  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId);

  const filteredSessions = useMemo(() => {
    return sessions.filter(session => {
      // Search filter
      const matchesSearch = !searchTerm || 
        (session.sender_name || 'Anonymous User').toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.sender_id.includes(searchTerm);

      // Intent filter
      const profile = profiles[session.page_id + '_' + session.sender_id];
      const intent = profile?.intent_level || 'unknown';
      const score = profile?.lead_score || 0;
      
      let matchesIntent = true;
      if (intentFilter === 'high') {
        matchesIntent = intent === 'high' || score >= 8;
      } else if (intentFilter === 'medium') {
        matchesIntent = intent === 'medium' || (score >= 4 && score <= 7);
      } else if (intentFilter === 'low') {
        matchesIntent = intent === 'low' || (score >= 1 && score <= 3);
      }

      return matchesSearch && matchesIntent;
    });
  }, [sessions, profiles, searchTerm, intentFilter]);

  // Debounce search term and refetch sessions on filter change
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchSessions(0, false, searchTerm, intentFilter);
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchTerm, intentFilter]);

  useEffect(() => {
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
          if (payload.new.session_id === activeSessionIdRef.current) {
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
  }, [user?.id]);

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

  const SESSIONS_PAGE_SIZE = 30;

  const fetchSessions = async (pageNumber = 0, append = false, currentSearch = searchTerm, currentIntent = intentFilter) => {
    if (!user) return;
    setLoadingSessions(true);
    
    // Fetch pages mapping once
    if (Object.keys(pages).length === 0) {
      const { data: pagesData } = await supabase.from('page_connections').select('page_id, page_name').eq('user_id', user.id);
      if (pagesData) {
        const pMap: Record<string, string> = {};
        pagesData.forEach(p => pMap[p.page_id] = p.page_name || p.page_id);
        setPages(pMap);
      }
    }

    let query = supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id);

    // Filter by search term at database level
    if (currentSearch.trim()) {
      query = query.ilike('sender_name', `%${currentSearch.trim()}%`);
    }

    // Filter by intent level at database level
    if (currentIntent && currentIntent !== 'all') {
      let profilesQuery = supabase
        .from('customer_profiles')
        .select('sender_id')
        .eq('user_id', user.id);

      if (currentIntent === 'high') {
        profilesQuery = profilesQuery.or('intent_level.eq.high,lead_score.gte.8');
      } else if (currentIntent === 'medium') {
        profilesQuery = profilesQuery.or('intent_level.eq.medium,and(lead_score.gte.4,lead_score.lte.7)');
      } else if (currentIntent === 'low') {
        profilesQuery = profilesQuery.or('intent_level.eq.low,and(lead_score.gte.1,lead_score.lte.3)');
      }

      const { data: matchedProfiles } = await profilesQuery;
      const matchedSenderIds = matchedProfiles?.map(p => p.sender_id) || [];

      if (matchedSenderIds.length > 0) {
        query = query.in('sender_id', matchedSenderIds);
      } else {
        // Force empty if no profiles match intent filter
        setSessions([]);
        setHasMoreSessions(false);
        setLoadingSessions(false);
        return;
      }
    }

    // Paginate database query
    const startRange = pageNumber * SESSIONS_PAGE_SIZE;
    const endRange = (pageNumber + 1) * SESSIONS_PAGE_SIZE - 1;

    query = query
      .order('last_message_at', { ascending: false })
      .range(startRange, endRange);

    const { data, error } = await query;

    if (!error && data) {
      setHasMoreSessions(data.length === SESSIONS_PAGE_SIZE);

      // On-demand fetch of customer profiles for these sessions
      const senderIds = data.map(s => s.sender_id);
      if (senderIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('customer_profiles')
          .select('page_id, sender_id, summary, intent_level, lead_score, metadata')
          .eq('user_id', user.id)
          .in('sender_id', senderIds);

        if (profilesData) {
          setProfiles(prev => {
            const nextProfiles = { ...prev };
            profilesData.forEach(p => {
              nextProfiles[p.page_id + '_' + p.sender_id] = p;
            });
            return nextProfiles;
          });
        }
      }

      let updatedSessions = append ? [...sessions, ...data] : data;

      // Remove potential duplicates
      const seen = new Set<string>();
      updatedSessions = updatedSessions.filter(s => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });

      setSessions(updatedSessions);
      setSessionsPage(pageNumber);
    }
    setLoadingSessions(false);
  };

  const MESSAGE_PAGE_SIZE = 50;

  const fetchMessages = async (sessionId: string) => {
    setLoadingMessages(true);
    setHasMoreMessages(false);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
      .limit(MESSAGE_PAGE_SIZE);

    if (!error && data) {
      setHasMoreMessages(data.length === MESSAGE_PAGE_SIZE);
      setMessages(data.reverse()); // Reverse to show oldest first
    }
    setLoadingMessages(false);
  };

  const loadOlderMessages = async () => {
    if (!activeSessionId || messages.length === 0) return;
    setLoadingOlder(true);
    const oldestMessage = messages[0];
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', activeSessionId)
      .lt('created_at', oldestMessage.created_at)
      .order('created_at', { ascending: false })
      .limit(MESSAGE_PAGE_SIZE);

    if (!error && data) {
      setHasMoreMessages(data.length === MESSAGE_PAGE_SIZE);
      setMessages(prev => [...data.reverse(), ...prev]);
    }
    setLoadingOlder(false);
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

  const handleToggleAiAccess = async () => {
    if (!activeSession) return;
    const currentMeta = activeSession.metadata
      ? (typeof activeSession.metadata === 'string' ? JSON.parse(activeSession.metadata) : activeSession.metadata)
      : {};
    const newMetadata = { ...currentMeta };
    const currentEnabled = newMetadata.ai_context_enabled !== false;
    newMetadata.ai_context_enabled = !currentEnabled;

    // Optimistic Update
    setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, metadata: newMetadata } : s));

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ metadata: newMetadata })
        .eq('id', activeSession.id);

      if (error) throw error;
      toast.success(newMetadata.ai_context_enabled 
        ? "AI assistant can now access this contact's details." 
        : "AI assistant blocked from accessing this contact's details."
      );
    } catch (err: any) {
      toast.error('Failed to update AI access: ' + err.message);
      // Revert
      setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, metadata: currentMeta } : s));
    }
  };

  const toggleBot = async () => {
    if (!activeSession) return;
    const newPausedState = !activeSession.bot_paused;
    
    // Optimistic update
    setSessions(prev => prev.map(s => s.id === activeSession.id ? { ...s, bot_paused: newPausedState } : s));

    try {
      await workerPost('/api/chat/toggle-bot', {
        sessionId: activeSession.id,
        botPaused: newPausedState,
      });
    } catch (err) {
      console.error(err);
      toast.error('Error toggling bot');
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
      await workerPost('/api/chat/send', {
        sessionId: activeSession.id,
        text: textToSend,
        pageId: activeSession.page_id,
        recipientId: activeSession.sender_id,
      });
      
      // We rely entirely on Supabase Realtime to push the message into the UI!
    } catch (err) {
      console.error(err);
      toast.error('Error sending message');
      // Restore the text if it failed
      setReplyText(textToSend);
    } finally {
      setSending(false);
    }
  };

  const handleSessionsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    if (isAtBottom && hasMoreSessions && !loadingSessions) {
      fetchSessions(sessionsPage + 1, true);
    }
  };

  return (
    <div className="inbox-container" style={{ display: 'flex', height: isMobile ? 'calc(100vh - 100px)' : 'calc(100vh - 40px)', background: '#1A1D21', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      {/* Sidebar */}
      <div 
        className="inbox-sidebar" 
        style={{ 
          width: isMobile ? '100%' : '300px', 
          borderRight: isMobile ? 'none' : '1px solid var(--border-color)', 
          display: showSidebar ? 'flex' : 'none', 
          flexDirection: 'column' 
        }}
      >
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600' }}>Inbox</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '12px'
              }}
            />
            <select
              value={intentFilter}
              onChange={e => setIntentFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 8px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                color: 'var(--text-secondary)',
                fontSize: '11px',
                cursor: 'pointer'
              }}
            >
              <option value="all">All Intents</option>
              <option value="high">High Intent (Score &ge; 8)</option>
              <option value="medium">Medium Intent (Score 4-7)</option>
              <option value="low">Low Intent (Score 1-3)</option>
            </select>
          </div>
        </div>
        
        <div onScroll={handleSessionsScroll} style={{ flex: 1, overflowY: 'auto' }}>
          {loadingSessions && sessions.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
          ) : filteredSessions.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>No matching conversations</div>
          ) : (
            <>
              {filteredSessions.map(session => {
                const prof = profiles[session.page_id + '_' + session.sender_id];
                return (
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
                        <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', maxWidth: '100%', verticalAlign: 'middle' }}>
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                              {session.sender_name || 'Anonymous User'}
                            </span>
                            {(() => {
                              if (!prof) {
                                return (
                                  <span style={{
                                    fontSize: '10px',
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    color: 'var(--text-secondary)',
                                    padding: '1px 5px',
                                    borderRadius: '4px',
                                    fontWeight: 'bold',
                                    flexShrink: 0
                                  }} title="Default score (pending AI profile)">
                                    5/10
                                  </span>
                                );
                              }
                              const score = prof.lead_score ?? (
                                prof.intent_level === 'high' || prof.intent_level === 'hot' ? 8 : 
                                prof.intent_level === 'low' || prof.intent_level === 'cold' ? 2 : 5
                              );
                              const isHigh = score >= 8;
                              const isLow = score <= 3;
                              return (
                                <span style={{
                                  fontSize: '10px',
                                  background: isHigh ? 'rgba(239, 68, 68, 0.2)' : isLow ? 'rgba(59, 130, 246, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                                  color: isHigh ? '#f87171' : isLow ? '#60a5fa' : '#facc15',
                                  padding: '1px 5px',
                                  borderRadius: '4px',
                                  fontWeight: 'bold',
                                  flexShrink: 0
                                }}>
                                  {score}/10
                                </span>
                              );
                            })()}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'normal', marginTop: '2px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div>Page: {pages[session.page_id] || 'Unknown'}</div>
                            <div 
                              onClick={(e) => handleCopyId(e, session.sender_id)}
                              style={{ 
                                fontSize: '10px', 
                                color: 'var(--accent-primary)', 
                                cursor: 'pointer', 
                                display: 'inline-flex', 
                                alignItems: 'center', 
                                gap: '4px',
                                marginTop: '2px',
                                width: 'fit-content'
                              }}
                              title="Click to copy Facebook User ID"
                            >
                              <Copy size={10} />
                              ID: {session.sender_id}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                          {timeAgo(session.last_message_at)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        {session.bot_paused ? (
                          <span style={{ fontSize: '10px', background: 'var(--error)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>PAUSED</span>
                        ) : (
                          <span style={{ fontSize: '10px', background: 'var(--accent-primary)', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>BOT</span>
                        )}
                        {prof && (
                          <span style={{
                            fontSize: '9px',
                            background: prof.intent_level === 'high' ? 'rgba(239, 68, 68, 0.12)' : prof.intent_level === 'medium' ? 'rgba(234, 179, 8, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                            color: prof.intent_level === 'high' ? '#f87171' : prof.intent_level === 'medium' ? '#facc15' : '#60a5fa',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            textTransform: 'uppercase'
                          }}>
                            {prof.lead_score ? `Score: ${prof.lead_score}/10` : `Score: ${prof.intent_level === 'high' || prof.intent_level === 'hot' ? 8 : prof.intent_level === 'low' || prof.intent_level === 'cold' ? 2 : 5}/10`}
                          </span>
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
                );
              })}
              {loadingSessions && (
                <div style={{ padding: '15px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                  Loading more...
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div 
        className="inbox-main" 
        style={{ 
          flex: 1, 
          display: showMain ? 'flex' : 'none', 
          flexDirection: 'column', 
          background: 'var(--bg-primary)',
          minWidth: 0
        }}
      >
        {activeSession ? (
          <>
            {/* Chat Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                {isMobile && (
                  <button
                    onClick={() => setActiveSessionId(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      padding: '8px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      marginRight: '4px'
                    }}
                    aria-label="Back to sessions"
                  >
                    <ArrowLeft size={20} />
                  </button>
                )}
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {activeSession.sender_avatar ? (
                    <img src={activeSession.sender_avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <User size={20} color="white" />
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ margin: 0, fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeSession.sender_name || 'Anonymous User'}</h3>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                    <span>{activeSession.bot_paused ? 'Bot is paused' : 'Bot is active'}</span>
                    <span>•</span>
                    {(() => {
                      const activeProfile = profiles[activeSession.page_id + '_' + activeSession.sender_id];
                      const score = activeProfile?.lead_score ?? (
                        activeProfile?.intent_level === 'high' || activeProfile?.intent_level === 'hot' ? 8 : 
                        activeProfile?.intent_level === 'low' || activeProfile?.intent_level === 'cold' ? 2 : 5
                      );
                      const isHigh = score >= 8;
                      const isLow = score <= 3;
                      const levelName = activeProfile?.intent_level ?? 'unknown';
                      
                      return (
                        <>
                          <span style={{
                            background: !activeProfile ? 'rgba(255, 255, 255, 0.05)' : isHigh ? 'rgba(239, 68, 68, 0.15)' : isLow ? 'rgba(59, 130, 246, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                            color: !activeProfile ? 'var(--text-secondary)' : isHigh ? '#f87171' : isLow ? '#60a5fa' : '#facc15',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontWeight: 'bold',
                            fontSize: '11px',
                            textTransform: 'uppercase'
                          }}>
                            {(!activeProfile ? 'DEFAULT' : levelName) + ' INTENT'} ({score}/10)
                          </span>
                          <span>•</span>
                        </>
                      );
                    })()}
                    <span>Page: {pages[activeSession.page_id] || 'Unknown'}</span>
                    <span>•</span>
                    <button 
                      onClick={(e) => handleCopyId(e as any, activeSession.sender_id)}
                      style={{ 
                        background: 'rgba(255,255,255,0.05)', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '4px', 
                        color: 'var(--accent-primary)', 
                        cursor: 'pointer', 
                        fontSize: '11px', 
                        display: 'inline-flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        padding: '2px 6px',
                        transition: 'all 0.2s'
                      }}
                      title="Click to copy Facebook User ID"
                    >
                      <Copy size={10} />
                      ID: {activeSession.sender_id}
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button 
                  className="btn btn-secondary"
                  onClick={fetchCustomerSummary}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '8px' : '10px 20px' }}
                  title="Profile Summary"
                >
                  <User size={16} />
                  {!isMobile && 'Profile Summary'}
                </button>
                <button 
                  className={`btn ${activeSession.bot_paused ? 'btn-warning-glow' : 'btn-secondary'}`}
                  onClick={toggleBot}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: isMobile ? '8px' : '10px 20px' }}
                  title={activeSession.bot_paused ? 'Resume Bot' : 'Pause Bot'}
                >
                  {activeSession.bot_paused ? <PlayCircle size={16} /> : <PauseCircle size={16} />}
                  {!isMobile && (activeSession.bot_paused ? 'Resume Bot' : 'Pause Bot')}
                </button>
              </div>
            </div>

            {/* Chat Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {loadingMessages ? (
                <div style={{ margin: 'auto', color: 'var(--text-secondary)' }}><Loader2 className="spin" /></div>
              ) : (
                <>
                  {hasMoreMessages && (
                    <button
                      onClick={loadOlderMessages}
                      disabled={loadingOlder}
                      style={{
                        alignSelf: 'center',
                        padding: '6px 16px',
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: '20px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginBottom: '8px',
                      }}
                    >
                      {loadingOlder ? <Loader2 size={12} className="spin" /> : <ChevronUp size={12} />}
                      {loadingOlder ? 'Loading...' : 'Load older messages'}
                    </button>
                  )}
                {messages.map(msg => {
                  const isUser = msg.role === 'user';
                  const isHumanAgent = msg.role === 'human_agent';
                  const isBot = msg.role === 'assistant';
                  const isNote = msg.role === 'internal_note';
                  
                  return (
                    <div id={`msg-${msg.id}`} key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-start' : 'flex-end', padding: '4px' }}>
                      <div style={{ 
                        maxWidth: isMobile ? '85%' : '70%', 
                        padding: '12px 16px', 
                        borderRadius: '16px',
                        borderBottomLeftRadius: isUser ? '4px' : '16px',
                        borderBottomRightRadius: !isUser ? '4px' : '16px',
                        background: isUser ? 'var(--bg-secondary)' : isNote ? '#FFFACD' : isHumanAgent ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
                        color: isNote ? 'black' : 'white',
                        border: isUser || isHumanAgent ? '1px solid var(--border-primary)' : 'none'
                      }}>
                        <div>{renderMarkdown(msg.content)}</div>
                        {msg.metadata?.attachment_urls && msg.metadata.attachment_urls.length > 0 && (
                          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {msg.metadata.attachment_urls.map((url: string, index: number) => {
                              const type = msg.metadata.attachment_types?.[index] || 'file';
                              if (type === 'image') {
                                return (
                                  <a key={index} href={url} target="_blank" rel="noreferrer">
                                    <img 
                                      src={url} 
                                      alt="Attachment preview" 
                                      style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'block', cursor: 'zoom-in' }} 
                                    />
                                  </a>
                                );
                              } else if (type === 'video') {
                                return (
                                  <video 
                                    key={index}
                                    src={url} 
                                    controls 
                                    style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'block' }} 
                                  />
                                );
                              } else if (type === 'audio') {
                                return (
                                  <audio 
                                    key={index}
                                    src={url} 
                                    controls 
                                    style={{ maxWidth: '100%', display: 'block' }} 
                                  />
                                );
                              } else {
                                const fileName = url.substring(url.lastIndexOf('/') + 1).split('?')[0];
                                return (
                                  <a 
                                    key={index}
                                    href={url} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '8px 12px',
                                      background: 'rgba(255, 255, 255, 0.1)',
                                      borderRadius: '8px',
                                      color: 'white',
                                      textDecoration: 'none',
                                      fontSize: '0.8rem',
                                      fontWeight: '500',
                                      border: '1px solid rgba(255, 255, 255, 0.2)'
                                    }}
                                  >
                                    <FileText size={14} />
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                                      {fileName || 'Download File'}
                                    </span>
                                  </a>
                                );
                              }
                            })}
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {isBot && <Bot size={12} />}
                        {isHumanAgent && <User size={12} />}
                        <span>{isUser ? 'User' : isBot ? 'Bot' : isHumanAgent ? 'Agent' : 'Note'} • {timeAgo(msg.created_at)}</span>
                      </div>
                    </div>
                  );
                })}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Bot Paused Banner */}
            {activeSession.bot_paused && (
              <div style={{
                padding: '12px 20px',
                background: 'var(--warning-bg)',
                borderTop: '1px solid rgba(245, 158, 11, 0.15)',
                borderBottom: '1px solid rgba(245, 158, 11, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                fontSize: '13px',
                color: 'var(--warning)',
                animation: 'fadeIn 0.3s ease'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, color: 'var(--warning)' }} />
                  <span>
                    <strong>Bot is Paused (Human Takeover Mode)</strong>. AI auto-replies are disabled for this session.
                  </span>
                </div>
                <button
                  onClick={toggleBot}
                  style={{
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#fb923c',
                    border: '1px solid var(--warning)',
                    borderRadius: '4px',
                    padding: '4px 12px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(245, 158, 11, 0.15)';
                  }}
                >
                  Resume Bot
                </button>
              </div>
            )}

            {/* Message Input Area */}
            <div style={{ padding: isMobile ? '12px 16px' : '20px', borderTop: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
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
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {loadingSummary ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Loader2 className="spin" size={24} style={{ margin: '0 auto 12px' }} />
                  <p>Fetching AI Profile...</p>
                </div>
              ) : (
                <>
                  <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', lineHeight: '1.6' }}>
                    {renderMarkdown(customerSummary)}
                  </div>
                  
                  {(() => {
                    const metadata = activeSession?.metadata
                      ? (typeof activeSession.metadata === 'string' ? JSON.parse(activeSession.metadata) : activeSession.metadata)
                      : {};
                    const isAiEnabled = metadata.ai_context_enabled !== false;
                    const otherMeta = Object.entries(metadata)
                      .filter(([k]) => k !== 'ai_context_enabled');

                    return (
                      <div className="card" style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: '12px', margin: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                          <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BrainCircuit size={16} className="text-primary" /> Captured Flow Data
                          </h3>
                          <button
                            onClick={handleToggleAiAccess}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: isAiEnabled ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                              border: `1px solid ${isAiEnabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                              borderRadius: '20px',
                              padding: '4px 10px',
                              color: isAiEnabled ? '#4ade80' : '#f87171',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            {isAiEnabled ? 'AI Fed' : 'AI Blocked'}
                          </button>
                        </div>
                        
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
                          {isAiEnabled 
                            ? "AI assistant can access captured parameters to contextually reply to the customer." 
                            : "AI assistant is blocked from accessing these variables."}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                          {otherMeta.length === 0 ? (
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center', padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                              No variables captured yet for this session.
                            </div>
                          ) : (
                            otherMeta.map(([key, val]) => (
                              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.02)' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '11px' }}>{key}</span>
                                <span style={{ color: '#fff', fontSize: '11px', wordBreak: 'break-all', marginLeft: '12px' }}>{String(val)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
