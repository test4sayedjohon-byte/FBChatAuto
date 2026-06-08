import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, X, Save, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import PricingModal from '../components/PricingModal';

// Brand Logo SVGs for high fidelity display
const FacebookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const WhatsAppIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.731-1.456L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.394 9.806-9.799.002-2.596-1.004-5.038-2.836-6.872a9.69 9.69 0 0 0-6.868-2.846c-5.41 0-9.81 4.403-9.813 9.81-.001 1.547.411 3.056 1.196 4.39l-.993 3.626 3.72-.976c1.328.724 2.775 1.106 4.293 1.106zm10.998-7.51c-.29-.145-1.716-.847-1.978-.942-.262-.096-.453-.145-.644.145-.191.29-.74.942-.907 1.133-.166.19-.333.215-.624.07-2.904-1.447-4.78-2.187-5.76-3.864-.262-.449.262-.417.75-1.393.083-.166.042-.31-.02-.455-.062-.145-.453-1.09-.62-1.492-.162-.392-.326-.339-.453-.346-.118-.006-.253-.008-.389-.008-.136 0-.356.05-.542.253-.187.203-.712.696-.712 1.699 0 1.003.729 1.973.83 2.112.102.139 1.434 2.19 3.476 3.07.485.209.864.334 1.157.427.488.156.933.134 1.285.08.393-.06 1.716-.7 1.958-1.378.243-.678.243-1.258.17-1.378-.073-.12-.262-.192-.553-.337z"/>
  </svg>
);

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
  whatsapp_business_account_id: string | null;
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
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('');
  const [whatsappBusinessAccountId, setWhatsappBusinessAccountId] = useState('');
  const [isWhatsappActive, setIsWhatsappActive] = useState(false);

  // Platform selection state
  const [selectedPlatform, setSelectedPlatform] = useState<'facebook' | 'instagram' | 'whatsapp' | null>(null);
  const [showSelectScreen, setShowSelectScreen] = useState(true);

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

  const location = useLocation();

  useEffect(() => {
    if (user) {
      load();
      
      const handleAgentUpdate = () => load();
      window.addEventListener('agent-data-updated', handleAgentUpdate);
      return () => window.removeEventListener('agent-data-updated', handleAgentUpdate);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && location.state?.autoConnect) {
      // Clear state so it doesn't reopen on subsequent manual page refreshes
      window.history.replaceState({}, document.title);
      openConnect();
    }
  }, [loading, location.state]);

  async function load() {
    if (!user) return;
    const { data, error } = await supabase
      .from('page_connections')
      .select('*')
      .eq('user_id', user.id)
      .order('connected_at', { ascending: false });
    if (error) {
      console.error('Error loading pages:', error);
      toast.error('Error loading pages: ' + error.message);
    }
    if (data) setPages(data);
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    let payload: any = {
      page_name: pageName.trim() || null,
    };

    if (accessToken.trim() !== '') {
      payload.access_token = accessToken.trim();
    }

    if (selectedPlatform === 'whatsapp') {
      payload.page_id = whatsappPhoneNumberId.trim();
      payload.whatsapp_phone_number_id = whatsappPhoneNumberId.trim();
      payload.whatsapp_business_account_id = whatsappBusinessAccountId.trim() || null;
      payload.is_whatsapp_active = isWhatsappActive;
      payload.instagram_account_id = null;
    } else if (selectedPlatform === 'instagram') {
      payload.page_id = pageId.trim();
      payload.instagram_account_id = instagramId.trim();
      payload.is_instagram_active = true;
      payload.whatsapp_phone_number_id = null;
      payload.whatsapp_business_account_id = null;
    } else {
      // Default to Facebook
      payload.page_id = pageId.trim();
      payload.instagram_account_id = null;
      payload.whatsapp_phone_number_id = null;
      payload.whatsapp_business_account_id = null;
    }

    if (editMode && editingPageId) {
      const { error } = await supabase.from('page_connections').update(payload).eq('id', editingPageId);
      if (error) toast.error('Error: ' + error.message);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in to connect a page.');
        setSaving(false);
        return;
      }
      payload.user_id = user.id;
      if (!payload.access_token) {
        payload.access_token = accessToken.trim();
      }
      const { error } = await supabase.from('page_connections').insert(payload);
      if (error) toast.error('Error: ' + error.message);
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
    setWhatsappPhoneNumberId('');
    setWhatsappBusinessAccountId('');
    setIsWhatsappActive(true);
    setSelectedPlatform(null);
    setShowSelectScreen(true);
    setShowModal(true);
  }

  function openEditPage(p: PageConn) {
    setEditMode(true);
    setEditingPageId(p.id);
    setPageId(p.page_id);
    setPageName(p.page_name || '');
    setAccessToken(''); // Leave blank to not change
    setInstagramId(p.instagram_account_id || '');
    setWhatsappPhoneNumberId(p.whatsapp_phone_number_id || '');
    setWhatsappBusinessAccountId(p.whatsapp_business_account_id || '');
    setIsWhatsappActive(p.is_whatsapp_active || false);

    if (p.whatsapp_phone_number_id) {
      setSelectedPlatform('whatsapp');
    } else if (p.instagram_account_id) {
      setSelectedPlatform('instagram');
    } else {
      setSelectedPlatform('facebook');
    }
    setShowSelectScreen(false);
    setShowModal(true);
  }

  async function del(id: string) {
    if (!confirm('Disconnect this Meta Channel connection?')) return;
    await supabase.from('page_connections').delete().eq('id', id);
    load();
  }

  async function toggle(p: PageConn) {
    const { error } = await supabase.from('page_connections').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) toast.error('Error toggling page: ' + error.message);
    load();
  }

  async function toggleWhatsApp(p: PageConn) {
    const { error } = await supabase.from('page_connections').update({ is_whatsapp_active: !p.is_whatsapp_active }).eq('id', p.id);
    if (error) toast.error('Error toggling WhatsApp: ' + error.message);
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
      toast.error('Error saving settings: ' + error.message);
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
          <p>Connect Facebook, Instagram, and WhatsApp channels to enable AI chatbot responses.</p>
        </div>
        <div style={{display:'flex', gap:'8px'}}>
          <button className="btn btn-primary" onClick={openConnect}>
            <Plus size={16}/> Connect Channel
          </button>
        </div>
      </div>

      {loading ? <div className="card" style={{padding:'48px',textAlign:'center',color:'var(--text-secondary)'}}>Loading...</div>
      : pages.length === 0 ? (
        <div className="card"><div className="empty-state">
          <X className="empty-state-icon" style={{color: 'var(--text-secondary)', opacity: 0.5}} />
          <h3>No Channels Connected</h3>
          <p>Connect a Facebook Page, Instagram Account, or WhatsApp Business number to start automating replies.</p>
          <button className="btn btn-primary" onClick={openConnect}>
            <Plus size={16}/> Connect Channel
          </button>
        </div></div>
      ) : pages.map((p) => {
        const isWhatsApp = !!p.whatsapp_phone_number_id;
        const isInstagram = !!p.instagram_account_id;
        
        let platformName = 'Facebook Page';
        let platformIcon = <FacebookIcon />;
        let iconBg = 'rgba(24,119,242,0.15)';
        let iconColor = '#1877F2';
        
        if (isWhatsApp) {
          platformName = 'WhatsApp Business';
          platformIcon = <WhatsAppIcon />;
          iconBg = 'rgba(37,211,102,0.15)';
          iconColor = '#25D366';
        } else if (isInstagram) {
          platformName = 'Instagram Business';
          platformIcon = <InstagramIcon />;
          iconBg = 'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)';
          iconColor = '#FFFFFF';
        }

        return (
          <div key={p.id} className="list-item" style={{opacity: p.is_active ? 1 : 0.5}}>
            <div className="provider-icon" style={{
              background: iconBg, 
              color: iconColor, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              borderRadius: '8px'
            }}>
              {platformIcon}
            </div>
            <div className="list-item-content">
              <div className="list-item-title" style={{display:'flex', alignItems:'center', gap:'8px'}}>
                {p.page_name || (isWhatsApp ? 'WhatsApp Number' : isInstagram ? 'Instagram Account' : 'Facebook Page')}
                <span className="badge" style={{
                  background: isInstagram ? 'rgba(225,48,108,0.1)' : iconBg, 
                  color: isInstagram ? '#E1306C' : iconColor, 
                  fontSize:'10px',
                  fontWeight: 600
                }}>
                  {platformName}
                </span>
              </div>
              <div className="list-item-subtitle" style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>
                {isWhatsApp ? (
                  <>Phone ID: {p.whatsapp_phone_number_id} • WABA ID: {p.whatsapp_business_account_id || 'N/A'}</>
                ) : isInstagram ? (
                  <>Instagram ID: {p.instagram_account_id} • Linked FB Page: {p.page_id}</>
                ) : (
                  <>Page ID: {p.page_id}</>
                )}
                {` • Connected ${new Date(p.connected_at).toLocaleDateString()}`}
              </div>
            </div>
            <div className="list-item-actions">
              {isWhatsApp ? (
                <>
                  <span className={`badge ${p.is_whatsapp_active ? 'badge-success' : 'badge-error'}`}>{p.is_whatsapp_active ? 'WA Active' : 'WA Paused'}</span>
                  <button className={`btn btn-sm ${p.is_whatsapp_active ? 'btn-secondary' : 'btn-danger'}`} onClick={() => toggleWhatsApp(p)}>{p.is_whatsapp_active ? 'Disable' : 'Enable'}</button>
                </>
              ) : isInstagram ? (
                <>
                  <span className={`badge ${p.is_instagram_active ? 'badge-success' : 'badge-error'}`}>{p.is_instagram_active ? 'IG Active' : 'IG Paused'}</span>
                  <button className={`btn btn-sm ${p.is_instagram_active ? 'btn-secondary' : 'btn-danger'}`} onClick={() => toggle(p)}>{p.is_instagram_active ? 'Disable' : 'Enable'}</button>
                </>
              ) : (
                <>
                  <span className={`badge ${p.is_active ? 'badge-success' : 'badge-error'}`}>{p.is_active ? 'FB Active' : 'FB Paused'}</span>
                  <button className={`btn btn-sm ${p.is_active ? 'btn-secondary' : 'btn-danger'}`} onClick={() => toggle(p)}>{p.is_active ? 'Disable' : 'Enable'}</button>
                </>
              )}
              
              <button className="btn btn-sm btn-secondary" onClick={() => openEditPage(p)}>Edit Details</button>
              <button className="btn btn-sm btn-secondary" onClick={() => openSettings(p)}>AI Behaviour</button>
              <button className="btn-ghost btn-icon" onClick={() => del(p.id)}><Trash2 size={14}/></button>
            </div>
          </div>
        );
      })}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth: showSelectScreen ? '500px' : '600px'}}>
            <div className="modal-header">
              <h2>
                {editMode 
                  ? `Edit ${selectedPlatform === 'whatsapp' ? 'WhatsApp' : selectedPlatform === 'instagram' ? 'Instagram' : 'Facebook'} Connection` 
                  : (showSelectScreen ? 'Connect Meta Channel' : `Connect ${selectedPlatform === 'whatsapp' ? 'WhatsApp' : selectedPlatform === 'instagram' ? 'Instagram' : 'Facebook'}`)}
              </h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            
            {showSelectScreen ? (
              <div className="modal-body" style={{display:'flex', flexDirection:'column', gap:'16px', paddingBottom:'24px'}}>
                <p style={{color:'var(--text-secondary)', fontSize:'0.85rem', margin: '0 0 8px 0'}}>
                  Choose the type of connection you want to set up:
                </p>
                <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                  
                  {/* Facebook Selection Button */}
                  <button 
                    type="button" 
                    onClick={() => { setSelectedPlatform('facebook'); setShowSelectScreen(false); }}
                    style={{
                      display:'flex', alignItems:'center', gap:'16px', padding:'16px', 
                      border:'1px solid var(--border-color)', borderRadius:'8px', background:'rgba(24,119,242,0.03)', 
                      textAlign:'left', cursor:'pointer', width: '100%', outline: 'none'
                    }}
                  >
                    <div style={{color:'#1877F2', background:'rgba(24,119,242,0.12)', padding:'10px', borderRadius:'8px', display:'flex'}}>
                      <FacebookIcon />
                    </div>
                    <div>
                      <h4 style={{margin:0, fontWeight:600, color:'var(--text-primary)', fontSize: '0.95rem'}}>Facebook Page</h4>
                      <p style={{margin:'4px 0 0 0', fontSize:'0.75rem', color:'var(--text-secondary)'}}>Connect a Page to automate Messenger chat.</p>
                    </div>
                  </button>

                  {/* Instagram Selection Button */}
                  <button 
                    type="button" 
                    onClick={() => { setSelectedPlatform('instagram'); setShowSelectScreen(false); }}
                    style={{
                      display:'flex', alignItems:'center', gap:'16px', padding:'16px', 
                      border:'1px solid var(--border-color)', borderRadius:'8px', background:'rgba(225,48,108,0.03)', 
                      textAlign:'left', cursor:'pointer', width: '100%', outline: 'none'
                    }}
                  >
                    <div style={{
                      background:'radial-gradient(circle at 30% 107%, #fdf497 0%, #fdf497 5%, #fd5949 45%, #d6249f 60%, #285AEB 90%)', 
                      color:'#FFFFFF', padding:'10px', borderRadius:'8px', display:'flex'
                    }}>
                      <InstagramIcon />
                    </div>
                    <div>
                      <h4 style={{margin:0, fontWeight:600, color:'var(--text-primary)', fontSize: '0.95rem'}}>Instagram Business</h4>
                      <p style={{margin:'4px 0 0 0', fontSize:'0.75rem', color:'var(--text-secondary)'}}>Automate Instagram DMs and comments.</p>
                    </div>
                  </button>

                  {/* WhatsApp Selection Button */}
                  <button 
                    type="button" 
                    onClick={() => { setSelectedPlatform('whatsapp'); setShowSelectScreen(false); }}
                    style={{
                      display:'flex', alignItems:'center', gap:'16px', padding:'16px', 
                      border:'1px solid var(--border-color)', borderRadius:'8px', background:'rgba(37,211,102,0.03)', 
                      textAlign:'left', cursor:'pointer', width: '100%', outline: 'none'
                    }}
                  >
                    <div style={{color:'#25D366', background:'rgba(37,211,102,0.12)', padding:'10px', borderRadius:'8px', display:'flex'}}>
                      <WhatsAppIcon />
                    </div>
                    <div>
                      <h4 style={{margin:0, fontWeight:600, color:'var(--text-primary)', fontSize: '0.95rem'}}>WhatsApp Business</h4>
                      <p style={{margin:'4px 0 0 0', fontSize:'0.75rem', color:'var(--text-secondary)'}}>Connect a phone number via Meta Cloud API.</p>
                    </div>
                  </button>

                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  
                  {/* WhatsApp Form Inputs */}
                  {selectedPlatform === 'whatsapp' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">WhatsApp Display Name</label>
                        <input className="form-input" placeholder="e.g., Support Number" value={pageName} onChange={e=>setPageName(e.target.value)} />
                        <p className="form-hint">A label to identify this number in the dashboard.</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">WhatsApp Phone Number ID</label>
                        <input className="form-input" placeholder="e.g., 106540352242922" value={whatsappPhoneNumberId} onChange={e=>setWhatsappPhoneNumberId(e.target.value)} required />
                        <p className="form-hint">Found under WhatsApp API Setup in the Meta Developer Console.</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">WhatsApp Business Account ID</label>
                        <input className="form-input" placeholder="e.g., 102290129340398" value={whatsappBusinessAccountId} onChange={e=>setWhatsappBusinessAccountId(e.target.value)} required />
                        <p className="form-hint">The parent WABA ID linked to your Business Manager.</p>
                      </div>
                      <div className="form-group" style={{background: 'rgba(37,211,102,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', marginBottom: '16px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                          <label className="toggle-switch">
                            <input type="checkbox" checked={isWhatsappActive} onChange={e=>setIsWhatsappActive(e.target.checked)} />
                            <span className="slider"></span>
                          </label>
                          <div>
                            <h4 style={{margin: 0, fontSize: '0.9rem', fontWeight: 600}}>WhatsApp Bot Active</h4>
                            <p className="form-hint" style={{margin: '2px 0 0 0', fontSize: '0.75rem'}}>Allow the AI bot to automate replies for this WhatsApp number.</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Instagram Form Inputs */}
                  {selectedPlatform === 'instagram' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Instagram Profile Name</label>
                        <input className="form-input" placeholder="e.g., My Brand Instagram" value={pageName} onChange={e=>setPageName(e.target.value)} />
                        <p className="form-hint">A label to identify this account.</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Instagram Business Account ID</label>
                        <input className="form-input" placeholder="e.g., 178414..." value={instagramId} onChange={e=>setInstagramId(e.target.value)} required />
                        <p className="form-hint">The specific Instagram Business Account ID from Meta.</p>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Linked Facebook Page ID</label>
                        <input className="form-input" placeholder="e.g., 123456789" value={pageId} onChange={e=>setPageId(e.target.value)} required />
                        <p className="form-hint">Instagram accounts must be linked to a Facebook Page to use the Messenger API.</p>
                      </div>
                    </>
                  )}

                  {/* Facebook Form Inputs */}
                  {selectedPlatform === 'facebook' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">Page Name</label>
                        <input className="form-input" placeholder="e.g., My Business Page" value={pageName} onChange={e=>setPageName(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Facebook Page ID</label>
                        <input className="form-input" placeholder="e.g., 123456789" value={pageId} onChange={e=>setPageId(e.target.value)} required />
                        <p className="form-hint">Found in your Page Settings or Meta Developer Console.</p>
                      </div>
                    </>
                  )}

                  {/* Common Access Token Field */}
                  <div className="form-group">
                    <label className="form-label">
                      {selectedPlatform === 'whatsapp' ? 'System User Token / Access Token' : 'Page Access Token'}
                    </label>
                    <textarea 
                      className="form-textarea" 
                      placeholder={editMode ? "Leave blank to keep existing token..." : "EAA..."} 
                      value={accessToken} 
                      onChange={e=>setAccessToken(e.target.value)} 
                      required={!editMode} 
                      style={{minHeight:'100px',fontFamily:'monospace',fontSize:'0.75rem'}} 
                    />
                    <p className="form-hint">
                      {selectedPlatform === 'whatsapp' 
                        ? 'Meta system user access token with whatsapp_business_messaging permissions.'
                        : 'Long-lived access token generated from Facebook Developer Console.'}
                    </p>
                  </div>

                </div>
                <div className="modal-footer" style={{display: 'flex', justifyContent: 'space-between'}}>
                  <div>
                    {!editMode && (
                      <button type="button" className="btn btn-secondary" onClick={() => { setShowSelectScreen(true); setSelectedPlatform(null); }}>
                        Back
                      </button>
                    )}
                  </div>
                  <div style={{display: 'flex', gap: '8px'}}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <Save size={14}/>}
                      {saving ? 'Saving...' : (editMode ? 'Save Changes' : 'Connect Channel')}
                    </button>
                  </div>
                </div>
              </form>
            )}
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
