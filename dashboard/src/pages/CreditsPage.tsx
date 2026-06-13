import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { 
  Zap, 
  Coins, 
  Cpu, 
  MessageSquare, 
  Bot, 
  History, 
  Calendar, 
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Info,
  Layers,
  Sparkles,
  Plus,
  Edit3,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Eye,
  BookOpen,
  FileText
} from 'lucide-react';

const FacebookIcon = ({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill={color} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon = ({ size = 12, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={size} height={size} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

interface LedgerItem {
  id: string;
  timestamp: string;
  type: 'addition' | 'deduction';
  amount: number;
  description: string;
  platform: 'facebook' | 'instagram' | 'whatsapp' | 'agent' | 'admin';
  category: 'comment' | 'dm' | 'agent_query' | 'image_gen' | 'purchase' | 'gift';
}

export default function CreditsPage() {
  useDocumentTitle('AI Credits & Analytics — AutometaBot');
  const { user, profile, refreshCreditBalance } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<any[]>([]);
  const [commentLogs, setCommentLogs] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  
  // Filters
  const [filterType, setFilterType] = useState<'all' | 'additions' | 'deductions'>('all');
  const [filterPlatform, setFilterPlatform] = useState<'all' | 'facebook' | 'instagram' | 'whatsapp' | 'agent' | 'admin'>('all');
  const [filterCategory, setFilterCategory] = useState<'all' | 'comment' | 'dm' | 'agent_query' | 'image_gen' | 'purchase' | 'gift'>('all');
  const [filterDate, setFilterDate] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Daily cap inline editing
  const [editingDailyCap, setEditingDailyCap] = useState(false);
  const [dailyCapInput, setDailyCapInput] = useState('');
  const [savingDailyCap, setSavingDailyCap] = useState(false);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    
    loadAllCreditsData();

    // Subscribe to database changes in real-time so that credit ledger/logs update instantly
    const channel = supabase.channel(`credits-page-realtime-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_logs', filter: `user_id=eq.${user.id}` }, () => {
        loadAllCreditsData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `user_id=eq.${user.id}` }, () => {
        loadAllCreditsData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs', filter: `user_id=eq.${user.id}` }, () => {
        loadAllCreditsData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases', filter: `user_id=eq.${user.id}` }, () => {
        loadAllCreditsData();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [user]);

  async function loadAllCreditsData() {
    try {
      setLoading(true);

      // 1. Fetch channel connections to map pageIds to platforms in memory
      const { data: pageConns, error: connErr } = await supabase
        .from('page_connections')
        .select('page_id, page_name, whatsapp_phone_number_id, instagram_account_id')
        .eq('user_id', user?.id);

      if (connErr) throw connErr;
      setConnections(pageConns || []);

      // 2. Fetch Comment Logs with credit deductions
      const { data: commLogs, error: commErr } = await supabase
        .from('comment_logs')
        .select('id, platform, credits_deducted, action_taken, user_message, created_at')
        .eq('user_id', user?.id)
        .gt('credits_deducted', 0)
        .order('created_at', { ascending: false })
        .limit(150);

      if (commErr) throw commErr;
      setCommentLogs(commLogs || []);

      // 3. Fetch Assistant Chat Messages with credit deductions
      const { data: chatMsgs, error: chatErr } = await supabase
        .from('chat_messages')
        .select('id, created_at, content, metadata, chat_sessions(page_id)')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(150);

      if (chatErr) throw chatErr;
      setChatMessages(chatMsgs || []);

      // 4. Fetch Agent tool audit logs
      const { data: audLogs, error: audErr } = await supabase
        .from('audit_logs')
        .select('id, action_type, description, created_at')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (audErr) throw audErr;
      setAuditLogs(audLogs || []);

      // 5. Fetch Purchases/Gifts history (Approved)
      const { data: purchLogs, error: purchErr } = await supabase
        .from('purchases')
        .select('id, message_addon, total_amount, payment_method, status, created_at')
        .eq('user_id', user?.id)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });

      if (purchErr) throw purchErr;
      setPurchases(purchLogs || []);

    } catch (err: any) {
      toast.error('Failed to load credit logs: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveDailyCap() {
    const val = parseInt(dailyCapInput, 10);
    if (isNaN(val) || val < 10 || val > 1000000) {
      toast.error('Daily cap must be between 10 and 1,000,000 credits.');
      return;
    }
    setSavingDailyCap(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ daily_credit_spend_cap: val })
        .eq('id', user?.id);
      if (error) throw error;
      await refreshCreditBalance();
      toast.success(`Daily cap updated to ${val} credits/day.`);
      setEditingDailyCap(false);
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    } finally {
      setSavingDailyCap(false);
    }
  }

  async function handleToggleFeature(featureKey: string) {
    if (!profile || !user?.id) return;
    
    const isAdminLocked = profile[featureKey as keyof typeof profile] === false;
    if (isAdminLocked) return;

    const currentSettings = profile.settings || {};
    const currentDisabled = Array.isArray(currentSettings.disabled_features) 
      ? currentSettings.disabled_features 
      : [];

    let newDisabled: string[];
    if (currentDisabled.includes(featureKey)) {
      newDisabled = currentDisabled.filter((k: string) => k !== featureKey);
    } else {
      newDisabled = [...currentDisabled, featureKey];
    }

    const newSettings = {
      ...currentSettings,
      disabled_features: newDisabled,
    };

    try {
      const { error } = await supabase
        .from('users')
        .update({ settings: newSettings })
        .eq('id', user.id);

      if (error) throw error;
      toast.success(`Feature ${currentDisabled.includes(featureKey) ? 'enabled' : 'disabled'} successfully.`);
    } catch (err: any) {
      console.error('Failed to toggle feature:', err);
      toast.error('Failed to toggle feature: ' + err.message);
    }
  }

  // Map Page Connections in memory for O(1) platform lookup
  const connectionsMap = useMemo(() => {
    const map = new Map<string, { name: string; platform: 'facebook' | 'instagram' | 'whatsapp' }>();
    connections.forEach(conn => {
      let plat: 'facebook' | 'instagram' | 'whatsapp' = 'facebook';
      if (conn.whatsapp_phone_number_id) plat = 'whatsapp';
      else if (conn.instagram_account_id) plat = 'instagram';
      map.set(conn.page_id, { name: conn.page_name || 'Connected Channel', platform: plat });
    });
    return map;
  }, [connections]);

  // Construct and Merge the Chronological Ledger
  const ledger = useMemo((): LedgerItem[] => {
    const list: LedgerItem[] = [];

    // Refills and Gifts (Additions and Deductions)
    purchases.forEach(p => {
      // Parse credits amount from message_addon (e.g. "Gift: +100 Credits" or "Admin Adjustment: -50 Credits")
      let creditsGained = 0;
      let isDeduction = false;
      
      const match = p.message_addon?.match(/Credits?:?\s*([+-]?\d+)/i) || p.message_addon?.match(/([+-]?\d+)\s*Credits?/i);
      if (match) {
        const val = parseInt(match[1], 10);
        creditsGained = Math.abs(val);
        isDeduction = val < 0;
      } else if (p.message_addon === '+500') {
        creditsGained = 500;
      } else if (p.message_addon === '+1000') {
        creditsGained = 1000;
      } else if (p.payment_method === 'gift') {
        // Fallback for gifts
        creditsGained = 100;
      } else {
        creditsGained = (p.channels_count || 1) * 300; // fallback default
      }

      list.push({
        id: p.id,
        timestamp: p.created_at,
        type: isDeduction ? 'deduction' : 'addition',
        amount: creditsGained,
        description: p.payment_method === 'admin_adjustment'
          ? `Admin Adjustment: ${p.message_addon}`
          : p.payment_method === 'gift' 
          ? `Gifting: ${p.message_addon || 'AI Credits gifted by administrator'}`
          : `Refill: Purchased channel addon package (${p.message_addon || 'AI Credits'})`,
        platform: 'admin',
        category: p.payment_method === 'gift' ? 'gift' : 'purchase'
      });
    });

    // Comments deductions
    commentLogs.forEach(c => {
      list.push({
        id: c.id,
        timestamp: c.created_at,
        type: 'deduction',
        amount: c.credits_deducted || 1,
        description: `Auto-moderation action taken: ${c.action_taken === 'replied' ? 'Replied to' : c.action_taken === 'hidden' ? 'Hidden' : 'Processed'} comment: "${c.user_message ? c.user_message.substring(0, 45) + (c.user_message.length > 45 ? '...' : '') : 'Inbound comment'}"`,
        platform: c.platform === 'instagram' ? 'instagram' : 'facebook',
        category: 'comment'
      });
    });

    // Chat DM deductions
    chatMessages.forEach(m => {
      const credits = parseInt(m.metadata?.credits_deducted || '0', 10);
      if (credits > 0) {
        const pageId = m.chat_sessions?.page_id;
        const conn = pageId ? connectionsMap.get(pageId) : null;
        let plat: 'facebook' | 'instagram' | 'whatsapp' | 'agent' = 'agent';
        let desc = 'System Assistant DM interaction';

        if (conn) {
          plat = conn.platform;
          desc = `AI Autopilot reply sent on ${conn.name}`;
        }

        list.push({
          id: m.id,
          timestamp: m.created_at,
          type: 'deduction',
          amount: credits,
          description: `${desc}: "${m.content ? m.content.substring(0, 45) + (m.content.length > 45 ? '...' : '') : 'AI Response'}"`,
          platform: plat,
          category: 'dm'
        });
      }
    });

    // Agent Tools & Weekly Planner deductions (Audit Logs)
    auditLogs.forEach(a => {
      let credits = 5; // default agent query cost
      let cat: 'agent_query' | 'image_gen' = 'agent_query';
      if (a.action_type === 'generate_image' || a.action_type === 'weekly_planner') {
        credits = 15;
        cat = 'image_gen';
      }

      list.push({
        id: a.id,
        timestamp: a.created_at,
        type: 'deduction',
        amount: credits,
        description: `Agent Action [${a.action_type}]: ${a.description || 'Processed agent instructions.'}`,
        platform: 'agent',
        category: cat
      });
    });

    // Sort chronologically descending
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [purchases, commentLogs, chatMessages, auditLogs, connectionsMap]);

  // Aggregate stats based on ALL data
  const aggregatedStats = useMemo(() => {
    let facebookComments = 0;
    let instagramComments = 0;
    let facebookDMs = 0;
    let instagramDMs = 0;
    let whatsappDMs = 0;
    
    let totalDms = 0;
    let totalVision = 0;
    let totalAgents = 0;
    let totalImages = 0;
    let totalComments = 0;
    let totalGained = 0;

    ledger.forEach(item => {
      if (item.type === 'addition') {
        totalGained += item.amount;
      } else {
        // Platform count
        if (item.platform === 'facebook' && item.category === 'comment') facebookComments += item.amount;
        else if (item.platform === 'instagram' && item.category === 'comment') instagramComments += item.amount;
        else if (item.platform === 'facebook' && item.category === 'dm') facebookDMs += item.amount;
        else if (item.platform === 'instagram' && item.category === 'dm') instagramDMs += item.amount;
        else if (item.platform === 'whatsapp') whatsappDMs += item.amount;

        // Feature cost categorization
        if (item.category === 'comment') {
          totalComments += item.amount;
        } else if (item.category === 'dm') {
          if (item.amount === 5) totalVision += item.amount;
          else totalDms += item.amount;
        } else if (item.category === 'agent_query') {
          totalAgents += item.amount;
        } else if (item.category === 'image_gen') {
          totalImages += item.amount;
        }
      }
    });

    const totalDeducted = facebookComments + instagramComments + facebookDMs + instagramDMs + whatsappDMs + totalAgents + totalImages;

    return {
      facebookComments,
      instagramComments,
      facebookDMs,
      instagramDMs,
      whatsappDMs,
      agentDeductions: totalAgents,
      imageDeductions: totalImages,
      
      totalDms,
      totalVision,
      totalAgents,
      totalImages,
      totalComments,
      totalDeducted,
      totalGained
    };
  }, [ledger]);

  // Calculate current limits
  const totalLimit = (profile?.monthly_credits_limit ?? 0) + (profile?.extra_credits_balance ?? 0);
  const creditsUsed = profile?.credits_used_this_month ?? 0;
  const remaining = Math.max(0, totalLimit - creditsUsed);
  const creditsPct = totalLimit > 0 ? (remaining / totalLimit) * 100 : 0;
  
  const isExhausted = remaining === 0;
  const isLow = !isExhausted && creditsPct <= 20;

  // Calculate usage breakdown trends (daily, weekly, monthly)
  const usageBreakdown = useMemo(() => {
    let daily = 0;
    let weekly = 0;
    
    const now = new Date().getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const sevenDaysMs = 7 * oneDayMs;

    ledger.forEach(item => {
      if (item.type === 'deduction') {
        const itemTime = new Date(item.timestamp).getTime();
        const diff = now - itemTime;
        if (diff <= oneDayMs) {
          daily += item.amount;
        }
        if (diff <= sevenDaysMs) {
          weekly += item.amount;
        }
      }
    });

    return {
      daily,
      weekly,
      monthly: creditsUsed,
    };
  }, [ledger, creditsUsed]);

  const ITEMS_PER_PAGE = 30;

  // Filtered Ledger list (category + date + platform + type + search)
  const filteredLedger = useMemo(() => {
    const now = new Date();
    return ledger.filter(item => {
      if (filterType === 'additions' && item.type !== 'addition') return false;
      if (filterType === 'deductions' && item.type !== 'deduction') return false;
      if (filterPlatform !== 'all' && item.platform !== filterPlatform) return false;
      if (filterCategory !== 'all' && item.category !== filterCategory) return false;

      if (filterDate !== 'all') {
        const itemDate = new Date(item.timestamp);
        if (filterDate === 'today') {
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          if (itemDate < todayStart) return false;
        } else if (filterDate === 'week') {
          const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (itemDate < weekStart) return false;
        } else if (filterDate === 'month') {
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          if (itemDate < monthStart) return false;
        }
      }

      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase();
        return (
          item.description.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [ledger, filterType, filterPlatform, filterCategory, filterDate, searchTerm]);

  // Paginated slice — always computed from filtered list
  const totalPages = Math.max(1, Math.ceil(filteredLedger.length / ITEMS_PER_PAGE));
  const paginatedLedger = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLedger.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLedger, currentPage]);

  // Reset page to 1 whenever any filter changes
  useEffect(() => { setCurrentPage(1); }, [filterType, filterPlatform, filterCategory, filterDate, searchTerm]);

  // Format cycle date
  const resetDateString = useMemo(() => {
    if (profile?.billing_cycle_anchor) {
      const anchor = new Date(profile.billing_cycle_anchor);
      const nextMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, anchor.getDate());
      return nextMonth.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    }
    // Fallback to 30 days from now
    const nextMonth = new Date();
    nextMonth.setDate(nextMonth.getDate() + 30);
    return nextMonth.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
  }, [profile]);

  const features = [
    {
      key: 'allow_chat',
      label: 'Chat replies / DMs',
      desc: 'Instant auto-replies on Messenger, IG & WhatsApp',
      icon: MessageSquare,
    },
    {
      key: 'allow_comment_analysis',
      label: 'Comments Auto replies',
      desc: 'Automatic scanning and replies to post comments',
      icon: Zap,
    },
    {
      key: 'allow_vision',
      label: 'Vision image recognition',
      desc: 'AI understanding of user photo attachments',
      icon: Eye,
    },
    {
      key: 'allow_image_gen',
      label: 'Image generation model',
      desc: 'Creating visual content and post planner assets',
      icon: Sparkles,
    },
    {
      key: 'allow_embeddings',
      label: 'Vector embeddings & RAG',
      desc: 'Retrieving context from uploaded files',
      icon: BookOpen,
    },
    {
      key: 'allow_agent',
      label: 'Autopilot agent tasks',
      desc: 'Executing complex background planning routines',
      icon: Cpu,
    },
    {
      key: 'allow_summarization',
      label: 'Session summarization',
      desc: 'Automatic customer profile & inbox summaries',
      icon: FileText,
    },
    {
      key: 'allow_content',
      label: 'Content creation',
      desc: 'Generating text copy and scheduled calendar posts',
      icon: Sparkles,
    },
  ].map(f => {
    const isAdminLocked = profile ? profile[f.key as keyof typeof profile] === false : false;
    const isUserDisabled = profile?.settings?.disabled_features?.includes(f.key) ?? false;
    return {
      ...f,
      isAdminLocked,
      isUserDisabled,
      active: !isAdminLocked && !isUserDisabled,
    };
  });

  return (
    <div className="animate-slideUp" style={{ paddingBottom: '60px' }}>
      
      {/* Header */}
      <div className="page-header flex justify-between items-start flex-mobile-col gap-16" style={{ marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={28} className="text-warning" style={{ color: '#f59e0b', fill: '#f59e0b' }} /> 
            AI Credits & Analytics
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Track token economics, monitor cross-channel usage, and analyze costs in real-time.
          </p>
        </div>
        <button 
          onClick={() => navigate('/store')} 
          className="btn btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '50px' }}
        >
          <Coins size={16} /> Refill Credits
        </button>
      </div>

      {/* Credit Status Warnings */}
      {isExhausted && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid var(--error)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          marginBottom: '24px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center'
        }}>
          <div style={{ background: 'var(--error)', padding: '10px', borderRadius: '50%', color: 'white', display: 'flex' }}>
            <AlertTriangle size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, color: 'var(--error)', fontWeight: 700, fontSize: '15px' }}>Deductions Blocked: Credits Exhausted</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              All AI response automations, planning tools, and comment analyses have been temporarily paused. Please buy additional credits to restore instant responses.
            </p>
          </div>
          <button onClick={() => navigate('/store')} className="btn btn-danger" style={{ background: 'var(--error)', border: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Refill Now <ArrowRight size={14} />
          </button>
        </div>
      )}

      {isLow && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid var(--warning)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
          marginBottom: '24px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center'
        }}>
          <div style={{ background: 'var(--warning)', padding: '10px', borderRadius: '50%', color: 'black', display: 'flex' }}>
            <AlertTriangle size={24} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, color: 'var(--warning)', fontWeight: 700, fontSize: '15px' }}>Credits Running Low ({creditsPct.toFixed(0)}% Left)</h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              You have only {remaining.toLocaleString()} credits left. Refill soon to prevent automatic pause of your Messenger, Instagram, and WhatsApp bots.
            </p>
          </div>
          <button onClick={() => navigate('/store')} className="btn btn-secondary" style={{ borderColor: 'var(--warning)', color: 'var(--warning)', background: 'rgba(245,158,11,0.08)' }}>
            Buy Credits
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Core Quotas Cards Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          
          {/* Main Visual balance Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '180px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, right: 0, width: '150px', height: '150px', background: 'radial-gradient(circle, var(--accent-primary-glow) 0%, transparent 70%)', opacity: 0.5, pointerEvents: 'none' }}></div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CURRENT BALANCE</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ 
                    fontSize: '0.7rem', 
                    fontWeight: 700, 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    background: isExhausted ? 'var(--error-bg)' : isLow ? 'var(--warning-bg)' : 'rgba(34,197,94,0.1)',
                    color: isExhausted ? 'var(--error)' : isLow ? 'var(--warning)' : 'var(--success)'
                  }}>
                    {isExhausted ? 'EXHAUSTED' : isLow ? 'LOW BALANCE' : 'ACTIVE'}
                  </span>
                  <button
                    id="request-credits-btn"
                    onClick={() => navigate('/store')}
                    title="Request / order more credits"
                    style={{
                      width: 26, height: 26, borderRadius: '50%',
                      background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                      border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
                      flexShrink: 0,
                    }}
                  >
                    <Plus size={14} color="#fff" />
                  </button>
                </div>
              </div>
              <h2 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                {remaining.toLocaleString()}
                <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>credits remaining</span>
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                Monthly base allowance of {profile?.monthly_credits_limit?.toLocaleString() ?? '1,000'} + {profile?.extra_credits_balance?.toLocaleString() ?? '0'} extras.
              </p>
            </div>
            
            <div style={{ marginTop: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={12} /> Resets on {resetDateString}
                </span>
              </div>
            </div>
          </div>

          {/* Daily Cap Safeguard Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '180px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>DAILY SAFETY CAP</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ display: 'inline-flex', cursor: 'help' }} title="Protects against runaway AI chat loops or spam spikes.">
                    <Info size={15} className="text-secondary" />
                  </span>
                  {!editingDailyCap && (
                    <button
                      id="edit-daily-cap-btn"
                      onClick={() => { setDailyCapInput(String(profile?.daily_credit_spend_cap ?? 200)); setEditingDailyCap(true); }}
                      title="Edit your daily spend cap"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}
                    >
                      <Edit3 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {editingDailyCap ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="number"
                    min={10}
                    max={1000000}
                    value={dailyCapInput}
                    onChange={e => setDailyCapInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveDailyCap(); if (e.key === 'Escape') setEditingDailyCap(false); }}
                    autoFocus
                    className="form-input"
                    style={{ width: '100px', padding: '6px 10px', fontSize: '1.2rem', fontWeight: 700 }}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>credits/day</span>
                  <button onClick={saveDailyCap} disabled={savingDailyCap} style={{ background: 'var(--success)', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#fff' }}>
                    {savingDailyCap ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                  </button>
                  <button onClick={() => setEditingDailyCap(false)} style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: 'var(--text-secondary)' }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>
                  {profile?.daily_credit_spend_cap?.toLocaleString() ?? '200'}
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>credits/day</span>
                </h2>
              )}

              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.4' }}>
                {editingDailyCap
                  ? 'Set a limit between 10–1,000,000. Press Enter or ✓ to save, Esc to cancel.'
                  : 'The automated safety valve is active. If your comments or chat queries spike unexpectedly, this limit restricts additional deductions to protect your budget.'}
              </p>
            </div>
            
            <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 500 }}>System Health Status:</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '6px', height: '6px', background: 'var(--success)', borderRadius: '50%', display: 'inline-block' }}></span>
                Protected
              </span>
            </div>
          </div>

          {/* Aggregate Consumption Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '220px' }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>CYCLE CONSUMPTION</span>
                <TrendingDown size={16} style={{ color: 'var(--error)' }} />
              </div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                {creditsUsed.toLocaleString()}
                <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)', marginLeft: '6px' }}>credits used</span>
              </h2>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.4' }}>
                Total credits spent on AI replies, automated comment moderations, vision processing, and image creations since your last rollover cycle.
              </p>

              {/* Usage Breakdown Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '16px', borderTop: '1px solid var(--border-primary)', paddingTop: '16px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '16px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Daily (24h)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {usageBreakdown.daily.toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>cr</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Weekly (7d)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {usageBreakdown.weekly.toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>cr</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 600 }}>Monthly (Cycle)</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#22c55e', marginTop: '4px' }}>
                    {usageBreakdown.monthly.toLocaleString()} <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)' }}>cr</span>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', fontSize: '0.75rem' }}>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Additions: </span>
                <span style={{ color: 'var(--success)', fontWeight: 600 }}>+{aggregatedStats.totalGained.toLocaleString()}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-secondary)' }}>Burn Rate: </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {totalLimit > 0 ? ((creditsUsed / totalLimit) * 100).toFixed(0) : 0}% / month
                </span>
              </div>
            </div>
          </div>

        </div>

        {/* Analytics Visual Breakdown Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          
          {/* Platform Breakdown Visualizer */}
          <div className="card">
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} className="text-primary" style={{ color: 'var(--accent-primary)' }} />
              Channel & Platform Breakdown
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Credits consumed by Messenger, Instagram, WhatsApp, and background comment audits.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* WhatsApp DMs */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <span style={{ display: 'flex', padding: '4px', background: 'rgba(37,211,102,0.1)', color: '#25D366', borderRadius: '4px' }}>
                      <MessageSquare size={12} />
                    </span>
                    WhatsApp Business DMs
                  </span>
                  <span style={{ fontWeight: 600 }}>{aggregatedStats.whatsappDMs} credits</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>
                  <div style={{ 
                    width: `${aggregatedStats.totalDeducted > 0 ? (aggregatedStats.whatsappDMs / aggregatedStats.totalDeducted) * 100 : 0}%`, 
                    height: '100%', 
                    background: '#25D366', 
                    borderRadius: '3px' 
                  }}></div>
                </div>
              </div>

              {/* Instagram DMs */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <span style={{ display: 'flex', padding: '4px', background: 'rgba(214,36,159,0.1)', color: '#D6249F', borderRadius: '4px' }}>
                      <InstagramIcon size={12} color="#D6249F" />
                    </span>
                    Instagram Direct Messages
                  </span>
                  <span style={{ fontWeight: 600 }}>{aggregatedStats.instagramDMs} credits</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>
                  <div style={{ 
                    width: `${aggregatedStats.totalDeducted > 0 ? (aggregatedStats.instagramDMs / aggregatedStats.totalDeducted) * 100 : 0}%`, 
                    height: '100%', 
                    background: '#D6249F', 
                    borderRadius: '3px' 
                  }}></div>
                </div>
              </div>

              {/* Facebook DMs */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <span style={{ display: 'flex', padding: '4px', background: 'rgba(24,119,242,0.1)', color: '#1877F2', borderRadius: '4px' }}>
                      <FacebookIcon size={12} color="#1877F2" />
                    </span>
                    Facebook Messenger Chats
                  </span>
                  <span style={{ fontWeight: 600 }}>{aggregatedStats.facebookDMs} credits</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>
                  <div style={{ 
                    width: `${aggregatedStats.totalDeducted > 0 ? (aggregatedStats.facebookDMs / aggregatedStats.totalDeducted) * 100 : 0}%`, 
                    height: '100%', 
                    background: '#1877F2', 
                    borderRadius: '3px' 
                  }}></div>
                </div>
              </div>

              {/* Instagram Comments */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <span style={{ display: 'flex', padding: '4px', background: 'rgba(253,89,73,0.1)', color: '#FD5949', borderRadius: '4px' }}>
                      <InstagramIcon size={12} color="#FD5949" />
                    </span>
                    Instagram Comment Moderation
                  </span>
                  <span style={{ fontWeight: 600 }}>{aggregatedStats.instagramComments} credits</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>
                  <div style={{ 
                    width: `${aggregatedStats.totalDeducted > 0 ? (aggregatedStats.instagramComments / aggregatedStats.totalDeducted) * 100 : 0}%`, 
                    height: '100%', 
                    background: '#FD5949', 
                    borderRadius: '3px' 
                  }}></div>
                </div>
              </div>

              {/* Facebook Comments */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <span style={{ display: 'flex', padding: '4px', background: 'rgba(59,130,246,0.1)', color: '#3B82F6', borderRadius: '4px' }}>
                      <FacebookIcon size={12} color="#3B82F6" />
                    </span>
                    Facebook Comment Moderation
                  </span>
                  <span style={{ fontWeight: 600 }}>{aggregatedStats.facebookComments} credits</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>
                  <div style={{ 
                    width: `${aggregatedStats.totalDeducted > 0 ? (aggregatedStats.facebookComments / aggregatedStats.totalDeducted) * 100 : 0}%`, 
                    height: '100%', 
                    background: '#3B82F6', 
                    borderRadius: '3px' 
                  }}></div>
                </div>
              </div>

              {/* System Agent / Tools */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '6px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <span style={{ display: 'flex', padding: '4px', background: 'rgba(249,115,22,0.1)', color: '#F97316', borderRadius: '4px' }}>
                      <Bot size={12} />
                    </span>
                    System Agent & RAG Planners
                  </span>
                  <span style={{ fontWeight: 600 }}>{(aggregatedStats.agentDeductions + aggregatedStats.imageDeductions)} credits</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px' }}>
                  <div style={{ 
                    width: `${aggregatedStats.totalDeducted > 0 ? ((aggregatedStats.agentDeductions + aggregatedStats.imageDeductions) / aggregatedStats.totalDeducted) * 100 : 0}%`, 
                    height: '100%', 
                    background: '#F97316', 
                    borderRadius: '3px' 
                  }}></div>
                </div>
              </div>

            </div>
          </div>

          {/* AI Feature Access Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Cpu size={18} style={{ color: 'var(--accent-primary)' }} />
                AI Service Permissions
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Active AI modules authorized for your workspace.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {features.map(f => {
                  const Icon = f.icon;
                  return (
                    <div 
                      key={f.key} 
                      onClick={() => !f.isAdminLocked && handleToggleFeature(f.key)}
                      onMouseEnter={() => !f.isAdminLocked && setHoveredKey(f.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-primary)',
                        background: f.active 
                          ? (hoveredKey === f.key ? 'rgba(34, 197, 94, 0.06)' : 'rgba(34, 197, 94, 0.03)')
                          : (hoveredKey === f.key ? 'rgba(255, 255, 255, 0.06)' : 'rgba(30, 30, 32, 0.4)'),
                        borderColor: f.active 
                          ? (hoveredKey === f.key ? 'rgba(34, 197, 94, 0.4)' : 'rgba(34, 197, 94, 0.25)')
                          : (hoveredKey === f.key ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.05)'),
                        boxShadow: f.active 
                          ? '0 0 12px rgba(34, 197, 94, 0.05)' 
                          : 'none',
                        opacity: f.active ? 1 : 0.65,
                        transition: 'all 0.25s ease',
                        cursor: f.isAdminLocked ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Premium custom checkbox */}
                        <div style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          border: f.active ? '2px solid #22c55e' : '2px solid rgba(255, 255, 255, 0.2)',
                          background: f.active ? '#22c55e' : 'transparent',
                          boxShadow: f.active ? '0 0 8px rgba(34, 197, 94, 0.3)' : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.2s ease',
                        }}>
                          {f.active ? (
                            <Check size={12} strokeWidth={3} color="#ffffff" />
                          ) : (
                            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.15)' }} />
                          )}
                        </div>

                        <div style={{
                          display: 'flex',
                          padding: '6px',
                          background: f.active ? 'rgba(34, 197, 94, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                          color: f.active ? '#22c55e' : 'var(--text-secondary)',
                          borderRadius: '6px',
                          transition: 'all 0.2s ease',
                        }}>
                          <Icon size={14} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: f.active ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            {f.label}
                          </div>
                          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                            {f.desc}
                          </div>
                        </div>
                      </div>
                      
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: f.isAdminLocked 
                          ? 'rgba(239, 68, 68, 0.08)' 
                          : f.isUserDisabled 
                            ? 'rgba(255, 255, 255, 0.05)' 
                            : 'rgba(34, 197, 94, 0.1)',
                        color: f.isAdminLocked 
                          ? '#f87171' 
                          : f.isUserDisabled 
                            ? '#9ca3af' 
                            : '#22c55e',
                        border: f.isAdminLocked 
                          ? '1px solid rgba(239, 68, 68, 0.15)' 
                          : f.isUserDisabled 
                            ? '1px solid rgba(255, 255, 255, 0.1)' 
                            : '1px solid rgba(34, 197, 94, 0.2)',
                      }}>
                        {f.isAdminLocked ? 'LOCKED' : f.isUserDisabled ? 'DISABLED' : 'ACTIVE'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ 
              marginTop: '20px', 
              padding: '12px', 
              background: 'var(--bg-secondary)', 
              border: '1px solid var(--border-primary)', 
              borderRadius: '8px', 
              fontSize: '0.7rem', 
              color: 'var(--text-secondary)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px' 
            }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <Info size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
                <span>These settings determine authorized AI models. Features are manually activated or deactivated by your administrator.</span>
              </div>
              {profile?.role === 'super_admin' && (
                <button
                  onClick={() => navigate(`/super-users/${user?.id}`)}
                  className="btn btn-secondary"
                  style={{
                    padding: '6px 12px',
                    fontSize: '0.7rem',
                    alignSelf: 'flex-start',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    borderRadius: '6px',
                    background: 'var(--surface-2)',
                    border: '1px solid var(--border-primary)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  <Cpu size={12} /> Configure Permissions
                </button>
              )}
            </div>
          </div>

          {/* Cost breakdown reference table */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} style={{ color: 'var(--warning)' }} />
                AI Feature Rate Reference
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Standard deduct pricing policies enforced atomically on each webhook transaction.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Keyword Comment Rule (Static)</span>
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>Free (0 cr)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>AI Comment Analysis & Replies</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>1–2 credits</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Standard DM Chat Response</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>1 credit</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Interactive Copilot / Agent Query</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>10 credits</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Vision Scan / Attachment DM</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>15 credits</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-primary)', paddingBottom: '6px', fontSize: '0.75rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Image Gen / Weekly Planner</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>30 credits</span>
                </div>
              </div>
            </div>

            <div style={{ marginTop: '20px', padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '8px', fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
              <Info size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0, marginTop: '2px' }} />
              <span>Gifts and top-ups will extend your Extra Credits balance and do not reset at the billing rollover date.</span>
            </div>
          </div>

        </div>

        {/* Transaction History Ledger Section */}
        <div className="card" style={{ padding: '0px', overflow: 'hidden' }}>
          
          {/* Control & Filter Header */}
          <div style={{ 
            padding: '20px 24px', 
            borderBottom: '1px solid var(--border-primary)', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            gap: '16px', 
            flexWrap: 'wrap' 
          }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <History size={18} className="text-secondary" />
                Ledger Transaction History
              </h3>
            </div>
            
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              
              {/* Search */}
              <input 
                type="text" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                placeholder="Search..." 
                className="form-input" 
                style={{ padding: '6px 10px', fontSize: '0.8rem', height: '32px', width: '150px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
              />

              {/* Date Range */}
              <select
                value={filterDate}
                onChange={(e: any) => setFilterDate(e.target.value)}
                className="form-input"
                style={{ padding: '6px 8px', fontSize: '0.8rem', height: '32px', width: '115px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="week">Last 7 Days</option>
                <option value="month">This Month</option>
              </select>

              {/* Type Filter */}
              <select
                value={filterType}
                onChange={(e: any) => setFilterType(e.target.value)}
                className="form-input"
                style={{ padding: '6px 8px', fontSize: '0.8rem', height: '32px', width: '115px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
              >
                <option value="all">All Types</option>
                <option value="additions">Refills &amp; Gifts</option>
                <option value="deductions">Deductions</option>
              </select>

              {/* Category / Product */}
              <select
                value={filterCategory}
                onChange={(e: any) => setFilterCategory(e.target.value)}
                className="form-input"
                style={{ padding: '6px 8px', fontSize: '0.8rem', height: '32px', width: '130px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
              >
                <option value="all">All Products</option>
                <option value="comment">Comments</option>
                <option value="dm">DM Replies</option>
                <option value="agent_query">Agent Queries</option>
                <option value="image_gen">Image Gen</option>
                <option value="purchase">Purchases</option>
                <option value="gift">Gifts</option>
              </select>

              {/* Platform Filter */}
              <select
                value={filterPlatform}
                onChange={(e: any) => setFilterPlatform(e.target.value)}
                className="form-input"
                style={{ padding: '6px 8px', fontSize: '0.8rem', height: '32px', width: '125px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
              >
                <option value="all">All Platforms</option>
                <option value="facebook">Facebook</option>
                <option value="instagram">Instagram</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="agent">System Agent</option>
                <option value="admin">Admin</option>
              </select>

            </div>
          </div>

          {/* Table Container */}
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.01)', borderBottom: '1px solid var(--border-primary)' }}>
                  <th style={{ padding: '12px 24px', color: 'var(--text-secondary)', fontWeight: 600 }}>Date/Time</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Type</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Platform</th>
                  <th style={{ padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Description</th>
                  <th style={{ padding: '12px 24px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      Loading ledger records...
                    </td>
                  </tr>
                ) : filteredLedger.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      No transactions match the selected filters.
                    </td>
                  </tr>
                ) : paginatedLedger.map((item) => {
                  const itemDate = new Date(item.timestamp).toLocaleString();
                  const isAdd = item.type === 'addition';

                  let badgeColor = 'rgba(59,130,246,0.1)';
                  let badgeText = 'Deduction';
                  let textColor = 'var(--text-primary)';

                  if (isAdd) {
                    badgeColor = 'rgba(34,197,94,0.1)';
                    badgeText = item.category === 'gift' ? 'Gifted' : 'Refilled';
                    textColor = 'var(--success)';
                  } else {
                    badgeColor = 'rgba(239,68,68,0.08)';
                    badgeText = 'Deducted';
                    textColor = 'var(--error)';
                  }

                  let platformLabel = 'System';
                  let platIcon = <Bot size={12} style={{ display: 'inline', marginRight: '4px' }} />;
                  if (item.platform === 'facebook') {
                    platformLabel = 'Facebook';
                    platIcon = <FacebookIcon size={12} color="#1877F2" />;
                  } else if (item.platform === 'instagram') {
                    platformLabel = 'Instagram';
                    platIcon = <InstagramIcon size={12} color="#D6249F" />;
                  } else if (item.platform === 'whatsapp') {
                    platformLabel = 'WhatsApp';
                    platIcon = <MessageSquare size={12} style={{ display: 'inline', marginRight: '4px', color: '#25D366' }} />;
                  } else if (item.platform === 'admin') {
                    platformLabel = 'System';
                    platIcon = <Cpu size={12} style={{ display: 'inline', marginRight: '4px' }} />;
                  }

                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-primary)', transition: 'background 0.2s' }} className="table-row-hover">
                      <td style={{ padding: '14px 24px', color: 'var(--text-secondary)' }}>{itemDate}</td>
                      <td style={{ padding: '14px 16px' }}>
                        <span style={{ 
                          fontSize: '0.65rem', 
                          fontWeight: 700, 
                          padding: '3px 8px', 
                          borderRadius: '12px',
                          background: badgeColor,
                          color: isAdd ? 'var(--success)' : 'var(--text-primary)'
                        }}>
                          {badgeText.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                        {platIcon} {platformLabel}
                      </td>
                      <td style={{ padding: '14px 16px', color: 'var(--text-primary)', maxWidth: '420px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.description}>
                        {item.description}
                      </td>
                      <td style={{ padding: '14px 24px', textAlign: 'right', fontWeight: 700, color: textColor, fontSize: '0.85rem' }}>
                        {isAdd ? '+' : '-'}{item.amount.toLocaleString()} cr
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {filteredLedger.length > ITEMS_PER_PAGE && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 24px',
              borderTop: '1px solid var(--border-primary)',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
            }}>
              <span>
                Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filteredLedger.length)} of {filteredLedger.length} records
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                    background: currentPage === 1 ? 'var(--surface)' : 'var(--surface-2)',
                    border: '1px solid var(--border)', color: currentPage === 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <span style={{ padding: '0 8px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: '6px 12px', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600,
                    background: currentPage === totalPages ? 'var(--surface)' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                    border: 'none', color: currentPage === totalPages ? 'var(--text-secondary)' : '#fff',
                    cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                  }}
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
