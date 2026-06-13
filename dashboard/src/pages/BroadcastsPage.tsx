import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
  workerGet,
  workerPost,
  workerPut,
  workerDelete
} from '../lib/workerApi';
import {
  Play,
  Pause,
  Square,
  Trash2,
  Plus,
  Megaphone,
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Clock,
  Send,
  Users,
  Sliders,
  Filter
} from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
  page_id: string;
  status: 'draft' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'stopped';
  filters: {
    intent_levels?: string[];
    tags?: string[];
    last_active_hours?: number;
  };
  sending_order: 'random' | 'latest_first' | 'oldest_first';
  mode: 'single' | 'multiple_random' | 'ai_personalized';
  static_templates?: string[];
  ai_prompt_goal?: string;
  delay_seconds: number;
  randomize_delay: boolean;
  created_at: string;
}

interface CampaignStats {
  pending_review: number;
  queued: number;
  sending: number;
  sent: number;
  failed: number;
  total: number;
}

interface PendingMessage {
  id: string;
  customer_name: string;
  sender_id: string;
  message_content: string;
  status: 'pending_review' | 'queued' | 'sending' | 'sent' | 'failed';
  batch_number: number;
}

interface PageConnection {
  page_id: string;
  page_name: string;
  is_active: boolean;
  whatsapp_phone_number_id?: string;
  is_whatsapp_active?: boolean;
}

export default function BroadcastsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'view'>('list');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // View campaign detail states
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [matchingContactsCount, setMatchingContactsCount] = useState(0);
  const [unsentContactsCount, setUnsentContactsCount] = useState(0);
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [generatingBatch, setGeneratingBatch] = useState(false);
  const [approvingBatch, setApprovingBatch] = useState(false);

  // Form states for creating campaign
  const [pageConnections, setPageConnections] = useState<PageConnection[]>([]);
  const [formName, setFormName] = useState('');
  const [formPageId, setFormPageId] = useState('');
  const [formMode, setFormMode] = useState<'single' | 'multiple_random' | 'ai_personalized'>('single');
  const [formIntentHigh, setFormIntentHigh] = useState(true);
  const [formIntentMedium, setFormIntentMedium] = useState(true);
  const [formIntentLow, setFormIntentLow] = useState(false);
  const [formIntentUnknown, setFormIntentUnknown] = useState(false);
  const [formTags, setFormTags] = useState('');
  const [formActiveHours, setFormActiveHours] = useState('');
  const [formSendingOrder, setFormSendingOrder] = useState<'random' | 'latest_first' | 'oldest_first'>('random');
  const [formSingleMessage, setFormSingleMessage] = useState('');
  const [formTemplates, setFormTemplates] = useState<string[]>(['']);
  const [formAiGoal, setFormAiGoal] = useState('');
  const [formDelay, setFormDelay] = useState(30);
  const [formRandomizeDelay, setFormRandomizeDelay] = useState(true);
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  // Load campaigns & page connections
  useEffect(() => {
    loadCampaigns();
    loadPageConnections();
  }, []);

  async function loadCampaigns() {
    try {
      setLoading(true);
      const res = await workerGet<{ campaigns: Campaign[] }>('/api/broadcasts');
      setCampaigns(res.campaigns || []);
    } catch (err: any) {
      console.error('Error loading campaigns:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadPageConnections() {
    try {
      const { data } = await supabase
        .from('page_connections')
        .select('page_id, page_name, is_active, whatsapp_phone_number_id, is_whatsapp_active')
        .eq('is_active', true);
      if (data) setPageConnections(data);
    } catch (err) {
      console.error('Error loading page connections:', err);
    }
  }

  // Load detailed campaign workspace
  async function loadCampaignDetails(id: string) {
    try {
      setLoadingDetails(true);
      const details = await workerGet<{
        campaign: Campaign;
        stats: CampaignStats;
        matchingContactsCount: number;
        unsentContactsCount: number;
      }>(`/api/broadcasts/${id}`);

      setCampaign(details.campaign);
      setStats(details.stats);
      setMatchingContactsCount(details.matchingContactsCount);
      setUnsentContactsCount(details.unsentContactsCount);

      // Fetch pending review messages
      const pendingRes = await workerGet<{ pendingMessages: PendingMessage[] }>(
        `/api/broadcasts/${id}/pending-batch`
      );
      setPendingMessages(pendingRes.pendingMessages || []);
    } catch (err) {
      console.error('Error fetching campaign workspace:', err);
    } finally {
      setLoadingDetails(false);
    }
  }

  // Create campaign
  async function handleCreateCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (!formName || !formPageId) return;

    try {
      setCreatingCampaign(true);

      const intent_levels: string[] = [];
      if (formIntentHigh) intent_levels.push('high');
      if (formIntentMedium) intent_levels.push('medium');
      if (formIntentLow) intent_levels.push('low');
      if (formIntentUnknown) intent_levels.push('unknown');

      const tags = formTags
        ? formTags.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
        : [];

      const filters = {
        intent_levels,
        tags,
        last_active_hours: formActiveHours ? parseInt(formActiveHours) : undefined,
      };

      const staticTemplates =
        formMode === 'single'
          ? [formSingleMessage]
          : formMode === 'multiple_random'
          ? formTemplates.filter((t) => t.trim().length > 0)
          : [];

      const payload = {
        name: formName,
        pageId: formPageId,
        filters,
        sendingOrder: formSendingOrder,
        mode: formMode,
        staticTemplates,
        aiPromptGoal: formAiGoal,
        delaySeconds: formDelay,
        randomizeDelay: formRandomizeDelay,
      };

      await workerPost('/api/broadcasts', payload);
      
      // Reset form states
      setFormName('');
      setFormMode('single');
      setFormSingleMessage('');
      setFormTemplates(['']);
      setFormAiGoal('');
      
      await loadCampaigns();
      setActiveTab('list');
    } catch (err: any) {
      alert(err.message || 'Failed to create campaign');
    } finally {
      setCreatingCampaign(false);
    }
  }

  // Generate batch
  async function handleGenerateBatch() {
    if (!campaign) return;
    try {
      setGeneratingBatch(true);
      await workerPost(`/api/broadcasts/${campaign.id}/generate-batch`, {});
      await loadCampaignDetails(campaign.id);
    } catch (err: any) {
      alert(err.message || 'Failed to generate review batch');
    } finally {
      setGeneratingBatch(false);
    }
  }

  // Edit message text
  async function handleEditMessage(msgId: string, text: string) {
    if (!campaign) return;
    try {
      await workerPut(`/api/broadcasts/${campaign.id}/messages/${msgId}`, {
        messageContent: text
      });
      // Update local state
      setPendingMessages(prev =>
        prev.map(m => m.id === msgId ? { ...m, message_content: text } : m)
      );
    } catch (err: any) {
      console.error('Error saving message edit:', err);
    }
  }

  // Discard message
  async function handleDiscardMessage(msgId: string) {
    if (!campaign) return;
    if (!confirm('Are you sure you want to discard this message?')) return;
    try {
      await workerDelete(`/api/broadcasts/${campaign.id}/messages/${msgId}`);
      setPendingMessages(prev => prev.filter(m => m.id !== msgId));
      if (stats) {
        setStats({
          ...stats,
          pending_review: Math.max(0, stats.pending_review - 1),
          total: Math.max(0, stats.total - 1)
        });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to discard message');
    }
  }

  // Approve & Queue batch
  async function handleApproveBatch() {
    if (!campaign) return;
    try {
      setApprovingBatch(true);
      await workerPost(`/api/broadcasts/${campaign.id}/approve-batch`, {});
      await loadCampaignDetails(campaign.id);
    } catch (err: any) {
      alert(err.message || 'Failed to approve batch');
    } finally {
      setApprovingBatch(false);
    }
  }

  // Control Status (Pause, Resume, Stop)
  async function handleStatusChange(status: 'paused' | 'sending' | 'stopped') {
    if (!campaign) return;
    try {
      await workerPost(`/api/broadcasts/${campaign.id}/status`, { status });
      await loadCampaignDetails(campaign.id);
    } catch (err: any) {
      alert(err.message || 'Failed to update campaign status');
    }
  }

  // Helper dynamic timer projection
  function calculateTimeEstimate() {
    if (!stats || !campaign) return '0m';
    const remainingCount = stats.queued + stats.pending_review;
    const totalSeconds = remainingCount * campaign.delay_seconds;
    if (totalSeconds < 60) return `${totalSeconds}s`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }

  return (
    <div className="animate-slideUp" style={{ color: 'var(--text-primary)' }}>
      {/* Tab: LIST */}
      {activeTab === 'list' && (
        <>
          <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Megaphone style={{ color: 'var(--accent-primary)' }} /> Bulk Campaigns
              </h1>
              <p>Broadcast personalized paced messages to target segments on WhatsApp & Messenger.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setActiveTab('create')}>
              <Plus size={16} style={{ marginRight: '6px' }} /> Create Campaign
            </button>
          </div>

          {loading ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading Campaigns...
            </div>
          ) : campaigns.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '64px 24px' }}>
              <Megaphone size={48} style={{ color: 'var(--text-secondary)', marginBottom: '16px', opacity: 0.5 }} />
              <h3>No Campaigns Found</h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>Create your first targeted paced broadcast campaign.</p>
              <button className="btn btn-primary" onClick={() => setActiveTab('create')}>
                Create Campaign
              </button>
            </div>
          ) : (
            <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {campaigns.map((c) => (
                <div key={c.id} className="card hover-scale" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: '100%' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <span className={`status-badge ${c.status}`} style={{ fontSize: '12px' }}>
                        {c.status.toUpperCase()}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 style={{ marginBottom: '8px' }}>{c.name}</h3>
                    
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div>Mode: <strong>{c.mode === 'ai_personalized' ? 'AI Personalization' : c.mode === 'multiple_random' ? 'Multi-Random' : 'Single Template'}</strong></div>
                      <div>Delay: <strong>{c.delay_seconds}s {c.randomize_delay && '(Randomized)'}</strong></div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {c.filters.intent_levels?.map(lvl => (
                          <span key={lvl} style={{ background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', border: '1px solid var(--border-light)' }}>
                            Intent: {lvl}
                          </span>
                        ))}
                        {c.filters.tags?.map(t => (
                          <span key={t} style={{ background: 'rgba(0, 196, 140, 0.1)', color: '#00c48c', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-secondary"
                    style={{ width: '100%', marginTop: '12px' }}
                    onClick={() => {
                      setSelectedCampaignId(c.id);
                      loadCampaignDetails(c.id);
                      setActiveTab('view');
                    }}
                  >
                    Manage Campaign
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab: CREATE */}
      {activeTab === 'create' && (
        <>
          <div className="page-header" style={{ marginBottom: '24px' }}>
            <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', marginBottom: '16px' }} onClick={() => setActiveTab('list')}>
              <ArrowLeft size={16} /> Back to List
            </button>
            <h1>Create Broadcast Campaign</h1>
            <p>Define your audience filters, compose the messages, and configure pacing details.</p>
          </div>

          <form onSubmit={handleCreateCampaign} className="card" style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* General Settings */}
            <div>
              <h3 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', marginBottom: '16px' }}>General Settings</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 600 }}>
                  Campaign Name
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. High Intent Retargeting Coupon"
                    style={{ padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'inherit' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 600 }}>
                  Source Channel (Connected Page / Phone)
                  <select
                    required
                    value={formPageId}
                    onChange={(e) => setFormPageId(e.target.value)}
                    style={{ padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'inherit' }}
                  >
                    <option value="">Select connected channel...</option>
                    {pageConnections.map((pc) => (
                      <option key={pc.page_id} value={pc.page_id}>
                        {pc.page_name} ({pc.is_whatsapp_active ? 'WhatsApp' : 'Messenger'})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {/* Target Audience Filters */}
            <div>
              <h3 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}><Filter size={18} /> Target Audience Filters</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>AI Intent Levels</span>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={formIntentHigh} onChange={(e) => setFormIntentHigh(e.target.checked)} />
                      High Intent
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={formIntentMedium} onChange={(e) => setFormIntentMedium(e.target.checked)} />
                      Medium Intent
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={formIntentLow} onChange={(e) => setFormIntentLow(e.target.checked)} />
                      Low Intent
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input type="checkbox" checked={formIntentUnknown} onChange={(e) => setFormIntentUnknown(e.target.checked)} />
                      Unknown
                    </label>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 600 }}>
                    Filter by Tags (comma separated)
                    <input
                      type="text"
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                      placeholder="e.g. VIP, hot-lead, discount"
                      style={{ padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'inherit' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 600 }}>
                    Active Within Last (hours)
                    <input
                      type="number"
                      value={formActiveHours}
                      onChange={(e) => setFormActiveHours(e.target.value)}
                      placeholder="e.g. 24 (blank for all time)"
                      style={{ padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'inherit' }}
                    />
                  </label>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 600 }}>
                  Queue Sending Order
                  <select
                    value={formSendingOrder}
                    onChange={(e) => setFormSendingOrder(e.target.value as any)}
                    style={{ padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'inherit' }}
                  >
                    <option value="random">Randomized Order (Highly Recommended to bypass filters)</option>
                    <option value="latest_first">Latest Active First (Hot Leads)</option>
                    <option value="oldest_first">Oldest Active First</option>
                  </select>
                </label>
              </div>
            </div>

            {/* Campaign Message Composer */}
            <div>
              <h3 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', marginBottom: '16px' }}>Message Configuration</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <span style={{ fontWeight: 600, display: 'block', marginBottom: '8px' }}>Composer Mode</span>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {(['single', 'multiple_random', 'ai_personalized'] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        className={`btn ${formMode === mode ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFormMode(mode)}
                        style={{ flex: 1 }}
                      >
                        {mode === 'ai_personalized' ? 'AI Personalize' : mode === 'multiple_random' ? 'Multi-Random' : 'Single Message'}
                      </button>
                    ))}
                  </div>
                </div>

                {formMode === 'single' && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 600 }}>
                    Message Content (use {'{first_name}'} for personalization)
                    <textarea
                      rows={4}
                      required
                      value={formSingleMessage}
                      onChange={(e) => setFormSingleMessage(e.target.value)}
                      placeholder="Hi {first_name}, thank you for checking out our page! We noticed you..."
                      style={{ padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'inherit', fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  </label>
                )}

                {formMode === 'multiple_random' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <span style={{ fontWeight: 600 }}>Static Message Templates (System picks one randomly per customer)</span>
                    {formTemplates.map((t, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <textarea
                          rows={2}
                          required
                          value={t}
                          onChange={(e) => {
                            const clone = [...formTemplates];
                            clone[idx] = e.target.value;
                            setFormTemplates(clone);
                          }}
                          placeholder={`Message version ${idx + 1}`}
                          style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'inherit', fontFamily: 'inherit', resize: 'vertical' }}
                        />
                        {formTemplates.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => setFormTemplates(formTemplates.filter((_, i) => i !== idx))}
                            style={{ padding: '8px', color: 'var(--error)' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setFormTemplates([...formTemplates, ''])}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Plus size={14} /> Add Alternate Message Variant
                    </button>
                  </div>
                )}

                {formMode === 'ai_personalized' && (
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 600 }}>
                    AI Campaign Goal / Prompt Instruction (with full customer background knowledge)
                    <textarea
                      rows={4}
                      required
                      value={formAiGoal}
                      onChange={(e) => setFormAiGoal(e.target.value)}
                      placeholder="e.g. Pitch a special 10% coupon code off product X since they were asking about pricing, and ask if they need help checking out."
                      style={{ padding: '10px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'inherit', fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Pacing & Delay Config */}
            <div>
              <h3 style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}><Sliders size={18} /> Safe Delivery Pacing</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'center' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 600 }}>
                  Baseline Delay (seconds)
                  <input
                    type="number"
                    min={5}
                    required
                    value={formDelay}
                    onChange={(e) => setFormDelay(parseInt(e.target.value))}
                    style={{ padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'inherit' }}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600, marginTop: '24px' }}>
                  <input
                    type="checkbox"
                    checked={formRandomizeDelay}
                    onChange={(e) => setFormRandomizeDelay(e.target.checked)}
                  />
                  Add Human Jitter (-10s to +15s offset)
                </label>
              </div>
            </div>

            <button type="submit" disabled={creatingCampaign} className="btn btn-primary" style={{ width: '100%', padding: '12px', marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Send size={16} /> {creatingCampaign ? 'Creating Campaign...' : 'Create Campaign'}
            </button>
          </form>
        </>
      )}

      {/* Tab: VIEW WORKSPACE */}
      {activeTab === 'view' && campaign && (
        <>
          <div className="page-header" style={{ marginBottom: '24px' }}>
            <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', marginBottom: '16px' }} onClick={() => { setActiveTab('list'); loadCampaigns(); }}>
              <ArrowLeft size={16} /> Back to Campaigns
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h1>{campaign.name}</h1>
                  <span className={`status-badge ${campaign.status}`} style={{ fontSize: '13px' }}>
                    {campaign.status.toUpperCase()}
                  </span>
                </div>
                <p style={{ color: 'var(--text-secondary)' }}>Connected Channel: Page ID <strong>{campaign.page_id}</strong> | Mode: <strong>{campaign.mode.toUpperCase()}</strong></p>
              </div>
              
              {/* Campaign Control Buttons */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {campaign.status === 'sending' && (
                  <button className="btn" style={{ background: '#f5a623', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => handleStatusChange('paused')}>
                    <Pause size={14} /> Pause Campaign
                  </button>
                )}
                {campaign.status === 'paused' && (
                  <button className="btn" style={{ background: '#00c48c', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => handleStatusChange('sending')}>
                    <Play size={14} /> Resume Campaign
                  </button>
                )}
                {(campaign.status === 'sending' || campaign.status === 'paused') && (
                  <button className="btn" style={{ background: 'var(--error)', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={() => handleStatusChange('stopped')}>
                    <Square size={14} /> Stop Campaign
                  </button>
                )}
                <button className="btn btn-secondary" style={{ padding: '8px' }} onClick={() => loadCampaignDetails(campaign.id)} disabled={loadingDetails}>
                  <RefreshCw size={16} className={loadingDetails ? 'spin' : ''} />
                </button>
              </div>
            </div>
          </div>

          {loadingDetails ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Loading Campaign Details...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Stats & Progress Row */}
              <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Target Audience</span>
                  <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{matchingContactsCount}</span>
                </div>
                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Pending Review</span>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#f5a623' }}>{stats?.pending_review || 0}</span>
                </div>
                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>In Paced Queue</span>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{stats?.queued || 0}</span>
                </div>
                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Sent successfully</span>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#00c48c' }}>{stats?.sent || 0}</span>
                </div>
                <div className="card" style={{ padding: '16px', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Sending Errors</span>
                  <span style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--error)' }}>{stats?.failed || 0}</span>
                </div>
              </div>

              {/* Progress and Timer Projection */}
              {campaign.status === 'sending' && (
                <div className="card" style={{ display: 'flex', gap: '20px', alignItems: 'center', background: 'rgba(0, 196, 140, 0.05)', borderColor: 'rgba(0, 196, 140, 0.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0, 196, 140, 0.1)', borderRadius: '50%', width: '40px', height: '40px', color: '#00c48c' }}>
                    <Clock size={20} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, color: '#00c48c' }}>Active Delivery Progress</h4>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      Estimated completion: <strong>{calculateTimeEstimate()}</strong> (Delays configured at {campaign.delay_seconds}s)
                    </span>
                  </div>
                </div>
              )}

              {/* Generation Trigger Area */}
              {pendingMessages.length === 0 && (stats?.queued || 0) === 0 && campaign.status !== 'stopped' && (
                <div className="card" style={{ textAlign: 'center', padding: '48px 24px', border: '1.5px dashed var(--border-light)' }}>
                  <Users size={32} style={{ color: 'var(--text-secondary)', marginBottom: '12px', opacity: 0.7 }} />
                  {unsentContactsCount > 0 ? (
                    <>
                      <h3>Generate Review Batch</h3>
                      <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 20px' }}>
                        You have <strong>{unsentContactsCount}</strong> remaining target contacts. Generate the next batch of 50 customized messages.
                      </p>
                      <button className="btn btn-primary" onClick={handleGenerateBatch} disabled={generatingBatch}>
                        <RefreshCw size={14} style={{ marginRight: '6px' }} className={generatingBatch ? 'spin' : ''} />
                        {generatingBatch ? 'AI Generating Messages...' : 'Generate Next Batch of 50'}
                      </button>
                    </>
                  ) : (
                    <>
                      <h3>Campaign Audience Exhausted</h3>
                      <p style={{ color: 'var(--text-secondary)' }}>All matching contacts have been successfully queued or sent.</p>
                    </>
                  )}
                </div>
              )}

              {/* Batch Review Console */}
              {pendingMessages.length > 0 && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle style={{ color: '#f5a623' }} size={20} /> Batch Review Console ({pendingMessages.length} Messages Pending Approval)
                    </h3>
                    <button className="btn btn-primary" style={{ background: '#00c48c', borderColor: '#00c48c' }} onClick={handleApproveBatch} disabled={approvingBatch}>
                      {approvingBatch ? 'Scheduling...' : `Approve & Start Sending ${pendingMessages.length} Messages`}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {pendingMessages.map((msg) => (
                      <div key={msg.id} className="card" style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', padding: '16px' }}>
                        <div style={{ background: 'var(--bg-secondary)', padding: '10px', borderRadius: '8px', minWidth: '140px', fontSize: '13px' }}>
                          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{msg.customer_name}</div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>ID: {msg.sender_id}</div>
                        </div>

                        <div style={{ flex: 1, display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
                          <textarea
                            rows={2}
                            value={msg.message_content}
                            onChange={(e) => {
                              // Optimistic local state update to keep UI fast
                              setPendingMessages(prev =>
                                prev.map(m => m.id === msg.id ? { ...m, message_content: e.target.value } : m)
                              );
                            }}
                            onBlur={(e) => handleEditMessage(msg.id, e.target.value)}
                            style={{ flex: 1, padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'inherit', fontFamily: 'inherit', resize: 'vertical' }}
                          />

                          <button className="btn btn-secondary" style={{ padding: '8px', color: 'var(--error)' }} onClick={() => handleDiscardMessage(msg.id)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
      {selectedCampaignId && <span style={{ display: 'none' }}>{selectedCampaignId}</span>}
    </div>
  );
}
