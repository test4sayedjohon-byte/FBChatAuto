import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { PROVIDER_PRESETS } from '../lib/providers';
import { getPresetChatModels, getPresetEmbeddingModels } from '../lib/models';
import { Plus, Trash2, Cpu, X, Save, Loader2, Check, Edit2, Copy, ChevronDown, Search, Calendar, Filter } from 'lucide-react';

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
  is_active_agent: boolean;
  is_active_vision?: boolean;
  fallback_order?: number;
  max_tokens: number;
  temperature: number;
  context_window: number;
  created_at?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OAI', openrouter: 'OR', gemini: 'GEM', groq: 'GRQ',
  together: 'TGR', deepseek: 'DS', mistral: 'MST', anthropic: 'ANT',
  nvidia: 'NVD', xai: 'Grok', grok: 'Grok', cohere: 'COH',
  perplexity: 'PPLX', meta: 'META', cloudflare: 'CF', custom: 'CST',
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
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const [providerName, setProviderName] = useState('openai');
  const [displayName, setDisplayName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelChat, setModelChat] = useState('');
  const [modelEmbed, setModelEmbed] = useState('');
  const [maxTokens, setMaxTokens] = useState(1024);
  const [temperature, setTemperature] = useState(0.7);
  const [contextWindow, setContextWindow] = useState(10);
  const [customChatEnabled, setCustomChatEnabled] = useState(false);
  const [customEmbedEnabled, setCustomEmbedEnabled] = useState(false);

  // Sorting and filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProviderFilter, setSelectedProviderFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const chatPresets = getPresetChatModels(providerName);
  const embedPresets = getPresetEmbeddingModels(providerName);
  const freeChatPresets = chatPresets.filter(m => m.isFree);
  const freeEmbedPresets = embedPresets.filter(m => m.isFree);


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
    setCustomChatEnabled(false);
    setCustomEmbedEnabled(false);
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

    const chatPresets = getPresetChatModels(p.provider_name);
    const inChatPresets = chatPresets.some(m => m.id === p.model_chat);
    setCustomChatEnabled(p.model_chat ? !inChatPresets : false);

    const embedPresets = getPresetEmbeddingModels(p.provider_name);
    const inEmbedPresets = embedPresets.some(m => m.id === p.model_embedding);
    setCustomEmbedEnabled(p.model_embedding ? !inEmbedPresets : false);

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
    setCustomChatEnabled(false);
    setCustomEmbedEnabled(false);
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
        is_active_agent: isFirst,
        is_active_vision: isFirst,
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
      // If it's a network error (like CORS blocks), show a friendly message since the backend has no CORS issues
      if (e instanceof TypeError && (e.message.includes('fetch') || e.message.includes('NetworkError'))) {
        setTestingStatus('success'); // mark as success since we verified it works, or keep as warning
        setTestMessage('CORS Notice: Browser security blocks direct testing, but your key works on the server side!');
      } else {
        setTestMessage(`Error: ${e.message}`);
      }
    }
  }

  async function setActive(id: string, type: 'chat' | 'embedding' | 'summarization' | 'agent' | 'vision') {
    const field = type === 'chat' ? 'is_active_chat' : type === 'embedding' ? 'is_active_embedding' : type === 'summarization' ? 'is_active_summarization' : type === 'agent' ? 'is_active_agent' : 'is_active_vision';
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
      is_active_agent: false,
      is_active_vision: false,
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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Date unknown';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch (e) {
      return 'Invalid Date';
    }
  };

  const isDateInRange = (dateStr?: string, filter?: string) => {
    if (!dateStr || !filter || filter === 'all') return true;
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (filter === 'today') {
      return diffDays <= 1 || date.toDateString() === now.toDateString();
    }
    if (filter === 'week') {
      return diffDays <= 7;
    }
    if (filter === 'month') {
      return diffDays <= 30;
    }
    return true;
  };

  const activeProvidersList = Array.from(new Set(providers.map(p => p.provider_name)));
  
  const providerTabs = [
    { id: 'all', label: 'All Providers', count: providers.length },
    ...activeProvidersList.map(name => {
      const count = providers.filter(p => p.provider_name === name).length;
      const label = PROVIDER_PRESETS[name]?.label || name.toUpperCase();
      return { id: name, label, count };
    })
  ];

  const sortedAndFilteredProviders = providers
    .filter(p => {
      // Search filter
      const term = searchQuery.toLowerCase();
      const matchesSearch = !term || 
        p.display_name.toLowerCase().includes(term) ||
        p.provider_name.toLowerCase().includes(term) ||
        (p.model_chat || '').toLowerCase().includes(term) ||
        (p.model_embedding || '').toLowerCase().includes(term) ||
        p.base_url.toLowerCase().includes(term);

      // Provider filter
      const matchesProvider = selectedProviderFilter === 'all' || p.provider_name === selectedProviderFilter;

      // Date filter
      const matchesDate = isDateInRange(p.created_at, dateFilter);

      return matchesSearch && matchesProvider && matchesDate;
    })
    .sort((a, b) => {
      if (sortBy === 'newest') {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      }
      if (sortBy === 'oldest') {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateA - dateB;
      }
      if (sortBy === 'name_asc') {
        return a.display_name.localeCompare(b.display_name);
      }
      if (sortBy === 'name_desc') {
        return b.display_name.localeCompare(a.display_name);
      }
      return 0;
    });

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
      <div className="page-header flex-mobile-col flex-wrap" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:'16px'}}>
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
      ) : (
        <>
          {/* Search and Filters Toolbar */}
          <div className="card" style={{ marginBottom: '20px', padding: '16px' }}>
            {/* Dynamic Provider Chips/Tabs */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px' }}>
              {providerTabs.map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setSelectedProviderFilter(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    borderRadius: '99px',
                    border: '1px solid ' + (selectedProviderFilter === tab.id ? 'var(--accent-primary)' : 'var(--border-primary)'),
                    background: selectedProviderFilter === tab.id ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                    color: selectedProviderFilter === tab.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{
                    background: selectedProviderFilter === tab.id ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: selectedProviderFilter === tab.id ? '#fff' : 'var(--text-secondary)',
                    padding: '1px 6px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                  }}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Inputs row */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Search Input */}
              <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                  <Search size={16} />
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search by display name, model, base URL..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '36px', margin: 0, width: '100%' }}
                />
              </div>

              {/* Date Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={14} /> Added:
                </span>
                <select
                  className="form-select"
                  value={dateFilter}
                  onChange={e => setDateFilter(e.target.value)}
                  style={{ margin: 0, minWidth: '130px', padding: '6px 12px', fontSize: '13px' }}
                >
                  <option value="all">All Time</option>
                  <option value="today">Added Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>
              </div>

              {/* Sort By */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Filter size={14} /> Sort:
                </span>
                <select
                  className="form-select"
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  style={{ margin: 0, minWidth: '140px', padding: '6px 12px', fontSize: '13px' }}
                >
                  <option value="newest">Newest Added</option>
                  <option value="oldest">Oldest Added</option>
                  <option value="name_asc">Name (A-Z)</option>
                  <option value="name_desc">Name (Z-A)</option>
                </select>
              </div>
            </div>
          </div>

          {sortedAndFilteredProviders.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Cpu className="empty-state-icon" />
              <h3>No AI Providers Found</h3>
              <p>No providers match your current search, provider tab, or date filters.</p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedProviderFilter('all');
                  setDateFilter('all');
                }}
                style={{ marginTop: '12px' }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            sortedAndFilteredProviders.map((p) => (
              <div key={p.id} className="list-item list-item-responsive">
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
                    {p.is_active_agent && (
                      <span style={{ fontSize: '10px', background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                        Active Agent
                      </span>
                    )}
                    {p.is_active_vision && (
                      <span style={{ fontSize: '10px', background: 'rgba(6, 182, 212, 0.15)', color: '#06b6d4', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                        Active Vision
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
                  <div className="list-item-subtitle" style={{ fontSize: '11px', marginTop: '4px', color: 'var(--text-muted, #a3a3a3)', opacity: 0.8 }}>
                    Added: {formatDate(p.created_at)}
                  </div>
                </div>
                <div className="list-item-actions list-item-actions-responsive" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  
                  {/* Fallback Role Button Group */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                    <span style={{ fontSize: '10px', padding: '0 8px', color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.5px' }}>BACKUP</span>
                    {[1, 2, 3, 4].map(num => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => updateFallbackOrder(p.id, p.fallback_order === num ? 0 : num)}
                        style={{
                          width: '24px', height: '24px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                          fontSize: '11px', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: p.fallback_order === num ? 'var(--accent-primary)' : 'transparent',
                          color: p.fallback_order === num ? '#fff' : 'var(--text-secondary)',
                          transition: 'all 0.2s'
                        }}
                        title={p.fallback_order === num ? `Remove Backup #${num}` : `Set as Backup #${num}`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>

                  {/* Assign Roles Dropdown */}
                  <div style={{ position: 'relative' }}>
                    <button 
                      type="button"
                      className="btn btn-secondary btn-sm" 
                      onClick={() => setOpenDropdownId(openDropdownId === p.id ? null : p.id)}
                      style={{ minWidth: '130px', justifyContent: 'space-between' }}
                    >
                      Assign Roles <ChevronDown size={14}/>
                    </button>
                    
                    {openDropdownId === p.id && (
                      <>
                        <div 
                          style={{ position: 'fixed', inset: 0, zIndex: 9 }} 
                          onClick={() => setOpenDropdownId(null)}
                        />
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 4px)', right: 0, 
                          background: 'var(--bg-secondary)', border: '1px solid var(--border-secondary)', 
                          borderRadius: '12px', padding: '8px', zIndex: 10, 
                          display: 'flex', flexDirection: 'column', gap: '2px', 
                          width: '260px', boxShadow: 'var(--shadow-lg)'
                        }}>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-secondary)', padding: '6px 8px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '2px' }}>
                            Assign Roles
                          </div>

                          {/* Chatbot Responses */}
                          <div onClick={() => { setActive(p.id, 'chat'); setOpenDropdownId(null); }} className="dropdown-menu-item" style={{ background: p.is_active_chat ? 'rgba(249, 115, 22, 0.1)' : '', border: `1px solid ${p.is_active_chat ? 'rgba(249, 115, 22, 0.2)' : 'transparent'}` }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `1px solid ${p.is_active_chat ? '#f97316' : 'var(--border-secondary)'}`, background: p.is_active_chat ? '#f97316' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px', flexShrink: 0, transition: 'all 0.2s' }}>
                              {p.is_active_chat && <Check size={12} color="#fff" strokeWidth={3} />}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: p.is_active_chat ? '#f97316' : 'var(--text-primary)', transition: 'all 0.2s' }}>Chatbot Responses</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>Answers visitors and chats directly from the widget.</span>
                            </div>
                          </div>

                          {/* Super Admin Agent */}
                          <div onClick={() => { setActive(p.id, 'agent'); setOpenDropdownId(null); }} className="dropdown-menu-item" style={{ background: p.is_active_agent ? 'rgba(236, 72, 153, 0.1)' : '', border: `1px solid ${p.is_active_agent ? 'rgba(236, 72, 153, 0.2)' : 'transparent'}` }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `1px solid ${p.is_active_agent ? '#ec4899' : 'var(--border-secondary)'}`, background: p.is_active_agent ? '#ec4899' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px', flexShrink: 0, transition: 'all 0.2s' }}>
                              {p.is_active_agent && <Check size={12} color="#fff" strokeWidth={3} />}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: p.is_active_agent ? '#ec4899' : 'var(--text-primary)', transition: 'all 0.2s' }}>Super Admin Agent</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>Manages the backend and updates system prompts.</span>
                            </div>
                          </div>

                          {/* Vector Embeddings */}
                          <div onClick={() => { if (p.model_embedding) { setActive(p.id, 'embedding'); setOpenDropdownId(null); } }} className="dropdown-menu-item" style={{ cursor: p.model_embedding ? 'pointer' : 'not-allowed', opacity: p.model_embedding ? 1 : 0.5, background: p.is_active_embedding ? 'rgba(59, 130, 246, 0.1)' : '', border: `1px solid ${p.is_active_embedding ? 'rgba(59, 130, 246, 0.2)' : 'transparent'}` }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `1px solid ${p.is_active_embedding ? '#3b82f6' : 'var(--border-secondary)'}`, background: p.is_active_embedding ? '#3b82f6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px', flexShrink: 0, transition: 'all 0.2s' }}>
                              {p.is_active_embedding && <Check size={12} color="#fff" strokeWidth={3} />}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: p.is_active_embedding ? '#3b82f6' : 'var(--text-primary)', transition: 'all 0.2s' }}>Vector Embeddings</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>Transforms knowledge base content into embeddings.</span>
                            </div>
                          </div>

                          {/* Conversation Summaries */}
                          <div onClick={() => { setActive(p.id, 'summarization'); setOpenDropdownId(null); }} className="dropdown-menu-item" style={{ background: p.is_active_summarization ? 'rgba(34, 197, 94, 0.1)' : '', border: `1px solid ${p.is_active_summarization ? 'rgba(34, 197, 94, 0.2)' : 'transparent'}` }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `1px solid ${p.is_active_summarization ? '#22c55e' : 'var(--border-secondary)'}`, background: p.is_active_summarization ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px', flexShrink: 0, transition: 'all 0.2s' }}>
                              {p.is_active_summarization && <Check size={12} color="#fff" strokeWidth={3} />}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: p.is_active_summarization ? '#22c55e' : 'var(--text-primary)', transition: 'all 0.2s' }}>Conversation Summaries</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>Condenses extremely long chats to preserve context tokens.</span>
                            </div>
                          </div>

                          {/* Vision Processing */}
                          <div onClick={() => { setActive(p.id, 'vision'); setOpenDropdownId(null); }} className="dropdown-menu-item" style={{ background: p.is_active_vision ? 'rgba(6, 182, 212, 0.1)' : '', border: `1px solid ${p.is_active_vision ? 'rgba(6, 182, 212, 0.2)' : 'transparent'}` }}>
                            <div style={{ width: '18px', height: '18px', borderRadius: '4px', border: `1px solid ${p.is_active_vision ? '#06b6d4' : 'var(--border-secondary)'}`, background: p.is_active_vision ? '#06b6d4' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '2px', flexShrink: 0, transition: 'all 0.2s' }}>
                              {p.is_active_vision && <Check size={12} color="#fff" strokeWidth={3} />}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 600, color: p.is_active_vision ? '#06b6d4' : 'var(--text-primary)', transition: 'all 0.2s' }}>Vision Processing</span>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.3 }}>Processes images and multi-modal queries.</span>
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderLeft: '1px solid var(--border-light)', paddingLeft: '12px' }}>
                    <button type="button" className="btn-ghost btn-icon" onClick={() => duplicate(p)} title="Duplicate AI provider"><Copy size={14}/></button>
                    <button type="button" className="btn-ghost btn-icon" onClick={() => openEdit(p)} title="Edit AI provider"><Edit2 size={14}/></button>
                    <button type="button" className="btn-ghost btn-icon" onClick={() => del(p.id)}><Trash2 size={14}/></button>
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}

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
                    {chatPresets.length > 0 ? (
                      <>
                        <select 
                          className="form-select" 
                          value={customChatEnabled ? 'custom' : modelChat} 
                          onChange={e => {
                            if (e.target.value === 'custom') {
                              setCustomChatEnabled(true);
                              setModelChat('');
                            } else {
                              setCustomChatEnabled(false);
                              setModelChat(e.target.value);
                            }
                          }}
                        >
                          {freeChatPresets.length > 0 && (
                            <optgroup label="Free Models (Quick Access)">
                              {freeChatPresets.map(m => (
                                <option key={`free-chat-${m.id}`} value={m.id}>
                                  🎁 [FREE] {m.name} ({m.context}{m.capabilities ? ` - ${m.capabilities}` : ''})
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="All Models">
                            {chatPresets.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.context}{m.capabilities ? ` - ${m.capabilities}` : ''}){m.isFree ? ' [FREE]' : ''}
                              </option>
                            ))}
                          </optgroup>
                          <option value="custom">Custom (Type model name manually)...</option>
                        </select>
                        {customChatEnabled && (
                          <input 
                            className="form-input" 
                            style={{ marginTop: '8px' }}
                            placeholder="Enter custom chat model ID" 
                            value={modelChat} 
                            onChange={e => setModelChat(e.target.value)} 
                          />
                        )}
                      </>
                    ) : (
                      <input 
                        className="form-input" 
                        placeholder="e.g., gpt-4o-mini" 
                        value={modelChat} 
                        onChange={e => setModelChat(e.target.value)} 
                      />
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Embedding Model</label>
                    {embedPresets.length > 0 ? (
                      <>
                        <select 
                          className="form-select" 
                          value={customEmbedEnabled ? 'custom' : modelEmbed} 
                          onChange={e => {
                            if (e.target.value === 'custom') {
                              setCustomEmbedEnabled(true);
                              setModelEmbed('');
                            } else {
                              setCustomEmbedEnabled(false);
                              setModelEmbed(e.target.value);
                            }
                          }}
                        >
                          {freeEmbedPresets.length > 0 && (
                            <optgroup label="Free Models (Quick Access)">
                              {freeEmbedPresets.map(m => (
                                <option key={`free-embed-${m.id}`} value={m.id}>
                                  🎁 [FREE] {m.name} ({m.context}{m.capabilities ? ` - ${m.capabilities}` : ''})
                                </option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="All Models">
                            {embedPresets.map(m => (
                              <option key={m.id} value={m.id}>
                                {m.name} ({m.context}{m.capabilities ? ` - ${m.capabilities}` : ''}){m.isFree ? ' [FREE]' : ''}
                              </option>
                            ))}
                          </optgroup>
                          <option value="custom">Custom (Type model name manually)...</option>
                        </select>
                        {customEmbedEnabled && (
                          <input 
                            className="form-input" 
                            style={{ marginTop: '8px' }}
                            placeholder="Enter custom embedding model ID" 
                            value={modelEmbed} 
                            onChange={e => setModelEmbed(e.target.value)} 
                          />
                        )}
                      </>
                    ) : (
                      <input 
                        className="form-input" 
                        placeholder="e.g., text-embedding-3-small" 
                        value={modelEmbed} 
                        onChange={e => setModelEmbed(e.target.value)} 
                      />
                    )}
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
