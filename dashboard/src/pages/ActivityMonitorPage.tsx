import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { workerPost } from '../lib/workerApi';
import { toast } from '../hooks/useToast';
import ActivityMonitorSentimentPanel from './ActivityMonitorSentimentPanel';
import { 
  MessageSquare, MessageCircle, Calendar, CheckCircle, 
  XCircle, EyeOff, Send, Loader2, ArrowLeft, User, Clock, 
  Filter, AlertTriangle, AlertCircle, CornerDownRight, 
  Play, Pause, Trash2, ThumbsUp, Sparkles, ExternalLink, 
  RefreshCw, Coins
} from 'lucide-react';

// Platform icons as custom inline SVGs to match theme
const FacebookIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon = ({ size = 16 }: { size?: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

function timeAgo(dateString: string) {
  if (!dateString) return 'unknown';
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

type CommentLog = {
  id: string;
  user_id: string;
  page_connection_id: string;
  platform: string;
  post_id: string;
  comment_id: string;
  parent_comment_id: string | null;
  sender_id: string;
  user_name: string;
  user_message: string;
  ai_sentiment: 'positive' | 'negative' | 'neutral' | null;
  ai_toxicity_score: number | null;
  action_taken: 'replied' | 'hidden' | 'trashed' | 'no_action' | null;
  reply_message: string | null;
  reply_source: 'ai' | 'manual' | null; // 'manual' = sent from dashboard, 'ai' = auto-replied by worker
  dm_sent_id: string | null;
  credits_deducted: number | null;
  created_at: string;
};

type ScheduledPost = {
  id: string;
  user_id: string;
  page_connection_id: string;
  platform: string;
  post_type: string;
  message: string;
  media_urls: any;
  scheduled_time: string;
  status: 'scheduled' | 'uploading' | 'ready' | 'published' | 'failed';
  meta_post_id: string | null;
  error_message: string | null;
  created_at: string;
};

export default function ActivityMonitorPage() {
  useDocumentTitle('Activity Monitor — AutometaBot');
  const { user, profile } = useAuth();

  // Derived from profile — mirrors the DB allow_comment_analysis flag
  const analysisEnabled = !!profile?.allow_comment_analysis;
  
  // Layout views state (responsive columns view for mobile)
  const [activeTab, setActiveTab] = useState<'dms' | 'comments' | 'posts'>('comments');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

  // Global filters
  const [platformFilter, setPlatformFilter] = useState<'all' | 'facebook' | 'instagram'>('all');
  const [pageFilter, setPageFilter] = useState<string>('all');

  // Comment filters
  const [sentimentFilter, setSentimentFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [toxicityFilter, setToxicityFilter] = useState<string>('all');
  
  // Mappings
  const [pagesMap, setPagesMap] = useState<Record<string, { name: string; platform: string }>>({});
  // Flat list of pages for the sentiment panel
  const [pagesList, setPagesList] = useState<{ page_id: string; page_name: string; platform: string }[]>([]);

  // Core Data States
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [commentLogs, setCommentLogs] = useState<CommentLog[]>([]);
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);

  // Selection & Modal States
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [chatReplyText, setChatReplyText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [togglingBot, setTogglingBot] = useState(false);

  // Customer Summary Profile
  const [customerSummary, setCustomerSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);

  // Comment Reply Modal State
  const [replyingComment, setReplyingComment] = useState<CommentLog | null>(null);
  const [commentReplyText, setCommentReplyText] = useState('');
  const [sendingCommentReply, setSendingCommentReply] = useState(false);

  // Scheduler execution trigger
  const [runningScheduler, setRunningScheduler] = useState(false);

  // Loading States
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingComments, setLoadingComments] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeSessionIdRef.current = selectedSessionId;
  }, [selectedSessionId]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch initial data & set up subscriptions
  useEffect(() => {
    if (!user) return;

    fetchPages();
    fetchCustomerProfiles();
    fetchSessions();
    fetchComments();
    fetchPosts();

    // Supabase Realtime Channels
    const sessionsSub = supabase
      .channel('activity_sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setSessions(prev => [payload.new as ChatSession, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setSessions(prev => prev.map(s => s.id === payload.new.id ? (payload.new as ChatSession) : s)
            .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
          );
        }
      })
      .subscribe();

    const messagesSub = supabase
      .channel('activity_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.new.session_id === activeSessionIdRef.current) {
          setChatMessages(prev => [...prev, payload.new as ChatMessage]);
        }
      })
      .subscribe();

    const commentsSub = supabase
      .channel('activity_comments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_logs', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setCommentLogs(prev => [payload.new as CommentLog, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setCommentLogs(prev => prev.map(c => c.id === payload.new.id ? (payload.new as CommentLog) : c));
        }
      })
      .subscribe();

    const postsSub = supabase
      .channel('activity_posts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_posts', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setScheduledPosts(prev => [payload.new as ScheduledPost, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          setScheduledPosts(prev => prev.map(p => p.id === payload.new.id ? (payload.new as ScheduledPost) : p));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(sessionsSub);
      supabase.removeChannel(messagesSub);
      supabase.removeChannel(commentsSub);
      supabase.removeChannel(postsSub);
    };
  }, [user]);

  // Load chat messages when selected session changes
  useEffect(() => {
    if (selectedSessionId) {
      loadChatMessages(selectedSessionId);
      const activeSession = sessions.find(s => s.id === selectedSessionId);
      if (activeSession) {
        fetchCustomerSummary(activeSession.page_id, activeSession.sender_id);
      }
    } else {
      setCustomerSummary(null);
      setSelectedProfile(null);
      setShowSummary(false);
    }
  }, [selectedSessionId]);

  // Scroll to bottom of chat when messages populate
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchCustomerProfiles = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('user_id', user.id);
      
      if (data) {
        const profMap: Record<string, any> = {};
        data.forEach(p => {
          profMap[p.page_id + '_' + p.sender_id] = p;
        });
        setProfiles(profMap);
      }
    } catch (err) {
      console.error('Error fetching customer profiles:', err);
    }
  };

  const fetchPages = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('page_connections')
      .select('page_id, page_name, whatsapp_phone_number_id, instagram_account_id')
      .eq('user_id', user.id);

    if (data) {
      const mapping: Record<string, { name: string; platform: string }> = {};
      const list: { page_id: string; page_name: string; platform: string }[] = [];
      data.forEach(p => {
        const platform = p.whatsapp_phone_number_id ? 'whatsapp' : p.instagram_account_id ? 'instagram' : 'facebook';
        mapping[p.page_id] = { name: p.page_name || p.page_id, platform };
        if (platform !== 'whatsapp') {
          list.push({ page_id: p.page_id, page_name: p.page_name || p.page_id, platform });
        }
      });
      setPagesMap(mapping);
      setPagesList(list);
    }
  };

  const fetchSessions = async () => {
    if (!user) return;
    setLoadingSessions(true);
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('last_message_at', { ascending: false })
      .limit(30);

    if (!error && data) {
      setSessions(data);
    }
    setLoadingSessions(false);
  };

  const fetchComments = async () => {
    if (!user) return;
    setLoadingComments(true);
    const { data, error } = await supabase
      .from('comment_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setCommentLogs(data);
    }
    setLoadingComments(false);
  };

  const fetchPosts = async () => {
    if (!user) return;
    setLoadingPosts(true);
    const { data, error } = await supabase
      .from('scheduled_posts')
      .select('*')
      .eq('user_id', user.id)
      .order('scheduled_time', { ascending: false })
      .limit(20);

    if (!error && data) {
      setScheduledPosts(data);
    }
    setLoadingPosts(false);
  };

  const loadChatMessages = async (sessionId: string) => {
    setLoadingMessages(true);
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (!error && data) {
      setChatMessages(data);
    }
    setLoadingMessages(false);
  };

  const fetchCustomerSummary = async (pageId: string, senderId: string) => {
    setLoadingSummary(true);
    try {
      const { data } = await supabase
        .from('customer_profiles')
        .select('*')
        .eq('page_id', pageId)
        .eq('sender_id', senderId)
        .maybeSingle();

      setSelectedProfile(data || null);
      if (data?.summary) {
        setCustomerSummary(data.summary);
      } else {
        setCustomerSummary('No summary generated yet. Complete conversation threads to generate AI profile outlines.');
      }
    } catch (err) {
      console.error(err);
      setSelectedProfile(null);
      setCustomerSummary('Failed to retrieve AI profile overview.');
    } finally {
      setLoadingSummary(false);
    }
  };

  // Actions
  const handleToggleBot = async (session: ChatSession) => {
    setTogglingBot(true);
    const nextPaused = !session.bot_paused;
    // Optimistic Update
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, bot_paused: nextPaused } : s));

    try {
      await workerPost('/api/chat/toggle-bot', {
        sessionId: session.id,
        botPaused: nextPaused
      });
      toast.success(nextPaused ? 'Chatbot paused for this session' : 'Chatbot resumed for this session');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to toggle bot: ' + err.message);
      // Revert
      setSessions(prev => prev.map(s => s.id === session.id ? { ...s, bot_paused: session.bot_paused } : s));
    } finally {
      setTogglingBot(false);
    }
  };

  const handleSendChatMessage = async () => {
    const activeSession = sessions.find(s => s.id === selectedSessionId);
    if (!chatReplyText.trim() || !activeSession) return;

    setSendingChat(true);
    const messageText = chatReplyText.trim();
    setChatReplyText('');

    try {
      await workerPost('/api/chat/send', {
        sessionId: activeSession.id,
        text: messageText,
        pageId: activeSession.page_id,
        recipientId: activeSession.sender_id,
      });
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to send message: ' + err.message);
      setChatReplyText(messageText); // restore
    } finally {
      setSendingChat(false);
    }
  };

  const handleSendCommentReply = async () => {
    if (!replyingComment || !commentReplyText.trim()) return;

    setSendingCommentReply(true);
    const replyText = commentReplyText.trim();

    try {
      await workerPost('/api/comment/reply', {
        commentId: replyingComment.comment_id,
        pageId: replyingComment.page_connection_id,
        message: replyText
      });

      setCommentLogs(prev => prev.map(c => 
        c.comment_id === replyingComment.comment_id 
          ? { ...c, action_taken: 'replied', reply_message: replyText, reply_source: 'manual' } 
          : c
      ));

      toast.success('Reply sent successfully!');
      setReplyingComment(null);
      setCommentReplyText('');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to reply: ' + err.message);
    } finally {
      setSendingCommentReply(false);
    }
  };

  const handleLikeComment = async (log: CommentLog) => {
    try {
      await workerPost('/api/comment/like', {
        commentId: log.comment_id,
        pageId: log.page_connection_id
      });
      toast.success('Comment liked!');
    } catch (err: any) {
      toast.error('Failed to like comment: ' + err.message);
    }
  };

  const handleHideComment = async (log: CommentLog) => {
    // Optimistic Update
    setCommentLogs(prev => prev.map(c => c.id === log.id ? { ...c, action_taken: 'hidden' } : c));
    try {
      await workerPost('/api/comment/hide', {
        commentId: log.comment_id,
        pageId: log.page_connection_id
      });
      toast.success('Comment hidden!');
    } catch (err: any) {
      toast.error('Failed to hide comment: ' + err.message);
      // Revert
      setCommentLogs(prev => prev.map(c => c.id === log.id ? { ...c, action_taken: log.action_taken } : c));
    }
  };

  const handleDeleteComment = async (log: CommentLog) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) return;
    
    // Optimistic Update
    setCommentLogs(prev => prev.map(c => c.id === log.id ? { ...c, action_taken: 'trashed' } : c));
    try {
      await workerPost('/api/comment/delete', {
        commentId: log.comment_id,
        pageId: log.page_connection_id
      });
      toast.success('Comment deleted!');
    } catch (err: any) {
      toast.error('Failed to delete comment: ' + err.message);
      // Revert
      setCommentLogs(prev => prev.map(c => c.id === log.id ? { ...c, action_taken: log.action_taken } : c));
    }
  };

  const handleRunScheduler = async () => {
    setRunningScheduler(true);
    try {
      await workerPost('/api/scheduler/run', {});
      toast.success('Queue synchronized and processed!');
      fetchPosts();
    } catch (err: any) {
      toast.error('Failed to run scheduler sync: ' + err.message);
    } finally {
      setRunningScheduler(false);
    }
  };

  // Safe parsing for post images/videos
  const getPostMediaUrls = (post: ScheduledPost): string[] => {
    if (!post.media_urls) return [];
    if (Array.isArray(post.media_urls)) return post.media_urls;
    if (typeof post.media_urls === 'string') {
      try {
        const parsed = JSON.parse(post.media_urls);
        return Array.isArray(parsed) ? parsed : [post.media_urls];
      } catch {
        return [post.media_urls];
      }
    }
    return [];
  };

  // Filtering Logic
  const getFilteredComments = () => {
    return commentLogs.filter(c => {
      const matchPlatform = platformFilter === 'all' || c.platform === platformFilter;
      const matchPage = pageFilter === 'all' || c.page_connection_id === pageFilter;
      const matchSentiment = sentimentFilter === 'all' || c.ai_sentiment === sentimentFilter;
      
      let matchAction = true;
      if (actionFilter !== 'all') {
        if (actionFilter === 'no_action') {
          matchAction = c.action_taken === 'no_action' || !c.action_taken;
        } else {
          matchAction = c.action_taken === actionFilter;
        }
      }
      
      let matchToxicity = true;
      if (toxicityFilter !== 'all') {
        if (toxicityFilter === 'toxic') {
          matchToxicity = c.ai_toxicity_score !== null && c.ai_toxicity_score > 0.5;
        } else {
          matchToxicity = c.ai_toxicity_score === null || c.ai_toxicity_score <= 0.5;
        }
      }

      return matchPlatform && matchPage && matchSentiment && matchAction && matchToxicity;
    });
  };

  const getFilteredSessions = () => {
    return sessions.filter(s => {
      const pageInfo = pagesMap[s.page_id];
      const matchPlatform = platformFilter === 'all' || (pageInfo && pageInfo.platform === platformFilter);
      const matchPage = pageFilter === 'all' || s.page_id === pageFilter;
      return matchPlatform && matchPage;
    });
  };

  const getFilteredPosts = () => {
    return scheduledPosts.filter(p => {
      const matchPlatform = platformFilter === 'all' || p.platform === platformFilter;
      const matchPage = pageFilter === 'all' || p.page_connection_id === pageFilter;
      return matchPlatform && matchPage;
    });
  };

  // Direct URLs to Social Posts
  const getSocialPostUrl = (platform: string, postId: string): string => {
    if (!postId) return '#';
    if (platform === 'instagram') {
      return `https://instagram.com/p/${postId}`;
    }
    return `https://facebook.com/${postId}`;
  };

  const activeSession = sessions.find(s => s.id === selectedSessionId);
  const activeSessionPageInfo = activeSession ? pagesMap[activeSession.page_id] : null;

  return (
    <div className="animate-slideUp" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', gap: '20px', overflow: 'hidden' }}>
      
      {/* Dynamic Keyframe Injection for pulsator */}
      <style>{`
        @keyframes pulse {
          0% { transform: scale(0.8); opacity: 0.5; box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); }
          70% { transform: scale(1.2); opacity: 1; box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); }
          100% { transform: scale(0.8); opacity: 0.5; box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
        }
        .live-dot {
          width: 8px;
          height: 8px;
          background-color: #4ade80;
          border-radius: 50%;
          display: inline-block;
          animation: pulse 1.8s infinite ease-in-out;
        }
        .comment-log-card:hover {
          border-color: rgba(249, 115, 22, 0.3) !important;
          background: rgba(255, 255, 255, 0.02) !important;
        }
        .session-row:hover {
          background: rgba(255, 255, 255, 0.02) !important;
        }
      `}</style>

      {/* Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '16px', 
        paddingBottom: '4px',
        borderBottom: '1px solid var(--border-primary)',
        flexShrink: 0 
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>Activity Monitor</h1>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(34,197,94,0.12)', color: '#4ade80', padding: '4px 10px', borderRadius: '50px', fontSize: '0.72rem', fontWeight: '700', border: '1px solid rgba(74, 222, 128, 0.15)' }}>
              <span className="live-dot" /> LIVE MONITOR
            </div>
          </div>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Live operation console of message streams, automatic comment policies, and publishing schedules.
          </p>
        </div>
        
        {/* Global Filters */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <Filter size={14} />
            <span style={{ fontSize: '0.85rem' }}>Global Channels:</span>
          </div>
          <select 
            value={platformFilter} 
            onChange={e => setPlatformFilter(e.target.value as any)} 
            className="form-input"
            style={{ width: '130px', padding: '6px 12px', fontSize: '0.85rem' }}
          >
            <option value="all">All Channels</option>
            <option value="facebook">Facebook</option>
            <option value="instagram">Instagram</option>
          </select>
          
          <select 
            value={pageFilter} 
            onChange={e => setPageFilter(e.target.value)} 
            className="form-input"
            style={{ width: '180px', padding: '6px 12px', fontSize: '0.85rem' }}
          >
            <option value="all">All Pages</option>
            {Object.entries(pagesMap).map(([id, info]) => (
              <option key={id} value={id}>
                {info.name} ({info.platform === 'instagram' ? 'IG' : 'FB'})
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Mobile tabs */}
      {isMobile && (
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button 
            className={`btn ${activeTab === 'dms' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setActiveTab('dms')}
          >
            <MessageSquare size={16} style={{ marginRight: '8px', display: 'inline', verticalAlign: 'middle' }} />
            DMs ({getFilteredSessions().length})
          </button>
          <button 
            className={`btn ${activeTab === 'comments' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setActiveTab('comments')}
          >
            <MessageCircle size={16} style={{ marginRight: '8px', display: 'inline', verticalAlign: 'middle' }} />
            Comments ({getFilteredComments().length})
          </button>
          <button 
            className={`btn ${activeTab === 'posts' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1 }}
            onClick={() => setActiveTab('posts')}
          >
            <Calendar size={16} style={{ marginRight: '8px', display: 'inline', verticalAlign: 'middle' }} />
            Posts ({getFilteredPosts().length})
          </button>
        </div>
      )}

      {/* Main Grid Content */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1.2fr 1fr', 
        gap: '20px', 
        flex: 1, 
        minHeight: 0,
        overflow: 'hidden'
      }}>
        
        {/* ========================================================================= */}
        {/* COLUMN 1: DIRECT MESSAGES (DMs)                                           */}
        {/* ========================================================================= */}
        {(!isMobile || activeTab === 'dms') && (
          <div className="card" style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-primary)', 
            borderRadius: '12px',
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: 0,
            overflow: 'hidden'
          }}>
            
            {/* Header */}
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid var(--border-primary)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              flexShrink: 0
            }}>
              {selectedSessionId && (
                <button 
                  onClick={() => setSelectedSessionId(null)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' }}
                >
                  <ArrowLeft size={16} />
                </button>
              )}
              <h2 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={16} style={{ color: 'var(--accent-primary)' }} />
                {selectedSessionId ? 'Chat Conversation' : 'Direct Messages'}
              </h2>
            </div>

            {/* Content area */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
              {!selectedSessionId ? (
                // DM sessions list
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
                  {loadingSessions ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <Loader2 className="spin" style={{ margin: 'auto', marginBottom: '8px' }} />
                      Loading conversations...
                    </div>
                  ) : getFilteredSessions().length === 0 ? (
                    <div className="empty-state" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No active chats matching filters.
                    </div>
                  ) : (
                    getFilteredSessions().map(session => {
                      const pageInfo = pagesMap[session.page_id];
                      return (
                        <div 
                          key={session.id}
                          onClick={() => setSelectedSessionId(session.id)}
                          className="session-row"
                          style={{
                            padding: '14px 20px',
                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            background: 'transparent'
                          }}
                        >
                          {/* Avatar */}
                          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                            {session.sender_avatar ? (
                              <img src={session.sender_avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <User size={16} color="var(--text-secondary)" />
                            )}
                          </div>
                          
                          {/* Details */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                              <span style={{ fontWeight: '600', color: 'var(--text-primary)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {session.sender_name || 'Visitor'}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {timeAgo(session.last_message_at)}
                              </span>
                            </div>
                            
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              {pageInfo && (
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  {pageInfo.platform === 'instagram' ? <InstagramIcon size={12} /> : <FacebookIcon size={12} />}
                                  {pageInfo.name}
                                </span>
                              )}
                              
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginLeft: 'auto' }}>
                                {(() => {
                                  const profileKey = session.page_id + '_' + session.sender_id;
                                  const prof = profiles[profileKey];
                                  if (!prof) return null;
                                  return (
                                    <span style={{ 
                                      fontSize: '9px', 
                                      background: prof.intent_level === 'high' ? 'rgba(34,197,94,0.15)' : prof.intent_level === 'medium' ? 'rgba(234,179,8,0.15)' : 'rgba(156,163,175,0.15)',
                                      color: prof.intent_level === 'high' ? '#4ade80' : prof.intent_level === 'medium' ? '#facc15' : '#9ca3af',
                                      padding: '1px 5px', 
                                      borderRadius: '4px', 
                                      fontWeight: 'bold' 
                                    }}>
                                      AI: {prof.lead_score || 5}/10
                                    </span>
                                  );
                                })()}
                                {session.bot_paused ? (
                                  <span style={{ fontSize: '9px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>HUMAN</span>
                                ) : (
                                  <span style={{ fontSize: '9px', background: 'rgba(249, 115, 22, 0.15)', color: 'var(--accent-primary)', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>BOT</span>
                                )}
                                {session.unread_count > 0 && (
                                  <span style={{ fontSize: '9px', background: '#3b82f6', color: 'white', padding: '1px 5px', borderRadius: '50px', fontWeight: 'bold' }}>
                                    {session.unread_count}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                // Chat Conversation stream
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                  
                  {/* Info Header */}
                  <div style={{ padding: '12px 20px', background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {activeSession?.sender_name || 'Visitor'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Page: {activeSessionPageInfo?.name || 'Unknown'}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {/* Customer summary trigger */}
                      <button 
                        onClick={() => setShowSummary(!showSummary)}
                        className={`btn ${showSummary ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="AI Profile Summary"
                      >
                        <Sparkles size={12} />
                        Summary
                      </button>

                      {/* Bot switch */}
                      <button 
                        onClick={() => activeSession && handleToggleBot(activeSession)}
                        disabled={togglingBot}
                        className={`btn ${activeSession?.bot_paused ? 'btn-warning-glow' : 'btn-secondary'}`}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                      >
                        {activeSession?.bot_paused ? <Play size={12} /> : <Pause size={12} />}
                        {activeSession?.bot_paused ? 'Resume Bot' : 'Pause Bot'}
                      </button>
                    </div>
                  </div>

                  {/* AI Collapsible Profile Summary Panel */}
                  {showSummary && (
                    <div style={{ 
                      background: 'var(--bg-tertiary)', 
                      borderBottom: '1px solid var(--border-primary)',
                      padding: '16px 20px',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      flexShrink: 0,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                          <Sparkles size={12} style={{ color: 'var(--accent-primary)' }} />
                          Customer Profile Context
                        </div>
                        {selectedProfile && (
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span style={{
                              fontSize: '10px',
                              background: selectedProfile.intent_level === 'high' ? 'rgba(34,197,94,0.15)' : selectedProfile.intent_level === 'medium' ? 'rgba(234,179,8,0.15)' : 'rgba(156,163,175,0.15)',
                              color: selectedProfile.intent_level === 'high' ? '#4ade80' : selectedProfile.intent_level === 'medium' ? '#facc15' : '#9ca3af',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 'bold',
                              textTransform: 'uppercase'
                            }}>
                              {selectedProfile.intent_level || 'unknown'} intent
                            </span>
                            <span style={{
                              fontSize: '10px',
                              background: 'rgba(59,130,246,0.15)',
                              color: '#60a5fa',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: 'bold'
                            }}>
                              Score: {selectedProfile.lead_score || 5}/10
                            </span>
                          </div>
                        )}
                      </div>

                      {loadingSummary ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', padding: '4px 0' }}>
                          <Loader2 className="spin" size={12} /> Retrieving profile summary...
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {selectedProfile?.metadata && (() => {
                            const meta = typeof selectedProfile.metadata === 'string' 
                              ? JSON.parse(selectedProfile.metadata) 
                              : selectedProfile.metadata;
                            return (
                              <>
                                {meta.short_description && (
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: '600' }}>
                                    "{meta.short_description}"
                                  </div>
                                )}
                                {meta.key_inquiries && (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    <strong>Inquiries:</strong> {meta.key_inquiries}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          <div style={{ 
                            lineHeight: '1.45', 
                            wordBreak: 'break-word', 
                            color: 'var(--text-primary)',
                            background: 'var(--bg-primary)',
                            padding: '10px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-primary)',
                            marginTop: '4px'
                          }}>
                            {customerSummary}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Messages Scroll Box */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {loadingMessages ? (
                      <div style={{ margin: 'auto', color: 'var(--text-secondary)' }}><Loader2 className="spin" /></div>
                    ) : chatMessages.length === 0 ? (
                      <div style={{ margin: 'auto', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No messages in this chat.</div>
                    ) : (
                      chatMessages.map(msg => {
                        const isUser = msg.role === 'user';
                        return (
                          <div 
                            key={msg.id} 
                            style={{ 
                              alignSelf: isUser ? 'flex-start' : 'flex-end',
                              maxWidth: '80%',
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: isUser ? 'flex-start' : 'flex-end'
                            }}
                          >
                            <div style={{
                              background: isUser ? '#1c1c1e' : 'var(--accent-primary)',
                              color: 'white',
                              padding: '10px 14px',
                              borderRadius: isUser ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                              fontSize: '0.85rem',
                              lineHeight: '1.4',
                              wordBreak: 'break-word',
                              border: isUser ? '1px solid rgba(255,255,255,0.05)' : 'none'
                            }}>
                              {msg.content}
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px', padding: '0 4px' }}>
                              {msg.role === 'human_agent' && 'Agent • '}
                              {msg.role === 'assistant' && 'Bot • '}
                              {timeAgo(msg.created_at)}
                            </span>
                          </div>
                        );
                      })
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Chat Input */}
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-primary)', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                    <input 
                      type="text" 
                      placeholder="Type a message..."
                      value={chatReplyText}
                      onChange={e => setChatReplyText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleSendChatMessage()}
                      className="form-input"
                      style={{ flex: 1, borderRadius: '20px', padding: '8px 16px', fontSize: '0.85rem' }}
                      disabled={sendingChat}
                    />
                    <button 
                      onClick={handleSendChatMessage}
                      disabled={sendingChat || !chatReplyText.trim()}
                      className="btn btn-primary"
                      style={{ width: '36px', height: '36px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                    >
                      {sendingChat ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                    </button>
                  </div>

                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* COLUMN 2: COMMENT ACTIVITY LOG (CENTER)                                   */}
        {/* ========================================================================= */}
        {(!isMobile || activeTab === 'comments') && (
          <div className="card" style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-primary)', 
            borderRadius: '12px',
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: 0,
            overflow: 'hidden'
          }}>
            
            {/* Header */}
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid var(--border-primary)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexShrink: 0
            }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageCircle size={16} style={{ color: 'var(--accent-primary)' }} />
                Comment Activity Log
              </h2>
              <span className="badge badge-info" style={{ fontSize: '0.75rem' }}>
                {getFilteredComments().length} Logs
              </span>
            </div>

            {/* Sentiment Analysis Panel */}
            <div style={{ padding: '10px 12px 0', flexShrink: 0 }}>
              <ActivityMonitorSentimentPanel
                pages={pagesList}
              />
            </div>

            {/* Comment sub filters */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)', 
              gap: '8px', 
              padding: '10px 12px', 
              background: 'var(--bg-tertiary)', 
              borderBottom: '1px solid var(--border-primary)', 
              flexShrink: 0 
            }}>
              <select 
                value={sentimentFilter} 
                onChange={e => setSentimentFilter(e.target.value)} 
                className="form-input" 
                style={{ padding: '4px 8px', fontSize: '0.75rem', height: '30px' }}
              >
                <option value="all">All Sentiments</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>

              <select 
                value={actionFilter} 
                onChange={e => setActionFilter(e.target.value)} 
                className="form-input" 
                style={{ padding: '4px 8px', fontSize: '0.75rem', height: '30px' }}
              >
                <option value="all">All Actions</option>
                <option value="replied">Replied Only</option>
                <option value="hidden">Hidden Only</option>
                <option value="trashed">Deleted Only</option>
                <option value="no_action">No Action Only</option>
              </select>

              <select 
                value={toxicityFilter} 
                onChange={e => setToxicityFilter(e.target.value)} 
                className="form-input" 
                style={{ padding: '4px 8px', fontSize: '0.75rem', height: '30px' }}
              >
                <option value="all">All Safety</option>
                <option value="toxic">Toxic Only</option>
                <option value="safe">Safe Only</option>
              </select>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {loadingComments ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Loader2 className="spin" style={{ margin: 'auto', marginBottom: '8px' }} />
                  Loading comment logs...
                </div>
              ) : getFilteredComments().length === 0 ? (
                <div className="empty-state" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No comment activity matches the current filters.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {getFilteredComments().map(log => {
                    const pageInfo = pagesMap[log.page_connection_id];
                    return (
                      <div 
                        key={log.id}
                        onClick={() => setReplyingComment(log)}
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: '8px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                          transition: 'all 0.2s',
                          position: 'relative',
                          cursor: 'pointer',
                        }}
                        className="comment-log-card"
                      >
                        {/* Card Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <User size={14} color="var(--text-secondary)" />
                            </div>
                            <div>
                              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                                {log.user_name || 'Anonymous User'}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                                {log.platform === 'instagram' ? <InstagramIcon size={10} /> : <FacebookIcon size={10} />}
                                {pageInfo?.name || 'Platform'} • {timeAgo(log.created_at)}
                              </div>
                            </div>
                          </div>

                          {/* Action badges */}
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {/* AI Customer Score badge */}
                            {(() => {
                              const profileKey = log.page_connection_id + '_' + log.sender_id;
                              const prof = profiles[profileKey];
                              if (!prof) return null;
                              return (
                                <span style={{ 
                                  fontSize: '9px', 
                                  background: prof.intent_level === 'high' ? 'rgba(34,197,94,0.15)' : prof.intent_level === 'medium' ? 'rgba(234,179,8,0.15)' : 'rgba(156,163,175,0.15)',
                                  color: prof.intent_level === 'high' ? '#4ade80' : prof.intent_level === 'medium' ? '#facc15' : '#9ca3af',
                                  padding: '1px 5px', 
                                  borderRadius: '4px', 
                                  fontWeight: 'bold' 
                                }} title={`AI Customer Score: ${prof.lead_score}/10`}>
                                  AI: {prof.lead_score || 5}/10
                                </span>
                              );
                            })()}
                            {/* Sentiment badge — only shown when analysis is on or a result already exists */}
                            {analysisEnabled && log.ai_sentiment ? (
                              <span className={`badge ${
                                log.ai_sentiment === 'positive' ? 'badge-success' :
                                log.ai_sentiment === 'negative' ? 'badge-error' : 'badge-warning'
                              }`} style={{ fontSize: '9px', textTransform: 'capitalize', padding: '1px 5px' }}>
                                {log.ai_sentiment}
                              </span>
                            ) : !analysisEnabled ? (
                              <span style={{ fontSize: '8px', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)', padding: '1px 5px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)' }}>
                                no analysis
                              </span>
                            ) : null}
                            {/* Toxicity warning — only when analysis on */}
                            {analysisEnabled && log.ai_toxicity_score !== null && log.ai_toxicity_score > 0.5 && (
                              <span className="badge badge-error" style={{ fontSize: '9px', display: 'flex', alignItems: 'center', gap: '2px', padding: '1px 5px' }} title={`Toxicity Score: ${(log.ai_toxicity_score * 100).toFixed(0)}%`}>
                                <AlertTriangle size={10} /> Toxic
                              </span>
                            )}
                            {/* Credits indicator */}
                            {log.credits_deducted !== null && log.credits_deducted > 0 && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)', fontSize: '8px', padding: '1px 4px', borderRadius: '4px' }}>
                                <Coins size={8} /> -{log.credits_deducted}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Comment Content */}
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', background: 'var(--bg-primary)', padding: '10px 12px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.02)', wordBreak: 'break-word' }}>
                          {log.user_message}
                        </div>

                        {/* Actions bar */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', paddingTop: '4px' }}>
                          
                          {/* Badges */}
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {log.action_taken === 'replied' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: log.reply_source === 'manual' ? 'rgba(59,130,246,0.15)' : 'rgba(34, 197, 94, 0.15)', color: log.reply_source === 'manual' ? '#60a5fa' : '#4ade80', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: '500' }}>
                                <CheckCircle size={12} /> {log.reply_source === 'manual' ? 'Manually Replied' : 'Auto Replied'}
                              </span>
                            )}
                            {log.action_taken === 'hidden' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(234, 179, 8, 0.15)', color: '#facc15', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: '500' }}>
                                <EyeOff size={12} /> Comment Hidden
                              </span>
                            )}
                            {log.action_taken === 'trashed' && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: '500' }}>
                                <Trash2 size={12} /> Comment Deleted
                              </span>
                            )}
                            {(log.action_taken === 'no_action' || !log.action_taken) && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: '500' }}>
                                <Clock size={12} /> No Action
                              </span>
                            )}
                            {log.dm_sent_id && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', fontSize: '11px', padding: '3px 8px', borderRadius: '4px', fontWeight: '500' }}>
                                <MessageSquare size={12} /> DM Sent
                              </span>
                            )}
                          </div>

                          {/* Quick Manual Actions */}
                          <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
                            <button 
                              onClick={e => { e.stopPropagation(); handleLikeComment(log); }}
                              className="btn btn-secondary"
                              style={{ padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}
                              title="Like Comment"
                            >
                              <ThumbsUp size={12} />
                            </button>
                            
                            {log.action_taken !== 'hidden' && (
                              <button 
                                onClick={e => { e.stopPropagation(); handleHideComment(log); }}
                                className="btn btn-secondary"
                                style={{ padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}
                                title="Hide Comment"
                              >
                                <EyeOff size={12} />
                              </button>
                            )}

                            {log.action_taken !== 'trashed' && (
                              <button 
                                onClick={e => { e.stopPropagation(); handleDeleteComment(log); }}
                                className="btn btn-secondary"
                                style={{ padding: '6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--error)' }}
                                title="Delete Comment"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}

                            {/* View on platform — prominently labeled */}
                            {log.post_id && (
                              <a 
                                href={getSocialPostUrl(log.platform, log.post_id)} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                onClick={e => e.stopPropagation()}
                                className="btn btn-secondary"
                                style={{ 
                                  padding: '5px 10px', 
                                  borderRadius: '6px', 
                                  border: '1px solid rgba(255,255,255,0.06)', 
                                  display: 'inline-flex', 
                                  alignItems: 'center',
                                  gap: '5px',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  color: 'var(--text-secondary)'
                                }}
                                title="Open original post on platform"
                              >
                                <ExternalLink size={11} />
                                View Post
                              </a>
                            )}

                            <button 
                              className="btn btn-secondary"
                              onClick={e => { e.stopPropagation(); setReplyingComment(log); }}
                              style={{ 
                                padding: '5px 12px', 
                                fontSize: '0.75rem', 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '6px',
                                borderRadius: '6px',
                                border: '1px solid rgba(255,255,255,0.06)'
                              }}
                            >
                              <Send size={12} />
                              Reply
                            </button>
                          </div>

                        </div>

                        {/* Reply message preview nested */}
                        {log.action_taken === 'replied' && log.reply_message && (
                          <div style={{ 
                            background: 'rgba(255,255,255,0.01)', 
                            borderLeft: '2px solid var(--accent-primary)',
                            padding: '8px 12px',
                            borderRadius: '0 6px 6px 0',
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            display: 'flex',
                            gap: '8px',
                            alignItems: 'flex-start',
                            marginTop: '2px'
                          }}>
                            <CornerDownRight size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                            <div style={{ wordBreak: 'break-word' }}>
                              <strong style={{ color: 'var(--text-primary)', fontSize: '0.75rem', display: 'block', marginBottom: '2px' }}>{log.reply_source === 'manual' ? 'Manual Reply:' : 'AI Reply sent:'}</strong>
                              {log.reply_message}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* COLUMN 3: CONTENT PLANNER & POSTS (RIGHT)                                 */}
        {/* ========================================================================= */}
        {(!isMobile || activeTab === 'posts') && (
          <div className="card" style={{ 
            background: 'var(--bg-secondary)', 
            border: '1px solid var(--border-primary)', 
            borderRadius: '12px',
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: 0,
            overflow: 'hidden'
          }}>
            
            {/* Header */}
            <div style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid var(--border-primary)', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              flexShrink: 0
            }}>
              <h2 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} style={{ color: 'var(--accent-primary)' }} />
                Scheduled Content
              </h2>
              
              {/* Sync trigger button */}
              <button 
                onClick={handleRunScheduler}
                disabled={runningScheduler}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Sync and process schedule queues"
              >
                <RefreshCw size={12} className={runningScheduler ? 'spin' : ''} />
                Sync Queue
              </button>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {loadingPosts ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  <Loader2 className="spin" style={{ margin: 'auto', marginBottom: '8px' }} />
                  Loading queue...
                </div>
              ) : getFilteredPosts().length === 0 ? (
                <div className="empty-state" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No posts in the scheduler queue.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {getFilteredPosts().map(post => {
                    const pageInfo = pagesMap[post.page_connection_id];
                    const mediaList = getPostMediaUrls(post);
                    
                    return (
                      <div 
                        key={post.id} 
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border-primary)',
                          borderRadius: '8px',
                          padding: '14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        {/* Post Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {post.platform === 'instagram' ? <InstagramIcon size={12} /> : <FacebookIcon size={12} />}
                            {pageInfo?.name || 'Platform'}
                          </span>
                          
                          {/* Status Badge */}
                          <span className={`badge ${
                            post.status === 'published' ? 'badge-success' :
                            post.status === 'failed' ? 'badge-error' :
                            post.status === 'uploading' ? 'badge-warning' : 'badge-info'
                          }`} style={{ fontSize: '9px', padding: '1px 5px', textTransform: 'uppercase' }}>
                            {post.status}
                          </span>
                        </div>

                        {/* Post Content preview */}
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', wordBreak: 'break-word', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {post.message || '[No text]'}
                        </div>

                        {/* Media preview thumbnails */}
                        {mediaList.length > 0 && (
                          <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '2px 0' }}>
                            {mediaList.map((url, i) => (
                              <div 
                                key={i} 
                                style={{ 
                                  width: '45px', 
                                  height: '45px', 
                                  borderRadius: '4px', 
                                  overflow: 'hidden', 
                                  background: 'var(--bg-secondary)', 
                                  border: '1px solid var(--border-primary)', 
                                  flexShrink: 0 
                                }}
                              >
                                <img src={url} alt="Media thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => {
                                  // Fallback if media is a video or inaccessible
                                  (e.target as HTMLElement).style.display = 'none';
                                }} />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Failure reason */}
                        {post.status === 'failed' && post.error_message && (
                          <div style={{ fontSize: '0.75rem', color: '#f87171', background: 'rgba(239, 68, 68, 0.05)', padding: '6px 10px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.15)', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                            <AlertCircle size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                            <div>{post.error_message}</div>
                          </div>
                        )}

                        {/* Footer Time info */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', paddingTop: '2px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} />
                            {post.status === 'published' ? 'Published' : 'Scheduled'}:
                          </span>
                          <span style={{ fontWeight: '500' }}>
                            {new Date(post.scheduled_time).toLocaleString(undefined, { 
                              month: 'short', 
                              day: 'numeric', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* ========================================================================= */}
      {/* MANUAL COMMENT REPLY MODAL                                                */}
      {/* ========================================================================= */}
      {replyingComment && (
        <div className="modal-overlay" style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          backdropFilter: 'blur(4px)'
        }}>
          <div className="modal" style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '500px',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column'
          }}>
            
            {/* Modal Header */}
            <div className="modal-header" style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-primary)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                Reply to {replyingComment.user_name}
              </h3>
              <button 
                className="btn-ghost btn-icon" 
                onClick={() => setReplyingComment(null)}
                style={{ padding: '4px' }}
              >
                <XCircle size={18} color="var(--text-secondary)" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Comment context:
              </div>
              <div style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '0.85rem',
                color: 'var(--text-primary)',
                maxHeight: '120px',
                overflowY: 'auto'
              }}>
                <strong>{replyingComment.user_name}:</strong> {replyingComment.user_message}
              </div>
              
              {/* Commenter AI Profile Context */}
              {(() => {
                const profileKey = replyingComment.page_connection_id + '_' + replyingComment.sender_id;
                const prof = profiles[profileKey];
                if (!prof) return null;
                const meta = typeof prof.metadata === 'string' ? JSON.parse(prof.metadata) : prof.metadata || {};
                return (
                  <div style={{
                    background: 'rgba(59,130,246,0.05)',
                    border: '1px solid rgba(59,130,246,0.15)',
                    borderRadius: '8px',
                    padding: '12px',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Sparkles size={12} style={{ color: 'var(--accent-primary)' }} />
                        AI Customer Profile Context
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <span style={{
                          fontSize: '9px',
                          background: prof.intent_level === 'high' ? 'rgba(34,197,94,0.15)' : prof.intent_level === 'medium' ? 'rgba(234,179,8,0.15)' : 'rgba(156,163,175,0.15)',
                          color: prof.intent_level === 'high' ? '#4ade80' : prof.intent_level === 'medium' ? '#facc15' : '#9ca3af',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}>
                          {prof.intent_level || 'warm'}
                        </span>
                        <span style={{
                          fontSize: '9px',
                          background: 'rgba(59,130,246,0.15)',
                          color: '#60a5fa',
                          padding: '1px 4px',
                          borderRadius: '3px',
                          fontWeight: 'bold'
                        }}>
                          Score: {prof.lead_score ?? (prof.intent_level === 'high' ? 8 : prof.intent_level === 'low' ? 2 : 5)}/10
                        </span>
                      </div>
                    </div>
                    {meta.short_description && (
                      <div style={{ fontStyle: 'italic', color: 'var(--text-primary)', fontWeight: '600' }}>
                        "{meta.short_description}"
                      </div>
                    )}
                    {meta.key_inquiries && (
                      <div>
                        <strong>Inquiries:</strong> {meta.key_inquiries}
                      </div>
                    )}
                    {prof.summary && (
                      <div style={{ 
                        fontSize: '0.75rem', 
                        lineHeight: '1.45', 
                        color: 'var(--text-primary)', 
                        background: 'var(--bg-primary)', 
                        padding: '8px 10px', 
                        borderRadius: '4px',
                        border: '1px solid var(--border-primary)',
                        maxHeight: '100px',
                        overflowY: 'auto'
                      }}>
                        {prof.summary}
                      </div>
                    )}
                  </div>
                );
              })()}
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Write Reply:</label>
                <textarea 
                  value={commentReplyText}
                  onChange={e => setCommentReplyText(e.target.value)}
                  className="form-input"
                  placeholder="Type your comment reply..."
                  rows={4}
                  style={{ width: '100%', resize: 'vertical', fontSize: '0.85rem', padding: '10px 12px' }}
                  disabled={sendingCommentReply}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="modal-footer" style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-primary)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              background: 'var(--bg-tertiary)'
            }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setReplyingComment(null)}
                disabled={sendingCommentReply}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleSendCommentReply}
                disabled={sendingCommentReply || !commentReplyText.trim()}
                style={{ 
                  padding: '8px 16px', 
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {sendingCommentReply ? (
                  <>
                    <Loader2 className="spin" size={14} />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    Send Reply
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
