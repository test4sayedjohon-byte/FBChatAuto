import { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Sparkles, Loader2, AlertCircle, Trash2, Cpu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    provider?: string;
    model?: string;
    ragUsed?: boolean;
    tokensUsed?: number;
  };
};

function generateId() {
  return '10000000-1000-4000-8000-' + Math.random().toString(16).substring(2, 14);
}

export default function SandboxPage() {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('sandbox_messages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved sandbox messages', e);
      }
    }
    return [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [sessionId, setSessionId] = useState(() => {
    const saved = localStorage.getItem('sandbox_session_id');
    return saved || generateId();
  });

  useEffect(() => {
    localStorage.setItem('sandbox_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('sandbox_session_id', sessionId);
  }, [sessionId]);
  const [globalProviders, setGlobalProviders] = useState<any[]>([]);
  const [selectedProvider, setSelectedProvider] = useState('default');
  const [pages, setPages] = useState<{page_id: string, page_name: string|null, is_active: boolean}[]>([]);
  const [selectedPageId, setSelectedPageId] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (user) {
      loadProviders();
    }
  }, [user]);

  async function loadProviders() {
    // Load user's current assignment
    const { data: uData } = await supabase.from('users').select('assigned_chat_provider_id').eq('id', user!.id).single();
    if (uData && uData.assigned_chat_provider_id) {
      setSelectedProvider(uData.assigned_chat_provider_id);
    }
    
    // Load global providers
    const { data: gData } = await supabase.from('ai_providers').select('id, display_name, model_chat').eq('is_global', true);
    if (gData) {
      setGlobalProviders(gData);
    }

    // Load connected pages (all, including inactive, so user can see status)
    const { data: pData } = await supabase
      .from('page_connections')
      .select('page_id, page_name, is_active')
      .eq('user_id', user!.id)
      .order('connected_at');
    if (pData) {
      setPages(pData);
      // Default to first ACTIVE page
      const firstActive = pData.find((p) => p.is_active);
      if (firstActive) setSelectedPageId(firstActive.page_id);
      else if (pData.length > 0) setSelectedPageId(pData[0].page_id);
    }
  }

  async function handleProviderChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setSelectedProvider(val);
    const updateVal = val === 'default' ? null : val;
    await supabase.from('users').update({ assigned_chat_provider_id: updateVal }).eq('id', user!.id);
  }

  function clearChat() {
    setMessages([]);
    setSessionId(generateId());
    setError('');
  }

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !user) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError('');

    try {
      // Send to our Cloudflare Worker test endpoint
      const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://metachat.junoverseai.com';
      const response = await fetch(`${WORKER_URL}/test-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          message: userMessage.content,
          sessionId: sessionId,
          pageId: selectedPageId === 'global' ? undefined : selectedPageId,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to get response');
      }

      const data = await response.json();

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        metadata: {
          provider: data.provider,
          model: data.model,
          ragUsed: data.ragUsed,
          tokensUsed: data.tokensUsed,
        }
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (err: any) {
      setError(err.message || 'An error occurred during chat');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPageInfo = pages.find((p) => p.page_id === selectedPageId);

  return (
    <div className="animate-slideUp" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 100px)' }}>
      <div className="page-header" style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={24} style={{ color: 'var(--accent-primary)' }} />
            AI Sandbox
          </h1>
          <p>Test your AI responses and knowledge base locally</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {profile?.is_super_admin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <Cpu size={16} style={{ color: 'var(--text-secondary)' }} />
              <select 
                className="form-select" 
                style={{ border: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)', padding: '4px', fontSize: '14px', width: 'auto' }}
                value={selectedProvider}
                onChange={handleProviderChange}
              >
                <option value="default">Default Active Model</option>
                {globalProviders.map(p => (
                  <option key={p.id} value={p.id}>{p.display_name} ({p.model_chat || 'No model'})</option>
                ))}
              </select>
            </div>
          )}
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', padding: '4px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
            <Bot size={16} style={{ color: 'var(--text-secondary)' }} />
            <select 
              className="form-select" 
              style={{ border: 'none', background: 'var(--bg-secondary)', color: 'var(--text-primary)', padding: '4px', fontSize: '14px', width: 'auto' }}
              value={selectedPageId}
              onChange={(e) => { setSelectedPageId(e.target.value); clearChat(); }}
            >
              {!profile?.is_super_admin && pages.length === 0 ? (
                <option value="global">No connected pages</option>
              ) : profile?.is_super_admin ? (
                <option value="global">Global Settings (No Page)</option>
              ) : null}
              {pages.map(p => (
                <option key={p.page_id} value={p.page_id}>
                  {p.is_active ? '✅' : '⏸️'} {p.page_name || p.page_id}{!p.is_active ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </div>

          <button className="btn btn-secondary" onClick={clearChat} title="Clear Chat History">
            <Trash2 size={16} /> Clear Chat
          </button>
        </div>
      </div>

      {selectedPageInfo && !selectedPageInfo.is_active && (
        <div style={{ padding: '12px 16px', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-lg)', color: '#f59e0b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem' }}>
          <span style={{ fontSize: '1.2rem' }}>⏸️</span>
          <span><strong>{selectedPageInfo.page_name || selectedPageInfo.page_id}</strong> is currently <strong>inactive</strong>. Enable it from the <strong>Facebook Pages</strong> section before testing.</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-lg)', color: 'var(--error)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={20} />
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Chat Area */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {messages.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Bot size={64} style={{ opacity: 0.5, marginBottom: '16px' }} />
              <p>Send a message to test your AI's responses.</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  gap: '16px',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: msg.role === 'user' ? 'rgba(249, 115, 22, 0.2)' : 'var(--bg-tertiary)'
                }}>
                  {msg.role === 'user' ? (
                    <User size={20} style={{ color: 'var(--accent-primary)' }} />
                  ) : (
                    <Bot size={20} style={{ color: 'var(--text-primary)' }} />
                  )}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '70%', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-lg)',
                    borderTopRightRadius: msg.role === 'user' ? '4px' : 'var(--radius-lg)',
                    borderTopLeftRadius: msg.role === 'assistant' ? '4px' : 'var(--radius-lg)',
                    background: msg.role === 'user' ? 'var(--accent-gradient)' : 'var(--bg-tertiary)',
                    color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                    border: msg.role === 'assistant' ? '1px solid var(--border-primary)' : 'none'
                  }}>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{msg.content}</p>
                  </div>
                  
                  {msg.metadata && profile?.is_super_admin && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Sparkles size={12} />
                        {msg.metadata.provider} ({msg.metadata.model})
                      </span>
                      {msg.metadata.ragUsed && (
                        <span style={{ color: 'var(--success)', border: '1px solid rgba(34, 197, 94, 0.3)', padding: '0 8px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)' }}>
                          RAG context used
                        </span>
                      )}
                      <span>{msg.metadata.tokensUsed} tokens</span>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {isLoading && (
            <div style={{ display: 'flex', gap: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={20} style={{ color: 'var(--text-primary)' }} />
              </div>
              <div style={{ padding: '16px', borderRadius: 'var(--radius-lg)', borderTopLeftRadius: '4px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />
                <span style={{ color: 'var(--text-muted)' }}>AI is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} style={{ position: 'relative', display: 'flex', gap: '12px' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message to test the AI..."
          disabled={isLoading}
          className="form-input"
          style={{ flex: 1, padding: '16px', paddingRight: '64px', borderRadius: 'var(--radius-lg)' }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="btn-primary"
          style={{ position: 'absolute', right: '8px', top: '8px', bottom: '8px', width: '40px', padding: 0, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
