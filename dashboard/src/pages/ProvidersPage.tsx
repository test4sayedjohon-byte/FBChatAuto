import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { PROVIDER_PRESETS } from '../lib/providers';
import { Plus, Trash2, Cpu, X, Save, Loader2, Check, Edit2, Copy } from 'lucide-react';

interface Provider {
  id: string;
  provider_name: string;
  display_name: string;
  base_url: string;
  api_key: string;
  model_chat: string | null;
  model_embedding: string | null;
  is_active_chat: boolean;
  is_active_embedding: boolean;
  is_active_summarization: boolean;
  fallback_order?: number;
  max_tokens: number;
  temperature: number;
  context_window: number;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OAI', openrouter: 'OR', gemini: 'GEM', groq: 'GRQ',
  together: 'TGR', deepseek: 'DS', mistral: 'MST', anthropic: 'ANT', custom: 'CST',
};

import { useAuth } from '../hooks/useAuth';

export default function ProvidersPage() {
  const { profile } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

  const [providerName, setProviderName] = useState('openai');
  const [displayName, setDisplayName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelChat, setModelChat] = useState('');
  const [modelEmbed, setModelEmbed] = useState('');
  const [maxTokens, setMaxTokens] = useState(1024);
  const [temperature, setTemperature] = useState(0.7);
  const [contextWindow, setContextWindow] = useState(10);

  useEffect(() => { 
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from('ai_providers')
      .select('*')
      .order('is_active_chat', { ascending: false })
      .order('fallback_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (data) setProviders(data);
    setLoading(false);
  }

  function openAdd() {
    setEditingProvider(null);
    const preset = PROVIDER_PRESETS['openai'];
    setProviderName('openai');
    setDisplayName('');
    setBaseUrl(preset.baseUrl);
    setApiKey('');
    setModelChat(preset.defaultChatModel);
    setModelEmbed(preset.defaultEmbeddingModel);
    setMaxTokens(1024);
    setTemperature(0.7);
    setContextWindow(10);
    setTestingStatus('idle');
    setTestMessage('');
    setShowModal(true);
  }

  function openEdit(p: Provider) {
    setEditingProvider(p);
    setProviderName(p.provider_name);
    setDisplayName(p.display_name);
    setBaseUrl(p.base_url);
    setApiKey(p.api_key);
    setModelChat(p.model_chat || '');
    setModelEmbed(p.model_embedding || '');
    setMaxTokens(p.max_tokens);
    setTemperature(p.temperature);
    setContextWindow(p.context_window);
    setTestingStatus('idle');
    setTestMessage('');
    setShowModal(true);
  }

  function onProviderChange(name: string) {
    setProviderName(name);
    const preset = PROVIDER_PRESETS[name];
    if (preset) {
      setBaseUrl(preset.baseUrl);
      setModelChat(preset.defaultChatModel);
      setModelEmbed(preset.defaultEmbeddingModel);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    
    const providerData = {
      provider_name: providerName,
      display_name: displayName || PROVIDER_PRESETS[providerName]?.label || providerName,
      base_url: baseUrl,
      api_key: apiKey,
      model_chat: modelChat || null,
      model_embedding: modelEmbed || null,
      max_tokens: maxTokens,
      temperature,
      context_window: contextWindow,
    };

    if (editingProvider) {
      await supabase.from('ai_providers')
        .update(providerData)
        .eq('id', editingProvider.id);
    } else {
      const isFirst = providers.length === 0;
      await supabase.from('ai_providers').insert({
        ...providerData,
        user_id: null,
        is_global: true,
        is_active_chat: isFirst,
        is_active_embedding: isFirst,
        is_active_summarization: isFirst,
      });
    }

    setSaving(false);
    setShowModal(false);
    setEditingProvider(null);
    load();
  }

  async function testConnection() {
    if (!baseUrl || !apiKey) {
      setTestingStatus('error');
      setTestMessage('Base URL and API Key are required to test.');
      return;
    }
    setTestingStatus('testing');
    try {
      // Clean up base URL to ensure no trailing slashes
      const url = baseUrl.replace(/\/+$/, '') + '/models';
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin, // For OpenRouter
          'X-Title': 'AutometaBot'
        }
      });
      if (response.ok) {
        setTestingStatus('success');
        setTestMessage('Connection successful!');
      } else {
        const err = await response.text();
        setTestingStatus('error');
        setTestMessage(`Failed: ${response.status} ${response.statusText} - ${err.substring(0, 100)}`);
      }
    } catch (e: any) {
      setTestingStatus('error');
      setTestMessage(`Error: ${e.message}`);
    }
  }

  async function setActive(id: string, type: 'chat' | 'embedding' | 'summarization') {
    const field = type === 'chat' ? 'is_active_chat' : type === 'embedding' ? 'is_active_embedding' : 'is_active_summarization';
    // Deactivate all first
    await supabase.from('ai_providers').update({ [field]: false }).neq('id', '00000000-0000-0000-0000-000000000000');
    // Activate selected
    const updates: any = { [field]: true };
    if (type === 'chat') {
      updates.fallback_order = 0; // If primary, it is not in the fallback list
    }
    await supabase.from('ai_providers').update(updates).eq('id', id);
    load();
  }

  async function updateFallbackOrder(id: string, order: number) {
    const updates: any = { fallback_order: order };
    if (order > 0) {
      updates.is_active_chat = false; // Cannot be primary and fallback at the same time
    }
    await supabase.from('ai_providers').update(updates).eq('id', id);
    load();
  }

  async function duplicate(p: Provider) {
    await supabase.from('ai_providers').insert({
      user_id: null,
      is_global: true,
      provider_name: p.provider_name,
      display_name: `${p.display_name} (Copy)`,
      base_url: p.base_url,
      api_key: p.api_key,
      model_chat: p.model_chat,
      model_embedding: p.model_embedding,
      is_active_chat: false,
      is_active_embedding: false,
      is_active_summarization: false,
      fallback_order: p.fallback_order || 0,
      max_tokens: p.max_tokens,
      temperature: p.temperature,
      context_window: p.context_window,
    });
    load();
  }

  async function del(id: string) {
    if (!confirm('Delete this AI provider?')) return;
    await supabase.from('ai_providers').delete().eq('id', id);
    load();
  }

  if (profile && !profile.is_super_admin) {
    return (
      <div className="card" style={{padding:'48px',textAlign:'center',color:'var(--text-secondary)'}}>
        <h3>Access Denied</h3>
        <p>You must be a super admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="animate-slideUp">
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <h1>AI Providers</h1>
          <p>Configure AI models from different providers. You can mix providers for chat and embeddings.</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Add Provider</button>
      </div>

      {loading ? <div className="card" style={{padding:'48px',textAlign:'center',color:'var(--text-secondary)'}}>Loading...</div>
      : providers.length === 0 ? (
        <div className="card"><div className="empty-state">
          <Cpu className="empty-state-icon" />
          <h3>No AI Providers</h3>
          <p>Add at least one AI provider to enable chatbot responses. Supports OpenAI, OpenRouter, Gemini, Groq, and more.</p>
          <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Add Provider</button>
        </div></div>
      ) : providers.map((p) => (
        <div key={p.id} className="list-item">
          <div className={`provider-icon provider-${p.provider_name}`}>
            {PROVIDER_LABELS[p.provider_name] || 'AI'}
          </div>
          <div className="list-item-content">
            <div className="list-item-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span>{p.display_name}</span>
              {p.is_active_chat && (
                <span style={{ fontSize: '10px', background: 'rgba(249, 115, 22, 0.15)', color: 'var(--accent-primary)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                  Primary Chat
                </span>
              )}
              {p.is_active_embedding && (
                <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                  Active Embed
                </span>
              )}
              {p.is_active_summarization && (
                <span style={{ fontSize: '10px', background: 'rgba(34, 197, 94, 0.15)', color: '#4ade80', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                  Active Summarize
                </span>
              )}
              {p.fallback_order && p.fallback_order > 0 ? (
                <span style={{ fontSize: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                  Backup #{p.fallback_order}
                </span>
              ) : null}
            </div>
            <div className="list-item-subtitle">
              Chat: {p.model_chat || '—'} • Embed: {p.model_embedding || '—'} • Temp: {p.temperature} • Context: {p.context_window} msgs
            </div>
          </div>
          <div className="list-item-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className={`btn btn-sm ${p.is_active_chat ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActive(p.id, 'chat')}
              title="Set as active chat provider"
            >
              {p.is_active_chat && <Check size={12}/>} Chat
            </button>
            <button
              className={`btn btn-sm ${p.is_active_embedding ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActive(p.id, 'embedding')}
              title="Set as active embedding provider"
              disabled={!p.model_embedding}
            >
              {p.is_active_embedding && <Check size={12}/>} Embed
            </button>
            <button
              className={`btn btn-sm ${p.is_active_summarization ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setActive(p.id, 'summarization')}
              title="Set as active summarization provider"
            >
              {p.is_active_summarization && <Check size={12}/>} Summarize
            </button>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '9px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fallback Role</span>
              <select
                className="form-select form-select-sm"
                style={{ width: '120px', padding: '2px 4px', fontSize: '11px', height: '24px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)', borderRadius: '4px' }}
                value={p.fallback_order || 0}
                onChange={(e) => updateFallbackOrder(p.id, Number(e.target.value))}
                title="Choose when this provider is used if other models fail"
              >
                <option value="0">No Backup</option>
                <option value="1">1st Backup</option>
                <option value="2">2nd Backup</option>
                <option value="3">3rd Backup</option>
                <option value="4">4th Backup</option>
                <option value="5">5th Backup</option>
              </select>
            </div>

            <button className="btn-ghost btn-icon" onClick={() => duplicate(p)} title="Duplicate AI provider"><Copy size={14}/></button>
            <button className="btn-ghost btn-icon" onClick={() => openEdit(p)} title="Edit AI provider"><Edit2 size={14}/></button>
            <button className="btn-ghost btn-icon" onClick={() => del(p.id)}><Trash2 size={14}/></button>
          </div>
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{maxWidth:'560px'}}>
            <div className="modal-header"><h2>{editingProvider ? 'Edit AI Provider' : 'Add AI Provider'}</h2><button className="btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18}/></button></div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Provider</label>
                  <select className="form-select" value={providerName} onChange={e=>onProviderChange(e.target.value)}>
                    {Object.entries(PROVIDER_PRESETS).map(([key, p]) => (
                      <option key={key} value={key}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input className="form-input" placeholder={PROVIDER_PRESETS[providerName]?.label} value={displayName} onChange={e=>setDisplayName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">API Key</label>
                  <input className="form-input" type="password" placeholder={PROVIDER_PRESETS[providerName]?.placeholder || 'API Key'} value={apiKey} onChange={e=>setApiKey(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Base URL</label>
                  <input className="form-input" value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} required />
                  <p className="form-hint">OpenAI-compatible API endpoint</p>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Chat Model</label>
                    <input className="form-input" placeholder="e.g., gpt-4o-mini" value={modelChat} onChange={e=>setModelChat(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Embedding Model</label>
                    <input className="form-input" placeholder="e.g., text-embedding-3-small" value={modelEmbed} onChange={e=>setModelEmbed(e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Max Tokens</label>
                    <input className="form-input" type="number" value={maxTokens} onChange={e=>setMaxTokens(Number(e.target.value))} min={1} max={8192} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Temperature</label>
                    <input className="form-input" type="number" value={temperature} onChange={e=>setTemperature(Number(e.target.value))} min={0} max={2} step={0.1} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Context Window (messages)</label>
                  <input className="form-input" type="number" value={contextWindow} onChange={e=>setContextWindow(Number(e.target.value))} min={1} max={50} />
                  <p className="form-hint">Number of recent chat messages to include as context</p>
                </div>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  {testingStatus !== 'idle' && (
                    <span style={{ fontSize: '13px', color: testingStatus === 'success' ? 'var(--success)' : testingStatus === 'error' ? 'var(--danger)' : 'var(--text-secondary)' }}>
                      {testMessage}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary" onClick={testConnection} disabled={testingStatus === 'testing' || !baseUrl || !apiKey}>
                    {testingStatus === 'testing' ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <Check size={14}/>}
                    Test
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <Save size={14}/>}
                    {saving ? 'Saving...' : editingProvider ? 'Save Changes' : 'Add Provider'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
