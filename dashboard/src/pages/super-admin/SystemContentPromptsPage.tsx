import { useState, useEffect } from 'react';
import { workerGet, workerPost, workerPut, workerDelete } from '../../lib/workerApi';
import { toast } from '../../hooks/useToast';
import { 
  Sparkles, Plus, Edit2, Trash2, Save, X, Eye, EyeOff, ListOrdered, FileText, ImageIcon, Loader2
} from 'lucide-react';

interface ContentPrompt {
  id: string;
  title: string;
  prompt_text: string;
  image_prompt_text: string | null;
  sequence_order: number;
  is_active: boolean;
  created_at: string;
}

export default function SystemContentPromptsPage() {
  const [prompts, setPrompts] = useState<ContentPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Partial<ContentPrompt> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPrompts();
  }, []);

  async function loadPrompts() {
    try {
      setLoading(true);
      const data = await workerGet<{ prompts: ContentPrompt[] }>('/api/admin/content-prompts');
      setPrompts(data.prompts || []);
    } catch (err: any) {
      toast.error('Failed to load prompts: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleOpenCreate = () => {
    setEditingPrompt({
      title: '',
      prompt_text: '',
      image_prompt_text: '',
      sequence_order: prompts.length + 1,
      is_active: true
    });
    setModalOpen(true);
  };

  const handleOpenEdit = (prompt: ContentPrompt) => {
    setEditingPrompt({ ...prompt });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setEditingPrompt(null);
    setModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPrompt || !editingPrompt.title || !editingPrompt.prompt_text) {
      toast.error('Please enter a title and prompt text.');
      return;
    }

    try {
      setSaving(true);
      if (editingPrompt.id) {
        // Update
        const data = await workerPut<{ success: boolean; prompt: ContentPrompt }>(
          `/api/admin/content-prompts/${editingPrompt.id}`, 
          editingPrompt
        );
        if (data.success) {
          toast.success('System prompt updated successfully.');
          setPrompts(prompts.map(p => p.id === editingPrompt.id ? data.prompt : p));
        }
      } else {
        // Create
        const data = await workerPost<{ success: boolean; prompt: ContentPrompt }>(
          '/api/admin/content-prompts', 
          editingPrompt
        );
        if (data.success) {
          toast.success('System prompt created successfully.');
          setPrompts([...prompts, data.prompt].sort((a, b) => a.sequence_order - b.sequence_order));
        }
      }
      handleCloseModal();
    } catch (err: any) {
      toast.error('Failed to save: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this content prompt template? Regular users will no longer be able to use it.')) return;

    try {
      const data = await workerDelete<{ success: boolean }>(`/api/admin/content-prompts/${id}`);
      if (data.success) {
        toast.success('System prompt deleted.');
        setPrompts(prompts.filter(p => p.id !== id));
      }
    } catch (err: any) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  return (
    <div className="animate-slideUp" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Sparkles size={24} color="var(--primary)" />
            Content System Prompts
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Manage the sequential AI system prompts used by the workspace copilot to generate marketing content.
          </p>
        </div>
        <button className="btn-primary" onClick={handleOpenCreate} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={16} /> Add New Prompt
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '300px' }}>
          <Loader2 className="animate-spin" size={32} color="var(--primary)" />
        </div>
      ) : prompts.length === 0 ? (
        <div style={{
          textAlign: 'center', 
          padding: '48px', 
          background: 'var(--bg-secondary)', 
          border: '1px dashed var(--border-primary)', 
          borderRadius: 'var(--radius-lg)'
        }}>
          <FileText size={48} style={{ color: 'var(--text-secondary)', marginBottom: '12px', opacity: 0.5 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>No templates created</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Get started by adding system prompts like Awareness, Education, or Hooks.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '20px' }}>
          {prompts.map((prompt) => (
            <div key={prompt.id} style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-lg)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: 'var(--shadow-sm)'
            }} className="card-hover">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      background: 'rgba(var(--primary-rgb), 0.15)',
                      color: 'var(--primary)',
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      padding: '2px 8px',
                      borderRadius: '12px'
                    }}>
                      #{prompt.sequence_order}
                    </span>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0 }}>
                      {prompt.title}
                    </h3>
                  </div>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: prompt.is_active ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
                    color: prompt.is_active ? '#22c55e' : '#9ca3af'
                  }}>
                    {prompt.is_active ? <Eye size={12} /> : <EyeOff size={12} />}
                    {prompt.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <FileText size={12} /> Prompt Content
                  </h4>
                  <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.85rem',
                    lineHeight: '1.4',
                    background: 'var(--bg-primary)',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    border: '1px solid var(--border-primary)',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {prompt.prompt_text}
                  </p>
                </div>

                {prompt.image_prompt_text && (
                  <div style={{ marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ImageIcon size={12} /> Image Generation Guidelines
                    </h4>
                    <p style={{
                      color: 'var(--text-secondary)',
                      fontSize: '0.85rem',
                      fontStyle: 'italic',
                      background: 'rgba(255,255,255,0.02)',
                      padding: '10px',
                      borderRadius: 'var(--radius-md)',
                      maxHeight: '80px',
                      overflowY: 'auto',
                      border: '1px dashed var(--border-primary)'
                    }}>
                      {prompt.image_prompt_text}
                    </p>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-primary)', paddingTop: '12px', marginTop: '8px' }}>
                <button className="btn-ghost btn-icon" onClick={() => handleOpenEdit(prompt)} title="Edit Prompt">
                  <Edit2 size={14} color="var(--text-secondary)" />
                </button>
                <button className="btn-ghost btn-icon" onClick={() => handleDelete(prompt.id)} title="Delete Prompt">
                  <Trash2 size={14} color="var(--error)" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      {modalOpen && editingPrompt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div className="animate-scaleUp" style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-lg)',
            width: '95%',
            maxWidth: '600px',
            boxShadow: 'var(--shadow-2xl)',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border-primary)' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                {editingPrompt.id ? <Edit2 size={18} /> : <Plus size={18} />}
                {editingPrompt.id ? 'Edit Content Prompt' : 'Create Content Prompt'}
              </h2>
              <button className="btn-ghost btn-icon" onClick={handleCloseModal}>
                <X size={18} color="var(--text-secondary)" />
              </button>
            </div>

            <form onSubmit={handleSave} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Template Title
                  </label>
                  <input
                    type="text"
                    className="input-text"
                    value={editingPrompt.title || ''}
                    onChange={(e) => setEditingPrompt({ ...editingPrompt, title: e.target.value })}
                    placeholder="e.g. Awareness, Education, Testimonial"
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Sequence Order
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <ListOrdered size={14} style={{ position: 'absolute', left: '12px', color: 'var(--text-secondary)' }} />
                      <input
                        type="number"
                        className="input-text"
                        value={editingPrompt.sequence_order || 0}
                        onChange={(e) => setEditingPrompt({ ...editingPrompt, sequence_order: parseInt(e.target.value) })}
                        placeholder="1"
                        required
                        style={{ width: '100%', paddingLeft: '36px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', height: '100%', marginTop: '24px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      <input
                        type="checkbox"
                        checked={editingPrompt.is_active || false}
                        onChange={(e) => setEditingPrompt({ ...editingPrompt, is_active: e.target.checked })}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                      />
                      Is Active Template
                    </label>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    System Prompt Instructions
                  </label>
                  <textarea
                    className="input-text"
                    value={editingPrompt.prompt_text || ''}
                    onChange={(e) => setEditingPrompt({ ...editingPrompt, prompt_text: e.target.value })}
                    placeholder="Detailed guidelines for the AI agent when generating this post..."
                    required
                    rows={6}
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem', resize: 'vertical' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Image Generation Guidelines (Optional)
                  </label>
                  <textarea
                    className="input-text"
                    value={editingPrompt.image_prompt_text || ''}
                    onChange={(e) => setEditingPrompt({ ...editingPrompt, image_prompt_text: e.target.value })}
                    placeholder="Specific design, color rules, or styling instructions for image prompt construction..."
                    rows={3}
                    style={{ width: '100%', fontStyle: 'italic', fontSize: '0.85rem', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-primary)', paddingTop: '16px', marginTop: '20px' }}>
                <button type="button" className="btn-ghost" onClick={handleCloseModal} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
