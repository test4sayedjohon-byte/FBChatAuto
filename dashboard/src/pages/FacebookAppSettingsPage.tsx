import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Loader2, Shield, Copy, Check } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function FacebookAppSettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [appSecret, setAppSecret] = useState('');
  const [verifyToken, setVerifyToken] = useState('');

  const webhookUrl = `https://fbchatauto-webhook.test4-sayedjohon.workers.dev/webhook/${user?.id || 'YOUR_USER_ID'}`;

  useEffect(() => { load(); }, []);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from('users').select('settings').eq('id', user.id).single();
    if (data?.settings) {
      setAppSecret(data.settings.fb_app_secret || '');
      setVerifyToken(data.settings.fb_verify_token || '');
    }
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    
    // First get existing settings to not overwrite other stuff
    const { data: userData } = await supabase.from('users').select('settings').eq('id', user.id).single();
    const currentSettings = userData?.settings || {};
    
    const newSettings = {
      ...currentSettings,
      fb_app_secret: appSecret,
      fb_verify_token: verifyToken
    };

    const { error } = await supabase.from('users').update({ settings: newSettings }).eq('id', user.id);
    if (error) alert('Error saving settings: ' + error.message);
    else alert('Facebook App Settings saved successfully!');
    setSaving(false);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="animate-slideUp max-w-3xl">
      <div className="page-header">
        <h1>Facebook App Settings</h1>
        <p>Configure your own Facebook App credentials to enable the AI for your pages.</p>
      </div>

      <div className="card mb-6">
        <div className="card-header border-b border-gray-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Shield className="text-primary" size={20} />
            <h2 className="text-lg font-semibold">Your Custom Webhook URL</h2>
          </div>
          <p className="text-sm text-gray-400 mt-1">Paste this exactly into your Facebook App's Webhook configuration.</p>
        </div>
        
        <div className="bg-darker p-4 rounded-lg flex items-center justify-between border border-gray-800">
          <code className="text-primary text-sm break-all">{webhookUrl}</code>
          <button onClick={handleCopy} className="btn btn-secondary btn-sm ml-4 whitespace-nowrap">
            {copied ? <><Check size={14}/> Copied</> : <><Copy size={14}/> Copy URL</>}
          </button>
        </div>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div className="form-group">
              <label className="form-label">Facebook App Secret</label>
              <input 
                type="password"
                className="form-input" 
                placeholder="e.g., f0136a49357de602e36ef1f3f81bc39b" 
                value={appSecret} 
                onChange={e=>setAppSecret(e.target.value)} 
                required 
              />
              <p className="form-hint">Found in Facebook Developer Portal &gt; App Settings &gt; Basic &gt; App Secret.</p>
            </div>
            
            <div className="form-group">
              <label className="form-label">Custom Verify Token</label>
              <input 
                className="form-input" 
                placeholder="Make up a secure password..." 
                value={verifyToken} 
                onChange={e=>setVerifyToken(e.target.value)} 
                required 
              />
              <p className="form-hint">Create any password here. You will paste this exact password into the "Verify Token" field in Facebook when setting up the webhook.</p>
            </div>
          </div>
          
          <div className="mt-8 flex justify-end">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin mr-2"/> : <Save size={16} className="mr-2"/>}
              {saving ? 'Saving...' : 'Save App Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
