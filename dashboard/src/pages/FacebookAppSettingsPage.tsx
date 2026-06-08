import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Save, Loader2, Shield, Copy, Check, Edit2, Lock, X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';

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
  const [showAppSecret, setShowAppSecret] = useState(false);
  const [showVerifyToken, setShowVerifyToken] = useState(false);

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
      toast.error('Error saving settings: ' + error.message);
    } else {
      toast.success('Meta App Settings saved successfully!');
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

  if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading configurations...</div>;

  return (
    <div className="animate-slideUp" style={{ maxWidth: '48rem' }}>
      <div className="page-header">
        <h1>Meta App Settings</h1>
        <p>Configure your own Meta Developer App credentials to enable the AI for your channels.</p>
      </div>

      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '16px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={20} style={{ color: 'var(--accent-primary)' }} />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Your Custom Webhook URL</h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: 0 }}>
            Paste this exactly into your Meta Developer App's Webhook configuration.
          </p>
        </div>
        
        <div className="flex-mobile-col flex-wrap" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
          <code style={{ wordBreak: 'break-all', fontSize: '0.875rem', color: 'var(--accent-primary)' }}>{webhookUrl}</code>
          <button onClick={handleCopy} className="btn btn-secondary btn-sm whitespace-nowrap">
            {copied ? <><Check size={14}/> Copied</> : <><Copy size={14}/> Copy URL</>}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header flex-mobile-col flex-wrap" style={{ borderBottom: '1px solid var(--border-primary)', paddingBottom: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} style={{ color: 'var(--text-secondary)' }} />
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: 0 }}>Credentials Configuration</h2>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="form-group">
              <label className="form-label">Meta App Secret</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showAppSecret ? "text" : "password"}
                  className={`form-input ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`} 
                  style={{
                    ...(!isEditing ? { background: 'var(--bg-tertiary)' } : {}),
                    paddingRight: '40px'
                  }}
                  placeholder={isEditing ? "e.g., f0136a49357de602e36ef1f3f81bc39b" : "••••••••••••••••••••••••••••••••"} 
                  value={appSecret} 
                  onChange={e=>setAppSecret(e.target.value)} 
                  disabled={!isEditing}
                  required 
                />
                <button
                  type="button"
                  onClick={() => setShowAppSecret(!showAppSecret)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {showAppSecret ? <EyeOff size={16} style={{ display: 'block' }} /> : <Eye size={16} style={{ display: 'block' }} />}
                </button>
              </div>
              <p className="form-hint">Found in Meta Developer Portal &gt; App Settings &gt; Basic &gt; App Secret.</p>
            </div>
            
            <div className="form-group">
              <label className="form-label">Custom Verify Token</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showVerifyToken ? "text" : "password"}
                  className={`form-input ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`} 
                  style={{
                    ...(!isEditing ? { background: 'var(--bg-tertiary)' } : {}),
                    paddingRight: '40px'
                  }}
                  placeholder={isEditing ? "Make up a secure password..." : "••••••••••••••••"} 
                  value={verifyToken} 
                  onChange={e=>setVerifyToken(e.target.value)} 
                  disabled={!isEditing}
                  required 
                />
                <button
                  type="button"
                  onClick={() => setShowVerifyToken(!showVerifyToken)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {showVerifyToken ? <EyeOff size={16} style={{ display: 'block' }} /> : <Eye size={16} style={{ display: 'block' }} />}
                </button>
              </div>
              <p className="form-hint">Create any password here. You will paste this exact password into the "Verify Token" field in Meta when setting up the webhook.</p>
            </div>
          </div>
          
          {isEditing && (
            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-primary)', paddingTop: '24px' }}>
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
