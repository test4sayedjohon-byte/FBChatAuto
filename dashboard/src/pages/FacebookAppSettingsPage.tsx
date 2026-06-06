import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Loader2, Shield, Copy, Check, Edit2, Lock, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function FacebookAppSettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [appSecret, setAppSecret] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  
  // Track original values to allow canceling edits
  const [originalAppSecret, setOriginalAppSecret] = useState('');
  const [originalVerifyToken, setOriginalVerifyToken] = useState('');
  
  const [hasSavedSettings, setHasSavedSettings] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const webhookUrl = `https://metachat.junoverseai.com/webhook/${user?.id || 'YOUR_USER_ID'}`;

  useEffect(() => { load(); }, []);

  async function load() {
    if (!user) return;
    const { data } = await supabase.from('users').select('settings').eq('id', user.id).single();
    if (data?.settings && (data.settings.fb_app_secret || data.settings.fb_verify_token)) {
      const secret = data.settings.fb_app_secret || '';
      const token = data.settings.fb_verify_token || '';
      setAppSecret(secret);
      setVerifyToken(token);
      setOriginalAppSecret(secret);
      setOriginalVerifyToken(token);
      setHasSavedSettings(true);
      setIsEditing(false);
    } else {
      setHasSavedSettings(false);
      setIsEditing(true);
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
    if (error) {
      alert('Error saving settings: ' + error.message);
    } else {
      alert('Meta App Settings saved successfully!');
      setOriginalAppSecret(appSecret);
      setOriginalVerifyToken(verifyToken);
      setHasSavedSettings(true);
      setIsEditing(false);
    }
    setSaving(false);
  }

  function handleCancel() {
    setAppSecret(originalAppSecret);
    setVerifyToken(originalVerifyToken);
    setIsEditing(false);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading configurations...</div>;

  return (
    <div className="animate-slideUp max-w-3xl">
      <div className="page-header">
        <h1>Meta App Settings</h1>
        <p>Configure your own Meta Developer App credentials to enable the AI for your channels.</p>
      </div>

      <div className="card mb-6">
        <div className="card-header border-b border-gray-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <Shield className="text-primary" size={20} />
            <h2 className="text-lg font-semibold">Your Custom Webhook URL</h2>
          </div>
          <p className="text-sm text-gray-400 mt-1">Paste this exactly into your Meta Developer App's Webhook configuration.</p>
        </div>
        
        <div className="bg-darker p-4 rounded-lg flex items-center justify-between border border-gray-800">
          <code className="text-primary text-sm break-all">{webhookUrl}</code>
          <button onClick={handleCopy} className="btn btn-secondary btn-sm ml-4 whitespace-nowrap">
            {copied ? <><Check size={14}/> Copied</> : <><Copy size={14}/> Copy URL</>}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header border-b border-gray-800 pb-4 mb-6 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Lock className="text-gray-400" size={18} />
            <h2 className="text-lg font-semibold">Credentials Configuration</h2>
          </div>
          {hasSavedSettings && !isEditing && (
            <button 
              onClick={() => setIsEditing(true)} 
              className="btn btn-secondary btn-sm flex items-center gap-2"
            >
              <Edit2 size={14} />
              Edit Credentials
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            <div className="form-group">
              <label className="form-label">Meta App Secret</label>
              <input 
                type="password"
                className={`form-input ${!isEditing ? 'opacity-60 cursor-not-allowed bg-darker' : ''}`} 
                placeholder={isEditing ? "e.g., f0136a49357de602e36ef1f3f81bc39b" : "••••••••••••••••••••••••••••••••"} 
                value={appSecret} 
                onChange={e=>setAppSecret(e.target.value)} 
                disabled={!isEditing}
                required 
              />
              <p className="form-hint">Found in Meta Developer Portal &gt; App Settings &gt; Basic &gt; App Secret.</p>
            </div>
            
            <div className="form-group">
              <label className="form-label">Custom Verify Token</label>
              <input 
                className={`form-input ${!isEditing ? 'opacity-60 cursor-not-allowed bg-darker' : ''}`} 
                placeholder={isEditing ? "Make up a secure password..." : "••••••••••••••••"} 
                value={verifyToken} 
                onChange={e=>setVerifyToken(e.target.value)} 
                disabled={!isEditing}
                required 
              />
              <p className="form-hint">Create any password here. You will paste this exact password into the "Verify Token" field in Meta when setting up the webhook.</p>
            </div>
          </div>
          
          {isEditing && (
            <div className="mt-8 flex justify-end gap-3 border-t border-gray-800 pt-6">
              {hasSavedSettings && (
                <button 
                  type="button" 
                  onClick={handleCancel} 
                  className="btn btn-secondary flex items-center gap-2"
                  disabled={saving}
                >
                  <X size={16} />
                  Cancel
                </button>
              )}
              <button type="submit" className="btn btn-primary flex items-center gap-2" disabled={saving}>
                {saving ? <Loader2 size={16} className="animate-spin"/> : <Save size={16} />}
                {saving ? 'Saving...' : 'Save App Settings'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
