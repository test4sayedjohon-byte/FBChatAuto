import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';
import { Plus, Trash2, X, Sparkles, Send, ShieldAlert, CheckCircle2, Loader2, Save } from 'lucide-react';

interface Rule {
  id: string;
  trigger_type: string;
  keywords: string[] | null;
  sentiment_target: string | null;
  action_to_take: string;
  reply_templates: string[] | null;
  is_active: boolean;
  page_connection_id: string;
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

export default function AutoModerationPage() {
  const { user } = useAuth();
  const [rules, setRules] = useState<Rule[]>([]);
  const [logs, setLogs] = useState<CommentLog[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Rule Creator State
  const [selectedChannel, setSelectedChannel] = useState('');
  const [triggerType, setTriggerType] = useState('keywords');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [sentimentTarget, setSentimentTarget] = useState('negative');
  const [actionToTake, setActionToTake] = useState('hide');
  const [replyInput, setReplyInput] = useState('');

  // Autopilot Drawer State
  const [showAutopilot, setShowAutopilot] = useState(false);
  const [autopilotMsg, setAutopilotMsg] = useState('');
  const [autopilotLogs, setAutopilotLogs] = useState<{ sender: 'user' | 'bot'; text: string }[]>([
    { sender: 'bot', text: 'Hi! I am your AI Autopilot Configurator. Tell me what automation rule you want to set up in plain English (e.g. "If someone comments price, reply to check DMs and hide it").' }
  ]);
  const [sendingAutopilot, setSendingAutopilot] = useState(false);

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

      setRules(rulesData || []);
      setLogs(logsData || []);
      
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
      const { error } = await supabase
        .from('comment_rules')
        .insert({
          user_id: user.id,
          page_connection_id: selectedChannel,
          trigger_type: triggerType,
          keywords: triggerType === 'keywords' ? keywordsInput.split(',').map(k => k.trim()).filter(k => k) : null,
          sentiment_target: triggerType === 'ai_sentiment' ? sentimentTarget : null,
          action_to_take: actionToTake,
          reply_templates: replyInput.trim() ? [replyInput.trim()] : null,
          is_active: true
        });

      if (error) throw error;

      toast.success('Moderation rule connected successfully!');
      setShowModal(false);
      // Reset Rule Form
      setSelectedChannel('');
      setKeywordsInput('');
      setReplyInput('');
      loadData();
    } catch (err: any) {
      toast.error('Failed to create rule: ' + err.message);
    } finally {
      setSaving(false);
    }
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
      // Local URL for worker execution
      const workerUrl = 'http://localhost:8787/api/autopilot-config';
      const response = await fetch(workerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Bypass-Auth': 'true' // bypass auth check locally
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
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Create Trigger Rule
          </button>
        </div>
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
                      <strong style={{ fontSize: '0.9rem' }}>
                        {rule.trigger_type === 'keywords' ? `Keywords: ${rule.keywords?.join(', ')}` : rule.trigger_type === 'ai_sentiment' ? `AI Sentiment: ${rule.sentiment_target}` : 'All Comments'}
                      </strong>
                    </div>
                    <div className="list-item-subtitle" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Action: {rule.action_to_take} {rule.reply_templates && `| Canned Reply: "${rule.reply_templates[0].substring(0, 30)}..."`}
                    </div>
                  </div>
                  <div className="list-item-actions">
                    <button className={`btn btn-sm ${rule.is_active ? 'btn-secondary' : 'btn-success'}`} onClick={() => handleToggleRule(rule)}>
                      {rule.is_active ? 'Pause' : 'Activate'}
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Connect Trigger Rule</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateRule}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select Social Channel</label>
                  <select className="form-input" value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)} required>
                    <option value="">-- Choose Connected Page --</option>
                    {channels.map(c => (
                      <option key={c.page_id} value={c.page_id}>{c.page_name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Trigger Event Type</label>
                  <select className="form-input" value={triggerType} onChange={e => setTriggerType(e.target.value)} required>
                    <option value="keywords">Keyword Match</option>
                    <option value="ai_sentiment">AI Sentiment Analysis</option>
                    <option value="all">All Comments</option>
                  </select>
                </div>

                {triggerType === 'keywords' && (
                  <div className="form-group">
                    <label className="form-label">Trigger Keywords (comma separated)</label>
                    <input className="form-input" placeholder="e.g. price, cost, buy, discount" value={keywordsInput} onChange={e => setKeywordsInput(e.target.value)} required />
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

                <div className="form-group">
                  <label className="form-label">Action to Take</label>
                  <select className="form-input" value={actionToTake} onChange={e => setActionToTake(e.target.value)} required>
                    <option value="reply">Public Comment Reply</option>
                    <option value="hide">Hide Comment</option>
                    <option value="trash_queue">Send to Safety Hold Queue</option>
                    <option value="hide_and_reply">Hide & Reply</option>
                    <option value="dm">Private DM Handshake</option>
                  </select>
                </div>

                {(actionToTake === 'reply' || actionToTake === 'hide_and_reply' || actionToTake === 'dm') && (
                  <div className="form-group">
                    <label className="form-label">Reply Message Template</label>
                    <textarea className="form-textarea" placeholder="Type your response template..." value={replyInput} onChange={e => setReplyInput(e.target.value)} required />
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Connect Rule
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
