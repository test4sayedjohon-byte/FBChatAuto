import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';
import {
  Sliders,
  Plus,
  Trash2,
  Edit3,
  Search,
  Download,
  Upload,
  X,
  Eye,
  Play,
  FileText,
  FileImage,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Smartphone,
  Cpu,
  Info,
  ChevronDown,
  ChevronUp as ChevronUpIcon,
  CheckCircle2,
  MessageSquare,
  Zap,
  RefreshCw
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface ChatRule {
  id: string;
  user_id: string;
  page_connection_id: string;
  name: string;
  keywords: string[];
  match_type: 'contains' | 'exact';
  case_sensitive: boolean;
  action_type: 'text' | 'flow' | 'media' | 'ai_push';
  reply_templates: string[];
  reply_text_after?: string | null;
  ai_prompt_directive?: string | null;
  dm_flow_id: string | null;
  media_id: string | null;
  priority: number;
  is_active: boolean;
  match_count: number;
  reply_mode?: 'random' | 'all' | null;
  created_at?: string;
  updated_at?: string;
}

interface ChatRuleLog {
  id: string;
  matched_keyword: string;
  incoming_message: string;
  action_taken: string;
  created_at: string;
  chat_rules?: { name: string } | null;
  chat_sessions?: { sender_name: string | null } | null;
}

interface PageConnection {
  page_id: string;
  page_name: string;
  platform: string;
}

interface DMFlow {
  id: string;
  name: string;
}

interface MediaAsset {
  id: string;
  name: string;
  friendly_name: string;
  file_url: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function ActionBadge({ type, replyMode }: { type: ChatRule['action_type']; replyMode?: ChatRule['reply_mode'] }) {
  const cfg = {
    text:    { label: replyMode === 'all' ? 'Text Series' : 'Text (Random)', color: '#f97316', bg: 'rgba(249,115,22,0.12)',    icon: <FileText size={12} /> },
    media:   { label: 'Media + Text', color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  icon: <FileImage size={12} /> },
    flow:    { label: 'Visual Flow', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',   icon: <Play size={12} /> },
    ai_push: { label: 'AI Instruct', color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: <Sparkles size={12} /> },
  }[type];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '3px 10px', borderRadius: '999px',
      background: cfg.bg, color: cfg.color,
      fontSize: '11px', fontWeight: 600,
      border: `1px solid ${cfg.color}33`
    }}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function Tooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <Info
        size={13}
        style={{ cursor: 'help', color: 'var(--text-muted)', flexShrink: 0 }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      />
      {open && (
        <span style={{
          position: 'absolute', bottom: '130%', left: '50%', transform: 'translateX(-50%)',
          background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.12)',
          color: 'var(--text-secondary)', fontSize: '11px', lineHeight: '1.5',
          padding: '8px 12px', borderRadius: '8px', whiteSpace: 'normal',
          width: '220px', zIndex: 9999, pointerEvents: 'none',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

/* ─── Shared inline style objects ────────────────────────────────────────── */

const S = {
  card: {
    background: 'rgba(20,20,20,0.85)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '16px',
    backdropFilter: 'blur(16px)',
  } as React.CSSProperties,

  sectionBox: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: '12px',
    padding: '20px',
  } as React.CSSProperties,

  pill: (active: boolean) => ({
    padding: '12px 16px', borderRadius: '12px', cursor: 'pointer',
    border: active ? '2px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.08)',
    background: active ? 'rgba(249,115,22,0.08)' : 'rgba(255,255,255,0.02)',
    transition: 'all 0.2s',
    textAlign: 'left' as const,
  }),

  label: {
    display: 'flex', alignItems: 'center', gap: '6px',
    fontSize: '12px', fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } as React.CSSProperties,

  input: {
    width: '100%', padding: '10px 14px',
    background: 'rgba(10,10,10,0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', color: '#f1f5f9',
    fontSize: '14px', fontFamily: 'inherit',
    outline: 'none', transition: 'border-color 0.15s',
  } as React.CSSProperties,

  select: {
    width: '100%', padding: '10px 14px',
    background: 'rgba(10,10,10,0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', color: '#f1f5f9',
    fontSize: '14px', fontFamily: 'inherit',
    outline: 'none', cursor: 'pointer',
    appearance: 'none' as const,
  } as React.CSSProperties,

  textarea: {
    width: '100%', padding: '10px 14px',
    background: 'rgba(10,10,10,0.9)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px', color: '#f1f5f9',
    fontSize: '14px', fontFamily: 'inherit',
    outline: 'none', resize: 'vertical' as const,
    lineHeight: 1.6,
  } as React.CSSProperties,

  divider: {
    borderTop: '1px solid rgba(255,255,255,0.06)',
    margin: '20px 0',
  } as React.CSSProperties,
};

/* ─── Main Component ─────────────────────────────────────────────────────── */

export default function KeywordRulesPage() {
  const { user } = useAuth();
  const [rules, setRules] = useState<ChatRule[]>([]);
  const [logs, setLogs] = useState<ChatRuleLog[]>([]);
  const [pages, setPages] = useState<PageConnection[]>([]);
  const [flows, setFlows] = useState<DMFlow[]>([]);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPage, setFilterPage] = useState('all');
  const [logsOpen, setLogsOpen] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ChatRule | null>(null);

  // Form
  const [formName, setFormName] = useState('');
  const [formPageId, setFormPageId] = useState('');
  const [formKeywords, setFormKeywords] = useState<string[]>([]);
  const [formKeywordInput, setFormKeywordInput] = useState('');
  const [formMatchType, setFormMatchType] = useState<'contains' | 'exact'>('contains');
  const [formCaseSensitive, setFormCaseSensitive] = useState(false);
  const [formActionType, setFormActionType] = useState<ChatRule['action_type']>('text');
  const [formReplyTemplates, setFormReplyTemplates] = useState<string[]>([]);
  const [formReplyInput, setFormReplyInput] = useState('');        // text-before (media) OR new template (text)
  const [formReplyTextAfter, setFormReplyTextAfter] = useState('');
  const [formAiPromptDirective, setFormAiPromptDirective] = useState('');
  const [formFlowId, setFormFlowId] = useState('');
  const [formMediaId, setFormMediaId] = useState('');
  const [formPriority, setFormPriority] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formReplyMode, setFormReplyMode] = useState<'random' | 'all'>('random');

  /* ─── Data Loading ───────────────────────────────────────────────────── */

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);

      const { data: pageData, error: pageErr } = await supabase
        .from('page_connections')
        .select('page_id, page_name, is_whatsapp_active, is_instagram_active');
      if (pageErr) throw pageErr;

      const formattedPages: PageConnection[] = (pageData || []).map(p => ({
        page_id: p.page_id,
        page_name: p.page_name || p.page_id,
        platform: p.is_whatsapp_active ? 'WhatsApp' : p.is_instagram_active ? 'Instagram' : 'Messenger',
      }));
      setPages(formattedPages);
      if (formattedPages.length > 0) setFormPageId(formattedPages[0].page_id);

      const { data: flowData } = await supabase
        .from('dm_flows').select('id, name').eq('is_active', true);
      setFlows(flowData || []);

      const { data: mediaData } = await supabase
        .from('media').select('id, name, friendly_name, file_url');
      setMediaAssets(mediaData || []);

      await refreshRules();
    } catch (err: any) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshRules() {
    const { data, error } = await supabase
      .from('chat_rules').select('*').order('priority', { ascending: false });
    if (error) throw error;
    setRules(data || []);
  }

  async function loadLogs() {
    setLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_rule_logs')
        .select(`id, matched_keyword, incoming_message, action_taken, created_at,
          chat_rules ( name ), chat_sessions ( sender_name )`)
        .order('created_at', { ascending: false }).limit(25);
      if (error) throw error;
      const formatted: ChatRuleLog[] = (data || []).map((item: any) => ({
        id: item.id,
        matched_keyword: item.matched_keyword,
        incoming_message: item.incoming_message,
        action_taken: item.action_taken,
        created_at: item.created_at,
        chat_rules: Array.isArray(item.chat_rules) ? item.chat_rules[0] : item.chat_rules,
        chat_sessions: Array.isArray(item.chat_sessions) ? item.chat_sessions[0] : item.chat_sessions,
      }));
      setLogs(formatted);
    } catch (err: any) {
      toast.error('Could not load logs: ' + err.message);
    } finally {
      setLogsLoading(false);
    }
  }

  /* ─── Toggle / Delete ────────────────────────────────────────────────── */

  const handleToggleActive = async (rule: ChatRule) => {
    try {
      const { error } = await supabase.from('chat_rules')
        .update({ is_active: !rule.is_active }).eq('id', rule.id);
      if (error) throw error;
      toast.success(`Rule "${rule.name}" ${!rule.is_active ? 'enabled' : 'disabled'}`);
      refreshRules();
    } catch (err: any) {
      toast.error('Failed to toggle rule: ' + err.message);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!confirm('Delete this rule? This cannot be undone.')) return;
    try {
      const { error } = await supabase.from('chat_rules').delete().eq('id', id);
      if (error) throw error;
      toast.success('Rule deleted');
      refreshRules();
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  /* ─── Tag Pill Controls ──────────────────────────────────────────────── */

  const addKeywordPill = () => {
    const val = formKeywordInput.trim().toLowerCase();
    if (val && !formKeywords.includes(val)) {
      setFormKeywords(prev => [...prev, val]);
      setFormKeywordInput('');
    }
  };

  const addReplyTemplate = () => {
    const val = formReplyInput.trim();
    if (val && !formReplyTemplates.includes(val)) {
      setFormReplyTemplates(prev => [...prev, val]);
      setFormReplyInput('');
    }
  };

  /* ─── Modal Open Helpers ─────────────────────────────────────────────── */

  const resetForm = () => {
    setFormName('');
    setFormKeywords([]);
    setFormKeywordInput('');
    setFormMatchType('contains');
    setFormCaseSensitive(false);
    setFormActionType('text');
    setFormReplyTemplates([]);
    setFormReplyInput('');
    setFormReplyTextAfter('');
    setFormAiPromptDirective('');
    setFormFlowId(flows[0]?.id || '');
    setFormMediaId(mediaAssets[0]?.id || '');
    setFormPriority(0);
    setFormIsActive(true);
    setFormReplyMode('random');
    if (pages.length > 0) setFormPageId(pages[0].page_id);
  };

  const openCreateModal = () => {
    setEditingRule(null);
    resetForm();
    setModalOpen(true);
  };

  const openEditModal = (rule: ChatRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormPageId(rule.page_connection_id);
    setFormKeywords(rule.keywords || []);
    setFormKeywordInput('');
    setFormMatchType(rule.match_type);
    setFormCaseSensitive(rule.case_sensitive);
    setFormActionType(rule.action_type);
    // For text action: templates list. For media: text-before stored in reply_templates[0]
    if (rule.action_type === 'media') {
      setFormReplyTemplates([]);
      setFormReplyInput(rule.reply_templates?.[0] || '');
    } else {
      setFormReplyTemplates(rule.reply_templates || []);
      setFormReplyInput('');
    }
    setFormReplyTextAfter(rule.reply_text_after || '');
    setFormAiPromptDirective(rule.ai_prompt_directive || '');
    setFormReplyMode(rule.reply_mode || 'random');
    setFormFlowId(rule.dm_flow_id || flows[0]?.id || '');
    setFormMediaId(rule.media_id || mediaAssets[0]?.id || '');
    setFormPriority(rule.priority);
    setFormIsActive(rule.is_active);
    setModalOpen(true);
  };

  /* ─── Save ────────────────────────────────────────────────────────────── */

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return toast.error('Please enter a rule name');
    if (formKeywords.length === 0) return toast.error('Add at least one trigger keyword');
    if (formActionType === 'text' && formReplyTemplates.length === 0 && !formReplyInput.trim())
      return toast.error('Add at least one reply message');
    if (formActionType === 'ai_push' && !formAiPromptDirective.trim())
      return toast.error('Provide instructions for the AI Bot');
    if (formActionType === 'media' && !formMediaId)
      return toast.error('Please select a media file from the vault');

    // Build templates array
    let templates: string[] = [];
    if (formActionType === 'text') {
      templates = [...formReplyTemplates];
      if (formReplyInput.trim()) templates.push(formReplyInput.trim());
    } else if (formActionType === 'media') {
      // store text-before in reply_templates[0]
      if (formReplyInput.trim()) templates = [formReplyInput.trim()];
    }

    const payload = {
      page_connection_id: formPageId,
      name: formName.trim(),
      keywords: formKeywords,
      match_type: formMatchType,
      case_sensitive: formCaseSensitive,
      action_type: formActionType,
      reply_templates: templates,
      reply_text_after: formActionType === 'media' ? (formReplyTextAfter.trim() || null) : null,
      ai_prompt_directive: formActionType === 'ai_push' ? formAiPromptDirective.trim() : null,
      reply_mode: formActionType === 'text' ? formReplyMode : 'random',
      dm_flow_id: formActionType === 'flow' ? (formFlowId || null) : null,
      media_id: formActionType === 'media' ? (formMediaId || null) : null,
      priority: formPriority,
      is_active: formIsActive,
      updated_at: new Date().toISOString(),
    };

    try {
      if (editingRule) {
        const { error } = await supabase.from('chat_rules').update(payload).eq('id', editingRule.id);
        if (error) throw error;
        toast.success('Rule updated!');
      } else {
        const { error } = await supabase.from('chat_rules').insert({
          ...payload, user_id: user?.id, match_count: 0,
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
        toast.success('Rule created!');
      }
      setModalOpen(false);
      refreshRules();
    } catch (err: any) {
      toast.error('Save failed: ' + err.message);
    }
  };

  /* ─── Import / Export ────────────────────────────────────────────────── */

  const handleExportJSON = () => {
    try {
      const a = document.createElement('a');
      a.setAttribute('href', 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rules, null, 2)));
      a.setAttribute('download', `chat_rules_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(a); a.click(); a.remove();
      toast.success('Rules exported');
    } catch (err: any) { toast.error('Export failed: ' + err.message); }
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const list = JSON.parse(ev.target?.result as string);
        const items = Array.isArray(list) ? list : [list];
        let count = 0;
        for (const item of items) {
          if (!item.name || !item.keywords || !item.action_type) continue;
          const { error } = await supabase.from('chat_rules').insert({
            user_id: user?.id,
            page_connection_id: item.page_connection_id || pages[0]?.page_id,
            name: item.name, keywords: item.keywords,
            match_type: item.match_type || 'contains',
            case_sensitive: !!item.case_sensitive,
            action_type: item.action_type,
            reply_templates: item.reply_templates || [],
            reply_text_after: item.reply_text_after || null,
            ai_prompt_directive: item.ai_prompt_directive || null,
            dm_flow_id: item.dm_flow_id || null,
            media_id: item.media_id || null,
            priority: item.priority || 0,
            is_active: item.is_active !== undefined ? item.is_active : true,
            reply_mode: item.reply_mode || 'random',
            match_count: 0,
          });
          if (error) throw error;
          count++;
        }
        toast.success(`Imported ${count} rules`);
        refreshRules();
      } catch (err: any) { toast.error('Import failed: ' + err.message); }
    };
    reader.readAsText(file);
  };

  /* ─── Derived ─────────────────────────────────────────────────────────── */

  const filteredRules = rules.filter(r => {
    const q = searchQuery.toLowerCase();
    const matchSearch = !q || r.name.toLowerCase().includes(q) || r.keywords.some(k => k.toLowerCase().includes(q));
    const matchPage = filterPage === 'all' || r.page_connection_id === filterPage;
    return matchSearch && matchPage;
  });

  const totalMatches = rules.reduce((acc, r) => acc + (r.match_count || 0), 0);
  const activeCount = rules.filter(r => r.is_active).length;

  // Preview helpers
  const previewMediaName = mediaAssets.find(m => m.id === formMediaId)?.friendly_name || 'Attached File';
  const previewFlowName = flows.find(f => f.id === formFlowId)?.name || 'Interactive Flow';

  /* ─── Render ──────────────────────────────────────────────────────────── */

  return (
    <div style={{ padding: '28px', maxWidth: '1400px', margin: '0 auto' }}>

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <Sliders size={24} color="var(--accent-primary)" />
            Chat Keyword Rules
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '560px', lineHeight: 1.6 }}>
            Auto-reply to customer messages when they contain specific keywords. Choose to send a text, file, start a visual flow, or tell the AI bot how to respond.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handleExportJSON} className="btn-secondary btn" style={{ fontSize: '13px' }}>
            <Download size={14} /> Export JSON
          </button>
          <label className="btn-secondary btn" style={{ fontSize: '13px', cursor: 'pointer' }}>
            <Upload size={14} /> Import JSON
            <input type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
          </label>
          <button onClick={openCreateModal} className="btn btn-primary" style={{ fontSize: '13px' }}>
            <Plus size={16} /> New Rule
          </button>
        </div>
      </div>

      {/* ── Metric Cards ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {[
          { label: 'TOTAL RULES', value: rules.length, icon: <Sliders size={20} />, color: '#f97316' },
          { label: 'ACTIVE RULES', value: activeCount, icon: <CheckCircle2 size={20} />, color: '#22c55e' },
          { label: 'TOTAL TRIGGERS', value: totalMatches.toLocaleString(), icon: <TrendingUp size={20} />, color: '#3b82f6' },
          { label: 'LOOP GUARD', value: '3 / min', icon: <AlertCircle size={20} />, color: '#ef4444' },
        ].map(card => (
          <div key={card.label} style={{ ...S.card, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ padding: '10px', borderRadius: '10px', background: card.color + '18', color: card.color, flexShrink: 0 }}>
              {card.icon}
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.05em', fontWeight: 600 }}>{card.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginTop: '2px' }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────────── */}
      <div style={{ ...S.card, padding: '14px 18px', display: 'flex', gap: '14px', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search by rule name or keyword..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ ...S.input, paddingLeft: '38px' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Filter channel:</span>
          <div style={{ position: 'relative' }}>
            <select value={filterPage} onChange={e => setFilterPage(e.target.value)} style={{ ...S.select, paddingRight: '32px', minWidth: '180px' }}>
              <option value="all">All Channels</option>
              {pages.map(p => <option key={p.page_id} value={p.page_id}>{p.page_name} ({p.platform})</option>)}
            </select>
            <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
          </div>
        </div>
      </div>

      {/* ── Rules Grid ────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <RefreshCw size={28} style={{ opacity: 0.4, marginBottom: '12px' }} />
          <div style={{ fontSize: '14px' }}>Loading rules…</div>
        </div>
      ) : filteredRules.length === 0 ? (
        <div style={{ ...S.card, padding: '60px', textAlign: 'center' }}>
          <Sliders size={44} style={{ color: 'var(--text-muted)', opacity: 0.3, marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', marginBottom: '8px' }}>No keyword rules yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '380px', margin: '0 auto 24px', lineHeight: 1.6 }}>
            Create your first rule to automatically reply when a customer sends a specific word or phrase.
          </p>
          <button onClick={openCreateModal} className="btn btn-primary">
            <Plus size={15} /> Create First Rule
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '18px', marginBottom: '32px' }}>
          {filteredRules.map(rule => {
            const page = pages.find(p => p.page_id === rule.page_connection_id);
            return (
              <div key={rule.id} style={{ ...S.card, padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                {/* Rule Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {rule.name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {page ? `${page.page_name} · ${page.platform}` : 'Unknown channel'}
                    </div>
                  </div>
                  <label className="switch" style={{ marginLeft: '12px', flexShrink: 0 }}>
                    <input type="checkbox" checked={rule.is_active} onChange={() => handleToggleActive(rule)} />
                    <span className="slider round"></span>
                  </label>
                </div>

                {/* Keyword Pills */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {rule.keywords?.map((kw, i) => (
                    <span key={i} style={{
                      fontSize: '11px', padding: '3px 10px', borderRadius: '999px',
                      background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)',
                      color: 'var(--accent-primary)', fontWeight: 600,
                    }}>
                      {kw}
                    </span>
                  ))}
                </div>

                {/* Meta Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ActionBadge type={rule.action_type} replyMode={rule.reply_mode} />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {rule.match_count || 0} triggered
                    </span>
                    {rule.priority > 0 && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>
                        P{rule.priority}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={() => openEditModal(rule)} title="Edit" style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '6px 8px', borderRadius: '8px', color: 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
                    >
                      <Edit3 size={14} />
                    </button>
                    <button onClick={() => handleDeleteRule(rule.id)} title="Delete" style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      padding: '6px 8px', borderRadius: '8px', color: 'var(--text-muted)',
                      transition: 'all 0.15s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ── Match Logs (collapsible) ───────────────────────────────────── */}
      <div style={{ ...S.card, overflow: 'hidden' }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', cursor: 'pointer' }}
          onClick={() => {
            const next = !logsOpen;
            setLogsOpen(next);
            if (next && logs.length === 0) loadLogs();
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Eye size={18} color="var(--accent-primary)" />
            <span style={{ fontSize: '15px', fontWeight: 600, color: '#fff' }}>Recent Trigger Match Logs</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Last 25 matches</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {logsOpen && (
              <button onClick={e => { e.stopPropagation(); loadLogs(); }} className="btn btn-secondary btn-sm" style={{ fontSize: '12px' }}>
                <RefreshCw size={12} /> Refresh
              </button>
            )}
            {logsOpen ? <ChevronUpIcon size={18} color="var(--text-muted)" /> : <ChevronDown size={18} color="var(--text-muted)" />}
          </div>
        </div>

        {logsOpen && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0 22px 22px' }}>
            {logsLoading ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>Loading logs…</div>
            ) : logs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
                No triggers recorded yet. Rules will appear here when they match real customer messages.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', marginTop: '16px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Timestamp', 'Customer', 'Rule', 'Keyword', 'Message', 'Action Sent'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{new Date(log.created_at).toLocaleString()}</td>
                        <td style={{ padding: '12px', fontWeight: 600, color: '#fff' }}>{log.chat_sessions?.sender_name || 'Anonymous'}</td>
                        <td style={{ padding: '12px', color: 'var(--accent-primary)' }}>{log.chat_rules?.name || 'Deleted Rule'}</td>
                        <td style={{ padding: '12px' }}>
                          <code style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: '4px', fontSize: '12px' }}>{log.matched_keyword}</code>
                        </td>
                        <td style={{ padding: '12px', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }} title={log.incoming_message}>
                          {log.incoming_message}
                        </td>
                        <td style={{ padding: '12px', color: '#22c55e' }}>{log.action_taken}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          CREATE / EDIT MODAL
          ══════════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.82)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1200, padding: '20px',
        }}>
          <div style={{
            ...S.card, width: '100%', maxWidth: '1080px',
            display: 'flex', flexDirection: 'column',
            maxHeight: '92vh', overflow: 'hidden',
          }}>

            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Sliders size={20} color="var(--accent-primary)" />
                <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff' }}>
                  {editingRule ? 'Edit Keyword Rule' : 'Create Keyword Rule'}
                </span>
              </div>
              <button onClick={() => setModalOpen(false)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '6px', borderRadius: '8px', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center',
              }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal Body: Left form + Right preview */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

              {/* ── Left: Form ─────────────────────────────────────────── */}
              <div style={{ flex: '1 1 520px', padding: '24px', overflowY: 'auto' }}>
                <form onSubmit={handleSaveRule} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>

                  {/* Row 1: Name + Channel */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={S.label}>
                        Rule Name <span style={{ color: 'var(--error)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. PDF Catalog Delivery"
                        value={formName}
                        onChange={e => setFormName(e.target.value)}
                        style={S.input}
                        required
                      />
                    </div>
                    <div>
                      <label style={S.label}>Target Page / Channel</label>
                      <div style={{ position: 'relative' }}>
                        <select value={formPageId} onChange={e => setFormPageId(e.target.value)} style={{ ...S.select, paddingRight: '32px' }} required>
                          {pages.length === 0
                            ? <option value="">No channels connected</option>
                            : pages.map(p => <option key={p.page_id} value={p.page_id}>{p.page_name} ({p.platform})</option>)
                          }
                        </select>
                        <ChevronDown size={13} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                      </div>
                    </div>
                  </div>

                  {/* Trigger Keywords */}
                  <div>
                    <label style={S.label}>
                      Trigger Keywords <span style={{ color: 'var(--error)' }}>*</span>
                      <Tooltip text="When a customer's message contains or exactly matches any of these words, the rule fires. Press Enter or click Add." />
                    </label>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                      <input
                        type="text"
                        placeholder="Type a keyword and press Enter..."
                        value={formKeywordInput}
                        onChange={e => setFormKeywordInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addKeywordPill(); } }}
                        style={S.input}
                      />
                      <button type="button" onClick={addKeywordPill} className="btn btn-secondary" style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>
                        Add
                      </button>
                    </div>

                    <div style={{
                      minHeight: '44px', padding: '8px', borderRadius: '8px',
                      background: 'rgba(255,255,255,0.02)',
                      border: formKeywords.length > 0 ? '1px solid rgba(249,115,22,0.25)' : '1px solid rgba(255,255,255,0.07)',
                      display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'flex-start',
                    }}>
                      {formKeywords.length === 0 && (
                        <span style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '3px 4px' }}>No keywords added yet</span>
                      )}
                      {formKeywords.map((kw, i) => (
                        <span key={i} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          padding: '4px 6px 4px 11px', borderRadius: '999px',
                          background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)',
                          color: 'var(--accent-primary)', fontSize: '12px', fontWeight: 600,
                        }}>
                          {kw}
                          <button
                            type="button"
                            onClick={() => setFormKeywords(prev => prev.filter((_, idx) => idx !== i))}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: '16px', height: '16px', borderRadius: '50%',
                              background: 'rgba(255,255,255,0.15)',
                              border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0,
                              color: '#fff', lineHeight: 1,
                            }}
                            title="Remove"
                          >
                            <X size={9} strokeWidth={3} />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Matching Options */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'end' }}>
                    <div>
                      <label style={S.label}>
                        Match Strategy
                        <Tooltip text="'Contains' fires if the keyword appears anywhere in the message (e.g. 'catalog' matches 'send me the catalog please'). 'Exact' fires only when the entire message equals the keyword exactly." />
                      </label>
                      <div style={{ position: 'relative' }}>
                        <select value={formMatchType} onChange={e => setFormMatchType(e.target.value as 'contains' | 'exact')} style={{ ...S.select, paddingRight: '32px' }}>
                          <option value="contains">Contains — keyword anywhere in message</option>
                          <option value="exact">Exact — entire message must match</option>
                        </select>
                        <ChevronDown size={13} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label className="switch">
                        <input type="checkbox" checked={formCaseSensitive} onChange={e => setFormCaseSensitive(e.target.checked)} />
                        <span className="slider round"></span>
                      </label>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Case Sensitive</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Off = "Price" matches "PRICE" too</div>
                      </div>
                    </div>
                  </div>

                  <div style={S.divider} />

                  {/* Action Type Selector */}
                  <div>
                    <label style={S.label}>
                      What to do when keyword matches?
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>

                      {/* Text Only */}
                      <button type="button" onClick={() => setFormActionType('text')} style={S.pill(formActionType === 'text')}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <FileText size={15} color={formActionType === 'text' ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                          <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Text-Only Reply</span>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          Sends a plain text message. <strong style={{ color: '#f97316' }}>AI bot is bypassed</strong> — this sends exactly what you write.
                        </p>
                      </button>

                      {/* Media + Text Series */}
                      <button type="button" onClick={() => setFormActionType('media')} style={S.pill(formActionType === 'media')}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <FileImage size={15} color={formActionType === 'media' ? '#22c55e' : 'var(--text-muted)'} />
                          <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Media + Text Series</span>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          Sends: optional intro text → your file → optional follow-up text. <strong style={{ color: '#22c55e' }}>AI bypassed.</strong>
                        </p>
                      </button>

                      {/* Visual Flow */}
                      <button type="button" onClick={() => setFormActionType('flow')} style={S.pill(formActionType === 'flow')}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <Play size={15} color={formActionType === 'flow' ? '#f59e0b' : 'var(--text-muted)'} />
                          <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Start Visual Flow</span>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          Launches a multi-step conversational flow you built in the DM Flow Builder. <strong style={{ color: '#f59e0b' }}>AI paused</strong> during flow.
                        </p>
                      </button>

                      {/* AI Instruct */}
                      <button type="button" onClick={() => setFormActionType('ai_push')} style={S.pill(formActionType === 'ai_push')}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <Cpu size={15} color={formActionType === 'ai_push' ? '#a78bfa' : 'var(--text-muted)'} />
                          <span style={{ fontWeight: 700, fontSize: '13px', color: '#fff' }}>Instruct AI Bot</span>
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                          <strong style={{ color: '#a78bfa' }}>AI stays active</strong>, but you add a secret instruction for this specific turn (e.g. "Mention the current sale").
                        </p>
                      </button>

                    </div>
                  </div>

                  {/* Conditional Config Blocks */}
                  <div style={S.sectionBox}>

                    {/* ── TEXT ONLY ─────────────────────────────────────── */}
                    {formActionType === 'text' && (
                      <div>
                        {/* Reply Mode Selection */}
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Reply Send Mode
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <button
                              type="button"
                              onClick={() => setFormReplyMode('random')}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: formReplyMode === 'random' ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.08)',
                                background: formReplyMode === 'random' ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.02)',
                                color: formReplyMode === 'random' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                fontSize: '13px',
                                fontWeight: formReplyMode === 'random' ? 700 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                gap: '2px',
                                textAlign: 'left'
                              }}
                            >
                              <span>Rotate (Send 1 Random)</span>
                              <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-tertiary)' }}>Picks one message at random each time.</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormReplyMode('all')}
                              style={{
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: formReplyMode === 'all' ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.08)',
                                background: formReplyMode === 'all' ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.02)',
                                color: formReplyMode === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                fontSize: '13px',
                                fontWeight: formReplyMode === 'all' ? 700 : 500,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-start',
                                gap: '2px',
                                textAlign: 'left'
                              }}
                            >
                              <span>Send Series (All)</span>
                              <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-tertiary)' }}>Sends all messages in order with a minor delay.</span>
                            </button>
                          </div>
                        </div>

                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Reply Messages</span>
                            <Tooltip text="Add one or more message templates. Mode above decides if the system rotates or sends all in sequence." />
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Add one or more reply texts. If you add multiple, a random one is picked per trigger (great for variety).
                          </p>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                          <input
                            type="text"
                            placeholder="Type a reply message and press Enter..."
                            value={formReplyInput}
                            onChange={e => setFormReplyInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addReplyTemplate(); } }}
                            style={S.input}
                          />
                          <button type="button" onClick={addReplyTemplate} className="btn btn-secondary" style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>
                            Add
                          </button>
                        </div>

                        {formReplyTemplates.length === 0 && (
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No messages added yet. Add at least one.</p>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {formReplyTemplates.map((tpl, i) => (
                            <div key={i} style={{
                              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              background: 'rgba(255,255,255,0.03)', padding: '10px 14px',
                              borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)',
                            }}>
                              <span style={{ fontSize: '13px', color: '#fff', flex: 1, marginRight: '12px' }}>
                                <MessageSquare size={12} style={{ color: 'var(--accent-primary)', marginRight: '6px', verticalAlign: 'middle' }} />
                                {tpl}
                              </span>
                              <button
                                type="button"
                                onClick={() => setFormReplyTemplates(prev => prev.filter((_, idx) => idx !== i))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', borderRadius: '4px' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* ── MEDIA + TEXT SERIES ───────────────────────────── */}
                    {formActionType === 'media' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                          <Info size={14} style={{ color: '#22c55e', flexShrink: 0, marginTop: '1px' }} />
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            Messages are sent in sequence: <strong style={{ color: '#fff' }}>① Intro text</strong> → <strong style={{ color: '#fff' }}>② Your file</strong> → <strong style={{ color: '#fff' }}>③ Follow-up text</strong>. Intro and follow-up are optional.
                          </p>
                        </div>

                        <div>
                          <label style={S.label}>① Intro Text (Optional) — sent before the file</label>
                          <input
                            type="text"
                            placeholder="e.g. Here's our product catalog! 📂"
                            value={formReplyInput}
                            onChange={e => setFormReplyInput(e.target.value)}
                            style={S.input}
                          />
                        </div>

                        <div>
                          <label style={S.label}>
                            ② Media File <span style={{ color: 'var(--error)' }}>*</span>
                            <Tooltip text="Files are managed in the Media Vault tab. Upload PDFs, images, or videos there first." />
                          </label>
                          {mediaAssets.length === 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '13px' }}>
                              <AlertCircle size={15} />
                              No files found in Media Vault. Please upload files in Media Vault first.
                            </div>
                          ) : (
                            <div style={{ position: 'relative' }}>
                              <select value={formMediaId} onChange={e => setFormMediaId(e.target.value)} style={{ ...S.select, paddingRight: '32px' }}>
                                {mediaAssets.map(a => <option key={a.id} value={a.id}>{a.friendly_name || a.name}</option>)}
                              </select>
                              <ChevronDown size={13} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                            </div>
                          )}
                        </div>

                        <div>
                          <label style={S.label}>③ Follow-up Text (Optional) — sent after the file</label>
                          <input
                            type="text"
                            placeholder="e.g. Let me know if you'd like to place an order! 😊"
                            value={formReplyTextAfter}
                            onChange={e => setFormReplyTextAfter(e.target.value)}
                            style={S.input}
                          />
                        </div>
                      </div>
                    )}

                    {/* ── VISUAL FLOW ───────────────────────────────────── */}
                    {formActionType === 'flow' && (
                      <div>
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>Select Conversation Flow</div>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            This launches a multi-step sequence from your DM Flow Builder — e.g. showing options, collecting info, or guiding a purchase. The AI bot is paused while the flow is running.
                          </p>
                        </div>
                        {flows.length === 0 ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: '13px' }}>
                            <AlertCircle size={15} />
                            No flows found. Build one first in the DM Flow Builder.
                          </div>
                        ) : (
                          <div style={{ position: 'relative' }}>
                            <select value={formFlowId} onChange={e => setFormFlowId(e.target.value)} style={{ ...S.select, paddingRight: '32px' }}>
                              {flows.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                            </select>
                            <ChevronDown size={13} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-muted)' }} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── AI INSTRUCT ───────────────────────────────────── */}
                    {formActionType === 'ai_push' && (
                      <div>
                        <div style={{ marginBottom: '14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff' }}>Secret AI Instruction</span>
                            <Tooltip text="The AI bot is still active and replies normally, but on this specific turn it receives an extra private instruction that the customer never sees. Use it to guide tone, content, or actions." />
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            The AI bot will reply using its normal knowledge, but <strong style={{ color: '#a78bfa' }}>secretly follow your instruction</strong> on this turn. Great for guiding tone, promoting specific offers, or handling sensitive topics.
                          </p>
                        </div>
                        <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)', marginBottom: '12px' }}>
                          <div style={{ fontSize: '11px', color: '#a78bfa', fontWeight: 600, marginBottom: '4px' }}>
                            💡 Example instructions:
                          </div>
                          <ul style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.8, paddingLeft: '16px', margin: 0 }}>
                            <li>"Acknowledge the request and ask for their budget before showing prices."</li>
                            <li>"Mention our 20% off sale and push them to click the shop link."</li>
                            <li>"Keep the reply under 3 sentences. Be very warm and friendly."</li>
                          </ul>
                        </div>
                        <textarea
                          placeholder="Write a direct instruction for the AI bot on this turn..."
                          value={formAiPromptDirective}
                          onChange={e => setFormAiPromptDirective(e.target.value)}
                          rows={4}
                          style={S.textarea}
                          required
                        />
                      </div>
                    )}
                  </div>

                  {/* Priority + Active Row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'end' }}>
                    <div>
                      <label style={S.label}>
                        Priority: {formPriority}
                        <Tooltip text="When multiple rules could match the same message, the one with the HIGHER number runs first. Set 0 for normal, 100 for highest priority. Most rules should be 0." />
                      </label>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: 1.4 }}>
                        Higher number = runs first when multiple rules match. Leave at 0 unless you need ordering.
                      </p>
                      <input
                        type="range" min={0} max={100} value={formPriority}
                        onChange={e => setFormPriority(Number(e.target.value))}
                        style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <label className="switch">
                        <input type="checkbox" checked={formIsActive} onChange={e => setFormIsActive(e.target.checked)} />
                        <span className="slider round"></span>
                      </label>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>Enable Immediately</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rule goes live on save</div>
                      </div>
                    </div>
                  </div>

                  {/* Submit Row */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <button type="button" onClick={() => setModalOpen(false)} className="btn btn-secondary">Cancel</button>
                    <button type="submit" className="btn btn-primary">
                      <Zap size={14} /> {editingRule ? 'Save Changes' : 'Create Rule'}
                    </button>
                  </div>

                </form>
              </div>

              {/* ── Right: Live Preview ─────────────────────────────────── */}
              <div style={{
                flex: '0 0 320px', padding: '24px',
                background: 'rgba(0,0,0,0.3)',
                borderLeft: '1px solid rgba(255,255,255,0.07)',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: '10px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <Smartphone size={15} color="var(--accent-primary)" />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Live Preview
                  </span>
                </div>

                {/* Phone Shell */}
                <div style={{
                  width: '284px', height: '500px',
                  background: '#101214',
                  border: '7px solid #252830',
                  borderRadius: '28px',
                  display: 'flex', flexDirection: 'column',
                  overflow: 'hidden',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                  position: 'relative',
                }}>
                  {/* notch */}
                  <div style={{ width: '56px', height: '12px', background: '#252830', borderRadius: '0 0 8px 8px', position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }} />

                  {/* Chat Header */}
                  <div style={{ padding: '18px 12px 10px', background: '#161920', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                      A
                    </div>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', lineHeight: 1.3 }}>AutoBot</div>
                      <div style={{ fontSize: '10px', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                        Active Autopilot
                      </div>
                    </div>
                  </div>

                  {/* Chat Bubbles */}
                  <div style={{ flex: 1, padding: '14px 10px', display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto' }}>

                    {/* Customer trigger bubble */}
                    <div style={{ alignSelf: 'flex-end', maxWidth: '85%' }}>
                      <div style={{ background: 'var(--accent-primary)', color: '#fff', padding: '9px 13px', borderRadius: '16px 16px 4px 16px', fontSize: '12px', lineHeight: 1.5, wordBreak: 'break-word' }}>
                        {formKeywords.length > 0 ? `I want the ${formKeywords[0]}` : 'Triggering message…'}
                      </div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'right', marginTop: '3px' }}>Customer</div>
                    </div>

                    {/* Bot response */}
                    {formActionType === 'text' && (
                      <div style={{ alignSelf: 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {formReplyMode === 'all' ? (
                          <>
                            {formReplyTemplates.length > 0 ? (
                              formReplyTemplates.map((tpl, i) => (
                                <div key={i} style={{ background: '#202428', color: '#fff', padding: '9px 13px', borderRadius: '14px 14px 14px 4px', fontSize: '12px', lineHeight: 1.5, border: '1px solid rgba(255,255,255,0.05)' }}>
                                  {tpl}
                                </div>
                              ))
                            ) : (
                              <div style={{ background: '#202428', color: '#fff', padding: '9px 13px', borderRadius: '14px 14px 14px 4px', fontSize: '12px', lineHeight: 1.5, border: '1px solid rgba(255,255,255,0.05)' }}>
                                {formReplyInput.trim() || '(Your reply will appear here)'}
                              </div>
                            )}
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>Bot · Text series (no AI)</div>
                          </>
                        ) : (
                          <>
                            <div style={{ background: '#202428', color: '#fff', padding: '9px 13px', borderRadius: '16px 16px 16px 4px', fontSize: '12px', lineHeight: 1.5, border: '1px solid rgba(255,255,255,0.05)' }}>
                              {formReplyTemplates.length > 0 ? formReplyTemplates[0] : formReplyInput.trim() || '(Your reply will appear here)'}
                              {formReplyTemplates.length > 1 && (
                                <div style={{ marginTop: '6px', fontSize: '9px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                  + {formReplyTemplates.length - 1} more rotation{formReplyTemplates.length > 2 ? 's' : ''}
                                </div>
                              )}
                            </div>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px' }}>Bot · Text reply (no AI)</div>
                          </>
                        )}
                      </div>
                    )}

                    {formActionType === 'media' && (
                      <div style={{ alignSelf: 'flex-start', maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                        {formReplyInput.trim() && (
                          <div style={{ background: '#202428', color: '#fff', padding: '8px 12px', borderRadius: '14px 14px 14px 4px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.05)', lineHeight: 1.5 }}>
                            {formReplyInput.trim()}
                          </div>
                        )}
                        <div style={{ background: '#202428', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                          <div style={{ height: '56px', background: 'rgba(34,197,94,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <FileImage size={20} color="#22c55e" />
                            <span style={{ fontSize: '10px', color: '#22c55e', fontWeight: 600 }}>FILE</span>
                          </div>
                          <div style={{ padding: '7px 10px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{previewMediaName}</div>
                            <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>Tap to open</div>
                          </div>
                        </div>
                        {formReplyTextAfter.trim() && (
                          <div style={{ background: '#202428', color: '#fff', padding: '8px 12px', borderRadius: '14px 14px 14px 4px', fontSize: '12px', border: '1px solid rgba(255,255,255,0.05)', lineHeight: 1.5 }}>
                            {formReplyTextAfter.trim()}
                          </div>
                        )}
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '1px' }}>Bot · Media series (no AI)</div>
                      </div>
                    )}

                    {formActionType === 'flow' && (
                      <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                        <div style={{ background: '#202428', color: '#fff', padding: '10px 13px', borderRadius: '16px 16px 16px 4px', fontSize: '12px', border: '1px solid rgba(245,158,11,0.2)', lineHeight: 1.5 }}>
                          <div style={{ color: '#f59e0b', fontWeight: 700, fontSize: '11px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Play size={10} /> Flow started: {previewFlowName}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            Interactive options &amp; buttons will appear…
                          </div>
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px' }}>Bot · Visual flow (AI paused)</div>
                      </div>
                    )}

                    {formActionType === 'ai_push' && (
                      <div style={{ alignSelf: 'flex-start', maxWidth: '85%' }}>
                        <div style={{ background: '#202428', padding: '10px 13px', borderRadius: '16px 16px 16px 4px', fontSize: '12px', border: '1px dashed rgba(167,139,250,0.4)', lineHeight: 1.5 }}>
                          <div style={{ color: '#a78bfa', fontWeight: 700, fontSize: '10px', marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Sparkles size={10} /> AI BOT — CUSTOM INSTRUCTION ACTIVE
                          </div>
                          <span style={{ fontStyle: 'italic', fontSize: '11px', color: 'var(--text-muted)' }}>
                            "{formAiPromptDirective.trim() || 'Your instruction will guide the AI reply…'}"
                          </span>
                        </div>
                        <div style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '3px' }}>AI bot replies with your guidance</div>
                      </div>
                    )}
                  </div>
                </div>

                <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '240px', lineHeight: 1.5 }}>
                  Preview updates live as you configure the rule above.
                </p>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
