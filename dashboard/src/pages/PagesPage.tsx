import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, X, Save, Loader2, RefreshCw, Check, AlertCircle, Key } from 'lucide-react';
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
  token_status?: string | null;
  token_last_checked_at?: string | null;
  follow_up_enabled?: boolean;
  follow_up_delay_minutes?: number;
  follow_up_prompt?: string | null;
  follow_up_max_count?: number;
  follow_up_min_score?: number;
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
    const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [setupType, setSetupType] = useState<'auto' | 'facebook' | 'instagram' | 'whatsapp' | null>(null);

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
  const [followUpEnabled, setFollowUpEnabled] = useState(false);
  const [followUpDelayMinutes, setFollowUpDelayMinutes] = useState(60);
  const [followUpPrompt, setFollowUpPrompt] = useState('');
  const [followUpMaxCount, setFollowUpMaxCount] = useState(1);
  const [followUpMinScore, setFollowUpMinScore] = useState(1);

  // Meta Auto-Discovery / Import scanner state
    const [metaToken, setMetaToken] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState<'idle' | 'pages' | 'instagram' | 'whatsapp' | 'completed' | 'error'>('idle');
  const [scanError, setScanError] = useState('');
  
  const [discoveredPages, setDiscoveredPages] = useState<any[]>([]);
  const [discoveredInstagrams, setDiscoveredInstagrams] = useState<any[]>([]);
  const [discoveredWhatsApp, setDiscoveredWhatsApp] = useState<any[]>([]);
  
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [selectedInstagrams, setSelectedInstagrams] = useState<string[]>([]);
  const [selectedWhatsApp, setSelectedWhatsApp] = useState<string[]>([]);

  const DEFAULT_PROMPT = `You are a helpful, friendly, and professional AI assistant for this business on Facebook Messenger.

## Instructions
- Respond in a conversational, warm tone appropriate for Messenger.
- Keep responses concise — Messenger is a chat format, not an essay.
- If you do not know the answer, say so honestly. Do not make things up.
- Use the business information below to answer customer questions accurately.
- If a question is outside your knowledge, suggest the customer contact the business directly.
- NEVER reveal that you are an AI unless directly asked. Present yourself as a helpful representative.`;

  async function handleScanMeta(): Promise<boolean> {
    if (!metaToken.trim()) {
      toast.error('Please enter a valid Meta Access Token.');
      return false;
    }
    setScanning(true);
    setScanError('');
    setDiscoveredPages([]);
    setDiscoveredInstagrams([]);
    setDiscoveredWhatsApp([]);
    setSelectedPages([]);
    setSelectedInstagrams([]);
    setSelectedWhatsApp([]);
    
    const token = metaToken.trim();
    
    // 1. Scan Facebook Pages
    setScanStep('pages');
    let pagesFound: any[] = [];
    try {
      const pagesRes = await fetch(`https://graph.facebook.com/v21.0/me/accounts?fields=id,name,access_token,category&limit=100&access_token=${token}`);
      if (!pagesRes.ok) {
        const err = await pagesRes.json();
        throw new Error(err.error?.message || 'Failed to fetch Facebook Pages.');
      }
      const pagesData = await pagesRes.json();
      pagesFound = pagesData.data || [];
      setDiscoveredPages(pagesFound);
    } catch (e: any) {
      console.error(e);
      setScanError(`Error scanning Facebook Pages: ${e.message}`);
      setScanStep('error');
      setScanning(false);
      return false;
    }
    
    // 2. Scan Instagram Business Accounts linked to Pages
    setScanStep('instagram');
    const igFound: any[] = [];
    for (const page of pagesFound) {
      try {
        const igRes = await fetch(`https://graph.facebook.com/v21.0/${page.id}?fields=instagram_business_account{id,username,name}&access_token=${page.access_token}`);
        if (igRes.ok) {
          const igData = await igRes.json();
          if (igData.instagram_business_account) {
            igFound.push({
              id: igData.instagram_business_account.id,
              username: igData.instagram_business_account.username || igData.instagram_business_account.name || 'Instagram Account',
              linked_page_id: page.id,
              linked_page_name: page.name,
              access_token: page.access_token
            });
          }
        }
      } catch (e) {
        console.warn(`Error scanning Instagram for page ${page.id}:`, e);
      }
    }
    setDiscoveredInstagrams(igFound);
    
    // 3. Scan WhatsApp Business accounts
    setScanStep('whatsapp');
    const waFound: any[] = [];
    try {
      const wabaRes = await fetch(`https://graph.facebook.com/v21.0/me/whatsapp_business_accounts?fields=id,name&access_token=${token}`);
      let wabas: any[] = [];
      if (wabaRes.ok) {
        const wabaData = await wabaRes.json();
        wabas = wabaData.data || [];
      } else {
        const bizRes = await fetch(`https://graph.facebook.com/v21.0/me/businesses?access_token=${token}`);
        if (bizRes.ok) {
          const bizData = await bizRes.json();
          const businesses = bizData.data || [];
          for (const biz of businesses) {
            const bizWabaRes = await fetch(`https://graph.facebook.com/v21.0/${biz.id}/whatsapp_business_accounts?fields=id,name&access_token=${token}`);
            if (bizWabaRes.ok) {
              const bizWabaData = await bizWabaRes.json();
              wabas = [...wabas, ...(bizWabaData.data || [])];
            }
          }
        }
      }
      
      const uniqueWabas = Array.from(new Map(wabas.map(w => [w.id, w])).values());
      
      for (const waba of uniqueWabas) {
        const phoneRes = await fetch(`https://graph.facebook.com/v21.0/${waba.id}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${token}`);
        if (phoneRes.ok) {
          const phoneData = await phoneRes.json();
          const phones = phoneData.data || [];
          for (const phone of phones) {
            waFound.push({
              phone_number_id: phone.id,
              display_phone_number: phone.display_phone_number,
              verified_name: phone.verified_name || waba.name || 'WhatsApp Business',
              waba_id: waba.id,
              access_token: token
            });
          }
        }
      }
    } catch (e) {
      console.warn('WhatsApp scanning failed:', e);
    }
    setDiscoveredWhatsApp(waFound);
    
    setScanStep('completed');
    setScanning(false);
    return true;
  }

  async function upsertPageConnection(payload: any) {
    const { data: existing } = await supabase
      .from('page_connections')
      .select('id')
      .eq('user_id', payload.user_id)
      .eq('page_id', payload.page_id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('page_connections')
        .update(payload)
        .eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('page_connections')
        .insert(payload);
      if (error) throw error;
    }
  }

  async function handleImportSelected() {
    if (!user) return;
    setSaving(true);
    let successCount = 0;
    
    // Import Pages
    for (const pageId of selectedPages) {
      const page = discoveredPages.find(p => p.id === pageId);
      if (!page) continue;
      try {
        await upsertPageConnection({
          user_id: user.id,
          page_id: page.id,
          page_name: page.name,
          access_token: page.access_token,
          is_active: true,
          connected_at: new Date().toISOString()
        });

        // Automatically subscribe the page to the app (for messages and feed webhooks)
        try {
          await fetch(`https://graph.facebook.com/v21.0/${page.id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_echoes,feed&access_token=${page.access_token}`, {
            method: 'POST'
          });
        } catch (subErr) {
          console.warn('Programmatic FB page subscription failed:', subErr);
        }

        successCount++;
      } catch (err: any) {
        console.error(`Error importing page ${page.name}:`, err.message);
        toast.error(`Error importing page ${page.name}: ${err.message}`);
      }
    }
    
    // Import Instagram
    for (const igId of selectedInstagrams) {
      const ig = discoveredInstagrams.find(i => i.id === igId);
      if (!ig) continue;
      try {
        const { data: existing } = await supabase
          .from('page_connections')
          .select('id')
          .eq('user_id', user.id)
          .eq('page_id', ig.linked_page_id)
          .maybeSingle();
          
        if (existing) {
          const { error } = await supabase
            .from('page_connections')
            .update({
              instagram_account_id: ig.id,
              is_instagram_active: true,
              is_active: true, // Auto-connect FB side too
              access_token: ig.access_token
            })
            .eq('id', existing.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('page_connections').insert({
            user_id: user.id,
            page_id: ig.linked_page_id,
            page_name: ig.username,
            access_token: ig.access_token,
            instagram_account_id: ig.id,
            is_instagram_active: true,
            is_active: true // Auto-connect FB side too
          });
          if (error) throw error;
        }

        // Automatically subscribe the linked FB page to the app
        try {
          await fetch(`https://graph.facebook.com/v21.0/${ig.linked_page_id}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_echoes,feed&access_token=${ig.access_token}`, {
            method: 'POST'
          });
        } catch (subErr) {
          console.warn('Programmatic FB page subscription failed for Instagram:', subErr);
        }

        successCount++;
      } catch (err: any) {
        console.error(`Error importing Instagram ${ig.username}:`, err.message);
        toast.error(`Error importing Instagram ${ig.username}: ${err.message}`);
      }
    }
    
    // Import WhatsApp
    for (const waId of selectedWhatsApp) {
      const wa = discoveredWhatsApp.find(w => w.phone_number_id === waId);
      if (!wa) continue;
      try {
        await upsertPageConnection({
          user_id: user.id,
          page_id: wa.phone_number_id,
          page_name: wa.verified_name,
          access_token: wa.access_token,
          whatsapp_phone_number_id: wa.phone_number_id,
          whatsapp_business_account_id: wa.waba_id,
          is_whatsapp_active: true,
          is_active: true, // Keep it active for general connectivity
          connected_at: new Date().toISOString()
        });
        successCount++;
      } catch (err: any) {
        console.error(`Error importing WhatsApp ${wa.verified_name}:`, err.message);
        toast.error(`Error importing WhatsApp ${wa.verified_name}: ${err.message}`);
      }
    }
    
    setSaving(false);
    setShowModal(false);
    toast.success(`Successfully connected ${successCount} Meta Channels!`);
    load();
  }

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
      payload.is_active = true;
    } else if (selectedPlatform === 'instagram') {
      payload.page_id = pageId.trim();
      payload.instagram_account_id = instagramId.trim();
      payload.is_instagram_active = true;
      payload.whatsapp_phone_number_id = null;
      payload.whatsapp_business_account_id = null;
      payload.is_active = true;
    } else {
      // Default to Facebook
      payload.page_id = pageId.trim();
      payload.instagram_account_id = null;
      payload.whatsapp_phone_number_id = null;
      payload.whatsapp_business_account_id = null;
      payload.is_active = true;
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

    // Programmatically subscribe the Facebook page to the app if a token is present
    const finalToken = payload.access_token || accessToken.trim();
    if (finalToken && selectedPlatform !== 'whatsapp') {
      const pageIdToSubscribe = pageId.trim();
      if (pageIdToSubscribe) {
        try {
          await fetch(`https://graph.facebook.com/v21.0/${pageIdToSubscribe}/subscribed_apps?subscribed_fields=messages,messaging_postbacks,message_echoes,feed&access_token=${finalToken}`, {
            method: 'POST'
          });
        } catch (subErr) {
          console.warn('Programmatic FB page subscription failed in manual setup:', subErr);
        }
      }
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
            setWizardStep(1);
    setSetupType(null);
    setMetaToken('');
    setScanning(false);
    setScanStep('idle');
    setScanError('');
    setDiscoveredPages([]);
    setDiscoveredInstagrams([]);
    setDiscoveredWhatsApp([]);
    setSelectedPages([]);
    setSelectedInstagrams([]);
    setSelectedWhatsApp([]);
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

  async function toggleInstagram(p: PageConn) {
    const { error } = await supabase.from('page_connections').update({ is_instagram_active: !p.is_instagram_active }).eq('id', p.id);
    if (error) toast.error('Error toggling Instagram: ' + error.message);
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
    setFollowUpEnabled(p.follow_up_enabled || false);
    setFollowUpDelayMinutes(p.follow_up_delay_minutes ?? 60);
    setFollowUpPrompt(p.follow_up_prompt || '');
    setFollowUpMaxCount(p.follow_up_max_count ?? 1);
    setFollowUpMinScore(p.follow_up_min_score ?? 1);
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
      trigger_responses: tResponses.length > 0 ? tResponses : ["I need to transfer you to a human agent. Please hold on."],
      follow_up_enabled: followUpEnabled,
      follow_up_delay_minutes: followUpDelayMinutes,
      follow_up_prompt: followUpPrompt.trim() || null,
      follow_up_max_count: followUpMaxCount,
      follow_up_min_score: followUpMinScore
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
              <div className="list-item-title" style={{display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap'}}>
                {p.page_name || (isWhatsApp ? 'WhatsApp Number' : isInstagram ? 'Instagram Account' : 'Facebook Page')}
                <span className="badge" style={{
                  background: isInstagram ? 'rgba(225,48,108,0.1)' : iconBg, 
                  color: isInstagram ? '#E1306C' : iconColor, 
                  fontSize:'10px',
                  fontWeight: 600
                }}>
                  {platformName}
                </span>
                {p.token_status === 'expired' && (
                  <span className="badge badge-error" style={{ fontSize: '10px', fontWeight: 600, background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                    Token Expired
                  </span>
                )}
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
                  <button className={`btn btn-sm ${p.is_instagram_active ? 'btn-secondary' : 'btn-danger'}`} onClick={() => toggleInstagram(p)}>{p.is_instagram_active ? 'Disable' : 'Enable'}</button>
                </>
              ) : (
                <>
                  <span className={`badge ${p.is_active ? 'badge-success' : 'badge-error'}`}>{p.is_active ? 'FB Active' : 'FB Paused'}</span>
                  <button className={`btn btn-sm ${p.is_active ? 'btn-secondary' : 'btn-danger'}`} onClick={() => toggle(p)}>{p.is_active ? 'Disable' : 'Enable'}</button>
                </>
              )}
              
              <button 
                className={`btn btn-sm ${p.token_status === 'expired' ? 'btn-danger' : 'btn-secondary'}`} 
                onClick={() => openEditPage(p)}
              >
                {p.token_status === 'expired' ? 'Reconnect Channel' : 'Edit Details'}
              </button>
              <button className="btn btn-sm btn-secondary" onClick={() => openSettings(p)}>AI Behaviour</button>
              <button className="btn-ghost btn-icon" onClick={() => del(p.id)}><Trash2 size={14}/></button>
            </div>
          </div>
        );
      })}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e=>e.stopPropagation()} style={{maxWidth: editMode ? '600px' : '650px'}}>
            <div className="modal-header">
              <h2>
                {editMode 
                  ? `Edit ${selectedPlatform === 'whatsapp' ? 'WhatsApp' : selectedPlatform === 'instagram' ? 'Instagram' : 'Facebook'} Connection` 
                  : 'Connect Meta Channels'}
              </h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            
            {editMode ? (
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {/* WhatsApp Form Inputs */}
                  {selectedPlatform === 'whatsapp' && (
                    <>
                      <div className="form-group">
                        <label className="form-label">WhatsApp Display Name</label>
                        <input className="form-input" placeholder="e.g., Support Number" value={pageName} onChange={e=>setPageName(e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">WhatsApp Phone Number ID</label>
                        <input className="form-input" placeholder="e.g., 106540352242922" value={whatsappPhoneNumberId} onChange={e=>setWhatsappPhoneNumberId(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">WhatsApp Business Account ID</label>
                        <input className="form-input" placeholder="e.g., 102290129340398" value={whatsappBusinessAccountId} onChange={e=>setWhatsappBusinessAccountId(e.target.value)} required />
                      </div>
                      <div className="form-group" style={{background: 'rgba(37,211,102,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', marginBottom: '16px'}}>
                        <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                          <label className="toggle-switch">
                            <input type="checkbox" checked={isWhatsappActive} onChange={e=>setIsWhatsappActive(e.target.checked)} />
                            <span className="slider"></span>
                          </label>
                          <div>
                            <h4 style={{margin: 0, fontSize: '0.9rem', fontWeight: 600}}>WhatsApp Bot Active</h4>
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
                      </div>
                      <div className="form-group">
                        <label className="form-label">Instagram Business Account ID</label>
                        <input className="form-input" placeholder="e.g., 178414..." value={instagramId} onChange={e=>setInstagramId(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Linked Facebook Page ID</label>
                        <input className="form-input" placeholder="e.g., 123456789" value={pageId} onChange={e=>setPageId(e.target.value)} required />
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
                      </div>
                    </>
                  )}

                  {/* Common Access Token Field */}
                  <div className="form-group">
                    <label className="form-label">Page Access Token</label>
                    <textarea 
                      className="form-textarea" 
                      placeholder="Leave blank to keep existing token..." 
                      value={accessToken} 
                      onChange={e=>setAccessToken(e.target.value)} 
                      style={{minHeight:'100px',fontFamily:'monospace',fontSize:'0.75rem'}} 
                    />
                  </div>
                </div>
                <div className="modal-footer" style={{display: 'flex', justifyContent: 'flex-end', gap: '8px'}}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <Save size={14}/>}
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="modal-body" style={{paddingTop: '8px'}}>
                {!editMode && wizardStep === 1 && (
                  <div className="animate-slideUp">
                    <h3 style={{fontSize: '1rem', marginBottom: '16px'}}>Choose Setup Method</h3>
                    <p style={{color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px'}}>
                      AutometaBot uses a Bring Your Own App (BYOA) architecture for maximum privacy and control. Choose how you want to connect:
                    </p>
                    <div style={{display:'flex', flexDirection:'column', gap:'12px'}}>
                      {/* Auto Setup Button */}
                      <button
                        type="button"
                        onClick={() => setSetupType('auto')}
                        style={{
                          display:'flex', alignItems:'center', gap:'16px', padding:'16px',
                          border: setupType === 'auto' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                          borderRadius:'8px', background:'var(--bg-tertiary)',
                          textAlign:'left', cursor:'pointer', width: '100%', outline: 'none'
                        }}
                      >
                        <div style={{color:'var(--text-primary)', padding:'10px', borderRadius:'8px', display:'flex', fontSize: '1.5rem'}}>
                          ⚡
                        </div>
                        <div>
                          <h4 style={{margin:0, fontWeight:600, color:'var(--text-primary)', fontSize: '0.95rem'}}>Automatic Setup</h4>
                          <p style={{margin:'4px 0 0 0', fontSize:'0.75rem', color:'var(--text-secondary)'}}>Scan your Meta account to auto-discover channels.</p>
                        </div>
                      </button>

                      {/* Facebook Selection Button */}
                      <button
                        type="button"
                        onClick={() => setSetupType('facebook')}
                        style={{
                          display:'flex', alignItems:'center', gap:'16px', padding:'16px',
                          border: setupType === 'facebook' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                          borderRadius:'8px', background:'rgba(24,119,242,0.03)',
                          textAlign:'left', cursor:'pointer', width: '100%', outline: 'none'
                        }}
                      >
                        <div style={{color:'#1877F2', background:'rgba(24,119,242,0.12)', padding:'10px', borderRadius:'8px', display:'flex'}}>
                          <FacebookIcon />
                        </div>
                        <div>
                          <h4 style={{margin:0, fontWeight:600, color:'var(--text-primary)', fontSize: '0.95rem'}}>Facebook Page</h4>
                          <p style={{margin:'4px 0 0 0', fontSize:'0.75rem', color:'var(--text-secondary)'}}>Connect a Page manually (BYOA).</p>
                        </div>
                      </button>

                      {/* Instagram Selection Button */}
                      <button
                        type="button"
                        onClick={() => setSetupType('instagram')}
                        style={{
                          display:'flex', alignItems:'center', gap:'16px', padding:'16px',
                          border: setupType === 'instagram' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                          borderRadius:'8px', background:'rgba(225,48,108,0.03)',
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
                          <p style={{margin:'4px 0 0 0', fontSize:'0.75rem', color:'var(--text-secondary)'}}>Connect Instagram manually (BYOA).</p>
                        </div>
                      </button>

                      {/* WhatsApp Selection Button */}
                      <button
                        type="button"
                        onClick={() => setSetupType('whatsapp')}
                        style={{
                          display:'flex', alignItems:'center', gap:'16px', padding:'16px',
                          border: setupType === 'whatsapp' ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                          borderRadius:'8px', background:'rgba(37,211,102,0.03)',
                          textAlign:'left', cursor:'pointer', width: '100%', outline: 'none'
                        }}
                      >
                        <div style={{color:'#25D366', background:'rgba(37,211,102,0.12)', padding:'10px', borderRadius:'8px', display:'flex'}}>
                          <WhatsAppIcon />
                        </div>
                        <div>
                          <h4 style={{margin:0, fontWeight:600, color:'var(--text-primary)', fontSize: '0.95rem'}}>WhatsApp Business</h4>
                          <p style={{margin:'4px 0 0 0', fontSize:'0.75rem', color:'var(--text-secondary)'}}>Connect WhatsApp manually (BYOA).</p>
                        </div>
                      </button>
                    </div>

                    <div className="modal-footer" style={{display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px'}}>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          if (setupType) {
                                                        if (setupType !== 'auto') {
                              setSelectedPlatform(setupType);
                            }
                            setWizardStep(2);
                          }
                        }}
                        disabled={!setupType}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {!editMode && wizardStep === 2 && setupType === 'auto' && (
                  <div className="animate-slideUp">
                    <div className="form-group">
                      <label className="form-label" style={{display:'flex', alignItems:'center', gap:'6px'}}>
                        <Key size={14} /> Meta System User Access Token / Admin Token
                      </label>
                      <div style={{display:'flex', gap:'8px'}}>
                        <input 
                          type="password"
                          className="form-input" 
                          placeholder="Paste your Meta system user or admin access token..." 
                          value={metaToken}
                          onChange={e=>setMetaToken(e.target.value)}
                          disabled={scanning}
                        />
                        <button 
                          type="button" 
                          className="btn btn-primary" 
                          onClick={() => {
                            handleScanMeta().then((success) => {
                                if (success) {
                                    setWizardStep(3);
                                }
                            });
                          }}
                          disabled={scanning || !metaToken.trim()}
                          style={{whiteSpace: 'nowrap'}}
                        >
                          {scanning ? <RefreshCw size={14} style={{animation:'spin 1s linear infinite'}}/> : <RefreshCw size={14} />}
                          {scanning ? 'Scanning...' : 'Scan Account'}
                        </button>
                      </div>
                      <p className="form-hint">Enter your System User Token with Pages & WhatsApp permissions to auto-discover channels.</p>
                    </div>

                    {scanning && (
                      <div style={{background: 'var(--bg-tertiary)', border:'1px solid var(--border-color)', borderRadius:'8px', padding:'16px', display:'flex', flexDirection:'column', gap:'12px', marginBottom:'16px'}}>
                        <div style={{display:'flex', alignItems:'center', gap:'8px', fontSize:'0.9rem', color:'var(--text-primary)'}}>
                          <Loader2 size={16} style={{animation:'spin 1s linear infinite', color: 'var(--accent-primary)'}} />
                          <strong>Scanning Meta Account...</strong>
                        </div>
                        <div style={{fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft:'24px', display:'flex', flexDirection:'column', gap:'6px'}}>
                          <div style={{opacity: scanStep === 'pages' ? 1 : 0.6}}>
                            {scanStep === 'pages' ? '➡️' : '✅'} Discovered Facebook Pages...
                          </div>
                          <div style={{opacity: scanStep === 'instagram' ? 1 : (scanStep === 'pages' ? 0.3 : 0.6)}}>
                            {scanStep === 'instagram' ? '➡️' : (scanStep === 'pages' ? '⏳' : '✅')} Checking linked Instagram Business Accounts...
                          </div>
                          <div style={{opacity: scanStep === 'whatsapp' ? 1 : (scanStep === 'completed' ? 0.6 : 0.3)}}>
                            {scanStep === 'whatsapp' ? '➡️' : (scanStep === 'completed' ? '✅' : '⏳')} Finding WhatsApp Business Numbers...
                          </div>
                        </div>
                      </div>
                    )}

                    {scanError && (
                      <div style={{background: 'rgba(239,68,68,0.05)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'8px', padding:'12px', color:'#EF4444', fontSize:'0.85rem', display:'flex', gap:'8px', alignItems:'flex-start', marginBottom:'16px'}}>
                        <AlertCircle size={16} style={{flexShrink: 0, marginTop: '2px'}} />
                        <div>{scanError}</div>
                      </div>
                    )}

                    <div className="modal-footer" style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px'}}>
                      <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(1)}>Back</button>
                      <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                    </div>
                  </div>
                )}

                {!editMode && wizardStep === 2 && setupType !== 'auto' && (
                  <div className="animate-slideUp">
                    <h3 style={{fontSize: '1rem', marginBottom: '16px'}}>Bring Your Own App (BYOA) Setup Instructions</h3>

                    <div style={{background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px'}}>
                      <ol style={{paddingLeft: '20px', margin: 0, display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        <li>Go to the <a href="https://developers.facebook.com/" target="_blank" rel="noreferrer" style={{color: 'var(--accent-primary)'}}>Meta Developer Portal</a> and <strong>Create an App</strong> (Type: Business).</li>
                        <li>In your Meta App Settings, find your <strong>App Secret</strong> and save it in the AutometaBot <a href="/settings/meta-app" target="_blank" style={{color: 'var(--accent-primary)'}}>Meta App Settings</a>.</li>
                        <li>Set up your Webhook in Meta. Use this exact URL:
                          <code style={{display: 'block', padding: '8px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '4px', marginTop: '4px', wordBreak: 'break-all'}}>{`https://metachat.junoverseai.com/webhook/${user?.id || 'YOUR_USER_ID'}`}</code>
                        </li>
                        <li>Use your Custom Verify Token from the AutometaBot settings when configuring the webhook.</li>
                        {setupType === 'facebook' && <li>Subscribe your Meta App webhook to the <code>messages</code>, <code>messaging_postbacks</code>, and <code>feed</code> fields.</li>}
                        {setupType === 'instagram' && <li>Subscribe your Meta App webhook (under Instagram) to the <code>messages</code> and <code>comments</code> fields.</li>}
                        {setupType === 'whatsapp' && <li>Subscribe your Meta App webhook (under WhatsApp) to the <code>messages</code> field.</li>}
                        <li>Generate a Long-Lived Access Token. Make sure it has the required permissions.</li>
                      </ol>
                    </div>

                    <div className="modal-footer" style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px'}}>
                      <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(1)}>Back</button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setWizardStep(3)}
                      >
                        I have my credentials ➔ Next
                      </button>
                    </div>
                  </div>
                )}

                {!editMode && wizardStep === 3 && setupType === 'auto' && (
                  <div className="animate-slideUp">
                    {scanStep === 'completed' && (
                      <div>
                        {discoveredPages.length === 0 && discoveredInstagrams.length === 0 && discoveredWhatsApp.length === 0 ? (
                          <div style={{textAlign: 'center', padding: '24px', background: 'var(--bg-tertiary)', border: '1px dashed var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)'}}>
                            <AlertCircle size={32} style={{margin: '0 auto 8px auto', opacity: 0.5}} />
                            <p style={{margin: 0, fontSize: '0.9rem', fontWeight: 500}}>No Channels Discovered</p>
                            <p style={{margin: '4px 0 0 0', fontSize: '0.75rem'}}>Verify your token permissions (pages_messaging, instagram_basic, whatsapp_business_messaging) and try again.</p>
                          </div>
                        ) : (
                          <div style={{display:'flex', flexDirection:'column', gap:'16px', marginBottom: '20px'}}>
                            
                            {/* Facebook Pages List */}
                            {discoveredPages.length > 0 && (
                              <div>
                                <h4 style={{fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                  <FacebookIcon /> Facebook Pages ({discoveredPages.length})
                                </h4>
                                <div style={{display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px'}}>
                                  {discoveredPages.map(page => (
                                    <label key={page.id} style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '4px', cursor: 'pointer', background: selectedPages.includes(page.id) ? 'rgba(24,119,242,0.05)' : 'transparent', border: '1px solid ' + (selectedPages.includes(page.id) ? 'rgba(24,119,242,0.2)' : 'transparent')}}>
                                      <input 
                                        type="checkbox" 
                                        checked={selectedPages.includes(page.id)}
                                        onChange={e => {
                                          if (e.target.checked) setSelectedPages(prev => [...prev, page.id]);
                                          else setSelectedPages(prev => prev.filter(id => id !== page.id));
                                        }}
                                      />
                                      <div style={{flex: 1}}>
                                        <div style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)'}}>{page.name}</div>
                                        <div style={{fontSize: '0.7rem', color: 'var(--text-secondary)'}}>Page ID: {page.id} • Category: {page.category}</div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Instagram Accounts List */}
                            {discoveredInstagrams.length > 0 && (
                              <div>
                                <h4 style={{fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                  <InstagramIcon /> Instagram Accounts ({discoveredInstagrams.length})
                                </h4>
                                <div style={{display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px'}}>
                                  {discoveredInstagrams.map(ig => (
                                    <label key={ig.id} style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '4px', cursor: 'pointer', background: selectedInstagrams.includes(ig.id) ? 'rgba(225,48,108,0.05)' : 'transparent', border: '1px solid ' + (selectedInstagrams.includes(ig.id) ? 'rgba(225,48,108,0.2)' : 'transparent')}}>
                                      <input 
                                        type="checkbox" 
                                        checked={selectedInstagrams.includes(ig.id)}
                                        onChange={e => {
                                          if (e.target.checked) setSelectedInstagrams(prev => [...prev, ig.id]);
                                          else setSelectedInstagrams(prev => prev.filter(id => id !== ig.id));
                                        }}
                                      />
                                      <div style={{flex: 1}}>
                                        <div style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)'}}>@{ig.username}</div>
                                        <div style={{fontSize: '0.7rem', color: 'var(--text-secondary)'}}>IG ID: {ig.id} • Linked Page: {ig.linked_page_name}</div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* WhatsApp Accounts List */}
                            {discoveredWhatsApp.length > 0 && (
                              <div>
                                <h4 style={{fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px'}}>
                                  <WhatsAppIcon /> WhatsApp Numbers ({discoveredWhatsApp.length})
                                </h4>
                                <div style={{display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px'}}>
                                  {discoveredWhatsApp.map(wa => (
                                    <label key={wa.phone_number_id} style={{display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '4px', cursor: 'pointer', background: selectedWhatsApp.includes(wa.phone_number_id) ? 'rgba(37,211,102,0.05)' : 'transparent', border: '1px solid ' + (selectedWhatsApp.includes(wa.phone_number_id) ? 'rgba(37,211,102,0.2)' : 'transparent')}}>
                                      <input 
                                        type="checkbox" 
                                        checked={selectedWhatsApp.includes(wa.phone_number_id)}
                                        onChange={e => {
                                          if (e.target.checked) setSelectedWhatsApp(prev => [...prev, wa.phone_number_id]);
                                          else setSelectedWhatsApp(prev => prev.filter(id => id !== wa.phone_number_id));
                                        }}
                                      />
                                      <div style={{flex: 1}}>
                                        <div style={{fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)'}}>{wa.verified_name} ({wa.display_phone_number})</div>
                                        <div style={{fontSize: '0.7rem', color: 'var(--text-secondary)'}}>Phone ID: {wa.phone_number_id} • WABA ID: {wa.waba_id}</div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            )}

                          </div>
                        )}
                      </div>
                    )}

                    <div className="modal-footer" style={{display: 'flex', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px'}}>
                      {!editMode && <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(2)}>Back</button>}
                      <div style={{display: 'flex', gap: '8px'}}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                        <button 
                          type="button" 
                          className="btn btn-primary"
                          onClick={handleImportSelected}
                          disabled={saving || (selectedPages.length === 0 && selectedInstagrams.length === 0 && selectedWhatsApp.length === 0)}
                        >
                          {saving ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <Check size={14}/>}
                          {saving ? 'Importing...' : `Import Selected (${selectedPages.length + selectedInstagrams.length + selectedWhatsApp.length})`}
                        </button>
                      </div>
                    </div>

                  </div>
                )}

                {(editMode || (wizardStep === 3 && setupType !== 'auto')) && (
                  <form onSubmit={handleSubmit} className="animate-slideUp">
                        <div style={{padding: '16px 0'}}>
                          {selectedPlatform === 'whatsapp' && (
                            <>
                              <div className="form-group">
                                <label className="form-label">WhatsApp Display Name</label>
                                <input className="form-input" placeholder="e.g., Support Number" value={pageName} onChange={e=>setPageName(e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">WhatsApp Phone Number ID</label>
                                <input className="form-input" placeholder="e.g., 106540352242922" value={whatsappPhoneNumberId} onChange={e=>setWhatsappPhoneNumberId(e.target.value)} required />
                              </div>
                              <div className="form-group">
                                <label className="form-label">WhatsApp Business Account ID</label>
                                <input className="form-input" placeholder="e.g., 102290129340398" value={whatsappBusinessAccountId} onChange={e=>setWhatsappBusinessAccountId(e.target.value)} required />
                              </div>
                              <div className="form-group" style={{background: 'rgba(37,211,102,0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', marginBottom: '16px'}}>
                                <div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
                                  <label className="toggle-switch">
                                    <input type="checkbox" checked={isWhatsappActive} onChange={e=>setIsWhatsappActive(e.target.checked)} />
                                    <span className="slider"></span>
                                  </label>
                                  <div>
                                    <h4 style={{margin: 0, fontSize: '0.9rem', fontWeight: 600}}>WhatsApp Bot Active</h4>
                                  </div>
                                </div>
                              </div>
                            </>
                          )}

                          {selectedPlatform === 'instagram' && (
                            <>
                              <div className="form-group">
                                <label className="form-label">Instagram Profile Name</label>
                                <input className="form-input" placeholder="e.g., My Brand Instagram" value={pageName} onChange={e=>setPageName(e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Instagram Business Account ID</label>
                                <input className="form-input" placeholder="e.g., 178414..." value={instagramId} onChange={e=>setInstagramId(e.target.value)} required />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Linked Facebook Page ID</label>
                                <input className="form-input" placeholder="e.g., 123456789" value={pageId} onChange={e=>setPageId(e.target.value)} required />
                              </div>
                            </>
                          )}

                          {selectedPlatform === 'facebook' && (
                            <>
                              <div className="form-group">
                                <label className="form-label">Page Name</label>
                                <input className="form-input" placeholder="e.g., My Business Page" value={pageName} onChange={e=>setPageName(e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Facebook Page ID</label>
                                <input className="form-input" placeholder="e.g., 123456789" value={pageId} onChange={e=>setPageId(e.target.value)} required />
                              </div>
                            </>
                          )}

                          <div className="form-group">
                            <label className="form-label">Access Token</label>
                            <textarea 
                              className="form-textarea" 
                              placeholder="EAA..." 
                              value={accessToken} 
                              onChange={e=>setAccessToken(e.target.value)} 
                              required 
                              style={{minHeight:'100px',fontFamily:'monospace',fontSize:'0.75rem'}} 
                            />
                          </div>
                        </div>
                        <div className="modal-footer" style={{display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px'}}>
                          {!editMode ? <button type="button" className="btn btn-secondary" onClick={() => setWizardStep(2)}>Back</button> : <div></div>}
                          <div style={{display: 'flex', gap: '8px', marginLeft: editMode ? 'auto' : undefined}}>
                            <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                            <button type="submit" className="btn btn-primary" disabled={saving}>
                              {saving ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <Save size={14}/>}
                              {editMode ? 'Save Changes' : 'Connect Channel'}
                            </button>
                          </div>
                        </div>
                  </form>
                )}
              </div>
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

                <div className="form-group" style={{background: 'rgba(59, 130, 246, 0.05)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px'}}>
                  <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px'}}>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={followUpEnabled} onChange={e=>setFollowUpEnabled(e.target.checked)} />
                      <span className="slider"></span>
                    </label>
                    <div>
                      <h4 style={{margin: 0, fontSize: '0.95rem'}}>AI Follow-Up Pilot</h4>
                      <p className="form-hint" style={{margin: '4px 0 0 0'}}>Automatically send a follow-up message when the customer becomes inactive/leaves the chat.</p>
                    </div>
                  </div>
                  
                  {followUpEnabled && (
                    <div style={{marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '12px'}}>
                      <div style={{display: 'flex', gap: '16px', flexWrap: 'wrap'}}>
                        <div className="form-group" style={{flex: 1, minWidth: '150px', marginBottom: 0}}>
                          <label className="form-label" style={{fontSize: '0.85rem'}}>Follow-up Delay</label>
                          <select 
                            className="form-input" 
                            value={followUpDelayMinutes} 
                            onChange={e=>setFollowUpDelayMinutes(parseInt(e.target.value))}
                            style={{background: 'var(--bg-primary)'}}
                          >
                            <option value="15">15 Minutes</option>
                            <option value="30">30 Minutes</option>
                            <option value="60">1 Hour (Recommended)</option>
                            <option value="120">2 Hours</option>
                            <option value="240">4 Hours</option>
                            <option value="720">12 Hours</option>
                            <option value="1380">23 Hours</option>
                          </select>
                          <p className="form-hint" style={{fontSize: '0.75rem'}}>Time to wait after customer becomes idle.</p>
                        </div>

                        <div className="form-group" style={{flex: 1, minWidth: '150px', marginBottom: 0}}>
                          <label className="form-label" style={{fontSize: '0.85rem'}}>Max Follow-ups per session</label>
                          <select 
                            className="form-input" 
                            value={followUpMaxCount} 
                            onChange={e=>setFollowUpMaxCount(parseInt(e.target.value))}
                            style={{background: 'var(--bg-primary)'}}
                          >
                            <option value="1">1 Time</option>
                            <option value="2">2 Times</option>
                            <option value="3">3 Times</option>
                          </select>
                          <p className="form-hint" style={{fontSize: '0.75rem'}}>Maximum messages sent without reply.</p>
                        </div>

                        <div className="form-group" style={{flex: 1, minWidth: '150px', marginBottom: 0}}>
                          <label className="form-label" style={{fontSize: '0.85rem'}}>Target Intent Score</label>
                          <select 
                            className="form-input" 
                            value={followUpMinScore} 
                            onChange={e=>setFollowUpMinScore(parseInt(e.target.value))}
                            style={{background: 'var(--bg-primary)'}}
                          >
                            <option value="1">All Customers (Score &ge; 1)</option>
                            <option value="3">Somewhat Warm (Score &ge; 3)</option>
                            <option value="5">Warm Only (Score &ge; 5)</option>
                            <option value="7">Hot Only (Score &ge; 7)</option>
                            <option value="9">Extremely Hot Only (Score &ge; 9)</option>
                          </select>
                          <p className="form-hint" style={{fontSize: '0.75rem'}}>Only follow up with score threshold.</p>
                        </div>
                      </div>

                      <div className="form-group" style={{marginBottom: 0}}>
                        <label className="form-label" style={{fontSize: '0.85rem'}}>Custom Follow-up Prompt / Instructions</label>
                        <textarea 
                          className="form-textarea" 
                          placeholder="e.g. Ask if they have any remaining questions about our pricing, and politely invite them to schedule a call if they are interested."
                          value={followUpPrompt} 
                          onChange={e=>setFollowUpPrompt(e.target.value)}
                          style={{minHeight: '80px', fontSize: '0.85rem'}}
                        />
                        <p className="form-hint" style={{fontSize: '0.75rem'}}>Instruct the AI how to draft the follow-up message using the conversation context.</p>
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
