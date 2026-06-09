import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { X, ArrowUp, ArrowDown, ShieldAlert, Sparkles, MessageSquare, Binary, FileText, Eye } from 'lucide-react';

interface Provider {
  id: string;
  provider_name: string;
  display_name: string;
  base_url: string;
  api_key: string;
  model_chat: string | null;
  model_reasoning: string | null;
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
}

interface FailoverMatrixProps {
  providers: Provider[];
  onRefresh: () => void;
}

interface RoleConfig {
  id: 'chat' | 'agent' | 'summarization' | 'embedding' | 'vision';
  title: string;
  description: string;
  icon: any;
  color: string;
  activeField: 'is_active_chat' | 'is_active_agent' | 'is_active_summarization' | 'is_active_embedding' | 'is_active_vision';
  fallbackOrderField: 'fallback_chat_order' | 'fallback_agent_order' | 'fallback_summarize_order' | 'fallback_embedding_order' | 'fallback_vision_order';
}

const ROLES: RoleConfig[] = [
  {
    id: 'chat',
    title: 'Chatbot Responses',
    description: 'Handles conversations directly with visitors in the Facebook Messenger and WhatsApp chat widget.',
    icon: MessageSquare,
    color: '#f97316',
    activeField: 'is_active_chat',
    fallbackOrderField: 'fallback_chat_order',
  },
  {
    id: 'agent',
    title: 'Super Admin Agent',
    description: 'Autonomous reasoning agent that executes tools (updating settings, prompt refactoring, knowledge updates).',
    icon: Sparkles,
    color: '#ec4899',
    activeField: 'is_active_agent',
    fallbackOrderField: 'fallback_agent_order',
  },
  {
    id: 'summarization',
    title: 'Conversation Summaries',
    description: 'Summarizes long conversation histories periodically to fit inside model token context windows.',
    icon: FileText,
    color: '#22c55e',
    activeField: 'is_active_summarization',
    fallbackOrderField: 'fallback_summarize_order',
  },
  {
    id: 'embedding',
    title: 'Vector Embeddings',
    description: 'Generates high-dimensional vectors for document chunks to support semantically searched RAG context.',
    icon: Binary,
    color: '#3b82f6',
    activeField: 'is_active_embedding',
    fallbackOrderField: 'fallback_embedding_order',
  },
  {
    id: 'vision',
    title: 'Vision Processing',
    description: 'Handles multimodal processing when customers upload screenshots or images in conversation.',
    icon: Eye,
    color: '#06b6d4',
    activeField: 'is_active_vision',
    fallbackOrderField: 'fallback_vision_order',
  },
];

export default function FailoverMatrix({ providers, onRefresh }: FailoverMatrixProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Helper: Get Primary provider for a role
  const getPrimary = (role: RoleConfig) => {
    return providers.find(p => p[role.activeField] === true);
  };

  // Helper: Get sorted fallbacks for a role
  const getFallbacks = (role: RoleConfig) => {
    return providers
      .filter(p => {
        const order = p[role.fallbackOrderField];
        const isPrimary = p[role.activeField] === true;
        return order !== null && order !== undefined && order > 0 && !isPrimary;
      })
      .sort((a, b) => {
        const orderA = a[role.fallbackOrderField] ?? 999;
        const orderB = b[role.fallbackOrderField] ?? 999;
        return orderA - orderB;
      });
  };

  // Helper: Get available providers to add as backup (not already primary or backup)
  const getAvailableForBackup = (role: RoleConfig) => {
    const primary = getPrimary(role);
    const fallbacks = getFallbacks(role);
    const fallbackIds = new Set(fallbacks.map(f => f.id));
    
    return providers.filter(p => p.id !== primary?.id && !fallbackIds.has(p.id));
  };

  // Action: Set Primary Provider
  async function handleSetPrimary(role: RoleConfig, providerId: string) {
    if (!providerId) return;
    setUpdatingId(`${role.id}-primary`);
    try {
      // 1. Deactivate this role on all providers
      await supabase
        .from('ai_providers')
        .update({ [role.activeField]: false })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // safe check

      // 2. Activate on selected and clear fallback rank if it was in fallback list
      await supabase
        .from('ai_providers')
        .update({ 
          [role.activeField]: true,
          [role.fallbackOrderField]: null
        })
        .eq('id', providerId);

      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  }

  // Action: Add Fallback Provider
  async function handleAddFallback(role: RoleConfig, providerId: string) {
    if (!providerId) return;
    setUpdatingId(`${role.id}-add`);
    try {
      const currentFallbacks = getFallbacks(role);
      const nextRank = currentFallbacks.length + 1;

      await supabase
        .from('ai_providers')
        .update({ [role.fallbackOrderField]: nextRank })
        .eq('id', providerId);

      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  }

  // Action: Remove Fallback Provider
  async function handleRemoveFallback(role: RoleConfig, providerId: string) {
    setUpdatingId(`${role.id}-remove-${providerId}`);
    try {
      // Clear fallback order
      await supabase
        .from('ai_providers')
        .update({ [role.fallbackOrderField]: null })
        .eq('id', providerId);

      // Re-index remaining backups to maintain sequential numbering
      const remaining = getFallbacks(role).filter(f => f.id !== providerId);
      for (let index = 0; index < remaining.length; index++) {
        await supabase
          .from('ai_providers')
          .update({ [role.fallbackOrderField]: index + 1 })
          .eq('id', remaining[index].id);
      }

      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  }

  // Action: Move Fallback Priority (Shift Rank up/down)
  async function handleShiftFallback(role: RoleConfig, providerId: string, direction: 'up' | 'down') {
    setUpdatingId(`${role.id}-shift-${providerId}`);
    try {
      const fallbacks = getFallbacks(role);
      const idx = fallbacks.findIndex(f => f.id === providerId);
      if (idx === -1) return;

      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= fallbacks.length) return;

      const currentProvider = fallbacks[idx];
      const swappedProvider = fallbacks[targetIdx];

      const currentRank = currentProvider[role.fallbackOrderField];
      const swappedRank = swappedProvider[role.fallbackOrderField];

      // Update swapped
      await supabase
        .from('ai_providers')
        .update({ [role.fallbackOrderField]: currentRank })
        .eq('id', swappedProvider.id);

      // Update current
      await supabase
        .from('ai_providers')
        .update({ [role.fallbackOrderField]: swappedRank })
        .eq('id', currentProvider.id);

      onRefresh();
    } catch (e) {
      console.error(e);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
      gap: '20px',
      alignItems: 'start'
    }}>
      {ROLES.map(role => {
        const primary = getPrimary(role);
        const fallbacks = getFallbacks(role);
        const availableBackups = getAvailableForBackup(role);
        const IconComponent = role.icon;

        return (
          <div key={role.id} className="card" style={{
            padding: '20px',
            border: `1px solid ${role.color}1c`,
            borderTop: `4px solid ${role.color}`,
            background: 'var(--bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: 'var(--shadow-md)',
            position: 'relative'
          }}>
            {/* Header */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{
                background: `${role.color}15`,
                color: role.color,
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <IconComponent size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{role.title}</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {role.description}
                </p>
              </div>
            </div>

            {/* Primary Provider Selector */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Primary Provider</span>
              <select
                className="form-select"
                value={primary?.id || ''}
                onChange={e => handleSetPrimary(role, e.target.value)}
                style={{ margin: 0, width: '100%', fontSize: '13px' }}
                disabled={updatingId?.startsWith(role.id)}
              >
                <option value="" disabled>-- Select Primary --</option>
                {providers.map(p => (
                  <option key={p.id} value={p.id}>{p.display_name} ({p.model_chat || p.model_embedding})</option>
                ))}
              </select>
            </div>

            {/* Fallback chain list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Fallback Providers (Ordered failover)</span>
              
              {fallbacks.length === 0 ? (
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px dashed var(--border-light)',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <ShieldAlert size={14} style={{ color: 'var(--text-muted)' }} />
                  No fallbacks active. Failures will cause system errors.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {fallbacks.map((f, index) => (
                    <div key={f.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                      border: '1px solid var(--border-light)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: role.color,
                          background: `${role.color}15`,
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          {index + 1}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{f.display_name}</span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          type="button"
                          className="btn-ghost btn-icon btn-sm"
                          onClick={() => handleShiftFallback(role, f.id, 'up')}
                          disabled={index === 0 || updatingId?.startsWith(role.id)}
                          style={{ padding: '2px', width: '22px', height: '22px' }}
                          title="Move up"
                        >
                          <ArrowUp size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-icon btn-sm"
                          onClick={() => handleShiftFallback(role, f.id, 'down')}
                          disabled={index === fallbacks.length - 1 || updatingId?.startsWith(role.id)}
                          style={{ padding: '2px', width: '22px', height: '22px' }}
                          title="Move down"
                        >
                          <ArrowDown size={12} />
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-icon btn-sm"
                          onClick={() => handleRemoveFallback(role, f.id)}
                          disabled={updatingId?.startsWith(role.id)}
                          style={{ padding: '2px', width: '22px', height: '22px', color: '#f87171' }}
                          title="Remove backup"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add backup provider dropdown */}
            {availableBackups.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                <select
                  className="form-select form-select-sm"
                  value=""
                  onChange={e => handleAddFallback(role, e.target.value)}
                  style={{ margin: 0, width: '100%', fontSize: '12px', background: 'transparent' }}
                  disabled={updatingId?.startsWith(role.id)}
                >
                  <option value="" disabled>+ Add Backup Provider</option>
                  {availableBackups.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name} ({p.model_chat || p.model_embedding})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
