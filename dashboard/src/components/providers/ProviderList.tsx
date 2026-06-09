import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { PROVIDER_PRESETS } from '../../lib/providers';
import { Trash2, Cpu, Copy, Edit2, Search, Calendar, Filter } from 'lucide-react';

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
  fallback_chat_order?: number | null;
  fallback_agent_order?: number | null;
  fallback_summarize_order?: number | null;
  fallback_vision_order?: number | null;
  fallback_embedding_order?: number | null;
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

interface ProviderListProps {
  providers: Provider[];
  onEdit: (provider: Provider) => void;
  onRefresh: () => void;
}

export default function ProviderList({ providers, onEdit, onRefresh }: ProviderListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProviderFilter, setSelectedProviderFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

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
      max_tokens: p.max_tokens,
      temperature: p.temperature,
      context_window: p.context_window,
    });
    onRefresh();
  }

  async function del(id: string) {
    if (!confirm('Delete this AI provider?')) return;
    await supabase.from('ai_providers').delete().eq('id', id);
    onRefresh();
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
      const term = searchQuery.toLowerCase();
      const matchesSearch = !term || 
        p.display_name.toLowerCase().includes(term) ||
        p.provider_name.toLowerCase().includes(term) ||
        (p.model_chat || '').toLowerCase().includes(term) ||
        (p.model_embedding || '').toLowerCase().includes(term) ||
        p.base_url.toLowerCase().includes(term);

      const matchesProvider = selectedProviderFilter === 'all' || p.provider_name === selectedProviderFilter;
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

  return (
    <div>
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
        </div>
      ) : (
        sortedAndFilteredProviders.map((p) => (
          <div key={p.id} className="list-item list-item-responsive" style={{ padding: '16px' }}>
            <div className={`provider-icon provider-${p.provider_name}`}>
              {PROVIDER_LABELS[p.provider_name] || 'AI'}
            </div>
            <div className="list-item-content">
              <div className="list-item-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, fontSize: '15px' }}>{p.display_name}</span>
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

                {/* Backups List */}
                {p.fallback_chat_order && p.fallback_chat_order > 0 ? (
                  <span style={{ fontSize: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    Backup Chat #{p.fallback_chat_order}
                  </span>
                ) : null}
                {p.fallback_agent_order && p.fallback_agent_order > 0 ? (
                  <span style={{ fontSize: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    Backup Agent #{p.fallback_agent_order}
                  </span>
                ) : null}
                {p.fallback_summarize_order && p.fallback_summarize_order > 0 ? (
                  <span style={{ fontSize: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    Backup Summarize #{p.fallback_summarize_order}
                  </span>
                ) : null}
                {p.fallback_vision_order && p.fallback_vision_order > 0 ? (
                  <span style={{ fontSize: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    Backup Vision #{p.fallback_vision_order}
                  </span>
                ) : null}
                {p.fallback_embedding_order && p.fallback_embedding_order > 0 ? (
                  <span style={{ fontSize: '10px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                    Backup Embed #{p.fallback_embedding_order}
                  </span>
                ) : null}
              </div>
              <div className="list-item-subtitle" style={{ fontSize: '13px', marginTop: '4px' }}>
                Chat: <code style={{ color: 'var(--accent-primary)', background: 'rgba(249, 115, 22, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>{p.model_chat || '—'}</code> • Embed: <code style={{ color: '#60a5fa', background: 'rgba(59, 130, 246, 0.05)', padding: '2px 6px', borderRadius: '4px' }}>{p.model_embedding || '—'}</code>
              </div>
              <div className="list-item-subtitle" style={{ fontSize: '11px', marginTop: '6px', color: 'var(--text-muted, #a3a3a3)', opacity: 0.8 }}>
                Base URL: <code>{p.base_url}</code> • Added: {formatDate(p.created_at)}
              </div>
            </div>
            <div className="list-item-actions" style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn-ghost btn-icon" onClick={() => duplicate(p)} title="Duplicate AI provider"><Copy size={16}/></button>
              <button type="button" className="btn-ghost btn-icon" onClick={() => onEdit(p)} title="Edit AI provider"><Edit2 size={16}/></button>
              <button type="button" className="btn-ghost btn-icon" onClick={() => del(p.id)} title="Delete AI provider" style={{ color: '#f87171' }}><Trash2 size={16}/></button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
