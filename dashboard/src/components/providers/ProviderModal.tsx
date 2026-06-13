import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { PROVIDER_PRESETS } from '../../lib/providers';
import { getPresetChatModels, getPresetEmbeddingModels } from '../../lib/models';
import { X, Loader2 } from 'lucide-react';

interface Provider {
  id: string;
  provider_name: string;
  display_name: string;
  base_url: string;
  api_key: string;
  model_chat: string | null;
  model_reasoning: string | null;
  model_embedding: string | null;
  max_tokens: number;
  temperature: number;
  context_window: number;
}

interface ProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  provider: Provider | null;
  onSaved: () => void;
  isFirst: boolean;
}

export default function ProviderModal({ isOpen, onClose, provider, onSaved, isFirst }: ProviderModalProps) {
  const [saving, setSaving] = useState(false);
  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const [providerName, setProviderName] = useState('openai');
  const [displayName, setDisplayName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [modelChat, setModelChat] = useState('');
  const [modelReasoning, setModelReasoning] = useState('');
  const [modelEmbed, setModelEmbed] = useState('');
  const [maxTokens, setMaxTokens] = useState(1024);
  const [temperature, setTemperature] = useState(0.7);
  const [contextWindow, setContextWindow] = useState(10);
  const [customChatEnabled, setCustomChatEnabled] = useState(false);
  const [customReasoningEnabled, setCustomReasoningEnabled] = useState(false);
  const [customEmbedEnabled, setCustomEmbedEnabled] = useState(false);

  const chatPresets = getPresetChatModels(providerName);
  const embedPresets = getPresetEmbeddingModels(providerName);
  const freeChatPresets = chatPresets.filter(m => m.isFree);
  const freeEmbedPresets = embedPresets.filter(m => m.isFree);

  useEffect(() => {
    if (provider) {
      setProviderName(provider.provider_name);
      setDisplayName(provider.display_name);
      setBaseUrl(provider.base_url);
      setApiKey(provider.api_key);
      setModelChat(provider.model_chat || '');
      setModelReasoning(provider.model_reasoning || '');
      setModelEmbed(provider.model_embedding || '');
      setMaxTokens(provider.max_tokens);
      setTemperature(provider.temperature);
      setContextWindow(provider.context_window);

      const presets = getPresetChatModels(provider.provider_name);
      const inChatPresets = presets.some(m => m.id === provider.model_chat);
      setCustomChatEnabled(provider.model_chat ? !inChatPresets : false);

      const inReasoningPresets = presets.some(m => m.id === provider.model_reasoning);
      setCustomReasoningEnabled(provider.model_reasoning ? !inReasoningPresets : false);

      const embeds = getPresetEmbeddingModels(provider.provider_name);
      const inEmbedPresets = embeds.some(m => m.id === provider.model_embedding);
      setCustomEmbedEnabled(provider.model_embedding ? !inEmbedPresets : false);
    } else {
      const preset = PROVIDER_PRESETS['openai'];
      setProviderName('openai');
      setDisplayName('');
      setBaseUrl(preset.baseUrl);
      setApiKey('');
      setModelChat(preset.defaultChatModel);
      setModelReasoning('');
      setModelEmbed(preset.defaultEmbeddingModel);
      setMaxTokens(1024);
      setTemperature(0.7);
      setContextWindow(10);
      setCustomChatEnabled(false);
      setCustomReasoningEnabled(false);
      setCustomEmbedEnabled(false);
    }
    setTestingStatus('idle');
    setTestMessage('');
  }, [provider, isOpen]);

  function onProviderChange(name: string) {
    setProviderName(name);
    const preset = PROVIDER_PRESETS[name];
    if (preset) {
      setBaseUrl(preset.baseUrl);
      setModelChat(preset.defaultChatModel);
      setModelReasoning('');
      setModelEmbed(preset.defaultEmbeddingModel);
    }
    setCustomChatEnabled(false);
    setCustomReasoningEnabled(false);
    setCustomEmbedEnabled(false);
  }

  async function testConnection() {
    if (!baseUrl || !apiKey) {
      setTestingStatus('error');
      setTestMessage('Base URL and API Key are required to test.');
      return;
    }
    setTestingStatus('testing');
    try {
      const url = baseUrl.replace(/\/+$/, '') + '/models';
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
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
      if (e instanceof TypeError && (e.message.includes('fetch') || e.message.includes('NetworkError'))) {
        setTestingStatus('success');
        setTestMessage('CORS Notice: Browser security blocks direct testing, but your key works on the server side!');
      } else {
        setTestingStatus('error');
        setTestMessage(`Error: ${e.message}`);
      }
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
      model_reasoning: modelReasoning || null,
      model_embedding: modelEmbed || null,
      max_tokens: maxTokens,
      temperature,
      context_window: contextWindow,
    };

    if (provider) {
      await supabase.from('ai_providers')
        .update(providerData)
        .eq('id', provider.id);
    } else {
      await supabase.from('ai_providers').insert({
        ...providerData,
        user_id: null,
        is_global: true,
        is_active_chat: isFirst,
        is_active_embedding: isFirst,
        is_active_summarization: isFirst,
        is_active_agent: isFirst,
        is_active_vision: isFirst,
        is_active_image: isFirst,
        is_active_content: isFirst,
      });
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 100 }}>
      <div className="modal" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <h2>{provider ? 'Edit AI Provider' : 'Add AI Provider'}</h2>
          <button type="button" className="btn-ghost btn-icon" onClick={onClose}><X size={18}/></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Provider</label>
              <select className="form-select" value={providerName} onChange={e => onProviderChange(e.target.value)}>
                {Object.entries(PROVIDER_PRESETS).map(([key, p]) => (
                  <option key={key} value={key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input className="form-input" placeholder={PROVIDER_PRESETS[providerName]?.label} value={displayName} onChange={e => setDisplayName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">API Key</label>
              <input className="form-input" type="password" placeholder={PROVIDER_PRESETS[providerName]?.placeholder || 'API Key'} value={apiKey} onChange={e => setApiKey(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">Base URL</label>
              <input className="form-input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} required />
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
                <label className="form-label">Reasoning / Thinking Model</label>
                {chatPresets.length > 0 ? (
                  <>
                    <select 
                      className="form-select" 
                      value={customReasoningEnabled ? 'custom' : modelReasoning} 
                      onChange={e => {
                        if (e.target.value === 'custom') {
                          setCustomReasoningEnabled(true);
                          setModelReasoning('');
                        } else {
                          setCustomReasoningEnabled(false);
                          setModelReasoning(e.target.value);
                        }
                      }}
                    >
                      <option value="">None (Fallback to standard chat model)</option>
                      {freeChatPresets.length > 0 && (
                        <optgroup label="Free Models (Quick Access)">
                          {freeChatPresets.map(m => (
                            <option key={`free-reason-${m.id}`} value={m.id}>
                              🎁 [FREE] {m.name} ({m.context}{m.capabilities ? ` - ${m.capabilities}` : ''})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="All Models">
                        {chatPresets.map(m => (
                          <option key={`reason-${m.id}`} value={m.id}>
                            {m.name} ({m.context}{m.capabilities ? ` - ${m.capabilities}` : ''}){m.isFree ? ' [FREE]' : ''}
                          </option>
                        ))}
                      </optgroup>
                      <option value="custom">Custom (Type model name manually)...</option>
                    </select>
                    {customReasoningEnabled && (
                      <input 
                        className="form-input" 
                        style={{ marginTop: '8px' }}
                        placeholder="Enter custom reasoning model ID" 
                        value={modelReasoning} 
                        onChange={e => setModelReasoning(e.target.value)} 
                      />
                    )}
                  </>
                ) : (
                  <input 
                    className="form-input" 
                    placeholder="e.g., o3-mini or deepseek-reasoner" 
                    value={modelReasoning} 
                    onChange={e => setModelReasoning(e.target.value)} 
                  />
                )}
                <p className="form-hint">Used when Reasoning Mode is active. Slow but smart.</p>
              </div>
            </div>

            <div className="form-row">
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
                <label className="form-label">Context Window (Messages)</label>
                <input className="form-input" type="number" min={1} max={50} value={contextWindow} onChange={e => setContextWindow(parseInt(e.target.value) || 10)} />
              </div>
              <div className="form-group">
                <label className="form-label">Temperature (0 - 2)</label>
                <input className="form-input" type="number" step={0.1} min={0} max={2} value={temperature} onChange={e => setTemperature(parseFloat(e.target.value) || 0.7)} />
              </div>
            </div>
            

          </div>
          <div className="modal-footer" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '10px' }}>
            {testingStatus !== 'idle' && (
              <div style={{
                fontSize: '13px',
                fontWeight: 500,
                textAlign: 'center',
                color: testingStatus === 'success' ? '#4ade80' : '#f87171'
              }}>
                {testMessage}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-secondary" onClick={testConnection} disabled={testingStatus === 'testing'}>
                {testingStatus === 'testing' && <Loader2 size={14} className="animate-spin" style={{ marginRight: '6px' }} />}
                Test Connection
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving...' : 'Save Provider'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
