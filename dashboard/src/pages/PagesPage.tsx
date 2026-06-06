import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Globe, X, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import PricingModal from '../components/PricingModal';

interface PageConn {
  id: string;
  page_id: string;
  page_name: string | null;
  is_active: boolean;
  connected_at: string;
  bot_name: string | null;
  custom_system_prompt: string | null;
  instagram_account_id: string | null;
  is_instagram_active: boolean;
  whatsapp_phone_number_id: string | null;
  is_whatsapp_active: boolean;
  enable_customer_profiling?: boolean;
  profiling_model?: string | null;
  trigger_words?: string[] | null;
  trigger_responses?: string[] | null;
  is_trigger_enabled?: boolean;
}

export default function PagesPage() {
  const { user, profile } = useAuth();
  const [pages, setPages] = useState<PageConn[]>([]);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [channelsToBuy, setChannelsToBuy] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [instagramId, setInstagramId] = useState('');

  // Bot Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedPage, setSelectedPage] = useState<PageConn | null>(null);
  const [botName, setBotName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [enableProfiling, setEnableProfiling] = useState(false);
  const [enableTrigger, setEnableTrigger] = useState(false);
  const [triggerWords, setTriggerWords] = useState<string[]>([]);
  const [triggerInput, setTriggerInput] = useState('');
  const [triggerResponses, setTriggerResponses] = useState('');

  const DEFAULT_PROMPT = `You are a helpful, friendly, and professional AI assistant for this business on Facebook Messenger.

## Instructions
- Respond in a conversational, warm tone appropriate for Messenger.
- Keep responses concise — Messenger is a chat format, not an essay.
- If you do not know the answer, say so honestly. Do not make things up.
- Use the business information below to answer customer questions accurately.
- If a question is outside your knowledge, suggest the customer contact the business directly.
- NEVER reveal that you are an AI unless directly asked. Present yourself as a helpful representative.`;

  useEffect(() => {
    if (user) {
      load();
    }
  }, [user]);

  async function load() {
    if (!user) return;
    const { data, error } = await supabase
      .from('page_connections')
      .select('*')
      .eq('user_id', user.id)
      .order('connected_at', { ascending: false });
    if (error) {
      console.error('Error loading pages:', error);
      alert('Error loading pages: ' + error.message);
    }
    if (data) setPages(data);
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    
    if (editMode && editingPageId) {
      const updates: any = {
        page_id: pageId,
        page_name: pageName || null,
        instagram_account_id: instagramId || null,
      };
      if (accessToken.trim() !== '') {
        updates.access_token = accessToken.trim();
      }
      const { error } = await supabase.from('page_connections').update(updates).eq('id', editingPageId);
      if (error) alert('Error: ' + error.message);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('You must be logged in to connect a page.');
        setSaving(false);
        return;
      }
      const { error } = await supabase.from('page_connections').insert({
        user_id: user.id,
        page_id: pageId,
        page_name: pageName || null,
        access_token: accessToken.trim(),
        instagram_account_id: instagramId || null,
      });
      if (error) alert('Error: ' + error.message);
    }

    setSaving(false);
    setShowModal(false);
    load();
  }

  function openConnect() {
    const allowed = profile?.allowed_channels || 0;
    if (pages.length >= allowed) {
      setChannelsToBuy(1);
      setShowPricingModal(true);
      return;
    }

    setEditMode(false);
    setEditingPageId(null);
    setPageId('');
    setPageName('');
    setAccessToken('');
    setInstagramId('');
    setShowModal(true);
  }

  function openEditPage(p: PageConn) {
    setEditMode(true);
    setEditingPageId(p.id);
    setPageId(p.page_id);
    setPageName(p.page_name || '');
    setAccessToken(''); // Leave blank to not change
    setInstagramId(p.instagram_account_id || '');
    setShowModal(true);
  }

  async function del(id: string) {
    if (!confirm('Disconnect this Meta Channel connection?')) return;
    await supabase.from('page_connections').delete().eq('id', id);
    load();
  }

  async function toggle(p: PageConn) {
    const { error } = await supabase.from('page_connections').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) alert('Error toggling page: ' + error.message);
    load();
  }

  function openSettings(p: PageConn) {
    setSelectedPage(p);
    setBotName(p.bot_name || '');
    setSystemPrompt(p.custom_system_prompt || DEFAULT_PROMPT);
    setEnableProfiling(p.enable_customer_profiling || false);
    setEnableTrigger(p.is_trigger_enabled || false);
    setTriggerWords(p.trigger_words || []);
    setTriggerInput('');
    setTriggerResponses((p.trigger_responses || ["I need to transfer you to a human agent. Please hold on."]).join('\n---\n'));
    setShowSettingsModal(true);
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!selectedPage) return;
    setSaving(true);
    
    // Always save the exact text the user typed.
    // Only save null if the field is completely empty (user wants to use platform default).
    const trimmedPrompt = systemPrompt.trim();
    const promptToSave = trimmedPrompt.length > 0 ? trimmedPrompt : null;

    const finalTriggerWords = [...triggerWords];
    if (triggerInput.trim() !== '') {
      finalTriggerWords.push(triggerInput.trim());
    }
    const tWords = finalTriggerWords.filter(w => w);
    
    const tResponses = triggerResponses.split('\n---\n').map(r => r.trim()).filter(r => r);

    const { error } = await supabase.from('page_connections').update({
      bot_name: botName.trim() || null,
      custom_system_prompt: promptToSave,
      enable_customer_profiling: enableProfiling,
      is_trigger_enabled: enableTrigger,
      trigger_words: tWords,
      trigger_responses: tResponses.length > 0 ? tResponses : ["I need to transfer you to a human agent. Please hold on."]
    }).eq('id', selectedPage.id);

    if (error) {
      alert('Error saving settings: ' + error.message);
    } else {
      setShowSettingsModal(false);
      load();
    }
    setSaving(false);
  }

  function resetToDefault() {
    if (confirm('Are you sure you want to reset the system prompt to the default? Any custom rules will be lost.')) {
      setSystemPrompt(DEFAULT_PROMPT);
      setBotName('');
    }
  }

  return (
    <div className="animate-slideUp">
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <h1>Meta Channels</h1>
          <p>Connect Facebook and Instagram to enable AI chatbot responses.</p>
        </div>
        <div style={{display:'flex', gap:'8px'}}>
          <button className="btn btn-secondary" disabled title="Coming Soon" style={{opacity: 0.7}}>
            <Plus size={16}/> Connect WhatsApp (Soon)
          </button>
          <button className="btn btn-primary" onClick={openConnect}><Plus size={16}/> Connect FB/IG</button>
        </div>
      </div>

      {loading ? <div className="card" style={{padding:'48px',textAlign:'center',color:'var(--text-secondary)'}}>Loading...</div>
      : pages.length === 0 ? (
        <div className="card"><div className="empty-state">
          <Globe className="empty-state-icon" />
          <h3>No Pages Connected</h3>
          <p>Connect a Facebook Page and Instagram Account to start receiving messages and sending AI-powered replies.</p>
          <button className="btn btn-primary" onClick={openConnect}><Plus size={16}/> Connect Page</button>
        </div></div>
      ) : pages.map((p) => (
        <div key={p.id} className="list-item" style={{opacity: p.is_active ? 1 : 0.5}}>
          <div className="provider-icon" style={{background:'rgba(66,103,178,0.15)',color:'#4267B2'}}><Globe size={18}/></div>
          <div className="list-item-content">
            <div className="list-item-title" style={{display:'flex', alignItems:'center', gap:'8px'}}>
              {p.page_name || p.page_id}
              {p.instagram_account_id && <span className="badge badge-success" style={{fontSize:'10px'}}>+ Instagram Connected</span>}
            </div>
            <div className="list-item-subtitle">FB ID: {p.page_id} {p.instagram_account_id ? `• IG ID: ${p.instagram_account_id}` : ''} • Connected {new Date(p.connected_at).toLocaleDateString()}</div>
          </div>
          <div className="list-item-actions">
            <span className={`badge ${p.is_active ? 'badge-success' : 'badge-error'}`}>{p.is_active ? 'Active' : 'Paused'}</span>
            <button className={`btn btn-sm ${p.is_active ? 'btn-secondary' : 'btn-danger'}`} onClick={() => toggle(p)}>{p.is_active ? 'Disable' : 'Enable'}</button>
            <button className="btn btn-sm btn-secondary" onClick={() => openEditPage(p)}>Edit Details</button>
            <button className="btn btn-sm btn-secondary" onClick={() => openSettings(p)}>AI Behaviour</button>
            <button className="btn-ghost btn-icon" onClick={() => del(p.id)}><Trash2 size={14}/></button>
          </div>
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit Meta Channel' : 'Connect Meta Channel'}</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Page ID</label>
                  <input className="form-input" placeholder="e.g., 123456789" value={pageId} onChange={e=>setPageId(e.target.value)} required />
                  <p className="form-hint">Found in your Meta Business Suite Page settings or Graph API Explorer</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Instagram Business Account ID (Optional)</label>
                  <input className="form-input" placeholder="e.g., 178414..." value={instagramId} onChange={e=>setInstagramId(e.target.value)} />
                  <p className="form-hint">Must be linked to this Facebook Page. Enables Instagram DM AI replies.</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Page Name</label>
                  <input className="form-input" placeholder="e.g., My Business Page" value={pageName} onChange={e=>setPageName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Page Access Token</label>
                  <textarea 
                    className="form-textarea" 
                    placeholder={editMode ? "Leave blank to keep existing token..." : "EAA..."} 
                    value={accessToken} 
                    onChange={e=>setAccessToken(e.target.value)} 
                    required={!editMode} 
                    style={{minHeight:'100px',fontFamily:'monospace',fontSize:'0.8rem'}} 
                  />
                  <p className="form-hint">Generate a long-lived Page Access Token from Facebook Developer Console</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <Save size={14}/>}
                  {saving ? 'Saving...' : (editMode ? 'Save Changes' : 'Connect Page')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettingsModal && selectedPage && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal" style={{maxWidth: '800px'}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>AI Behaviour</h2>
                <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px'}}>
                  Customize the AI for {selectedPage.page_name || selectedPage.page_id}
                </p>
              </div>
              <button className="btn-ghost btn-icon" onClick={() => setShowSettingsModal(false)}><X size={18}/></button>
            </div>
            <form onSubmit={saveSettings}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Bot Persona Name</label>
                  <input className="form-input" placeholder="e.g., Sarah from Support" value={botName} onChange={e=>setBotName(e.target.value)} />
                  <p className="form-hint">The name the AI uses when introducing itself (optional).</p>
                </div>
                
                <div className="form-group" style={{background: 'rgba(var(--primary-rgb), 0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px'}}>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={enableProfiling} onChange={e=>setEnableProfiling(e.target.checked)} />
                      <span className="slider"></span>
                    </label>
                    <div>
                      <h4 style={{margin: 0, fontSize: '0.95rem'}}>Enable Customer Profiling</h4>
                      <p className="form-hint" style={{margin: '4px 0 0 0'}}>Automatically extract and remember details about this customer to avoid hallucinations.</p>
                    </div>
                  </div>
                  
                  {enableProfiling && (
                    <div style={{marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)'}}>
                      <label className="form-label" style={{fontSize: '0.85rem'}}>Summarization details</label>
                      <p className="form-hint" style={{marginTop: '6px', fontSize: '0.75rem'}}>The summary model is configured by your platform administrator. It runs quietly in the background to build the profile without interrupting the chat.</p>
                    </div>
                  )}
                </div>

                <div className="form-group" style={{background: 'rgba(var(--error-rgb, 239, 68, 68), 0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px'}}>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={enableTrigger} onChange={e=>setEnableTrigger(e.target.checked)} />
                      <span className="slider"></span>
                    </label>
                    <div>
                      <h4 style={{margin: 0, fontSize: '0.95rem'}}>Human Takeover Triggers</h4>
                      <p className="form-hint" style={{margin: '4px 0 0 0'}}>Automatically pause the bot and reply with a canned response if certain words are said.</p>
                    </div>
                  </div>
                  
                  {enableTrigger && (
                    <div style={{marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)'}}>
                      <div className="form-group" style={{marginBottom: '12px'}}>
                        <label className="form-label" style={{fontSize: '0.85rem'}}>Trigger Words</label>
                        <div style={{
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: '6px', 
                          padding: '8px', 
                          border: '1px solid var(--border-light)', 
                          borderRadius: 'var(--radius-md)', 
                          background: 'var(--bg-primary)'
                        }}>
                          {triggerWords.map((word, idx) => (
                            <span key={idx} style={{
                              background: 'var(--bg-tertiary)',
                              padding: '2px 8px',
                              borderRadius: '16px',
                              fontSize: '0.8rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              border: '1px solid var(--border-primary)'
                            }}>
                              {word}
                              <button 
                                type="button" 
                                style={{background: 'none', border: 'none', padding: 0, cursor: 'pointer', opacity: 0.6, display: 'flex'}}
                                onClick={() => setTriggerWords(prev => prev.filter((_, i) => i !== idx))}
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                          <input 
                            style={{
                              border: 'none', 
                              background: 'transparent', 
                              flex: 1, 
                              minWidth: '120px', 
                              outline: 'none', 
                              fontSize: '0.85rem',
                              color: 'var(--text-primary)'
                            }}
                            placeholder={triggerWords.length === 0 ? "Type a phrase and press comma..." : ""}
                            value={triggerInput}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val.includes(',')) {
                                const parts = val.split(',');
                                const newWords = parts.slice(0, -1).map(p => p.trim()).filter(p => p);
                                if (newWords.length > 0) {
                                  setTriggerWords(prev => [...prev, ...newWords]);
                                }
                                setTriggerInput(parts[parts.length - 1].trimStart());
                              } else {
                                setTriggerInput(val);
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Backspace' && triggerInput === '' && triggerWords.length > 0) {
                                e.preventDefault();
                                const lastWord = triggerWords[triggerWords.length - 1];
                                setTriggerWords(prev => prev.slice(0, -1));
                                setTriggerInput(lastWord);
                              }
                            }}
                          />
                        </div>
                        <p className="form-hint" style={{marginTop: '4px'}}>Type a word or phrase and press comma (,) to add it as a trigger.</p>
                      </div>
                      <div className="form-group" style={{marginBottom: 0}}>
                        <label className="form-label" style={{fontSize: '0.85rem'}}>Predefined Responses (separated by --- on a new line)</label>
                        <textarea 
                          className="form-textarea" 
                          placeholder={"I need to transfer you to a human agent. Please hold on.\n---\nLet me get a manager for you."}
                          value={triggerResponses} 
                          onChange={e=>setTriggerResponses(e.target.value)}
                          style={{minHeight: '100px', fontSize: '0.85rem'}}
                        />
                        <p className="form-hint" style={{marginTop: '6px', fontSize: '0.75rem'}}>If multiple responses are provided, one will be chosen randomly.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom: '8px'}}>
                    <label className="form-label" style={{marginBottom: 0}}>Custom System Prompt</label>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={resetToDefault}>Reset to Default</button>
                  </div>
                  <textarea 
                    className="form-textarea" 
                    placeholder="Paste your markdown file or custom instructions here..." 
                    value={systemPrompt} 
                    onChange={e=>setSystemPrompt(e.target.value)} 
                    style={{minHeight:'350px', fontFamily:'monospace', fontSize:'0.85rem'}} 
                  />
                  <p className="form-hint">
                    This is the absolute core brain of the bot. It overrides the default instructions. You can write extensive rules, scenarios, and personality traits here.
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowSettingsModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <Save size={14}/>}
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showPricingModal && (
        <PricingModal 
          onClose={() => setShowPricingModal(false)} 
          initialChannels={channelsToBuy} 
        />
      )}
    </div>
  );
}
