// ============================================================================
// UserWorkspacePage — Full-page admin workspace for managing a single user
// ============================================================================
// Loaded at /super-users/:userId
// Replaces the old InspectionDrawer with a full-page tabbed workspace
// ============================================================================

import { useEffect, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { workerPost } from '../lib/workerApi';
import { toast } from '../hooks/useToast';
import ConfirmationDialog from '../components/ConfirmationDialog';
import {
  ArrowLeft,
  Settings,
  Globe,
  FileText,
  BookOpen,
  MessageSquare,
  Cpu,
  Shield,
  ShieldAlert,
  Crown,
  User,
  Ban,
  UserCheck,
  Eye,
  Pencil,
  Plus,
  Trash2,
  RefreshCw,
  Save,
  ChevronRight,
  Zap,
  Loader2,
  Gift,
  X,
  Pause,
  Play,
  Image,
} from 'lucide-react';
import type { SuperAdminUser, UserRole, InspectData } from './super-admin/types';
import { getPresetChatModels } from '../lib/models';

// ── Tab definitions ─────────────────────────────────────────────────────────
type WorkspaceTab = 'overview' | 'ai' | 'channels' | 'knowledge' | 'inbox';

const TABS: { key: WorkspaceTab; label: string; icon: any }[] = [
  { key: 'overview', label: 'Overview & Quotas', icon: Settings },
  { key: 'ai', label: 'AI Configuration', icon: Cpu },
  { key: 'channels', label: 'Channels & Bots', icon: Globe },
  { key: 'knowledge', label: 'Knowledge & Docs', icon: BookOpen },
  { key: 'inbox', label: 'Inbox', icon: MessageSquare },
];

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = {
  page: { paddingBottom: '40px' } as React.CSSProperties,
  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px',
    fontSize: '14px', color: 'var(--text-secondary)',
  } as React.CSSProperties,
  breadcrumbLink: {
    color: 'var(--accent-primary)', textDecoration: 'none', display: 'flex',
    alignItems: 'center', gap: '4px',
  } as React.CSSProperties,
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    flexWrap: 'wrap' as const, gap: '16px', marginBottom: '24px',
  } as React.CSSProperties,
  avatar: (role: string) => ({
    width: '56px', height: '56px', borderRadius: '50%', display: 'flex',
    alignItems: 'center', justifyContent: 'center', fontWeight: 700,
    fontSize: '20px', color: '#fff', flexShrink: 0,
    background: role === 'super_admin' ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)'
      : role === 'admin' ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
      : 'linear-gradient(135deg, #6b7280, #4b5563)',
  }) as React.CSSProperties,
  badge: (color: string, bg: string) => ({
    display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px',
    borderRadius: '6px', fontSize: '11px', fontWeight: 600, color, background: bg,
  }) as React.CSSProperties,
  tabBar: {
    display: 'flex', gap: '2px', background: 'var(--bg-secondary)',
    borderRadius: 'var(--radius-md)', padding: '4px', marginBottom: '24px',
    overflowX: 'auto' as const, border: '1px solid var(--border-primary)',
  } as React.CSSProperties,
  tab: (active: boolean) => ({
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
    borderRadius: '8px', fontSize: '13px', fontWeight: active ? 600 : 400,
    color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
    background: active ? 'var(--bg-tertiary)' : 'transparent',
    border: 'none', cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap' as const,
  }) as React.CSSProperties,
  card: {
    background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
    borderRadius: 'var(--radius-md)', padding: '20px',
  } as React.CSSProperties,
  cardTitle: {
    fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)',
    marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px',
  } as React.CSSProperties,
  grid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' } as React.CSSProperties,
  formRow: { display: 'flex', flexDirection: 'column' as const, gap: '6px', marginBottom: '12px' } as React.CSSProperties,
  formLabel: { fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' } as React.CSSProperties,
  actionRow: { display: 'flex', gap: '8px', flexWrap: 'wrap' as const, marginTop: '16px' } as React.CSSProperties,
  stat: {
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '4px',
    padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px', flex: 1, minWidth: '80px',
  } as React.CSSProperties,
  statVal: { fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' } as React.CSSProperties,
  statLabel: { fontSize: '11px', color: 'var(--text-secondary)' } as React.CSSProperties,
  providerCard: (isCustom: boolean) => ({
    ...styles.card,
    borderColor: isCustom ? 'var(--accent-primary)' : 'var(--border-primary)',
    position: 'relative' as const,
  }) as React.CSSProperties,
};

// ── Component ───────────────────────────────────────────────────────────────

export default function UserWorkspacePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();

  // Core state
  const [userData, setUserData] = useState<SuperAdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('overview');

  // Inspect data (pages, docs, fields, usage)
  const [inspectData, setInspectData] = useState<InspectData>({
    pages: [], documents: [], fields: [],
    usage: { totalMonthTokens: 0, filteredTokens: 0, modelBreakdown: [], dateBreakdown: [] },
  });

  // AI Provider state
  const [allProviders, setAllProviders] = useState<any[]>([]);
  const [globalProviders, setGlobalProviders] = useState<any[]>([]);

  // Quota state
  const [monthlyLimitInput, setMonthlyLimitInput] = useState(500000);
  const [strictEnforcementInput, setStrictEnforcementInput] = useState(true);
  const [allowedChannelsInput, setAllowedChannelsInput] = useState(0);

  // Credits system state
  const [monthlyCreditsLimitInput, setMonthlyCreditsLimitInput] = useState(0);
  const [extraCreditsBalanceInput, setExtraCreditsBalanceInput] = useState(0);
  const [creditsUsedThisMonthInput, setCreditsUsedThisMonthInput] = useState(0);
  const [dailyCreditSpendCapInput, setDailyCreditSpendCapInput] = useState(0);

  // Missing user settings states
  const [allowCommentAnalysisInput, setAllowCommentAnalysisInput] = useState(true);
  const [sentimentAnalysisScopeInput, setSentimentAnalysisScopeInput] = useState<'global' | 'specific_posts'>('global');
  const [sentimentWatchedPostIdsInput, setSentimentWatchedPostIdsInput] = useState('');
  const [brandVoiceProfileInput, setBrandVoiceProfileInput] = useState('');
  const [imageModelInput, setImageModelInput] = useState('flux');
  const [allowChatInput, setAllowChatInput] = useState(true);
  const [allowImageGenInput, setAllowImageGenInput] = useState(true);
  const [allowEmbeddingsInput, setAllowEmbeddingsInput] = useState(true);
  const [allowAgentInput, setAllowAgentInput] = useState(true);
  const [allowSummarizationInput, setAllowSummarizationInput] = useState(true);
  const [allowVisionInput, setAllowVisionInput] = useState(true);

  // Database mirror for selective input synchronization
  const [dbValues, setDbValues] = useState<any>(null);

  
  const [savingQuota, setSavingQuota] = useState(false);

  // Page form state
  const [showPageForm, setShowPageForm] = useState(false);
  const [editingPage, setEditingPage] = useState<any>(null);
  const [pageForm, setPageForm] = useState({ page_id: '', page_name: '', access_token: '', bot_name: '', custom_system_prompt: '', ai_model: '', temperature: 0.5, is_active: true, ai_provider_id: '' });
  const [savingForm, setSavingForm] = useState(false);
  const [customModelEnabled, setCustomModelEnabled] = useState(false);

  // Field form state
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [editingField, setEditingField] = useState<any>(null);
  const [fieldForm, setFieldForm] = useState({ field_name: '', field_value: '', category: 'general', page_id: '', is_active: true });

  // Doc form state
  const [showDocForm, setShowDocForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any>(null);
  const [docForm, setDocForm] = useState({ title: '', original_content: '', selectedPageIds: [] as string[] });
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);

  // Confirmation dialogs
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; desc: string; variant: 'danger' | 'warning' | 'info'; typeToConfirm?: string; onConfirm: () => void }>({ open: false, title: '', desc: '', variant: 'info', onConfirm: () => {} });

  // Usage filter (for future detailed usage analytics)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_usageFilter, _setUsageFilter] = useState<'this_month' | 'last_month' | 'this_year' | 'all_time'>('this_month');

  // Inbox state
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Gifting state
  const [giftModalOpen, setGiftModalOpen] = useState(false);

  const [giftAmount, setGiftAmount] = useState<number>(100);
  const [giftCurrency, setGiftCurrency] = useState<'USD' | 'BTT'>('USD');
  const [giftPrice, setGiftPrice] = useState<string>('5.00');
  const [giftNotes, setGiftNotes] = useState<string>('');
  const [giftSubmitting, setGiftSubmitting] = useState(false);

  useEffect(() => {
    if (!giftAmount) {
      setGiftPrice('0');
      return;
    }
    let calculated = 0;
    if (giftCurrency === 'USD') {
      calculated = giftAmount * 0.05;
      setGiftPrice(calculated.toFixed(2));
    } else {
      calculated = giftAmount * 6.5;
      setGiftPrice(Math.round(calculated).toString());
    }
  }, [giftAmount, giftCurrency]);

  async function handleGiftSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userData) return;
    setGiftSubmitting(true);
    try {
      const finalPrice = parseFloat(giftPrice) || 0;

      // Determine the message_addon string based on gift type
      const addonString = `Gift: +${giftAmount} Credits`;

      // Insert into purchases — the DB trigger (trg_purchase_approval) handles
      // updating all user limits automatically. No direct users update needed here.
      const { error: purchaseErr } = await supabase
        .from('purchases')
        .insert({
          user_id: userData.id,
          channels_count: 0,
          message_addon: addonString,
          currency: giftCurrency,
          total_amount: finalPrice,
          payment_method: 'gift',
          status: 'approved',
          admin_notes: giftNotes || 'Gifted by administrator'
        });

      if (purchaseErr) throw purchaseErr;

      // Log to admin audit log
      await supabase.from('admin_audit_log').insert({
        admin_id: currentUser?.id,
        target_id: userData.id,
        action: 'gift_credits',
        details: { amount: giftAmount, price: finalPrice, currency: giftCurrency, notes: giftNotes }
      });

      toast.success(`Successfully gifted ${addonString.replace('Gift: ', '')}!`);
      setGiftModalOpen(false);
      loadUserData(); // Refresh current page stats
    } catch (err: any) {
      toast.error("Gifting failed: " + err.message);
    } finally {
      setGiftSubmitting(false);
    }
  }

  // ── Load user data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (userId) loadUserData();
  }, [userId]);

  // Real-time listener for the inspected user's profile and credits updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`admin-inspect-user-realtime-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new && Object.keys(payload.new).length > 0) {
            const newData = payload.new as Record<string, any>;
            setUserData((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                ...newData,
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  // Keep inputs in sync with userData updates in real-time,
  // but selectively update only fields that the admin has not manually edited.
  useEffect(() => {
    if (!userData) return;
    
    // If dbValues is not initialized yet, initialize it and inputs
    if (!dbValues) {
      setDbValues(userData);
      setMonthlyLimitInput(userData.monthly_token_limit ?? 500000);
      setStrictEnforcementInput(userData.strict_token_enforcement ?? true);
      setAllowedChannelsInput(userData.allowed_channels ?? 0);
      setMonthlyCreditsLimitInput(userData.monthly_credits_limit ?? 0);
      setExtraCreditsBalanceInput(userData.extra_credits_balance ?? 0);
      setCreditsUsedThisMonthInput(userData.credits_used_this_month ?? 0);
      setDailyCreditSpendCapInput(userData.daily_credit_spend_cap ?? 0);
      setAllowCommentAnalysisInput(userData.allow_comment_analysis ?? true);
      setSentimentAnalysisScopeInput(userData.sentiment_analysis_scope ?? 'global');
      setSentimentWatchedPostIdsInput(Array.isArray(userData.sentiment_watched_post_ids) ? userData.sentiment_watched_post_ids.join(', ') : '');
      setBrandVoiceProfileInput(userData.brand_voice_profile ?? '');
      setImageModelInput(userData.image_model ?? 'flux');
      setAllowChatInput(userData.allow_chat ?? true);
      setAllowImageGenInput(userData.allow_image_gen ?? true);
      setAllowEmbeddingsInput(userData.allow_embeddings ?? true);
      setAllowAgentInput(userData.allow_agent ?? true);
      setAllowSummarizationInput(userData.allow_summarization ?? true);
      setAllowVisionInput(userData.allow_vision ?? true);
      return;
    }

    // Otherwise, check each field for background DB changes and sync if untouched
    if (userData.monthly_token_limit !== dbValues.monthly_token_limit) {
      if (monthlyLimitInput === (dbValues.monthly_token_limit ?? 500000)) {
        setMonthlyLimitInput(userData.monthly_token_limit ?? 500000);
      }
    }
    if (userData.strict_token_enforcement !== dbValues.strict_token_enforcement) {
      if (strictEnforcementInput === (dbValues.strict_token_enforcement ?? true)) {
        setStrictEnforcementInput(userData.strict_token_enforcement ?? true);
      }
    }
    if (userData.allowed_channels !== dbValues.allowed_channels) {
      if (allowedChannelsInput === (dbValues.allowed_channels ?? 0)) {
        setAllowedChannelsInput(userData.allowed_channels ?? 0);
      }
    }
    if (userData.monthly_credits_limit !== dbValues.monthly_credits_limit) {
      if (monthlyCreditsLimitInput === (dbValues.monthly_credits_limit ?? 0)) {
        setMonthlyCreditsLimitInput(userData.monthly_credits_limit ?? 0);
      }
    }
    if (userData.extra_credits_balance !== dbValues.extra_credits_balance) {
      if (extraCreditsBalanceInput === (dbValues.extra_credits_balance ?? 0)) {
        setExtraCreditsBalanceInput(userData.extra_credits_balance ?? 0);
      }
    }
    if (userData.credits_used_this_month !== dbValues.credits_used_this_month) {
      if (creditsUsedThisMonthInput === (dbValues.credits_used_this_month ?? 0)) {
        setCreditsUsedThisMonthInput(userData.credits_used_this_month ?? 0);
      }
    }
    if (userData.daily_credit_spend_cap !== dbValues.daily_credit_spend_cap) {
      if (dailyCreditSpendCapInput === (dbValues.daily_credit_spend_cap ?? 0)) {
        setDailyCreditSpendCapInput(userData.daily_credit_spend_cap ?? 0);
      }
    }
    if (userData.allow_comment_analysis !== dbValues.allow_comment_analysis) {
      if (allowCommentAnalysisInput === (dbValues.allow_comment_analysis ?? true)) {
        setAllowCommentAnalysisInput(userData.allow_comment_analysis ?? true);
      }
    }
    if (userData.sentiment_analysis_scope !== dbValues.sentiment_analysis_scope) {
      if (sentimentAnalysisScopeInput === (dbValues.sentiment_analysis_scope ?? 'global')) {
        setSentimentAnalysisScopeInput(userData.sentiment_analysis_scope ?? 'global');
      }
    }
    
    const oldWatchedPostIdsStr = Array.isArray(dbValues.sentiment_watched_post_ids) ? dbValues.sentiment_watched_post_ids.join(', ') : '';
    if (JSON.stringify(userData.sentiment_watched_post_ids) !== JSON.stringify(dbValues.sentiment_watched_post_ids)) {
      if (sentimentWatchedPostIdsInput === oldWatchedPostIdsStr) {
        setSentimentWatchedPostIdsInput(Array.isArray(userData.sentiment_watched_post_ids) ? userData.sentiment_watched_post_ids.join(', ') : '');
      }
    }

    if (userData.brand_voice_profile !== dbValues.brand_voice_profile) {
      if (brandVoiceProfileInput === (dbValues.brand_voice_profile ?? '')) {
        setBrandVoiceProfileInput(userData.brand_voice_profile ?? '');
      }
    }
    if (userData.image_model !== dbValues.image_model) {
      if (imageModelInput === (dbValues.image_model ?? 'flux')) {
        setImageModelInput(userData.image_model ?? 'flux');
      }
    }
    if (userData.allow_chat !== dbValues.allow_chat) {
      if (allowChatInput === (dbValues.allow_chat ?? true)) {
        setAllowChatInput(userData.allow_chat ?? true);
      }
    }
    if (userData.allow_image_gen !== dbValues.allow_image_gen) {
      if (allowImageGenInput === (dbValues.allow_image_gen ?? true)) {
        setAllowImageGenInput(userData.allow_image_gen ?? true);
      }
    }
    if (userData.allow_embeddings !== dbValues.allow_embeddings) {
      if (allowEmbeddingsInput === (dbValues.allow_embeddings ?? true)) {
        setAllowEmbeddingsInput(userData.allow_embeddings ?? true);
      }
    }
    if (userData.allow_agent !== dbValues.allow_agent) {
      if (allowAgentInput === (dbValues.allow_agent ?? true)) {
        setAllowAgentInput(userData.allow_agent ?? true);
      }
    }
    if (userData.allow_summarization !== dbValues.allow_summarization) {
      if (allowSummarizationInput === (dbValues.allow_summarization ?? true)) {
        setAllowSummarizationInput(userData.allow_summarization ?? true);
      }
    }
    if (userData.allow_vision !== dbValues.allow_vision) {
      if (allowVisionInput === (dbValues.allow_vision ?? true)) {
        setAllowVisionInput(userData.allow_vision ?? true);
      }
    }

    // Keep the sync tracker in sync
    setDbValues(userData);
  }, [userData]);

  async function loadUserData() {
    setLoading(true);
    try {
      const [userRes, provsRes, pagesRes, docsRes, fieldsRes, sessionsRes, messagesRes] = await Promise.all([
        supabase.from('users').select('*').eq('id', userId).single(),
        supabase.from('ai_providers').select('*').order('display_name'),
        supabase.from('page_connections').select('*').eq('user_id', userId),
        supabase.from('documents').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('knowledge_fields').select('*').eq('user_id', userId).order('sort_order'),
        supabase.from('chat_sessions').select('user_id, message_count').eq('user_id', userId),
        supabase.from('chat_messages').select('created_at, token_count, metadata').eq('user_id', userId).gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ]);

      if (userRes.error) throw userRes.error;

      const user = userRes.data;
      const sessionCount = sessionsRes.data?.length || 0;
      const messageCount = (sessionsRes.data || []).reduce((acc: number, s: any) => acc + (s.message_count || 0), 0);
      const totalMonthTokens = (messagesRes.data || []).reduce((acc: number, m: any) => acc + (m.token_count || 0), 0);

      // Enrich with folder page assignments
      let assignmentMap: Record<string, string[]> = {};
      const folderIds = (docsRes.data || []).map((d: any) => d.folder_id).filter(Boolean);
      if (folderIds.length > 0) {
        const { data: assignments } = await supabase.from('folder_page_assignments').select('folder_id, page_id').in('folder_id', folderIds);
        for (const a of (assignments || [])) {
          if (!assignmentMap[a.folder_id]) assignmentMap[a.folder_id] = [];
          assignmentMap[a.folder_id].push(a.page_id);
        }
      }

      const enrichedDocs = (docsRes.data || []).map((d: any) => ({ 
        ...d, 
        assignedPageIds: d.folder_id ? (assignmentMap[d.folder_id] || []) : [] 
      }));

      setUserData({
        ...user,
        pageCount: pagesRes.data?.length || 0,
        documentCount: docsRes.data?.length || 0,
        fieldCount: fieldsRes.data?.length || 0,
        sessionCount,
        messageCount,
      } as SuperAdminUser);

      setAllProviders(provsRes.data || []);
      setGlobalProviders((provsRes.data || []).filter((p: any) => p.is_global));

      setInspectData({
        pages: pagesRes.data || [],
        documents: enrichedDocs,
        fields: fieldsRes.data || [],
        usage: { totalMonthTokens, filteredTokens: 0, modelBreakdown: [], dateBreakdown: [] },
      });

      // Initialize quota inputs
      setMonthlyLimitInput(user.monthly_token_limit ?? 500000);
      setStrictEnforcementInput(user.strict_token_enforcement ?? true);
      setAllowedChannelsInput(user.allowed_channels ?? 0);
      
      setMonthlyCreditsLimitInput(user.monthly_credits_limit ?? 0);
      setExtraCreditsBalanceInput(user.extra_credits_balance ?? 0);
      setCreditsUsedThisMonthInput(user.credits_used_this_month ?? 0);
      setDailyCreditSpendCapInput(user.daily_credit_spend_cap ?? 0);

      // Initialize missing settings
      setAllowCommentAnalysisInput(user.allow_comment_analysis ?? true);
      setSentimentAnalysisScopeInput(user.sentiment_analysis_scope ?? 'global');
      setSentimentWatchedPostIdsInput(Array.isArray(user.sentiment_watched_post_ids) ? user.sentiment_watched_post_ids.join(', ') : '');
      setBrandVoiceProfileInput(user.brand_voice_profile ?? '');
      setImageModelInput(user.image_model ?? 'flux');
      setAllowChatInput(user.allow_chat ?? true);
      setAllowImageGenInput(user.allow_image_gen ?? true);
      setAllowEmbeddingsInput(user.allow_embeddings ?? true);
      setAllowAgentInput(user.allow_agent ?? true);
      setAllowSummarizationInput(user.allow_summarization ?? true);
      setAllowVisionInput(user.allow_vision ?? true);

      // Initialize dbValues to avoid initial triggers overwriting inputs
      setDbValues(user);

    } catch (err) {
      console.error('Failed to load user:', err);
      toast.error('Failed to load user data');
    } finally {
      setLoading(false);
    }
  }

  // ── Quota handlers ────────────────────────────────────────────────────────
  async function handleSaveQuota(e: FormEvent) {
    e.preventDefault();
    if (!userData) return;
    setSavingQuota(true);
    try {
      // 1. Calculate extra credits balance difference to log adjustment
      const oldExtraBalance = userData.extra_credits_balance ?? 0;
      const diffExtraBalance = extraCreditsBalanceInput - oldExtraBalance;

      // 2. Parse watched post IDs array
      const watchedPostIds = sentimentWatchedPostIdsInput
        .split(',')
        .map(id => id.trim())
        .filter(Boolean);

      // 3. Save directly to user record
      // Note: we do NOT save extra_credits_balance here if diffExtraBalance is non-zero,
      // because the approved purchase record trigger will automatically handle it!
      // But if diffExtraBalance is zero, we keep it as is.
      const updatePayload: any = {
        monthly_token_limit: monthlyLimitInput,
        strict_token_enforcement: strictEnforcementInput,
        allowed_channels: allowedChannelsInput,
        monthly_credits_limit: monthlyCreditsLimitInput,
        credits_used_this_month: creditsUsedThisMonthInput,
        daily_credit_spend_cap: dailyCreditSpendCapInput,
        allow_comment_analysis: allowCommentAnalysisInput,
        sentiment_analysis_scope: sentimentAnalysisScopeInput,
        sentiment_watched_post_ids: watchedPostIds,
        brand_voice_profile: brandVoiceProfileInput,
        image_model: imageModelInput,
        allow_chat: allowChatInput,
        allow_image_gen: allowImageGenInput,
        allow_embeddings: allowEmbeddingsInput,
        allow_agent: allowAgentInput,
        allow_summarization: allowSummarizationInput,
        allow_vision: allowVisionInput,
      };

      if (diffExtraBalance === 0) {
        updatePayload.extra_credits_balance = extraCreditsBalanceInput;
      }

      const { error } = await supabase.from('users').update(updatePayload).eq('id', userData.id);
      if (error) throw error;

      // 4. Log credit adjustment transaction if diff is non-zero
      if (diffExtraBalance !== 0) {
        const addonString = `Admin Adjustment: ${diffExtraBalance > 0 ? '+' : ''}${diffExtraBalance} Credits`;
        const { error: purchaseErr } = await supabase
          .from('purchases')
          .insert({
            user_id: userData.id,
            channels_count: 0,
            message_addon: addonString,
            currency: 'USD',
            total_amount: 0,
            payment_method: 'admin_adjustment',
            status: 'approved',
            admin_notes: 'Manual balance adjustment by administrator'
          });
        if (purchaseErr) throw purchaseErr;
      }

      // Log audit
      await supabase.from('admin_audit_log').insert({
        admin_id: currentUser?.id,
        target_id: userData.id,
        action: 'quota_change',
        details: { 
          monthly_token_limit: monthlyLimitInput, 
          strict_token_enforcement: strictEnforcementInput, 
          allowed_channels: allowedChannelsInput,
          monthly_credits_limit: monthlyCreditsLimitInput,
          extra_credits_balance: extraCreditsBalanceInput,
          daily_credit_spend_cap: dailyCreditSpendCapInput,
          allow_comment_analysis: allowCommentAnalysisInput,
          sentiment_analysis_scope: sentimentAnalysisScopeInput,
          sentiment_watched_post_ids: watchedPostIds,
          brand_voice_profile: brandVoiceProfileInput,
          image_model: imageModelInput,
          allow_chat: allowChatInput,
          allow_image_gen: allowImageGenInput,
          allow_embeddings: allowEmbeddingsInput,
          allow_agent: allowAgentInput,
          allow_summarization: allowSummarizationInput,
          allow_vision: allowVisionInput,
          credit_adjustment: diffExtraBalance,
        },
      });

      const updatedUser = {
        ...(userData || {}),
        ...updatePayload,
        extra_credits_balance: diffExtraBalance === 0 ? extraCreditsBalanceInput : ((userData as any).extra_credits_balance ?? 0) + diffExtraBalance,
      } as SuperAdminUser;

      setUserData(updatedUser);
      setDbValues(updatedUser);
      
      toast.success('Quota and settings updated');
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSavingQuota(false);
    }
  }

  // Handle remaining credits live change by dynamically adjusting extra_credits_balance and credits_used_this_month
  const handleRemainingCreditsChange = (newVal: number) => {
    const val = Math.max(0, isNaN(newVal) ? 0 : Math.round(newVal));
    if (val >= monthlyCreditsLimitInput) {
      setCreditsUsedThisMonthInput(0);
      setExtraCreditsBalanceInput(val - monthlyCreditsLimitInput);
    } else {
      setExtraCreditsBalanceInput(0);
      setCreditsUsedThisMonthInput(monthlyCreditsLimitInput - val);
    }
  };

  // ── Plan change ───────────────────────────────────────────────────────────
  async function changePlan(plan: string) {
    if (!userData) return;
    const oldPlan = userData.plan;
    const { error } = await supabase.from('users').update({ plan }).eq('id', userData.id);
    if (error) { toast.error('Error: ' + error.message); return; }

    await supabase.from('admin_audit_log').insert({ admin_id: currentUser?.id, target_id: userData.id, action: 'plan_change', details: { old_value: oldPlan, new_value: plan } });
    setUserData(prev => prev ? { ...prev, plan } : null);
    toast.success(`Plan changed to ${plan}`);
  }

  // ── Role change ───────────────────────────────────────────────────────────
  async function changeRole(newRole: UserRole) {
    if (!userData) return;
    if (userData.id === currentUser?.id) { toast.warning("You cannot change your own role!"); return; }

    setConfirmDialog({
      open: true, variant: 'warning',
      title: 'Change User Role',
      desc: `Change ${userData.display_name || userData.email}'s role from "${userData.role}" to "${newRole}"?`,
      onConfirm: async () => {
        const { error } = await supabase.from('users').update({ role: newRole, is_super_admin: newRole === 'super_admin' }).eq('id', userData.id);
        if (error) { toast.error('Error: ' + error.message); return; }

        await supabase.from('admin_audit_log').insert({ admin_id: currentUser?.id, target_id: userData.id, action: 'role_change', details: { old_value: userData.role, new_value: newRole } });
        setUserData(prev => prev ? { ...prev, role: newRole, is_super_admin: newRole === 'super_admin' } : null);
        toast.success(`Role changed to ${newRole}`);
        setConfirmDialog(d => ({ ...d, open: false }));
      },
    });
  }

  // ── Suspension ────────────────────────────────────────────────────────────
  async function toggleSuspension() {
    if (!userData) return;
    if (userData.id === currentUser?.id) { toast.warning("You cannot suspend yourself!"); return; }
    const nextStatus = !userData.is_suspended;

    setConfirmDialog({
      open: true, variant: nextStatus ? 'danger' : 'info',
      title: nextStatus ? 'Suspend User' : 'Unsuspend User',
      desc: nextStatus
        ? `Suspend ${userData.display_name || userData.email}? They will be locked out and their chatbots will stop.`
        : `Lift suspension for ${userData.display_name || userData.email}?`,
      onConfirm: async () => {
        const { error } = await supabase.from('users').update({ is_suspended: nextStatus }).eq('id', userData.id);
        if (error) { toast.error('Error: ' + error.message); return; }

        await supabase.from('admin_audit_log').insert({ admin_id: currentUser?.id, target_id: userData.id, action: nextStatus ? 'suspend' : 'unsuspend', details: {} });
        setUserData(prev => prev ? { ...prev, is_suspended: nextStatus } : null);
        toast.success(nextStatus ? 'User suspended' : 'Suspension lifted');
        setConfirmDialog(d => ({ ...d, open: false }));
      },
    });
  }

  // ── Pause ────────────────────────────────────────────────────────────
  async function togglePause() {
    if (!userData) return;
    const nextStatus = !userData.is_paused;

    setConfirmDialog({
      open: true, variant: nextStatus ? 'warning' : 'info',
      title: nextStatus ? 'Pause User Activity' : 'Resume User Activity',
      desc: nextStatus
        ? `Pause all activity for ${userData.display_name || userData.email}? Chatbot responses and comments automation will stop.`
        : `Resume all activity for ${userData.display_name || userData.email}?`,
      onConfirm: async () => {
        const { error } = await supabase.from('users').update({ is_paused: nextStatus }).eq('id', userData.id);
        if (error) { toast.error('Error: ' + error.message); return; }

        await supabase.from('admin_audit_log').insert({ admin_id: currentUser?.id, target_id: userData.id, action: nextStatus ? 'pause' : 'unpause', details: {} });
        setUserData(prev => prev ? { ...prev, is_paused: nextStatus } : null);
        toast.success(nextStatus ? 'User activity paused' : 'User activity resumed');
        setConfirmDialog(d => ({ ...d, open: false }));
      },
    });
  }

  // ── Impersonation ─────────────────────────────────────────────────────────
  async function handleImpersonate() {
    if (!userData) return;

    setConfirmDialog({
      open: true, variant: 'warning',
      title: 'Impersonate User',
      desc: `You will be logged in as ${userData.email}. Your admin session will be saved and you can return via the banner.`,
      onConfirm: async () => {
        try {
          // Save current admin session
          const { data: sessionData } = await supabase.auth.getSession();
          if (!sessionData.session) { toast.error('No active session'); return; }

          localStorage.setItem('autometabot_admin_session', JSON.stringify({
            accessToken: sessionData.session.access_token,
            refreshToken: sessionData.session.refresh_token,
            targetEmail: userData.email,
          }));

          // Call impersonation endpoint
          const result = await workerPost('/api/admin/impersonate', {
            targetEmail: userData.email,
            redirectTo: window.location.origin
          });
          if (result.link) {
            window.location.href = result.link;
          } else {
            toast.error('Failed to generate impersonation link');
            localStorage.removeItem('autometabot_admin_session');
          }
        } catch (err: any) {
          toast.error('Impersonation failed: ' + err.message);
          localStorage.removeItem('autometabot_admin_session');
        }
        setConfirmDialog(d => ({ ...d, open: false }));
      },
    });
  }

  // ── AI Provider Overrides ─────────────────────────────────────────────────
  const PROVIDER_ROLES = [
    { key: 'assigned_chat_provider_id', label: 'Primary Chat', desc: 'Main chatbot response model' },
    { key: 'assigned_fallback_chat_provider_id', label: 'Fallback Chat', desc: 'Used when primary fails' },
    { key: 'assigned_embedding_provider_id', label: 'Embeddings', desc: 'Vector embedding model for RAG' },
    { key: 'assigned_summarization_provider_id', label: 'Summarization', desc: 'Customer profile summaries' },
    { key: 'assigned_agent_provider_id', label: 'Agent', desc: 'Super admin AI agent model' },
    { key: 'assigned_vision_provider_id', label: 'Vision', desc: 'Processes image and multimodal queries' },
    { key: 'assigned_comment_analysis_provider_id', label: 'Comment Analysis', desc: 'Processes auto-moderation and comment analysis' },
    { key: 'assigned_image_provider_id', label: 'Image Generation', desc: 'Processes text-to-image requests' },
  ] as const;

  async function assignProvider(field: string, providerId: string) {
    if (!userData) return;
    const val = providerId === 'default' ? null : providerId;
    const { error } = await supabase.from('users').update({ [field]: val }).eq('id', userData.id);
    if (error) { toast.error('Error: ' + error.message); return; }

    await supabase.from('admin_audit_log').insert({
      admin_id: currentUser?.id, target_id: userData.id, action: 'provider_override',
      details: { field, provider_id: val },
    });

    setUserData(prev => prev ? { ...prev, [field]: val } : null);
    toast.success('Provider override updated');
  }

  // ── Page CRUD ─────────────────────────────────────────────────────────────
  async function handleDisconnectPage(pageConnId: string) {
    setConfirmDialog({
      open: true, variant: 'danger', title: 'Disconnect Page',
      desc: 'Disconnect this Facebook Page? The bot will stop responding on this page.',
      onConfirm: async () => {
        const { error } = await supabase.from('page_connections').delete().eq('id', pageConnId);
        if (error) toast.error('Error: ' + error.message);
        else {
          setInspectData(prev => ({ ...prev, pages: prev.pages.filter(p => p.id !== pageConnId) }));
          setUserData(prev => prev ? { ...prev, pageCount: Math.max(0, prev.pageCount - 1) } : null);
        }
        setConfirmDialog(d => ({ ...d, open: false }));
      },
    });
  }

  async function handleTogglePage(pageConnId: string, currentActive: boolean) {
    const { error } = await supabase.from('page_connections').update({ is_active: !currentActive }).eq('id', pageConnId);
    if (error) toast.error('Error: ' + error.message);
    else setInspectData(prev => ({ ...prev, pages: prev.pages.map(p => p.id === pageConnId ? { ...p, is_active: !currentActive } : p) }));
  }

  function openAddPage() {
    const defaultProvider = allProviders.find(p => p.is_global && p.is_active_chat) || allProviders.find(p => p.is_global);
    setEditingPage(null);
    setPageForm({ page_id: '', page_name: '', access_token: '', bot_name: 'AI Support Bot', custom_system_prompt: '', ai_model: defaultProvider?.model_chat || 'gemini-1.5-flash', temperature: 0.5, is_active: true, ai_provider_id: '' });
    setCustomModelEnabled(false);
    setShowPageForm(true);
  }

  function openEditPage(p: any) {
    const defaultProvider = allProviders.find(prov => prov.is_global && prov.is_active_chat) || allProviders.find(prov => prov.is_global);
    setEditingPage(p);
    setPageForm({ page_id: p.page_id, page_name: p.page_name || '', access_token: '', bot_name: p.bot_name || '', custom_system_prompt: p.custom_system_prompt || '', ai_model: p.ai_model || defaultProvider?.model_chat || 'gemini-1.5-flash', temperature: p.temperature ?? 0.5, is_active: p.is_active, ai_provider_id: p.ai_provider_id || '' });
    
    const selectedProv = allProviders.find(prov => prov.id === p.ai_provider_id) || defaultProvider;
    const providerName = selectedProv?.provider_name || 'custom';
    const presets = getPresetChatModels(providerName);
    const inPresets = presets.some(m => m.id === p.ai_model);
    setCustomModelEnabled(p.ai_model ? !inPresets : false);

    setShowPageForm(true);
  }

  async function handlePageSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userData) return;
    setSavingForm(true);
    const payload: any = { page_id: pageForm.page_id, page_name: pageForm.page_name, bot_name: pageForm.bot_name, custom_system_prompt: pageForm.custom_system_prompt, ai_model: pageForm.ai_model, temperature: pageForm.temperature, is_active: pageForm.is_active, ai_provider_id: pageForm.ai_provider_id || null };
    if (pageForm.access_token) payload.access_token = pageForm.access_token;

    try {
      if (editingPage) {
        const { error } = await supabase.from('page_connections').update(payload).eq('id', editingPage.id);
        if (error) throw error;
      } else {
        if (!pageForm.access_token) { toast.warning('Access token is required'); setSavingForm(false); return; }
        const { error } = await supabase.from('page_connections').insert({ ...payload, user_id: userData.id, access_token: pageForm.access_token });
        if (error) throw error;
        setUserData(prev => prev ? { ...prev, pageCount: prev.pageCount + 1 } : null);
      }
      setShowPageForm(false);
      loadUserData();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSavingForm(false);
    }
  }

  // ── Knowledge field CRUD ──────────────────────────────────────────────────
  function openAddField() {
    setEditingField(null);
    setFieldForm({ field_name: '', field_value: '', category: 'general', page_id: '', is_active: true });
    setShowFieldForm(true);
  }

  function openEditField(f: any) {
    setEditingField(f);
    setFieldForm({ field_name: f.field_name, field_value: f.field_value, category: f.category || 'general', page_id: f.page_id || '', is_active: f.is_active });
    setShowFieldForm(true);
  }

  async function handleFieldSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userData) return;
    setSavingForm(true);
    const payload = { field_name: fieldForm.field_name, field_value: fieldForm.field_value, category: fieldForm.category, page_id: fieldForm.page_id || null, is_active: fieldForm.is_active };
    try {
      if (editingField) {
        const { error } = await supabase.from('knowledge_fields').update(payload).eq('id', editingField.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('knowledge_fields').insert({ ...payload, user_id: userData.id });
        if (error) throw error;
        setUserData(prev => prev ? { ...prev, fieldCount: prev.fieldCount + 1 } : null);
      }
      setShowFieldForm(false);
      loadUserData();
    } catch (err: any) { toast.error('Error: ' + err.message); }
    finally { setSavingForm(false); }
  }

  async function handleDeleteField(fieldId: string) {
    const { error } = await supabase.from('knowledge_fields').delete().eq('id', fieldId);
    if (error) toast.error('Error: ' + error.message);
    else {
      setInspectData(prev => ({ ...prev, fields: prev.fields.filter(f => f.id !== fieldId) }));
      setUserData(prev => prev ? { ...prev, fieldCount: Math.max(0, prev.fieldCount - 1) } : null);
    }
  }

  // ── Document CRUD ─────────────────────────────────────────────────────────
  function openAddDoc() {
    setEditingDoc(null);
    setDocForm({ title: '', original_content: '', selectedPageIds: [] });
    setShowDocForm(true);
  }

  function openEditDoc(d: any) {
    setEditingDoc(d);
    setDocForm({ title: d.title, original_content: d.original_content || '', selectedPageIds: d.assignedPageIds || [] });
    setShowDocForm(true);
  }

  async function handleDocSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userData) return;
    setSavingForm(true);
    let docId = editingDoc?.id;
    try {
      if (editingDoc) {
        const { error } = await supabase.from('documents').update({ title: docForm.title, original_content: docForm.original_content, page_id: null }).eq('id', editingDoc.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('documents').insert({ user_id: userData.id, title: docForm.title, original_content: docForm.original_content, source_type: 'text', page_id: null }).select().single();
        if (error) throw error;
        docId = data.id;
        setUserData(prev => prev ? { ...prev, documentCount: prev.documentCount + 1 } : null);
      }
      // Sync page assignments
      if (docId) {
        await supabase.from('document_page_assignments').delete().eq('document_id', docId);
        if (docForm.selectedPageIds.length > 0) {
          await supabase.from('document_page_assignments').insert(docForm.selectedPageIds.map(pid => ({ document_id: docId, page_id: pid })));
        }
        // Trigger embedding processing
        setProcessingDocId(docId);
        try {
          await workerPost('/api/documents/process', { documentId: docId, userId: userData.id });
        } catch (err: any) { toast.warning('Saved, but embedding failed: ' + err.message); }
        finally { setProcessingDocId(null); }
      }
      setShowDocForm(false);
      loadUserData();
    } catch (err: any) { toast.error('Error: ' + err.message); }
    finally { setSavingForm(false); }
  }

  async function handleDeleteDoc(docId: string) {
    const { error } = await supabase.from('documents').delete().eq('id', docId);
    if (error) toast.error('Error: ' + error.message);
    else {
      setInspectData(prev => ({ ...prev, documents: prev.documents.filter(d => d.id !== docId) }));
      setUserData(prev => prev ? { ...prev, documentCount: Math.max(0, prev.documentCount - 1) } : null);
    }
  }

  // ── Inbox ─────────────────────────────────────────────────────────────────
  async function loadInboxSessions() {
    if (!userId) return;
    setLoadingSessions(true);
    const { data } = await supabase.from('chat_sessions').select('*').eq('user_id', userId).order('last_message_at', { ascending: false }).limit(50);
    setSessions(data || []);
    setLoadingSessions(false);
  }

  async function loadSessionMessages(sessionId: string) {
    setSelectedSession(sessionId);
    const { data } = await supabase.from('chat_messages').select('*').eq('session_id', sessionId).order('created_at', { ascending: true });
    setMessages(data || []);
  }

  useEffect(() => {
    if (activeTab === 'inbox' && userId) loadInboxSessions();
  }, [activeTab, userId]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}><Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} /> Loading user data...</div>;
  if (!userData) return <div className="card" style={{ padding: '48px', textAlign: 'center' }}><ShieldAlert size={48} style={{ opacity: 0.5, margin: '0 auto 16px' }} /><h3>User not found</h3><Link to="/super-users" style={{ color: 'var(--accent-primary)' }}>← Back to Users</Link></div>;

  const initials = userData.display_name ? userData.display_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : userData.email[0].toUpperCase();

  return (
    <div className="animate-slideUp" style={styles.page}>
      {/* Breadcrumb */}
      <div style={styles.breadcrumb}>
        <Link to="/super-users" style={styles.breadcrumbLink}><ArrowLeft size={14} /> Users</Link>
        <ChevronRight size={14} />
        <span style={{ color: 'var(--text-primary)' }}>{userData.display_name || userData.email}</span>
      </div>

      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={styles.avatar(userData.role)}>{initials}</div>
          <div>
            <h1 style={{ fontSize: '22px', margin: 0 }}>{userData.display_name || 'Unnamed User'}</h1>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' }}>{userData.email}</div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
              <span style={styles.badge(
                userData.role === 'super_admin' ? '#c084fc' : userData.role === 'admin' ? '#60a5fa' : '#9ca3af',
                userData.role === 'super_admin' ? 'rgba(192,132,252,0.15)' : userData.role === 'admin' ? 'rgba(96,165,250,0.15)' : 'rgba(156,163,175,0.1)',
              )}>
                {userData.role === 'super_admin' ? <Crown size={10} /> : userData.role === 'admin' ? <Shield size={10} /> : <User size={10} />}
                {userData.role.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </span>
              <span style={styles.badge(
                userData.plan === 'enterprise' ? '#c084fc' : userData.plan === 'pro' ? '#f59e0b' : '#9ca3af',
                userData.plan === 'enterprise' ? 'rgba(192,132,252,0.15)' : userData.plan === 'pro' ? 'rgba(245,158,11,0.15)' : 'rgba(156,163,175,0.1)',
              )}>
                {userData.plan.charAt(0).toUpperCase() + userData.plan.slice(1)}
              </span>
              {userData.is_paused && <span style={styles.badge('#9ca3af', 'rgba(156,163,175,0.15)')}>
                <Pause size={10} /> Paused
              </span>}
              {userData.is_suspended && <span style={styles.badge('#ef4444', 'rgba(239,68,68,0.15)')}>
                <Ban size={10} /> Suspended
              </span>}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {userData.role !== 'super_admin' && (
            <button className="btn btn-outline" onClick={handleImpersonate} style={{ fontSize: '13px', padding: '8px 14px' }}>
              <Eye size={14} /> Impersonate
            </button>
          )}
          <button className="btn btn-outline" onClick={togglePause} style={{ fontSize: '13px', padding: '8px 14px', borderColor: userData.is_paused ? 'rgba(34,197,94,0.3)' : 'rgba(156,163,175,0.3)', color: userData.is_paused ? '#22c55e' : '#9ca3af' }}>
            {userData.is_paused ? <Play size={14} /> : <Pause size={14} />}
            {userData.is_paused ? 'Resume' : 'Pause'}
          </button>
          <button className="btn btn-outline" onClick={toggleSuspension} style={{ fontSize: '13px', padding: '8px 14px', borderColor: userData.is_suspended ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)', color: userData.is_suspended ? '#22c55e' : '#ef4444' }}>
            {userData.is_suspended ? <UserCheck size={14} /> : <Ban size={14} />}
            {userData.is_suspended ? 'Unsuspend' : 'Suspend'}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={styles.stat}><span style={styles.statVal}>{userData.pageCount}</span><span style={styles.statLabel}>Channels</span></div>
        <div style={styles.stat}><span style={styles.statVal}>{userData.documentCount}</span><span style={styles.statLabel}>Documents</span></div>
        <div style={styles.stat}><span style={styles.statVal}>{userData.fieldCount}</span><span style={styles.statLabel}>KB Facts</span></div>
        <div style={styles.stat}><span style={styles.statVal}>{userData.sessionCount}</span><span style={styles.statLabel}>Sessions</span></div>
        <div style={styles.stat}><span style={styles.statVal}>{userData.messageCount.toLocaleString()}</span><span style={styles.statLabel}>Messages</span></div>
        <div style={styles.stat}><span style={styles.statVal}>{(() => {
          const total = (userData.monthly_credits_limit ?? 0) + (userData.extra_credits_balance ?? 0);
          const remaining = Math.max(0, total - (userData.credits_used_this_month ?? 0));
          return remaining.toLocaleString();
        })()}</span><span style={styles.statLabel}>Credits Left</span></div>
        <div style={styles.stat}><span style={styles.statVal}>{inspectData.usage.totalMonthTokens.toLocaleString()}</span><span style={styles.statLabel}>Tokens (MTD)</span></div>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        {TABS.map(t => (
          <button key={t.key} style={styles.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: OVERVIEW & QUOTAS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div style={styles.grid2}>
          {/* Profile & Role card */}
          <div style={styles.card}>
            <div style={styles.cardTitle}><Settings size={16} /> Profile & Plan</div>
            <div style={styles.formRow}>
              <label style={styles.formLabel}>Plan</label>
              <select className="form-input" value={userData.plan} onChange={e => changePlan(e.target.value)}>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            <div style={styles.formRow}>
              <label style={styles.formLabel}>Role</label>
              <select className="form-input" value={userData.role} onChange={e => changeRole(e.target.value as UserRole)} disabled={userData.id === currentUser?.id}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Created: {new Date(userData.created_at).toLocaleDateString()}
            </div>
          </div>

          {/* Quotas card */}
          <form onSubmit={handleSaveQuota} style={styles.card}>
            <div style={styles.cardTitle}><Zap size={16} /> Usage Quotas</div>
            <div style={styles.formRow}>
              <label style={styles.formLabel}>Monthly Token Limit</label>
              <input className="form-input" type="number" value={monthlyLimitInput} onChange={e => setMonthlyLimitInput(Number(e.target.value))} />
            </div>
            <div style={styles.formRow}>
              <label style={styles.formLabel}>Allowed Channels (0 = unlimited)</label>
              <input className="form-input" type="number" value={allowedChannelsInput} onChange={e => setAllowedChannelsInput(Number(e.target.value))} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <input type="checkbox" id="strictEnf" checked={strictEnforcementInput} onChange={e => setStrictEnforcementInput(e.target.checked)} />
              <label htmlFor="strictEnf" style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Strict token enforcement</label>
            </div>

            <div style={{ marginTop: '20px', marginBottom: '12px', borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
              <div style={{ ...styles.cardTitle, marginBottom: '12px' }}><Zap size={16} /> Credit Quotas</div>
              
              <div style={styles.formRow}>
                <label style={styles.formLabel}>Monthly Credits Limit</label>
                <input className="form-input" type="number" value={monthlyCreditsLimitInput} onChange={e => setMonthlyCreditsLimitInput(Number(e.target.value))} />
              </div>

              <div style={styles.formRow}>
                <label style={styles.formLabel}>Extra Credits Balance</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    className="form-input" 
                    type="number" 
                    value={extraCreditsBalanceInput} 
                    onChange={e => setExtraCreditsBalanceInput(Number(e.target.value))} 
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setGiftAmount(100);
                      setGiftCurrency('USD');
                      setGiftNotes('Gifted credits');
                      setGiftModalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      padding: '4px 10px',
                      height: '38px',
                      borderRadius: '6px',
                      borderColor: 'var(--accent-primary)',
                      color: 'var(--accent-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    <Gift size={12} /> Gift Credits 🎁
                  </button>
                </div>
              </div>

              <div style={styles.formRow}>
                <label style={styles.formLabel}>Credits Used This Month</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    className="form-input" 
                    type="number" 
                    value={creditsUsedThisMonthInput} 
                    onChange={e => setCreditsUsedThisMonthInput(Number(e.target.value))} 
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setCreditsUsedThisMonthInput(0)}
                    style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      height: '38px',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                  >
                    Reset to 0
                  </button>
                </div>
              </div>

              <div style={styles.formRow}>
                <label style={styles.formLabel}>
                  Current Credit Balance (Remaining)
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '6px', fontWeight: 'normal' }}>
                    (Calculated: Limit + Extra - Used)
                  </span>
                </label>
                <input 
                  className="form-input" 
                  type="number" 
                  value={(monthlyCreditsLimitInput + extraCreditsBalanceInput) - creditsUsedThisMonthInput} 
                  onChange={e => handleRemainingCreditsChange(Number(e.target.value))}
                  style={{ borderColor: 'var(--accent-primary)', fontWeight: 'bold' }}
                />
              </div>

              <div style={styles.formRow}>
                <label style={styles.formLabel}>Daily Credit Spend Cap (0 = unlimited)</label>
                <input className="form-input" type="number" value={dailyCreditSpendCapInput} onChange={e => setDailyCreditSpendCapInput(Number(e.target.value))} />
              </div>

              <div style={{ marginTop: '20px', marginBottom: '12px', borderTop: '1px solid var(--border-primary)', paddingTop: '16px' }}>
                <div style={{ ...styles.cardTitle, marginBottom: '12px' }}><Settings size={14} /> Feature Access & Permissions</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px' }}>
                  Toggle which AI services this user is allowed to access. Default is enabled.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '20px' }}>
                  {/* Chatbot Responses */}
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-primary)',
                    background: allowChatInput ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-tertiary)',
                    borderColor: allowChatInput ? 'var(--accent-primary)' : 'var(--border-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                        <MessageSquare size={16} style={{ color: allowChatInput ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                        Chat Responses
                      </div>
                      <input 
                        type="checkbox" 
                        checked={allowChatInput} 
                        onChange={e => setAllowChatInput(e.target.checked)} 
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      DM & chat automated replies.
                    </span>
                  </label>

                  {/* Comments Automation */}
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-primary)',
                    background: allowCommentAnalysisInput ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-tertiary)',
                    borderColor: allowCommentAnalysisInput ? 'var(--accent-primary)' : 'var(--border-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                        <Zap size={16} style={{ color: allowCommentAnalysisInput ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                        Comments Reply
                      </div>
                      <input 
                        type="checkbox" 
                        checked={allowCommentAnalysisInput} 
                        onChange={e => setAllowCommentAnalysisInput(e.target.checked)} 
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Post comment scanning & responses.
                    </span>
                  </label>

                  {/* Vision Processing */}
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-primary)',
                    background: allowVisionInput ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-tertiary)',
                    borderColor: allowVisionInput ? 'var(--accent-primary)' : 'var(--border-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                        <Eye size={16} style={{ color: allowVisionInput ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                        Vision Queries
                      </div>
                      <input 
                        type="checkbox" 
                        checked={allowVisionInput} 
                        onChange={e => setAllowVisionInput(e.target.checked)} 
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      AI understanding of user photos.
                    </span>
                  </label>

                  {/* Image Generation */}
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-primary)',
                    background: allowImageGenInput ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-tertiary)',
                    borderColor: allowImageGenInput ? 'var(--accent-primary)' : 'var(--border-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                        <Image size={16} style={{ color: allowImageGenInput ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                        Image Generation
                      </div>
                      <input 
                        type="checkbox" 
                        checked={allowImageGenInput} 
                        onChange={e => setAllowImageGenInput(e.target.checked)} 
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      FLUX & creative asset generation.
                    </span>
                  </label>

                  {/* Embeddings / RAG */}
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-primary)',
                    background: allowEmbeddingsInput ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-tertiary)',
                    borderColor: allowEmbeddingsInput ? 'var(--accent-primary)' : 'var(--border-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                        <BookOpen size={16} style={{ color: allowEmbeddingsInput ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                        Embeddings & RAG
                      </div>
                      <input 
                        type="checkbox" 
                        checked={allowEmbeddingsInput} 
                        onChange={e => setAllowEmbeddingsInput(e.target.checked)} 
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Knowledge base document indexing.
                    </span>
                  </label>

                  {/* Super Admin Agent */}
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-primary)',
                    background: allowAgentInput ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-tertiary)',
                    borderColor: allowAgentInput ? 'var(--accent-primary)' : 'var(--border-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                        <Cpu size={16} style={{ color: allowAgentInput ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                        Autopilot Agent
                      </div>
                      <input 
                        type="checkbox" 
                        checked={allowAgentInput} 
                        onChange={e => setAllowAgentInput(e.target.checked)} 
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Autonomous agent task runner.
                    </span>
                  </label>

                  {/* Summarization */}
                  <label style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-primary)',
                    background: allowSummarizationInput ? 'rgba(99, 102, 241, 0.04)' : 'var(--bg-tertiary)',
                    borderColor: allowSummarizationInput ? 'var(--accent-primary)' : 'var(--border-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                        <FileText size={16} style={{ color: allowSummarizationInput ? 'var(--accent-primary)' : 'var(--text-secondary)' }} />
                        Summarization
                      </div>
                      <input 
                        type="checkbox" 
                        checked={allowSummarizationInput} 
                        onChange={e => setAllowSummarizationInput(e.target.checked)} 
                        style={{ cursor: 'pointer' }}
                      />
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Session & profile auto summaries.
                    </span>
                  </label>
                </div>

                {allowCommentAnalysisInput && (
                  <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-primary)' }}>
                    <div style={styles.formRow}>
                      <label style={styles.formLabel}>Sentiment Analysis Scope</label>
                      <select 
                        className="form-input" 
                        value={sentimentAnalysisScopeInput} 
                        onChange={e => setSentimentAnalysisScopeInput(e.target.value as 'global' | 'specific_posts')}
                      >
                        <option value="global">Scan All Posts (Global)</option>
                        <option value="specific_posts">Scan Only Watched Posts</option>
                      </select>
                    </div>

                    {sentimentAnalysisScopeInput === 'specific_posts' && (
                      <div style={{ ...styles.formRow, marginBottom: 0, marginTop: '12px' }}>
                        <label style={styles.formLabel}>Watched Facebook/Instagram Post IDs (comma-separated)</label>
                        <input 
                          className="form-input" 
                          type="text" 
                          placeholder="e.g. 12345678, 87654321" 
                          value={sentimentWatchedPostIdsInput} 
                          onChange={e => setSentimentWatchedPostIdsInput(e.target.value)} 
                        />
                      </div>
                    )}
                  </div>
                )}

                <div style={styles.formRow}>
                  <label style={styles.formLabel}>Image Generation Model Override</label>
                  <select 
                    className="form-input" 
                    value={imageModelInput} 
                    onChange={e => setImageModelInput(e.target.value)}
                  >
                    <option value="flux">FLUX (Recommended)</option>
                    <option value="dall-e-3">DALL-E 3</option>
                    <option value="stable-diffusion-xl">Stable Diffusion XL</option>
                    <option value="recraft">Recraft (Vector/Creative)</option>
                  </select>
                </div>

                <div style={styles.formRow}>
                  <label style={styles.formLabel}>Brand Voice Profile & Language Rules</label>
                  <textarea 
                    className="form-input" 
                    rows={4}
                    style={{ resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
                    placeholder="e.g. Friendly and professional. Speak in French when comments are in French. Avoid emojis."
                    value={brandVoiceProfileInput} 
                    onChange={e => setBrandVoiceProfileInput(e.target.value)} 
                  />
                </div>
              </div>
            </div>

            <button className="btn btn-primary" type="submit" disabled={savingQuota} style={{ width: '100%' }}>
              <Save size={14} /> {savingQuota ? 'Saving...' : 'Save Quotas'}
            </button>
          </form>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: AI CONFIGURATION */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'ai' && (
        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
            Override AI providers for this user. When set to "Inherit Global", the system-wide provider is used.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {PROVIDER_ROLES.map(role => {
              const currentValue = (userData as any)[role.key] || null;
              const isCustom = !!currentValue;
              const provider = currentValue ? allProviders.find(p => p.id === currentValue) : null;

              return (
                <div key={role.key} style={styles.providerCard(isCustom)}>
                  {isCustom && <div style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '10px', fontWeight: 600, color: 'var(--accent-primary)', background: 'rgba(99,102,241,0.1)', padding: '2px 6px', borderRadius: '4px' }}>CUSTOM</div>}
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{role.label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '12px' }}>{role.desc}</div>
                  <select className="form-input" value={currentValue || 'default'} onChange={e => assignProvider(role.key, e.target.value)} style={{ fontSize: '13px' }}>
                    <option value="default">Inherit Global</option>
                    {globalProviders.map(p => <option key={p.id} value={p.id}>🌐 {p.display_name}</option>)}
                    {allProviders.filter(p => !p.is_global).map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                  </select>
                  {isCustom && provider && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      Model: {provider.model_chat || provider.model_embedding || 'N/A'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: CHANNELS & BOTS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'channels' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={styles.cardTitle}><Globe size={16} /> Connected Pages ({inspectData.pages.length})</div>
            <button className="btn btn-primary" onClick={openAddPage} style={{ fontSize: '13px' }}><Plus size={14} /> Add Page</button>
          </div>

          {inspectData.pages.length === 0 ? (
            <div style={{ ...styles.card, textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No pages connected</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {inspectData.pages.map((p: any) => (
                <div key={p.id} style={{ ...styles.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{p.page_name || p.page_id}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Bot: {p.bot_name || 'Default'} • {p.ai_model || 'Default model'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <span style={styles.badge(p.is_active ? '#22c55e' : '#ef4444', p.is_active ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)')}>
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button className="btn-ghost btn-icon" onClick={() => openEditPage(p)} title="Edit"><Pencil size={14} /></button>
                    <button className="btn-ghost btn-icon" onClick={() => handleTogglePage(p.id, p.is_active)} title="Toggle"><RefreshCw size={14} /></button>
                    <button className="btn-ghost btn-icon" onClick={() => handleDisconnectPage(p.id)} title="Disconnect" style={{ color: 'var(--error)' }}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Page form modal */}
          {showPageForm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowPageForm(false)}>
              <form onSubmit={handlePageSubmit} onClick={e => e.stopPropagation()} style={{ ...styles.card, maxWidth: '500px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
                <h3 style={{ marginBottom: '16px' }}>{editingPage ? 'Edit Page' : 'Add Page'}</h3>
                {['page_id', 'page_name', 'access_token', 'bot_name'].map(field => (
                  <div key={field} style={styles.formRow}>
                    <label style={styles.formLabel}>{field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</label>
                    <input className="form-input" value={(pageForm as any)[field]} onChange={e => setPageForm(prev => ({ ...prev, [field]: e.target.value }))} placeholder={field === 'access_token' && editingPage ? '(leave blank to keep current)' : ''} />
                  </div>
                ))}
                <div style={styles.formRow}>
                  <label style={styles.formLabel}>AI Provider</label>
                  <select 
                    className="form-select"
                    value={pageForm.ai_provider_id}
                    onChange={e => {
                      const providerId = e.target.value;
                      const selectedProv = allProviders.find(p => p.id === providerId);
                      const defaultProv = allProviders.find(p => p.is_global && p.is_active_chat) || allProviders.find(p => p.is_global);
                      const chosenProv = selectedProv || defaultProv;
                      setPageForm(prev => ({ 
                        ...prev, 
                        ai_provider_id: providerId,
                        ai_model: chosenProv?.model_chat || ''
                      }));
                      setCustomModelEnabled(false);
                    }}
                  >
                    <option value="">Default Account / Active Provider</option>
                    {allProviders.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.display_name} ({p.provider_name} - {p.model_chat || 'no chat model'})
                      </option>
                    ))}
                  </select>
                </div>
                {(() => {
                  const selectedProv = allProviders.find(p => p.id === pageForm.ai_provider_id) || allProviders.find(p => p.is_global && p.is_active_chat) || allProviders.find(p => p.is_global);
                  const providerName = selectedProv?.provider_name || 'custom';
                  const presets = getPresetChatModels(providerName);
                  const freePresets = presets.filter(m => m.isFree);

                  return (
                    <div style={styles.formRow}>
                      <label style={styles.formLabel}>AI Model Override</label>
                      {presets.length > 0 ? (
                        <>
                          <select 
                            className="form-select" 
                            value={customModelEnabled ? 'custom' : pageForm.ai_model} 
                            onChange={e => {
                              if (e.target.value === 'custom') {
                                setCustomModelEnabled(true);
                                setPageForm(prev => ({ ...prev, ai_model: '' }));
                              } else {
                                setCustomModelEnabled(false);
                                setPageForm(prev => ({ ...prev, ai_model: e.target.value }));
                              }
                            }}
                          >
                            {freePresets.length > 0 && (
                              <optgroup label="Free Models (Quick Access)">
                                {freePresets.map(m => (
                                  <option key={`free-override-${m.id}`} value={m.id}>
                                    🎁 [FREE] {m.name} ({m.context}{m.capabilities ? ` - ${m.capabilities}` : ''})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="All Models">
                              {presets.map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.context}{m.capabilities ? ` - ${m.capabilities}` : ''}){m.isFree ? ' [FREE]' : ''}
                                </option>
                              ))}
                            </optgroup>
                            <option value="custom">Custom (Type model name manually)...</option>
                          </select>
                          {customModelEnabled && (
                            <input 
                              className="form-input" 
                              style={{ marginTop: '8px' }}
                              placeholder="Enter custom model ID" 
                              value={pageForm.ai_model} 
                              onChange={e => setPageForm(prev => ({ ...prev, ai_model: e.target.value }))} 
                            />
                          )}
                        </>
                      ) : (
                        <input 
                          className="form-input" 
                          placeholder="e.g. gemini-1.5-flash" 
                          value={pageForm.ai_model} 
                          onChange={e => setPageForm(prev => ({ ...prev, ai_model: e.target.value }))} 
                        />
                      )}
                    </div>
                  );
                })()}
                <div style={styles.formRow}>
                  <label style={styles.formLabel}>System Prompt</label>
                  <textarea className="form-input" rows={4} value={pageForm.custom_system_prompt} onChange={e => setPageForm(prev => ({ ...prev, custom_system_prompt: e.target.value }))} />
                </div>
                <div style={styles.formRow}>
                  <label style={styles.formLabel}>Temperature: {pageForm.temperature}</label>
                  <input type="range" min={0} max={1} step={0.1} value={pageForm.temperature} onChange={e => setPageForm(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))} />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button type="submit" className="btn btn-primary" disabled={savingForm}>{savingForm ? 'Saving...' : 'Save'}</button>
                  <button type="button" className="btn btn-outline" onClick={() => setShowPageForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 4: KNOWLEDGE & DOCUMENTS */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'knowledge' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Knowledge Base section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={styles.cardTitle}><BookOpen size={16} /> Knowledge Base ({inspectData.fields.length})</div>
              <button className="btn btn-primary" onClick={openAddField} style={{ fontSize: '13px' }}><Plus size={14} /> Add Fact</button>
            </div>
            {inspectData.fields.length === 0 ? (
              <div style={{ ...styles.card, textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>No knowledge facts</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {inspectData.fields.map((f: any) => (
                  <div key={f.id} style={{ ...styles.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{f.field_name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.field_value}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button className="btn-ghost btn-icon" onClick={() => openEditField(f)}><Pencil size={14} /></button>
                      <button className="btn-ghost btn-icon" onClick={() => handleDeleteField(f.id)} style={{ color: 'var(--error)' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={styles.cardTitle}><FileText size={16} /> Documents ({inspectData.documents.length})</div>
              <button className="btn btn-primary" onClick={openAddDoc} style={{ fontSize: '13px' }}><Plus size={14} /> Add Document</button>
            </div>
            {inspectData.documents.length === 0 ? (
              <div style={{ ...styles.card, textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>No documents</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {inspectData.documents.map((d: any) => (
                  <div key={d.id} style={{ ...styles.card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px' }}>
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{d.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{d.chunk_count || 0} chunks • {d.source_type}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      {processingDocId === d.id && <Loader2 size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />}
                      <button className="btn-ghost btn-icon" onClick={() => openEditDoc(d)}><Pencil size={14} /></button>
                      <button className="btn-ghost btn-icon" onClick={async () => { setProcessingDocId(d.id); try { await workerPost('/api/documents/process', { documentId: d.id, userId: userData.id }); toast.success('Reprocessed'); } catch (e: any) { toast.error(e.message); } finally { setProcessingDocId(null); } }} title="Re-embed"><RefreshCw size={14} /></button>
                      <button className="btn-ghost btn-icon" onClick={() => handleDeleteDoc(d.id)} style={{ color: 'var(--error)' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Field form modal */}
          {showFieldForm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowFieldForm(false)}>
              <form onSubmit={handleFieldSubmit} onClick={e => e.stopPropagation()} style={{ ...styles.card, maxWidth: '420px', width: '100%' }}>
                <h3 style={{ marginBottom: '16px' }}>{editingField ? 'Edit Fact' : 'Add Fact'}</h3>
                <div style={styles.formRow}>
                  <label style={styles.formLabel}>Field Name</label>
                  <input className="form-input" value={fieldForm.field_name} onChange={e => setFieldForm(prev => ({ ...prev, field_name: e.target.value }))} required />
                </div>
                <div style={styles.formRow}>
                  <label style={styles.formLabel}>Value</label>
                  <textarea className="form-input" rows={3} value={fieldForm.field_value} onChange={e => setFieldForm(prev => ({ ...prev, field_value: e.target.value }))} required />
                </div>
                <div style={styles.formRow}>
                  <label style={styles.formLabel}>Category</label>
                  <input className="form-input" value={fieldForm.category} onChange={e => setFieldForm(prev => ({ ...prev, category: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button type="submit" className="btn btn-primary" disabled={savingForm}>{savingForm ? 'Saving...' : 'Save'}</button>
                  <button type="button" className="btn btn-outline" onClick={() => setShowFieldForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}

          {/* Doc form modal */}
          {showDocForm && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }} onClick={() => setShowDocForm(false)}>
              <form onSubmit={handleDocSubmit} onClick={e => e.stopPropagation()} style={{ ...styles.card, maxWidth: '500px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
                <h3 style={{ marginBottom: '16px' }}>{editingDoc ? 'Edit Document' : 'Add Document'}</h3>
                <div style={styles.formRow}>
                  <label style={styles.formLabel}>Title</label>
                  <input className="form-input" value={docForm.title} onChange={e => setDocForm(prev => ({ ...prev, title: e.target.value }))} required />
                </div>
                <div style={styles.formRow}>
                  <label style={styles.formLabel}>Content</label>
                  <textarea className="form-input" rows={8} value={docForm.original_content} onChange={e => setDocForm(prev => ({ ...prev, original_content: e.target.value }))} required />
                </div>
                {inspectData.pages.length > 0 && (
                  <div style={styles.formRow}>
                    <label style={styles.formLabel}>Assign to Pages</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {inspectData.pages.map((p: any) => (
                        <label key={p.page_id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', background: docForm.selectedPageIds.includes(p.page_id) ? 'rgba(99,102,241,0.15)' : 'var(--bg-tertiary)', border: `1px solid ${docForm.selectedPageIds.includes(p.page_id) ? 'var(--accent-primary)' : 'var(--border-primary)'}` }}>
                          <input type="checkbox" checked={docForm.selectedPageIds.includes(p.page_id)} onChange={() => setDocForm(prev => ({ ...prev, selectedPageIds: prev.selectedPageIds.includes(p.page_id) ? prev.selectedPageIds.filter(id => id !== p.page_id) : [...prev.selectedPageIds, p.page_id] }))} style={{ display: 'none' }} />
                          {p.page_name || p.page_id}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                  <button type="submit" className="btn btn-primary" disabled={savingForm}>{savingForm ? 'Saving...' : 'Save & Process'}</button>
                  <button type="button" className="btn btn-outline" onClick={() => setShowDocForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 5: INBOX MIRROR */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'inbox' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '16px', minHeight: '400px' }}>
          {/* Session list */}
          <div style={{ ...styles.card, padding: '0', overflowY: 'auto', maxHeight: '600px' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-primary)', fontWeight: 600, fontSize: '13px' }}>
              Sessions ({sessions.length})
            </div>
            {loadingSessions ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>No sessions</div>
            ) : (
              sessions.map((s: any) => (
                <div
                  key={s.id}
                  onClick={() => loadSessionMessages(s.id)}
                  style={{
                    padding: '10px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border-primary)',
                    background: selectedSession === s.id ? 'var(--bg-tertiary)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{s.sender_name || s.sender_id}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{s.message_count} msgs</span>
                    <span>{new Date(s.last_message_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Messages */}
          <div style={{ ...styles.card, padding: '0', display: 'flex', flexDirection: 'column' }}>
            {!selectedSession ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                Select a session to view messages
              </div>
            ) : (
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px' }}>
                {messages.map((m: any) => (
                  <div key={m.id} style={{
                    alignSelf: m.role === 'assistant' || m.role === 'human_agent' ? 'flex-end' : 'flex-start',
                    maxWidth: '75%', padding: '8px 12px', borderRadius: '12px', fontSize: '13px',
                    background: m.role === 'assistant' ? 'var(--accent-primary)' : m.role === 'human_agent' ? '#059669' : 'var(--bg-tertiary)',
                    color: m.role === 'assistant' || m.role === 'human_agent' ? '#fff' : 'var(--text-primary)',
                  }}>
                    <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '4px' }}>{m.role}</div>
                    {m.content}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={confirmDialog.open}
        onClose={() => setConfirmDialog(d => ({ ...d, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        description={confirmDialog.desc}
        variant={confirmDialog.variant}
        typeToConfirm={confirmDialog.typeToConfirm}
      />

      {/* 🎁 Gift Queries Modal */}
      {giftModalOpen && userData && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
          onClick={() => setGiftModalOpen(false)}
        >
          <form 
            onSubmit={handleGiftSubmit}
            className="card animate-scaleUp" 
            style={{
              maxWidth: '480px', 
              width: '100%', 
              background: 'var(--bg-primary, #111315)', 
              border: '1px solid var(--border-primary, rgba(255,255,255,0.08))',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.65)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Gift size={20} style={{ color: 'var(--accent-primary, #6366f1)' }} />
                Gift Extra AI Credits
              </h3>
              <button 
                type="button"
                className="btn-ghost btn-icon" 
                onClick={() => setGiftModalOpen(false)}
                style={{ padding: '4px', borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.4 }}>
              Add extra AI Credits for <strong>{userData.display_name || userData.email}</strong>. The price will be calculated automatically but you can modify it as needed.
            </p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  Credits Amount
                </label>
                <input 
                  type="number"
                  min="1"
                  required
                  className="form-input"
                  value={giftAmount}
                  onChange={e => setGiftAmount(Math.max(1, parseInt(e.target.value) || 0))}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '90px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Currency</label>
                <select 
                  className="form-input"
                  value={giftCurrency}
                  onChange={e => setGiftCurrency(e.target.value as 'USD' | 'BTT')}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                >
                  <option value="USD">USD ($)</option>
                  <option value="BTT">BTT</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Total Price (Calculated automatically, but editable)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {giftCurrency === 'BTT' ? 'BTT' : '$'}
                </span>
                <input 
                  type="text"
                  required
                  className="form-input"
                  value={giftPrice}
                  onChange={e => setGiftPrice(e.target.value)}
                  style={{ paddingLeft: giftCurrency === 'BTT' ? '45px' : '28px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Admin Notes / Log Reason
              </label>
              <textarea
                className="form-input"
                placeholder="e.g. Loyalty gift, refund compensation"
                rows={2}
                value={giftNotes}
                onChange={e => setGiftNotes(e.target.value)}
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', padding: '10px', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setGiftModalOpen(false)}
                disabled={giftSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={giftSubmitting}
                style={{ 
                  background: 'var(--accent-gradient, linear-gradient(135deg, #6366f1, #8b5cf6))', 
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {giftSubmitting ? 'Processing...' : 'Confirm Gift 🎁'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
