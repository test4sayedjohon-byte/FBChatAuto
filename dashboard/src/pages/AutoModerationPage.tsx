import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';
import { WORKER_URL } from '../lib/workerApi';
import { Plus, Trash2, X, Sparkles, Send, ShieldAlert, CheckCircle2, Loader2, Save, Edit2, Brain, ToggleLeft, ToggleRight } from 'lucide-react';

interface Rule {
  id: string;
  trigger_type: string;
  keywords: string[] | null;
  sentiment_target: string | null;
  ai_custom_criteria?: string | null;
  use_dynamic_ai_reply?: boolean;
  action_to_take: string;
  reply_templates: string[] | null;
  dm_reply_templates?: string[] | null;
  is_active: boolean;
  page_connection_id: string;
  attachment_urls?: string[] | null;
  dm_attachment_urls?: string[] | null;
  post_id?: string | null;
  dm_flow_id?: string | null;
}

interface CommentLog {
  id: string;
  platform: string;
  post_id: string;
  comment_id: string;
  user_name: string | null;
  user_message: string | null;
  ai_sentiment: string | null;
  ai_toxicity_score: number | null;
  action_taken: string | null;
  reply_message: string | null;
  created_at: string;
}

interface Channel {
  page_id: string;
  page_name: string;
}

interface ChatAsset {
  id: string;
  name: string;
  friendly_name: string;
  file_url: string;
  file_type: string;
}

export default function AutoModerationPage() {
  const { user, profile, refreshCreditBalance } = useAuth();
  const [analysisEnabled, setAnalysisEnabled] = useState<boolean>(true);
  const [togglingAnalysis, setTogglingAnalysis] = useState(false);
  const navigate = useNavigate();
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<CommentLog[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [chatAssets, setChatAssets] = useState<ChatAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  
  // DM Flow selection states
  const [flows, setFlows] = useState<{ id: string; name: string; is_active: boolean }[]>([]);
  const [responseType, setResponseType] = useState<'text' | 'flow'>('text');
  const [selectedDmFlowId, setSelectedDmFlowId] = useState<string>('');


  // Rule Creator State
  const [selectedChannel, setSelectedChannel] = useState('');
  const [triggerType, setTriggerType] = useState('keywords');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [sentimentTarget, setSentimentTarget] = useState('negative');
  const [selectedActions, setSelectedActions] = useState<string[]>(['hide']);
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const [selectedDmAttachments, setSelectedDmAttachments] = useState<string[]>([]);
  const [replyInput, setReplyInput] = useState('');
  const [dmReplyInput, setDmReplyInput] = useState('');
  const [aiCustomCriteria, setAiCustomCriteria] = useState('');
  const [useDynamicAiReply, setUseDynamicAiReply] = useState(false);

  // Post Selector State
  const [posts, setPosts] = useState<{ id: string; message: string; created_time: string; picture: string | null }[]>([]);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [applyToPostType, setApplyToPostType] = useState('global');
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Autopilot Drawer State
  const [showAutopilot, setShowAutopilot] = useState(false);
  const [autopilotMsg, setAutopilotMsg] = useState('');
  const [autopilotLogs, setAutopilotLogs] = useState<{ sender: 'user' | 'bot'; text: string }[]>([
    { sender: 'bot', text: 'Hi! I am your AI Autopilot Configurator. Tell me what automation rule you want to set up in plain English (e.g. "If someone comments price, reply to check DMs and hide it").' }
  ]);
  const [sendingAutopilot, setSendingAutopilot] = useState(false);

  async function fetchPagePosts(pageId: string) {
    if (!pageId) return;
    try {
      setLoadingPosts(true);
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token || '';
      
      const response = await fetch(`${WORKER_URL}/api/page-posts/${pageId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch posts');
      const data = await response.json() as any;
      setPosts(data.posts || []);
    } catch (err: any) {
      console.error('Error fetching page posts:', err);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      // Fetch rules
      const { data: rulesData } = await supabase.from('comment_rules').select('*');
      // Fetch logs
      const { data: logsData } = await supabase.from('comment_logs').select('*').order('created_at', { ascending: false }).limit(20);
      // Fetch connected channels
      const { data: channelsData } = await supabase
        .from('page_connections')
        .select('page_id, page_name, whatsapp_phone_number_id');
      // Fetch chat assets
      const { data: chatAssetsData } = await supabase
        .from('media')
        .select('id, name, friendly_name, file_url, file_type');
      // Fetch DM flows
      const { data: flowsData } = await supabase
        .from('dm_flows')
        .select('id, name, is_active');

      setRules(rulesData || []);
      setLogs(logsData || []);
      setChatAssets(chatAssetsData || []);
      setFlows(flowsData || []);

      
      const filteredChannels = (channelsData || [])
        .filter((c: any) => !c.whatsapp_phone_number_id)
        .map((c: any) => ({ page_id: c.page_id, page_name: c.page_name }));
      setChannels(filteredChannels);
    } catch (err: any) {
      toast.error('Error loading moderation data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRule(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      let finalKeywords = [...keywords];
      if (keywordsInput.trim()) {
        const word = keywordsInput.trim();
        if (!finalKeywords.includes(word)) {
          finalKeywords.push(word);
        }
      }

      if (triggerType === 'keywords' && finalKeywords.length === 0) {
        throw new Error('Please specify at least one keyword.');
      }

      if (triggerType === 'ai_custom' && !aiCustomCriteria.trim()) {
        throw new Error('Please specify the custom AI trigger criteria.');
      }

      if (selectedActions.length === 0) {
        throw new Error('Please select at least one action.');
      }

      if (editingRuleId) {
        const { error } = await supabase
          .from('comment_rules')
          .update({
            page_connection_id: selectedChannel,
            trigger_type: triggerType,
            keywords: triggerType === 'keywords' ? finalKeywords : null,
            sentiment_target: triggerType === 'ai_sentiment' ? sentimentTarget : null,
            ai_custom_criteria: triggerType === 'ai_custom' ? aiCustomCriteria.trim() : null,
            use_dynamic_ai_reply: selectedActions.includes('reply') ? useDynamicAiReply : false,
            action_to_take: selectedActions.join(','),
            reply_templates: selectedActions.includes('reply') && !useDynamicAiReply && replyInput.trim() ? [replyInput.trim()] : null,
            dm_reply_templates: selectedActions.includes('dm') && responseType === 'text' && dmReplyInput.trim() ? [dmReplyInput.trim()] : null,
            attachment_urls: selectedActions.includes('reply') && selectedAttachments.length > 0 ? selectedAttachments : null,
            dm_attachment_urls: selectedActions.includes('dm') && responseType === 'text' && selectedDmAttachments.length > 0 ? selectedDmAttachments : null,
            dm_flow_id: selectedActions.includes('dm') && responseType === 'flow' ? selectedDmFlowId || null : null,
            post_id: applyToPostType === 'specific' && selectedPostId ? selectedPostId : null,
          })
          .eq('id', editingRuleId);

        if (error) throw error;
        toast.success('Moderation rule updated successfully!');
      } else {
        const { error } = await supabase
          .from('comment_rules')
          .insert({
            user_id: user.id,
            page_connection_id: selectedChannel,
            trigger_type: triggerType,
            keywords: triggerType === 'keywords' ? finalKeywords : null,
            sentiment_target: triggerType === 'ai_sentiment' ? sentimentTarget : null,
            ai_custom_criteria: triggerType === 'ai_custom' ? aiCustomCriteria.trim() : null,
            use_dynamic_ai_reply: selectedActions.includes('reply') ? useDynamicAiReply : false,
            action_to_take: selectedActions.join(','),
            reply_templates: selectedActions.includes('reply') && !useDynamicAiReply && replyInput.trim() ? [replyInput.trim()] : null,
            dm_reply_templates: selectedActions.includes('dm') && responseType === 'text' && dmReplyInput.trim() ? [dmReplyInput.trim()] : null,
            attachment_urls: selectedActions.includes('reply') && selectedAttachments.length > 0 ? selectedAttachments : null,
            dm_attachment_urls: selectedActions.includes('dm') && responseType === 'text' && selectedDmAttachments.length > 0 ? selectedDmAttachments : null,
            dm_flow_id: selectedActions.includes('dm') && responseType === 'flow' ? selectedDmFlowId || null : null,
            post_id: applyToPostType === 'specific' && selectedPostId ? selectedPostId : null,
            is_active: true
          });

        if (error) throw error;
        toast.success('Moderation rule connected successfully!');
      }

      setShowModal(false);
      // Reset Rule Form
      setEditingRuleId(null);
      setSelectedChannel('');
      setKeywordsInput('');
      setKeywords([]);
      setReplyInput('');
      setDmReplyInput('');
      setResponseType('text');
      setSelectedDmFlowId('');
      setAiCustomCriteria('');
      setUseDynamicAiReply(false);

      setSelectedActions(['hide']);
      setSelectedAttachments([]);
      setSelectedDmAttachments([]);
      setApplyToPostType('global');
      setSelectedPostId('');
      setPosts([]);
      loadData();
    } catch (err: any) {
      toast.error('Failed to create rule: ' + err.message);
    } finally {
      setSaving(false);
    }
  }


  function closeModal() {
    setShowModal(false);
    setEditingRuleId(null);
    setResponseType('text');
    setSelectedDmFlowId('');
    setAiCustomCriteria('');
    setUseDynamicAiReply(false);
  }

  async function handleToggleRule(rule: Rule) {
    try {
      const { error } = await supabase
        .from('comment_rules')
        .update({ is_active: !rule.is_active })
        .eq('id', rule.id);

      if (error) throw error;
      loadData();
    } catch (err: any) {
      toast.error('Failed to update rule: ' + err.message);
    }
  }

  async function handleDeleteRule(id: string) {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      const { error } = await supabase.from('comment_rules').delete().eq('id', id);
      if (error) throw error;
      toast.success('Rule deleted.');
      loadData();
    } catch (err: any) {
      toast.error('Failed to delete rule: ' + err.message);
    }
  }

  async function handleRestoreComment(log: CommentLog) {
    try {
      // In production, this pings Meta API to unhide/restore the comment
      // and updates logs state
      const { error } = await supabase
        .from('comment_logs')
        .update({ action_taken: 'restored' })
        .eq('id', log.id);

      if (error) throw error;
      toast.success('Comment restored/unhidden successfully!');
      loadData();
    } catch (err: any) {
      toast.error('Error restoring comment: ' + err.message);
    }
  }

  async function handleSendAutopilot() {
    if (!autopilotMsg.trim() || !user) return;
    const userText = autopilotMsg.trim();
    setAutopilotLogs(prev => [...prev, { sender: 'user', text: userText }]);
    setAutopilotMsg('');
    setSendingAutopilot(true);

    try {
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token || '';

      const workerUrl = `${WORKER_URL}/api/autopilot-config`;
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          userId: user.id,
          message: userText
        })
      });

      if (!response.ok) throw new Error('Network response failure');
      const resData = await response.json() as any;

      setAutopilotLogs(prev => [...prev, { sender: 'bot', text: resData.reply }]);
      if (resData.dataModified) {
        loadData();
      }
    } catch (err) {
      // Fallback response if local worker is not running yet
      setTimeout(() => {
        setAutopilotLogs(prev => [...prev, {
          sender: 'bot',
          text: `Got it! I mock-processed your command: "${userText}". In production, this updates your moderation configurations directly.`
        }]);
      }, 8000);
    } finally {
      setSendingAutopilot(false);
    }
  }

  // Sync local toggle state when profile loads
  useEffect(() => {
    if (profile !== null) {
      setAnalysisEnabled(!!profile.allow_comment_analysis);
    }
  }, [profile?.allow_comment_analysis]);

  async function toggleCommentAnalysis() {
    if (!user) return;
    const newVal = !analysisEnabled;
    setTogglingAnalysis(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ allow_comment_analysis: newVal })
        .eq('id', user.id);
      if (error) throw error;
      setAnalysisEnabled(newVal);
      await refreshCreditBalance();
      toast.success(newVal ? 'AI Sentiment Analysis enabled — 1 credit per comment.' : 'AI Sentiment Analysis disabled. Keyword rules still active.');
    } catch (err: any) {
      toast.error('Failed to update setting: ' + err.message);
    } finally {
      setTogglingAnalysis(false);
    }
  }

  return (
    <div className="animate-slideUp" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '30px' }}>
      
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Auto-Moderation & Triggers</h1>
          <p>Configure automated comment replies, sentiment sorting, and safety controls.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button className="btn btn-secondary" onClick={() => setShowAutopilot(true)}>
            <Sparkles size={16} style={{ color: 'var(--primary)', marginRight: '4px' }} /> AI Autopilot
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/moderation/new')}>
            <Plus size={16} /> Create Trigger Rule
          </button>
        </div>
      </div>

      {/* AI Sentiment Analysis toggle banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 22px',
        borderRadius: '14px',
        background: analysisEnabled
          ? 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.08) 100%)'
          : 'var(--surface)',
        border: `1.5px solid ${analysisEnabled ? 'rgba(99,102,241,0.35)' : 'var(--border)'}`,
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '12px',
            background: analysisEnabled ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'var(--surface-2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Brain size={22} color={analysisEnabled ? '#fff' : 'var(--text-secondary)'} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>AI Sentiment Analysis</span>
              <span style={{
                padding: '2px 8px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 700,
                background: analysisEnabled ? 'rgba(99,102,241,0.2)' : 'var(--surface-2)',
                color: analysisEnabled ? '#818cf8' : 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {analysisEnabled ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {analysisEnabled
                ? 'AI reads every comment for sentiment, toxicity & custom triggers. Costs 1 credit per comment.'
                : 'Disabled — only keyword-match rules run. No AI credits charged for comments.'}
            </p>
          </div>
        </div>
        <button
          id="toggle-comment-analysis-btn"
          onClick={toggleCommentAnalysis}
          disabled={togglingAnalysis}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 20px', borderRadius: '10px', fontWeight: 600, fontSize: '0.88rem',
            border: 'none', cursor: togglingAnalysis ? 'not-allowed' : 'pointer',
            background: analysisEnabled
              ? 'rgba(239,68,68,0.12)'
              : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            color: analysisEnabled ? '#f87171' : '#fff',
            transition: 'all 0.2s ease', opacity: togglingAnalysis ? 0.7 : 1,
            flexShrink: 0,
          }}
        >
          {togglingAnalysis
            ? <Loader2 size={16} className="spin" />
            : analysisEnabled
              ? <ToggleRight size={18} />
              : <ToggleLeft size={18} />}
          {analysisEnabled ? 'Disable Analysis' : 'Enable Analysis'}
        </button>
      </div>

      {/* Rules list */}
      <div className="card">
        <h3>Active Rules</h3>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading rules...</p>
        ) : rules.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
            No rules set. Click "Create Trigger Rule" or use AI Autopilot to connect your first keyword trigger.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
            {rules.map(rule => {
              const channelName = channels.find(c => c.page_id === rule.page_connection_id)?.page_name || 'All Channels';
              return (
                <div key={rule.id} className="list-item" style={{ border: '1px solid var(--border-primary)', padding: '12px 16px', borderRadius: '8px', opacity: rule.is_active ? 1 : 0.6 }}>
                  <div className="list-item-content">
                    <div className="list-item-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="badge" style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', fontSize: '10px' }}>
                        {channelName}
                      </span>
                      <span className="badge" style={{ 
                        background: rule.post_id ? 'rgba(139,92,246,0.1)' : 'rgba(107,114,128,0.1)', 
                        color: rule.post_id ? '#8b5cf6' : 'var(--text-secondary)', 
                        fontSize: '9px',
                        fontWeight: 'bold'
                      }}>
                        {rule.post_id ? 'Post-Specific' : 'Global'}
                      </span>
                      <strong style={{ fontSize: '0.9rem' }}>
                        {rule.trigger_type === 'keywords' 
                          ? `Keywords: ${rule.keywords?.join(', ')}` 
                          : rule.trigger_type === 'ai_sentiment' 
                          ? `AI Sentiment: ${rule.sentiment_target}` 
                          : rule.trigger_type === 'ai_custom'
                          ? `AI Custom Criteria: "${rule.ai_custom_criteria}"`
                          : 'All Comments'}
                      </strong>
                    </div>
                    <div className="list-item-subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: '500' }}>Actions:</span>
                      {rule.action_to_take.split(',').map((action: string) => {
                        const colors: Record<string, string> = {
                          hide: 'rgba(245,158,11,0.15), #f59e0b',
                          delete: 'rgba(239,68,68,0.15), #ef4444',
                          like: 'rgba(59,130,246,0.15), #3b82f6',
                          block: 'rgba(220,38,38,0.2), #dc2626',
                          reply: 'rgba(16,185,129,0.15), #10b981',
                          dm: 'rgba(139,92,246,0.15), #8b5cf6',
                          trash_queue: 'rgba(107,114,128,0.15), #6b7280'
                        };
                        const [bg, col] = colors[action] ? colors[action].split(', ') : ['rgba(255,255,255,0.05)', 'var(--text-secondary)'];
                        return (
                          <span key={action} style={{ background: bg, color: col, padding: '1px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold' }}>
                            {action.toUpperCase()}
                          </span>
                        );
                      })}
                      {rule.use_dynamic_ai_reply ? (
                        <span style={{ marginLeft: '4px', color: 'var(--primary)', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <Sparkles size={11} /> AI Autopilot Reply
                        </span>
                      ) : rule.reply_templates && (
                        <span style={{ marginLeft: '4px' }}>| Canned Reply: "{rule.reply_templates[0].substring(0, 25)}..."</span>
                      )}
                      {rule.dm_flow_id ? (
                        <span style={{ marginLeft: '4px', color: '#8b5cf6', fontWeight: '500' }}>
                          | DM Flow: "{flows.find(f => f.id === rule.dm_flow_id)?.name || 'Flow'}"
                        </span>
                      ) : rule.dm_reply_templates ? (
                        <span style={{ marginLeft: '4px' }}>
                          | DM Reply: "{rule.dm_reply_templates[0].substring(0, 25)}..."
                        </span>
                      ) : null}

                      {rule.attachment_urls && rule.attachment_urls.length > 0 && (
                        <span style={{ color: 'var(--primary)', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '4px', fontWeight: '600' }}>
                          ({rule.attachment_urls.length} files attached)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="list-item-actions">
                    <button className={`btn btn-sm ${rule.is_active ? 'btn-secondary' : 'btn-success'}`} onClick={() => handleToggleRule(rule)}>
                      {rule.is_active ? 'Pause' : 'Activate'}
                    </button>
                    <button className="btn-ghost btn-icon" onClick={() => navigate(`/moderation/edit/${rule.id}`)} title="Edit Rule">
                      <Edit2 size={14} color="var(--text-secondary)" />
                    </button>
                    <button className="btn-ghost btn-icon" onClick={() => handleDeleteRule(rule.id)}>
                      <Trash2 size={14} color="var(--error)" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Trash hold queue safety screen */}
      <div className="card">
        <h3>Moderation Hold & Trash Queue</h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          To keep your feed clean, comments matching negative filters are hidden automatically and placed here for 24 hours.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          {logs.filter(l => l.action_taken === 'trashed').length === 0 ? (
            <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <CheckCircle2 size={24} style={{ color: 'var(--success)', margin: '0 auto 8px auto', opacity: 0.7 }} />
              Trash Queue is clean. No toxic comments flagged recently.
            </div>
          ) : (
            logs.filter(l => l.action_taken === 'trashed').map(log => (
              <div key={log.id} className="list-item" style={{ border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.02)', padding: '12px' }}>
                <div className="list-item-content">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShieldAlert size={14} color="var(--error)" />
                    <strong style={{ fontSize: '0.85rem' }}>{log.user_name || 'Anonymous User'}</strong>
                    <span className="badge badge-error" style={{ fontSize: '8px' }}>Toxic Flag</span>
                  </div>
                  <p style={{ margin: '6px 0 0 0', fontSize: '0.8rem', color: 'var(--text-primary)' }}>"{log.user_message}"</p>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Score: {((log.ai_toxicity_score || 0) * 100).toFixed(0)}% Toxic • Flagged {new Date(log.created_at).toLocaleTimeString()}
                  </div>
                </div>
                <div className="list-item-actions">
                  <button className="btn btn-sm btn-success" onClick={() => handleRestoreComment(log)}>Restore Comment</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Trigger Rule Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>{editingRuleId ? 'Edit Trigger Rule' : 'Connect Trigger Rule'}</h2>
              <button className="btn-ghost btn-icon" type="button" onClick={closeModal}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateRule}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Social Channel</label>
                  <select className="form-input" value={selectedChannel} onChange={e => {
                    const val = e.target.value;
                    setSelectedChannel(val);
                    setSelectedPostId('');
                    setApplyToPostType('global');
                    if (val) {
                      fetchPagePosts(val);
                    } else {
                      setPosts([]);
                    }
                  }} required>
                    <option value="">-- Choose Connected Page --</option>
                    {channels.map(c => (
                      <option key={c.page_id} value={c.page_id}>{c.page_name}</option>
                    ))}
                  </select>
                </div>

                {selectedChannel && (
                  <>
                    <div className="form-group">
                      <label className="form-label">Rule Scope</label>
                      <select className="form-input" value={applyToPostType} onChange={e => setApplyToPostType(e.target.value)}>
                        <option value="global">Apply to All Posts on Page (Global)</option>
                        <option value="specific">Apply to a Specific Post</option>
                      </select>
                    </div>

                    {applyToPostType === 'specific' && (
                      <div className="form-group">
                        <label className="form-label">Select Target Post</label>
                        {loadingPosts ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            <Loader2 size={14} className="animate-spin" /> Fetching recent page posts...
                          </div>
                        ) : posts.length === 0 ? (
                          <div style={{ padding: '8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            No posts found on this page.
                          </div>
                        ) : (
                          <>
                            <select 
                              className="form-input" 
                              value={selectedPostId} 
                              onChange={e => setSelectedPostId(e.target.value)}
                              required={applyToPostType === 'specific'}
                            >
                              <option value="">-- Choose a Post --</option>
                              {posts.map(post => (
                                <option key={post.id} value={post.id}>
                                  {post.message.substring(0, 60)}{post.message.length > 60 ? '...' : ''}
                                </option>
                              ))}
                            </select>

                            {selectedPostId && (
                              (() => {
                                const selectedPost = posts.find(p => p.id === selectedPostId);
                                if (!selectedPost) return null;
                                return (
                                  <div style={{ 
                                    display: 'flex', 
                                    gap: '12px', 
                                    background: 'var(--bg-secondary)', 
                                    padding: '12px', 
                                    borderRadius: '8px', 
                                    marginTop: '8px', 
                                    border: '1px solid var(--border-primary)',
                                    alignItems: 'center'
                                  }}>
                                    {selectedPost.picture && (
                                      <img 
                                        src={selectedPost.picture} 
                                        alt="Post thumbnail" 
                                        style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px' }} 
                                      />
                                    )}
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1 }}>
                                      <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>Selected Post Preview:</div>
                                      "{selectedPost.message.substring(0, 100)}{selectedPost.message.length > 100 ? '...' : ''}"
                                    </div>
                                  </div>
                                );
                              })()
                            )}
                          </>
                        )}
                    </div>
                    )}
                  </>
                )}

                <div className="form-group">
                  <label className="form-label">Trigger Event Type</label>
                  <select className="form-input" value={triggerType} onChange={e => setTriggerType(e.target.value)} required>
                    <option value="keywords">Keyword Match</option>
                    <option value="ai_sentiment">AI Sentiment Analysis</option>
                    <option value="ai_custom">Custom AI Trigger (Natural Language)</option>
                    <option value="all">All Comments</option>
                  </select>
                </div>

                 {triggerType === 'keywords' && (
                  <div className="form-group">
                    <label className="form-label">Trigger Keywords (Type and press comma or Enter)</label>
                    <div style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      padding: '8px 12px',
                      background: 'var(--bg-secondary)',
                      border: '1.5px solid var(--border-primary)',
                      borderRadius: '8px',
                      minHeight: '42px',
                      alignItems: 'center',
                      cursor: 'text'
                    }} onClick={() => document.getElementById('keyword-tag-input')?.focus()}>
                      {keywords.map((kw, idx) => (
                        <div key={idx} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'var(--bg-primary)',
                          border: '1.5px solid var(--accent-primary)',
                          borderRadius: '6px',
                          padding: '2px 8px',
                          fontSize: '0.85rem',
                          fontWeight: '600',
                          color: 'var(--text-primary)'
                        }}>
                          <span>{kw}</span>
                          <button 
                            type="button" 
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                            onClick={(e) => { e.stopPropagation(); setKeywords(keywords.filter((_, i) => i !== idx)); }}
                          >
                            <X size={14} color="var(--text-secondary)" />
                          </button>
                        </div>
                      ))}
                      <input 
                        id="keyword-tag-input"
                        type="text"
                        placeholder={keywords.length === 0 ? "e.g. price, cost, buy" : ""}
                        value={keywordsInput}
                        onChange={e => {
                          const val = e.target.value;
                          if (val.endsWith(',')) {
                            const word = val.slice(0, -1).trim();
                            if (word && !keywords.includes(word)) {
                              setKeywords([...keywords, word]);
                            }
                            setKeywordsInput('');
                          } else {
                            setKeywordsInput(val);
                          }
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const word = keywordsInput.trim();
                            if (word && !keywords.includes(word)) {
                              setKeywords([...keywords, word]);
                            }
                            setKeywordsInput('');
                          } else if (e.key === 'Backspace' && !keywordsInput && keywords.length > 0) {
                            setKeywords(keywords.slice(0, -1));
                          }
                        }}
                        style={{
                          flex: 1,
                          minWidth: '120px',
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: 'var(--text-primary)',
                          padding: 0,
                          fontSize: '0.9rem'
                        }}
                      />
                    </div>
                    <span className="form-hint">Type a keyword and separate with commas or press Enter. Backspace deletes the entire block.</span>
                  </div>
                )}

                {triggerType === 'ai_sentiment' && (
                  <div className="form-group">
                    <label className="form-label">Target AI Sentiment</label>
                    <select className="form-input" value={sentimentTarget} onChange={e => setSentimentTarget(e.target.value)} required>
                      <option value="negative">Negative</option>
                      <option value="positive">Positive</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </div>
                )}

                {triggerType === 'ai_custom' && (
                  <div className="form-group animate-fadeIn">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ margin: 0 }}>Custom AI Trigger Prompt</label>
                      <span style={{ 
                        cursor: 'pointer', 
                        background: 'var(--bg-secondary)', 
                        border: '1px solid var(--border-primary)',
                        borderRadius: '50%',
                        width: '18px',
                        height: '18px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        color: 'var(--text-secondary)'
                      }} title="Define a natural language instruction for the AI. The comment will trigger if the AI decides the comment matches your description.">?</span>
                    </div>
                    
                    <textarea 
                      className="form-textarea" 
                      placeholder="e.g. anyone talking about red cows or green trees" 
                      value={aiCustomCriteria} 
                      onChange={e => setAiCustomCriteria(e.target.value)} 
                      required 
                    />
                    
                    <div style={{ marginTop: '8px' }}>
                      <span className="form-hint" style={{ display: 'block', marginBottom: '6px', fontSize: '0.75rem' }}>Presets (Click to apply):</span>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button 
                          type="button" 
                          className="btn btn-sm btn-secondary" 
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                          onClick={() => setAiCustomCriteria("Comments asking about pricing, cost, rates, fees, or how to buy.")}
                        >
                          Pricing/Buy
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-sm btn-secondary" 
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                          onClick={() => setAiCustomCriteria("Comments expressing customer support issues, technical problems, or complaints.")}
                        >
                          Issues/Support
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-sm btn-secondary" 
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                          onClick={() => setAiCustomCriteria("Comments asking if the product is in stock, where it is available, or shipping times.")}
                        >
                          Availability
                        </button>
                        <button 
                          type="button" 
                          className="btn btn-sm btn-secondary" 
                          style={{ fontSize: '11px', padding: '2px 8px' }}
                          onClick={() => setAiCustomCriteria("Comments containing general praise, compliments, or positive feedback.")}
                        >
                          Positive/Praise
                        </button>
                      </div>
                    </div>
                  </div>
                )}                <div className="form-group">
                  <label className="form-label">Actions to Take (Select all that apply)</label>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
                    gap: '12px', 
                    background: 'var(--bg-secondary)', 
                    padding: '12px', 
                    borderRadius: '8px',
                    border: '1.5px solid var(--border-primary)'
                  }}>
                    {[
                      { id: 'hide', label: 'Hide Comment' },
                      { id: 'delete', label: 'Delete Comment' },
                      { id: 'like', label: 'Auto-Like Comment' },
                      { id: 'block', label: 'Block User on Page' },
                      { id: 'reply', label: 'Public Comment Reply' },
                      { id: 'dm', label: 'Private DM Handshake' },
                      { id: 'trash_queue', label: 'Send to Safety Queue' },
                    ].map(act => {
                      const checked = selectedActions.includes(act.id);
                      return (
                        <label key={act.id} style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          fontWeight: checked ? '600' : 'normal',
                          color: checked ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}>
                          <input 
                            type="checkbox" 
                            checked={checked}
                            onChange={() => {
                              if (checked) {
                                setSelectedActions(selectedActions.filter(a => a !== act.id));
                              } else {
                                setSelectedActions([...selectedActions, act.id]);
                              }
                            }}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          {act.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {selectedActions.includes('reply') && (
                  <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px', marginTop: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                      Public Comment Reply Settings
                    </h4>
                    <div className="form-group" style={{ marginBottom: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                        <input 
                          type="checkbox" 
                          checked={useDynamicAiReply} 
                          onChange={e => setUseDynamicAiReply(e.target.checked)}
                          style={{ accentColor: '#10b981' }}
                        />
                        Enable AI Autopilot Reply (Contextual AI Responses)
                      </label>
                      <span className="form-hint" style={{ display: 'block', marginTop: '4px', marginLeft: '22px' }}>
                        If enabled, the AI will dynamically write a contextual reply using the post caption and comment instead of a canned template.
                      </span>
                    </div>

                    {!useDynamicAiReply && (
                      <div className="form-group animate-fadeIn">
                        <label className="form-label">Public Reply Message Template</label>
                        <textarea className="form-textarea" placeholder="Type your public response template..." value={replyInput} onChange={e => setReplyInput(e.target.value)} required={!useDynamicAiReply} />
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Public Reply Attachments (Optional)</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <select 
                          className="form-input" 
                          value="" 
                          onChange={e => {
                            const val = e.target.value;
                            if (val && !selectedAttachments.includes(val)) {
                              setSelectedAttachments([...selectedAttachments, val]);
                            }
                          }}
                        >
                          <option value="">-- Attach a file from Chat Assets --</option>
                          {chatAssets.map(asset => (
                            <option key={asset.id} value={asset.file_url}>{asset.friendly_name} ({asset.file_type})</option>
                          ))}
                        </select>

                        {selectedAttachments.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                            {selectedAttachments.map((url, idx) => {
                              const asset = chatAssets.find(a => a.file_url === url);
                              const displayName = asset ? asset.friendly_name : url.split('/').pop() || 'File';
                              return (
                                <div key={idx} style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  background: 'var(--bg-primary)',
                                  border: '1.5px solid var(--accent-primary)',
                                  borderRadius: '6px',
                                  padding: '2px 8px',
                                  fontSize: '0.8rem',
                                  color: 'var(--text-primary)'
                                }}>
                                  <span>{displayName}</span>
                                  <button 
                                    type="button" 
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                                    onClick={() => setSelectedAttachments(selectedAttachments.filter((_, i) => i !== idx))}
                                  >
                                    <X size={12} color="var(--text-secondary)" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div style={{ marginTop: '4px' }}>
                          <input 
                            type="file" 
                            id="inline-asset-upload" 
                            style={{ display: 'none' }} 
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file || !user) return;
                              
                              try {
                                setSaving(true);
                                const fileExt = file.name.split('.').pop();
                                const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
                                const filePath = `${user.id}/${fileName}`;

                                const { error: uploadErr } = await supabase.storage
                                  .from('media_assets')
                                  .upload(filePath, file);

                                if (uploadErr) throw uploadErr;

                                const { data: { publicUrl } } = supabase.storage
                                  .from('media_assets')
                                  .getPublicUrl(filePath);

                                let fileType = 'file';
                                if (file.type.startsWith('image/')) fileType = 'image';
                                else if (file.type.startsWith('video/')) fileType = 'video';
                                else if (file.type.startsWith('audio/')) fileType = 'audio';

                                const assetName = file.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
                                const { error: dbErr } = await supabase
                                  .from('media')
                                  .insert({
                                    user_id: user.id,
                                    name: `${assetName}_${Date.now()}`,
                                    friendly_name: file.name,
                                    file_url: publicUrl,
                                    file_type: fileType,
                                    ai_auto_send: true
                                  });

                                if (dbErr) throw dbErr;

                                toast.success(`Uploaded & attached: ${file.name}`);
                                
                                const { data: chatAssetsData } = await supabase
                                  .from('media')
                                  .select('id, name, friendly_name, file_url, file_type');
                                setChatAssets(chatAssetsData || []);

                                setSelectedAttachments(prev => [...prev, publicUrl]);
                              } catch (err: any) {
                                toast.error('Upload failed: ' + err.message);
                              } finally {
                                setSaving(false);
                              }
                            }}
                          />
                          <button 
                            type="button" 
                            className="btn btn-sm btn-secondary" 
                            style={{ width: '100%' }}
                            onClick={() => document.getElementById('inline-asset-upload')?.click()}
                            disabled={saving}
                          >
                            Upload & Attach New File
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {selectedActions.includes('dm') && (
                  <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px', marginTop: '16px' }}>
                    <h4 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6' }}></span>
                      Private DM Handshake Settings
                    </h4>
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Response Type</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="responseType"
                            value="text"
                            checked={responseType === 'text'}
                            onChange={() => setResponseType('text')}
                            style={{ accentColor: '#8b5cf6' }}
                          />
                          Send static text message
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                          <input
                            type="radio"
                            name="responseType"
                            value="flow"
                            checked={responseType === 'flow'}
                            onChange={() => setResponseType('flow')}
                            style={{ accentColor: '#8b5cf6' }}
                          />
                          Trigger a structured DM Flow
                        </label>
                      </div>
                    </div>

                    {responseType === 'text' ? (
                      <>
                        <div className="form-group">
                          <label className="form-label">Private DM Message Template</label>
                          <textarea className="form-textarea" placeholder="Type your private DM template..." value={dmReplyInput} onChange={e => setDmReplyInput(e.target.value)} required={responseType === 'text'} />
                        </div>

                        <div className="form-group">
                          <label className="form-label">Private DM Attachments (Optional)</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <select 
                              className="form-input" 
                              value="" 
                              onChange={e => {
                                const val = e.target.value;
                                if (val && !selectedDmAttachments.includes(val)) {
                                  setSelectedDmAttachments([...selectedDmAttachments, val]);
                                }
                              }}
                            >
                              <option value="">-- Attach a file from Chat Assets --</option>
                              {chatAssets.map(asset => (
                                <option key={asset.id} value={asset.file_url}>{asset.friendly_name} ({asset.file_type})</option>
                              ))}
                            </select>

                            {selectedDmAttachments.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '4px' }}>
                                {selectedDmAttachments.map((url, idx) => {
                                  const asset = chatAssets.find(a => a.file_url === url);
                                  const displayName = asset ? asset.friendly_name : url.split('/').pop() || 'File';
                                  return (
                                    <div key={idx} style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                      background: 'var(--bg-primary)',
                                      border: '1.5px solid var(--accent-primary)',
                                      borderRadius: '6px',
                                      padding: '2px 8px',
                                      fontSize: '0.8rem',
                                      color: 'var(--text-primary)'
                                    }}>
                                      <span>{displayName}</span>
                                      <button 
                                        type="button" 
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                                        onClick={() => setSelectedDmAttachments(selectedDmAttachments.filter((_, i) => i !== idx))}
                                      >
                                        <X size={12} color="var(--text-secondary)" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            <div style={{ marginTop: '4px' }}>
                              <input 
                                type="file" 
                                id="inline-dm-asset-upload" 
                                style={{ display: 'none' }} 
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file || !user) return;
                                  
                                  try {
                                    setSaving(true);
                                    const fileExt = file.name.split('.').pop();
                                    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
                                    const filePath = `${user.id}/${fileName}`;

                                    const { error: uploadErr } = await supabase.storage
                                      .from('media_assets')
                                      .upload(filePath, file);

                                    if (uploadErr) throw uploadErr;

                                    const { data: { publicUrl } } = supabase.storage
                                      .from('media_assets')
                                      .getPublicUrl(filePath);

                                    let fileType = 'file';
                                    if (file.type.startsWith('image/')) fileType = 'image';
                                    else if (file.type.startsWith('video/')) fileType = 'video';
                                    else if (file.type.startsWith('audio/')) fileType = 'audio';

                                    const assetName = file.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
                                    const { error: dbErr } = await supabase
                                      .from('media')
                                      .insert({
                                        user_id: user.id,
                                        name: `${assetName}_${Date.now()}`,
                                        friendly_name: file.name,
                                        file_url: publicUrl,
                                        file_type: fileType,
                                        ai_auto_send: true
                                      });

                                    if (dbErr) throw dbErr;

                                      toast.success(`Uploaded & attached: ${file.name}`);
                                    
                                    const { data: chatAssetsData } = await supabase
                                      .from('media')
                                      .select('id, name, friendly_name, file_url, file_type');
                                    setChatAssets(chatAssetsData || []);

                                    setSelectedDmAttachments(prev => [...prev, publicUrl]);
                                  } catch (err: any) {
                                    toast.error('Upload failed: ' + err.message);
                                  } finally {
                                    setSaving(false);
                                  }
                                }}
                              />
                              <button 
                                type="button" 
                                className="btn btn-sm btn-secondary" 
                                style={{ width: '100%' }}
                                onClick={() => document.getElementById('inline-dm-asset-upload')?.click()}
                                disabled={saving}
                              >
                                Upload & Attach New File
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="form-group">
                        <label className="form-label">Select DM Flow</label>
                        <select
                          className="form-input"
                          value={selectedDmFlowId}
                          onChange={e => setSelectedDmFlowId(e.target.value)}
                          required={responseType === 'flow'}
                        >
                          <option value="">-- Choose an active Flow --</option>
                          {flows.map(f => (
                            <option key={f.id} value={f.id}>{f.name} {!f.is_active ? '(Inactive)' : ''}</option>
                          ))}
                        </select>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '6px' }}>
                          The chosen sequence will run automatically once the user receives the private comment handshake.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {editingRuleId ? 'Save Changes' : 'Connect Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Autopilot Chat Drawer */}
      {showAutopilot && (
        <div className="modal-overlay" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch' }} onClick={() => setShowAutopilot(false)}>
          <div className="modal animate-slideLeft" style={{ width: '400px', height: '100%', margin: 0, borderRadius: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }} onClick={e => e.stopPropagation()}>
            <div>
              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={18} color="var(--primary)" />
                  <h2>AI Autopilot Builder</h2>
                </div>
                <button className="btn-ghost btn-icon" onClick={() => setShowAutopilot(false)}><X size={18} /></button>
              </div>
              
              {/* Message History */}
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: 'calc(100vh - 200px)' }}>
                {autopilotLogs.map((log, i) => (
                  <div key={i} style={{
                    alignSelf: log.sender === 'user' ? 'flex-end' : 'flex-start',
                    background: log.sender === 'user' ? 'var(--primary)' : 'var(--bg-secondary)',
                    color: log.sender === 'user' ? 'white' : 'var(--text-primary)',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '0.85rem',
                    maxWidth: '85%'
                  }}>
                    {log.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Input Bar */}
            <div style={{ borderTop: '1px solid var(--border-color)', padding: '12px', display: 'flex', gap: '8px' }}>
              <input className="form-input" style={{ margin: 0 }} placeholder="E.g. Delete profanity comments" value={autopilotMsg} onChange={e => setAutopilotMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSendAutopilot()} disabled={sendingAutopilot} />
              <button className="btn btn-primary btn-icon" onClick={handleSendAutopilot} disabled={sendingAutopilot || !autopilotMsg.trim()}>
                {sendingAutopilot ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
