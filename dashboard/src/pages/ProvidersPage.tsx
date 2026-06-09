import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Cpu, Settings, Key } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

// Components
import ProviderList from '../components/providers/ProviderList';
import FailoverMatrix from '../components/providers/FailoverMatrix';
import ProviderModal from '../components/providers/ProviderModal';

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

export default function ProvidersPage() {
  const { profile } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'credentials' | 'routing'>('credentials');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);

  useEffect(() => { 
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('ai_providers')
      .select('*')
      .order('is_active_chat', { ascending: false })
      .order('fallback_chat_order', { ascending: true })
      .order('created_at', { ascending: true });
    
    if (data) setProviders(data);
    setLoading(false);
  }

  function openAdd() {
    setEditingProvider(null);
    setShowModal(true);
  }

  function openEdit(p: Provider) {
    setEditingProvider(p);
    setShowModal(true);
  }

  if (profile && !profile.is_super_admin) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <h3>Access Denied</h3>
        <p>You must be a super admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="animate-slideUp">
      {/* Header */}
      <div className="page-header flex-mobile-col flex-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu style={{ color: 'var(--accent-primary)' }} /> AI Settings
          </h1>
          <p>Configure model credentials and failover priorities across all agent and chat workflows.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={openAdd}>
          <Plus size={16} style={{ marginRight: '6px' }} /> Add Provider
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-light)', paddingBottom: '12px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('credentials')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: activeTab === 'credentials' ? 'var(--bg-secondary)' : 'transparent',
            border: activeTab === 'credentials' ? '1px solid var(--border-primary)' : '1px solid transparent',
            color: activeTab === 'credentials' ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <Key size={16} /> API Credentials
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('routing')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: activeTab === 'routing' ? 'var(--bg-secondary)' : 'transparent',
            border: activeTab === 'routing' ? '1px solid var(--border-primary)' : '1px solid transparent',
            color: activeTab === 'routing' ? 'var(--text-primary)' : 'var(--text-secondary)',
            borderRadius: '8px',
            fontWeight: 600,
            fontSize: '14px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <Settings size={16} /> Failover & Routing Matrix
        </button>
      </div>

      {loading && providers.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading AI Configurations...
        </div>
      ) : providers.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Cpu className="empty-state-icon" />
            <h3>No AI Providers</h3>
            <p>Add at least one AI provider to enable chatbot responses. Supports OpenAI, OpenRouter, Gemini, Groq, and more.</p>
            <button className="btn btn-primary" onClick={openAdd}><Plus size={16}/> Add Provider</button>
          </div>
        </div>
      ) : (
        activeTab === 'credentials' ? (
          <ProviderList
            providers={providers}
            onEdit={openEdit}
            onRefresh={load}
          />
        ) : (
          <FailoverMatrix
            providers={providers}
            onRefresh={load}
          />
        )
      )}

      {/* Creation/Edit Modal */}
      <ProviderModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        provider={editingProvider}
        onSaved={load}
        isFirst={providers.length === 0}
      />
    </div>
  );
}
