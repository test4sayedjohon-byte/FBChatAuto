import { useState, useRef, useEffect } from 'react';
import { Bot, User, Loader2, Send, Trash2, Sliders, Paperclip, X, History, RotateCcw, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { workerPost } from '../lib/workerApi';
import { toast } from '../hooks/useToast';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function AgentChatPage() {
  useDocumentTitle('System Agent — AutometaBot');
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<{role: string, content: string, fileAttachment?: { name: string, content: string }}[]>(() => {
    const saved = localStorage.getItem('agent_messages');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved agent messages', e);
      }
    }
    return [];
  });
  
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [selectedFile, setSelectedFile] = useState<{ name: string; content: string } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (typeof content === 'string') {
        setSelectedFile({ name: file.name, content });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const removeFile = () => {
    setSelectedFile(null);
  };
  
  const [selectedChannel, setSelectedChannel] = useState<string>(() => {
    return localStorage.getItem('agent_selected_channel') || 'global';
  });
  const [selectedContext, setSelectedContext] = useState<string>(() => {
    return localStorage.getItem('agent_selected_context') || 'global';
  });
  const [reasoningMode, setReasoningMode] = useState<'thinking' | 'fast'>(() => {
    return (localStorage.getItem('agent_reasoning_mode') as 'thinking' | 'fast') || 'fast';
  });

  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(() => {
    return localStorage.getItem('agent_show_snapshots') !== 'false';
  });
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null);

  const fetchSnapshots = async () => {
    if (!user) return;
    setIsLoadingSnapshots(true);
    try {
      let query = supabase
        .from('version_history')
        .select('id, entity_type, field_name, previous_value, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (selectedChannel === 'global') {
        query = query.is('page_id', null);
      } else {
        query = query.eq('page_id', selectedChannel);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      setSnapshots(data || []);
    } catch (e: any) {
      console.error('Error fetching version snapshots:', e);
    } finally {
      setIsLoadingSnapshots(false);
    }
  };

  const handleRestoreSnapshot = async (snapshot: any) => {
    if (!user) return;
    const confirmRestore = window.confirm(`Are you sure you want to restore this snapshot? This will overwrite the current configuration.`);
    if (!confirmRestore) return;

    try {
      const { entity_type, entity_id, previous_value, field_name } = snapshot;

      if (entity_type === 'system_prompt') {
        let query = supabase
          .from('page_connections')
          .update({ custom_system_prompt: previous_value })
          .eq('user_id', user.id);
        
        if (selectedChannel === 'global') {
          query = query.is('page_id', null);
        } else {
          query = query.eq('page_id', selectedChannel);
        }
        
        const { error } = await query;
        if (error) throw error;
      }
      else if (entity_type === 'quick_answer') {
        if (previous_value === null) {
          const { error } = await supabase
            .from('knowledge_fields')
            .delete()
            .eq('id', entity_id)
            .eq('user_id', user.id);
          if (error) throw error;
        } else {
          const { data: existing } = await supabase
            .from('knowledge_fields')
            .select('id')
            .eq('id', entity_id)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase
              .from('knowledge_fields')
              .update({ field_value: previous_value })
              .eq('id', entity_id);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from('knowledge_fields')
              .insert({
                id: entity_id,
                user_id: user.id,
                page_id: selectedChannel === 'global' ? null : selectedChannel,
                field_name: field_name,
                field_value: previous_value,
                category: 'general'
              });
            if (error) throw error;
          }
        }
      }
      else if (entity_type === 'document') {
        if (previous_value === null) {
          const { error } = await supabase
            .from('documents')
            .delete()
            .eq('id', entity_id)
            .eq('user_id', user.id);
          if (error) throw error;
        } else {
          const { data: existing } = await supabase
            .from('documents')
            .select('id')
            .eq('id', entity_id)
            .maybeSingle();

          if (existing) {
            const { error } = await supabase
              .from('documents')
              .update({ original_content: previous_value })
              .eq('id', entity_id);
            if (error) throw error;

            try {
              await workerPost('/api/documents/process', { documentId: entity_id, userId: user.id });
            } catch (embedError) {
              console.error('Failed to trigger re-embedding:', embedError);
            }
          } else {
            let folderId = null;
            if (selectedChannel === 'global') {
              const { data: folder } = await supabase
                .from('document_folders')
                .select('id')
                .eq('user_id', user.id)
                .limit(1)
                .maybeSingle();
              folderId = folder?.id;
            } else {
              const { data: assign } = await supabase
                .from('folder_page_assignments')
                .select('folder_id')
                .eq('page_id', selectedChannel)
                .limit(1)
                .maybeSingle();
              folderId = assign?.folder_id;
            }

            if (folderId) {
              const { error } = await supabase
                .from('documents')
                .insert({
                  id: entity_id,
                  user_id: user.id,
                  folder_id: folderId,
                  title: field_name || 'Restored Document',
                  original_content: previous_value,
                  source_type: 'text'
                });
              if (error) throw error;

              try {
                await workerPost('/api/documents/process', { documentId: entity_id, userId: user.id });
              } catch (embedError) {
                console.error('Failed to trigger embedding for restored document:', embedError);
              }
            } else {
              throw new Error('No target folder found to assign the restored document.');
            }
          }
        }
      }

      toast.success('Snapshot successfully restored!');
      window.dispatchEvent(new Event('agent-data-updated'));
    } catch (err: any) {
      console.error('Restore error:', err);
      toast.error(`Failed to restore snapshot: ${err.message}`);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, [user, selectedChannel]);

  useEffect(() => {
    const handleUpdate = () => {
      fetchSnapshots();
    };
    window.addEventListener('agent-data-updated', handleUpdate);
    return () => {
      window.removeEventListener('agent-data-updated', handleUpdate);
    };
  }, [user, selectedChannel]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    localStorage.setItem('agent_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (user) {
      supabase
        .from('page_connections')
        .select('page_id, page_name')
        .eq('user_id', user.id)
        .then(({ data, error }) => {
          if (error) {
            console.error('Error fetching page connections:', error);
          } else if (data) {
            setChannels(data);
          }
        });
    }
  }, [user]);

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem('agent_messages');
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!input.trim() && !selectedFile) || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input.trim() || `Processing attached file: ${selectedFile?.name}`,
      fileAttachment: selectedFile ? { name: selectedFile.name, content: selectedFile.content } : undefined
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSelectedFile(null);
    setIsLoading(true);

    try {
      const backendMessages = [...messages, userMessage].map((m) => {
        if (m.fileAttachment) {
          return {
            role: m.role,
            content: `${m.content}\n\n[Attached File: ${m.fileAttachment.name}]\n${m.fileAttachment.content}`
          };
        }
        return { role: m.role, content: m.content };
      });

      const data = await workerPost('/api/agent/chat', { 
        messages: backendMessages,
        channelId: selectedChannel,
        contextType: selectedContext,
        reasoningMode
      });
      
      if (data.message) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.message.content }]);
      }
      if (data.databaseUpdated) {
        window.dispatchEvent(new Event('agent-data-updated'));
        toast.success('System settings automatically synced.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to get response');
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const getContextLabel = (val: string) => {
    switch(val) {
      case 'system_prompt': return 'System Prompt';
      case 'quick_answers': return 'Quick Answers';
      case 'knowledge_base': return 'Knowledge Base';
      default: return 'Global (All Contexts)';
    }
  };

  const getChannelLabel = (val: string) => {
    if (val === 'global') return 'Global (All Channels)';
    const found = channels.find(c => c.page_id === val);
    return found ? found.page_name : val;
  };

  return (
    <div className="animate-slideUp" style={{ paddingBottom: '40px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header flex-mobile-col flex-wrap" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '8px' }}>System Agent</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage your knowledge base, system prompts, and documents via chat.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className={`btn ${showSnapshots ? 'btn-primary' : 'btn-secondary'}`} 
            onClick={() => {
              const nextVal = !showSnapshots;
              setShowSnapshots(nextVal);
              localStorage.setItem('agent_show_snapshots', String(nextVal));
            }}
            title="Toggle Snapshots History"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <History size={16} />
            <span>{showSnapshots ? 'Hide Snapshots' : 'Show Snapshots'}</span>
          </button>

          <button className="btn btn-secondary" onClick={clearChat} title="Clear Chat History" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Trash2 size={16} />
            <span>Clear Chat</span>
          </button>
        </div>
      </div>

      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)', overflow: 'hidden', padding: 0 }}>
        {/* Context Control Bar */}
        <div style={{ 
          padding: '12px 24px', 
          borderBottom: '1px solid var(--border-subtle)', 
          background: 'var(--surface-secondary)', 
          display: 'flex', 
          gap: '24px', 
          flexWrap: 'wrap', 
          alignItems: 'center',
          fontSize: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
            <Sliders size={16} />
            <span style={{ fontWeight: 600 }}>Chat Target Context:</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Channel:</span>
            <select
              value={selectedChannel}
              onChange={(e) => {
                setSelectedChannel(e.target.value);
                localStorage.setItem('agent_selected_channel', e.target.value);
              }}
              className="form-input"
              style={{ padding: '6px 12px', fontSize: '13px', height: '32px', minWidth: '160px', width: 'auto', background: 'var(--surface-primary)' }}
            >
              <option value="global">Global (All Channels)</option>
              {channels.map((c) => (
                <option key={c.page_id} value={c.page_id}>
                  {c.page_name || c.page_id}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Context Type:</span>
            <select
              value={selectedContext}
              onChange={(e) => {
                setSelectedContext(e.target.value);
                localStorage.setItem('agent_selected_context', e.target.value);
              }}
              className="form-input"
              style={{ padding: '6px 12px', fontSize: '13px', height: '32px', minWidth: '160px', width: 'auto', background: 'var(--surface-primary)' }}
            >
              <option value="global">Global (All Contexts)</option>
              <option value="system_prompt">System Prompt</option>
              <option value="quick_answers">Quick Answers</option>
              <option value="knowledge_base">Knowledge Base</option>
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Mode:</span>
            <select
              value={reasoningMode}
              onChange={(e) => {
                const val = e.target.value as 'thinking' | 'fast';
                setReasoningMode(val);
                localStorage.setItem('agent_reasoning_mode', val);
              }}
              className="form-input"
              style={{ padding: '6px 12px', fontSize: '13px', height: '32px', minWidth: '150px', width: 'auto', background: 'var(--surface-primary)' }}
            >
              <option value="fast">⚡ Precise & Fast (Default)</option>
              <option value="thinking">🧠 Reasoning / Thinking</option>
            </select>
          </div>
        </div>

        {/* Outer Split Container */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* Main Chat Pane */}
          <div style={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%',
            background: 'var(--surface-primary)'
          }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '60px' }}>
                  <Bot size={64} style={{ opacity: 0.2, margin: '0 auto 20px' }} />
                  <h2 style={{ fontSize: '20px', color: 'var(--text-primary)', marginBottom: '8px' }}>Hi! I'm your Autometa Assistant.</h2>
                  <p style={{ fontSize: '15px', marginBottom: '8px' }}>I can help you update system prompts, add knowledge base entries, and manage documents.</p>
                  
                  <div style={{ 
                    maxWidth: '480px', 
                    margin: '20px auto 0', 
                    padding: '16px', 
                    borderRadius: '12px', 
                    background: 'var(--surface-secondary)', 
                    border: '1px solid var(--border-subtle)',
                    textAlign: 'left',
                    fontSize: '14px'
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-primary)' }}>Active Configuration:</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div>• <strong>Channel:</strong> {getChannelLabel(selectedChannel)}</div>
                      <div>• <strong>Scope/Context:</strong> {getContextLabel(selectedContext)}</div>
                      <div>• <strong>Mode:</strong> {reasoningMode === 'thinking' ? '🧠 Reasoning (Deep thinking)' : '⚡ Precise & Fast (No timeout)'}</div>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '12px' }}>
                      Change dropdowns above to narrow focus and prevent AI errors.
                    </div>
                  </div>
                </div>
              ) : (
                messages.map((m, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    gap: '16px',
                    flexDirection: m.role === 'user' ? 'row-reverse' : 'row'
                  }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '50%',
                      background: m.role === 'user' ? 'var(--surface-tertiary)' : 'var(--accent-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {m.role === 'user' ? <User size={20} /> : <Bot size={20} color="white" />}
                    </div>
                    <div style={{
                      background: m.role === 'user' ? 'var(--surface-tertiary)' : 'var(--surface-secondary)',
                      padding: '16px 20px',
                      borderRadius: '16px',
                      borderTopRightRadius: m.role === 'user' ? '4px' : '16px',
                      borderTopLeftRadius: m.role === 'user' ? '16px' : '4px',
                      maxWidth: '85%',
                      wordBreak: 'break-word',
                      lineHeight: '1.6',
                      fontSize: '15px',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {m.fileAttachment && (
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '8px', 
                          background: 'var(--surface-primary)', 
                          padding: '8px 12px', 
                          borderRadius: '8px', 
                          marginBottom: '10px',
                          border: '1px solid var(--border-subtle)',
                          fontSize: '13px',
                          color: 'var(--text-secondary)'
                        }}>
                          <Paperclip size={14} />
                          <span style={{ fontWeight: 500 }}>{m.fileAttachment.name}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({Math.round(m.fileAttachment.content.length / 1024)} KB)</span>
                        </div>
                      )}
                      {m.content}
                    </div>
                  </div>
                ))
              )}
              {isLoading && (
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    background: 'var(--accent-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Bot size={20} color="white" />
                  </div>
                  <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center' }}>
                    <Loader2 className="animate-spin" size={24} color="var(--text-secondary)" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div style={{ padding: '20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-secondary)' }}>
              <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Attachment Preview */}
                {selectedFile && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'var(--surface-primary)',
                    padding: '10px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--border-subtle)',
                    fontSize: '14px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                      <Paperclip size={16} />
                      <span style={{ fontWeight: 500 }}>{selectedFile.name}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>({Math.round(selectedFile.content.length / 1024)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '4px',
                        display: 'flex',
                        alignItems: 'center'
                      }}
                      title="Remove attachment"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '48px',
                      height: '48px',
                      borderRadius: 'var(--radius-lg)',
                      cursor: 'pointer',
                      color: 'var(--text-secondary)',
                      background: 'var(--surface-primary)',
                      border: '1px solid var(--border-subtle)',
                      flexShrink: 0,
                      transition: 'all 0.2s'
                    }}
                    title="Attach Document"
                  >
                    <Paperclip size={20} />
                    <input
                      type="file"
                      accept=".txt,.md,.json,.csv,.yml,.yaml"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                      disabled={isLoading}
                    />
                  </label>

                  <div style={{ flex: 1, display: 'flex', gap: '12px' }}>
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={selectedFile ? "Ask the agent what to do with this file..." : `Ask me to update something in ${getContextLabel(selectedContext)}...`}
                      className="input-field"
                      style={{ flex: 1, padding: '14px 20px', fontSize: '15px' }}
                      disabled={isLoading}
                    />
                    <button 
                      type="submit" 
                      className="btn-primary" 
                      disabled={(!input.trim() && !selectedFile) || isLoading}
                      style={{ padding: '0 24px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Send size={18} />
                      <span>Send</span>
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Snapshots Sidebar */}
          {showSnapshots && (
            <div style={{ 
              width: '350px', 
              display: 'flex', 
              flexDirection: 'column', 
              height: '100%', 
              background: 'var(--surface-secondary)',
              borderLeft: '1px solid var(--border-subtle)' 
            }}>
              <div style={{ 
                padding: '16px 20px', 
                borderBottom: '1px solid var(--border-subtle)', 
                background: 'var(--surface-primary)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
                  <History size={16} className="text-primary" /> Version Snapshots
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--surface-tertiary)', padding: '2px 8px', borderRadius: '12px' }}>
                  Last 20
                </span>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {isLoadingSnapshots ? (
                  <div style={{ display: 'flex', justifyContent: 'center', padding: '40px', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <Loader2 className="animate-spin" size={16} /> Loading snapshots...
                  </div>
                ) : snapshots.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '40px 20px', fontSize: '13px' }}>
                    No database updates recorded yet for this channel.
                  </div>
                ) : (
                  snapshots.map((snap) => {
                    const isExpanded = expandedSnapshotId === snap.id;
                    const dateStr = new Date(snap.created_at).toLocaleString();
                    let icon = <FileText size={16} />;
                    let title = 'Document Modification';
                    
                    if (snap.entity_type === 'system_prompt') {
                      icon = <Sliders size={16} />;
                      title = 'System Prompt';
                    } else if (snap.entity_type === 'quick_answer') {
                      icon = <Bot size={16} />;
                      title = `Quick Answer: ${snap.field_name || 'fact'}`;
                    } else if (snap.entity_type === 'document') {
                      title = `Document: ${snap.field_name || 'doc'}`;
                    }
                    
                    return (
                      <div key={snap.id} style={{ 
                        background: 'var(--surface-primary)', 
                        border: '1px solid var(--border-subtle)', 
                        borderRadius: '12px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ 
                              background: 'var(--surface-secondary)', 
                              padding: '6px', 
                              borderRadius: '8px',
                              color: 'var(--accent-primary)'
                            }}>
                              {icon}
                            </div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                                {title}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                {dateStr}
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          <button 
                            onClick={() => setExpandedSnapshotId(isExpanded ? null : snap.id)}
                            className="btn btn-secondary"
                            style={{ 
                              flex: 1, 
                              padding: '4px 8px', 
                              fontSize: '11px', 
                              height: '28px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '4px'
                            }}
                          >
                            {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            <span>{isExpanded ? 'Hide Details' : 'View Snapshot'}</span>
                          </button>
                          
                          <button 
                            onClick={() => handleRestoreSnapshot(snap)}
                            className="btn-primary"
                            style={{ 
                              padding: '4px 10px', 
                              fontSize: '11px', 
                              height: '28px', 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '4px',
                              borderRadius: 'var(--radius-md)',
                              background: 'var(--accent-primary)' 
                            }}
                          >
                            <RotateCcw size={12} />
                            <span>Restore</span>
                          </button>
                        </div>

                        {isExpanded && (
                          <div style={{ 
                            marginTop: '4px', 
                            padding: '8px 12px', 
                            background: 'var(--surface-secondary)', 
                            border: '1px solid var(--border-subtle)', 
                            borderRadius: '8px',
                            fontSize: '11px',
                            color: 'var(--text-secondary)',
                            maxHeight: '120px',
                            overflowY: 'auto',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            fontFamily: 'monospace'
                          }}>
                            {snap.previous_value === null 
                              ? '[New item inserted - Restore will delete it]' 
                              : (snap.previous_value || '[Empty/Null]')}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
