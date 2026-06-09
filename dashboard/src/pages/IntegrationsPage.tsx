import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';
import { Save, Trash2, Link2, FileSpreadsheet, Plus, X, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';

interface Integration {
  id: string;
  integration_type: string;
  credentials: any;
  config: any;
  is_active: boolean;
}

export default function IntegrationsPage() {
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form State
  const [showModal, setShowModal] = useState(false);
  const [integrationType, setIntegrationType] = useState('custom_webhook');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [hubspotKey, setHubspotKey] = useState('');
  const [sheetsWebhookUrl, setSheetsWebhookUrl] = useState('');
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    if (user) {
      loadIntegrations();
    }
  }, [user]);

  async function loadIntegrations() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('integrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIntegrations(data || []);
    } catch (err: any) {
      toast.error('Failed to load integrations: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddIntegration(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const credentials: any = {};
    const config: any = { display_name: displayName.trim() || undefined };

    if (integrationType === 'custom_webhook') {
      config.webhook_url = webhookUrl.trim();
    } else if (integrationType === 'google_sheets') {
      config.sheets_webhook_url = sheetsWebhookUrl.trim();
    } else if (integrationType === 'hubspot') {
      credentials.access_token = hubspotKey.trim();
    }

    try {
      const { error } = await supabase
        .from('integrations')
        .insert({
          user_id: user.id,
          integration_type: integrationType,
          credentials,
          config,
          is_active: true
        });

      if (error) throw error;

      toast.success('Integration added successfully!');
      setShowModal(false);
      // Reset form fields
      setWebhookUrl('');
      setSheetsWebhookUrl('');
      setHubspotKey('');
      setDisplayName('');
      loadIntegrations();
    } catch (err: any) {
      toast.error('Failed to save integration: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteIntegration(id: string) {
    if (!confirm('Are you sure you want to disconnect this integration?')) return;
    try {
      const { error } = await supabase.from('integrations').delete().eq('id', id);
      if (error) throw error;
      toast.success('Integration disconnected.');
      loadIntegrations();
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    }
  }

  async function handleToggleIntegration(integration: Integration) {
    try {
      const { error } = await supabase
        .from('integrations')
        .update({ is_active: !integration.is_active })
        .eq('id', integration.id);

      if (error) throw error;
      loadIntegrations();
    } catch (err: any) {
      toast.error('Failed to update integration state: ' + err.message);
    }
  }

  return (
    <div className="animate-slideUp">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Integrations & Webhooks</h1>
          <p>Sync leads and conversation alerts directly to your CRM, Google Sheets, or custom API endpoints.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> Add Integration
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Loader2 className="animate-spin" style={{ margin: '0 auto 16px auto' }} />
          Loading integrations...
        </div>
      ) : integrations.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Link2 size={48} style={{ color: 'var(--text-secondary)', opacity: 0.5, marginBottom: '16px' }} />
            <h3>No Integrations Configured</h3>
            <p>Connect HubSpot, Google Sheets, or Zapier webhooks to capture lead data from chat comments automatically.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              Add Integration
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {integrations.map(integration => {
            const isSheets = integration.integration_type === 'google_sheets';
            const isHubspot = integration.integration_type === 'hubspot';
            
            let label = 'Custom Webhook';
            let icon = <Link2 size={18} />;
            let desc = integration.config?.webhook_url || 'Webhook URL';

            if (isSheets) {
              label = 'Google Sheets Link';
              icon = <FileSpreadsheet size={18} />;
              desc = integration.config?.sheets_webhook_url || 'Google Script Endpoint';
            } else if (isHubspot) {
              label = 'HubSpot CRM Connection';
              icon = <Link2 size={18} />;
              desc = 'Connected via API Access Token';
            }

            return (
              <div key={integration.id} className="list-item" style={{ border: '1px solid var(--border-primary)', padding: '16px', borderRadius: '8px', opacity: integration.is_active ? 1 : 0.6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: 'rgba(var(--primary-rgb), 0.1)', color: 'var(--primary)', padding: '8px', borderRadius: '6px', display: 'flex' }}>
                    {icon}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>{integration.config?.display_name || label}</h4>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>{desc}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', color: integration.is_active ? 'var(--success)' : 'var(--text-secondary)' }} onClick={() => handleToggleIntegration(integration)} title={integration.is_active ? 'Pause Sync' : 'Enable Sync'}>
                    {integration.is_active ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                  <button className="btn-ghost btn-icon" onClick={() => handleDeleteIntegration(integration.id)} title="Remove connection">
                    <Trash2 size={14} color="var(--error)" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connection Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Add Lead Sync Integration</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleAddIntegration}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Friendly Name</label>
                  <input className="form-input" placeholder="e.g. Sales HubSpot or Leads Sheet" value={displayName} onChange={e => setDisplayName(e.target.value)} required />
                </div>

                <div className="form-group">
                  <label className="form-label">Integration Target</label>
                  <select className="form-input" value={integrationType} onChange={e => setIntegrationType(e.target.value)} required>
                    <option value="custom_webhook">Zapier / n8n / Custom Webhook</option>
                    <option value="google_sheets">Google Sheets Sync</option>
                    <option value="hubspot">HubSpot CRM</option>
                  </select>
                </div>

                {integrationType === 'custom_webhook' && (
                  <div className="form-group">
                    <label className="form-label">Webhook Endpoint URL</label>
                    <input className="form-input" type="url" placeholder="https://hooks.zapier.com/hooks/catch/..." value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} required />
                    <p className="form-hint">Leads captured from chat comments will be POSTed to this URL instantly.</p>
                  </div>
                )}

                {integrationType === 'google_sheets' && (
                  <div className="form-group">
                    <label className="form-label">Google Sheets Script Webhook URL</label>
                    <input className="form-input" type="url" placeholder="https://script.google.com/macros/s/..." value={sheetsWebhookUrl} onChange={e => setSheetsWebhookUrl(e.target.value)} required />
                    <p className="form-hint">Create an App Script Web App in Google Sheets to receive row additions directly.</p>
                  </div>
                )}

                {integrationType === 'hubspot' && (
                  <div className="form-group">
                    <label className="form-label">HubSpot Private Access Token</label>
                    <input className="form-input" type="password" placeholder="pat-na1-..." value={hubspotKey} onChange={e => setHubspotKey(e.target.value)} required />
                    <p className="form-hint">Generate a Private App Token in HubSpot Settings → Integrations with contacts write scopes.</p>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Connect Integration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
