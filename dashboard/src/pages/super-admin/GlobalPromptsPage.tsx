import { useState, useEffect } from 'react';
import { workerGet, workerPut } from '../../lib/workerApi';
import { toast } from '../../hooks/useToast';
import {
  Settings, Save, Loader2
} from 'lucide-react';

interface GlobalPrompt {
  id: string;
  key: string;
  title: string;
  prompt_text: string;
  description: string | null;
}

export default function GlobalPromptsPage() {
  const [prompts, setPrompts] = useState<GlobalPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    loadPrompts();
  }, []);

  async function loadPrompts() {
    try {
      setLoading(true);
      const data = await workerGet<{ prompts: GlobalPrompt[] }>('/api/admin/global-prompts');
      setPrompts(data.prompts || []);
    } catch (err: any) {
      toast.error('Failed to load prompts: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleUpdate = async (prompt: GlobalPrompt, newText: string) => {
    try {
      setSaving(prompt.id);
      const data = await workerPut<{ success: boolean; prompt: GlobalPrompt }>(`/api/admin/global-prompts/${prompt.id}`, {
        prompt_text: newText
      });
      if (data.success) {
        toast.success(`${prompt.title} updated successfully.`);
        setPrompts(prompts.map(p => p.id === prompt.id ? { ...p, prompt_text: newText } : p));
      }
    } catch (err: any) {
      toast.error('Failed to update prompt: ' + err.message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="animate-slideUp" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Settings size={24} color="var(--primary)" />
            Global System Prompts
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage the core system prompts that drive ideation, product integration, and default bot behavior.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <Loader2 className="animate-spin" size={32} color="var(--primary)" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {prompts.map((prompt) => (
            <div key={prompt.id} style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                  {prompt.title}
                </h3>
                {prompt.description && (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    {prompt.description}
                  </p>
                )}
              </div>

              <textarea
                className="input-text"
                value={prompt.prompt_text}
                onChange={(e) => setPrompts(prompts.map(p => p.id === prompt.id ? { ...p, prompt_text: e.target.value } : p))}
                rows={6}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn-primary"
                  onClick={() => handleUpdate(prompt, prompt.prompt_text)}
                  disabled={saving === prompt.id}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  {saving === prompt.id ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                  Save Changes
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
