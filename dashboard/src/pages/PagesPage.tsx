import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, Globe, X, Save, Loader2 } from 'lucide-react';

interface PageConn {
  id: string;
  page_id: string;
  page_name: string | null;
  is_active: boolean;
  connected_at: string;
  bot_name: string | null;
  custom_system_prompt: string | null;
}

export default function PagesPage() {
  const [pages, setPages] = useState<PageConn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingPageId, setEditingPageId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pageId, setPageId] = useState('');
  const [pageName, setPageName] = useState('');
  const [accessToken, setAccessToken] = useState('');

  // Bot Settings Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [selectedPage, setSelectedPage] = useState<PageConn | null>(null);
  const [botName, setBotName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');

  const DEFAULT_PROMPT = `You are a helpful, friendly, and professional AI assistant for this business on Facebook Messenger.

## Instructions
- Respond in a conversational, warm tone appropriate for Messenger.
- Keep responses concise — Messenger is a chat format, not an essay.
- If you do not know the answer, say so honestly. Do not make things up.
- Use the business information below to answer customer questions accurately.
- If a question is outside your knowledge, suggest the customer contact the business directly.
- NEVER reveal that you are an AI unless directly asked. Present yourself as a helpful representative.`;

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from('page_connections').select('*').order('connected_at', { ascending: false });
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
      });
      if (error) alert('Error: ' + error.message);
    }

    setSaving(false);
    setShowModal(false);
    load();
  }

  function openConnect() {
    setEditMode(false);
    setEditingPageId(null);
    setPageId('');
    setPageName('');
    setAccessToken('');
    setShowModal(true);
  }

  function openEditPage(p: PageConn) {
    setEditMode(true);
    setEditingPageId(p.id);
    setPageId(p.page_id);
    setPageName(p.page_name || '');
    setAccessToken(''); // Leave blank to not change
    setShowModal(true);
  }

  async function del(id: string) {
    if (!confirm('Disconnect this Facebook Page?')) return;
    await supabase.from('page_connections').delete().eq('id', id);
    load();
  }

  async function toggle(p: PageConn) {
    await supabase.from('page_connections').update({ is_active: !p.is_active }).eq('id', p.id);
    load();
  }

  function openSettings(p: PageConn) {
    setSelectedPage(p);
    setBotName(p.bot_name || '');
    setSystemPrompt(p.custom_system_prompt || DEFAULT_PROMPT);
    setShowSettingsModal(true);
  }

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    if (!selectedPage) return;
    setSaving(true);
    
    // If they reset to default, we can save null to use the worker's hardcoded default, 
    // or just save the exact text. Let's save the exact text if they edited it, 
    // or null if it exactly matches the default (to save DB space and rely on worker default).
    const promptToSave = systemPrompt.trim() === DEFAULT_PROMPT.trim() ? null : systemPrompt.trim();

    const { error } = await supabase.from('page_connections').update({
      bot_name: botName.trim() || null,
      custom_system_prompt: promptToSave || null
    }).eq('id', selectedPage.id);

    if (error) alert('Error: ' + error.message);
    setSaving(false);
    setShowSettingsModal(false);
    load();
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
          <h1>Facebook Pages</h1>
          <p>Connect your Facebook Pages to enable AI chatbot responses.</p>
        </div>
        <button className="btn btn-primary" onClick={openConnect}><Plus size={16}/> Connect Page</button>
      </div>

      {loading ? <div className="card" style={{padding:'48px',textAlign:'center',color:'var(--text-secondary)'}}>Loading...</div>
      : pages.length === 0 ? (
        <div className="card"><div className="empty-state">
          <Globe className="empty-state-icon" />
          <h3>No Pages Connected</h3>
          <p>Connect a Facebook Page to start receiving messages and sending AI-powered replies.</p>
          <button className="btn btn-primary" onClick={openConnect}><Plus size={16}/> Connect Page</button>
        </div></div>
      ) : pages.map((p) => (
        <div key={p.id} className="list-item" style={{opacity: p.is_active ? 1 : 0.5}}>
          <div className="provider-icon" style={{background:'rgba(66,103,178,0.15)',color:'#4267B2'}}><Globe size={18}/></div>
          <div className="list-item-content">
            <div className="list-item-title">{p.page_name || p.page_id}</div>
            <div className="list-item-subtitle">ID: {p.page_id} • Connected {new Date(p.connected_at).toLocaleDateString()}</div>
          </div>
          <div className="list-item-actions">
            <span className={`badge ${p.is_active ? 'badge-success' : 'badge-error'}`}>{p.is_active ? 'Active' : 'Inactive'}</span>
            <button className={`btn btn-sm ${p.is_active ? 'btn-secondary' : 'btn-danger'}`} onClick={() => toggle(p)}>{p.is_active ? 'Disable' : 'Enable'}</button>
            <button className="btn btn-sm btn-secondary" onClick={() => openEditPage(p)}>Edit Details</button>
            <button className="btn btn-sm btn-secondary" onClick={() => openSettings(p)}>Bot Settings</button>
            <button className="btn-ghost btn-icon" onClick={() => del(p.id)}><Trash2 size={14}/></button>
          </div>
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit Facebook Page' : 'Connect Facebook Page'}</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Page ID</label>
                  <input className="form-input" placeholder="e.g., 123456789" value={pageId} onChange={e=>setPageId(e.target.value)} required />
                  <p className="form-hint">Found in your Facebook Page's About section or Graph API Explorer</p>
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
                <h2>AI Bot Settings</h2>
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
    </div>
  );
}
