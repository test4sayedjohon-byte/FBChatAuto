import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, FileText, Upload, X, Save, Loader2 } from 'lucide-react';

interface Doc {
  id: string;
  title: string;
  source_type: string;
  original_content?: string;
  chunk_count: number;
  is_active: boolean;
  created_at: string;
  page_id: string | null;
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [pages, setPages] = useState<{page_id: string, page_name: string|null}[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedPageId, setSelectedPageId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data: docsData } = await supabase.from('documents').select('*').order('created_at', { ascending: false });
    if (docsData) setDocs(docsData);
    
    const { data: pagesData } = await supabase.from('page_connections').select('page_id, page_name');
    if (pagesData) setPages(pagesData);
    
    setLoading(false);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('You must be logged in.');
      setSaving(false);
      return;
    }

    let targetDocId = editingDocId;

    if (editMode && editingDocId) {
      const { error } = await supabase.from('documents').update({
        title,
        page_id: selectedPageId || null,
        original_content: content
      }).eq('id', editingDocId);
      
      if (error) {
        alert('Error updating document: ' + error.message);
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase.from('documents').insert({ 
        user_id: user.id,
        page_id: selectedPageId || null,
        title, 
        source_type: 'text', 
        original_content: content 
      }).select().single();
      
      if (error) {
        alert('Error saving document: ' + error.message);
        setSaving(false);
        return;
      }
      targetDocId = data.id;
    }
    
    // Trigger the Cloudflare Worker to chunk and embed the document
    try {
      const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://fbchatauto-webhook.test4-sayedjohon.workers.dev';
      const response = await fetch(`${WORKER_URL}/api/documents/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: targetDocId,
          userId: user.id
        })
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process document');
      }
    } catch (err: any) {
      alert('Document saved, but embedding failed. The AI might not be able to read it yet. Error: ' + err.message);
    }
    
    setSaving(false);
    setShowModal(false);
    load();
  }

  function openAdd() {
    setEditMode(false);
    setEditingDocId(null);
    setTitle('');
    setContent('');
    setSelectedPageId('');
    setShowModal(true);
  }

  function openEdit(d: Doc) {
    setEditMode(true);
    setEditingDocId(d.id);
    setTitle(d.title);
    setContent(d.original_content || '');
    setSelectedPageId(d.page_id || '');
    setShowModal(true);
  }

  async function del(id: string) {
    if (!confirm('Delete this document?')) return;
    await supabase.from('documents').delete().eq('id', id);
    load();
  }

  async function toggle(d: Doc) {
    await supabase.from('documents').update({ is_active: !d.is_active }).eq('id', d.id);
    load();
  }

  return (
    <div className="animate-slideUp">
      <div className="page-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <h1>Documents</h1>
          <p>Upload text for the AI to search when answering questions (RAG).</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Document</button>
      </div>

      {loading ? <div className="card" style={{padding:'48px',textAlign:'center',color:'var(--text-secondary)'}}>Loading...</div>
      : docs.length === 0 ? (
        <div className="card"><div className="empty-state">
          <FileText className="empty-state-icon" />
          <h3>No Documents Yet</h3>
          <p>Upload text content that the AI can search through to answer detailed customer questions.</p>
          <button className="btn btn-primary" onClick={openAdd}><Upload size={16} /> Upload First Document</button>
        </div></div>
      ) : docs.map((d) => (
        <div key={d.id} className="list-item" style={{opacity: d.is_active ? 1 : 0.5}}>
          <div className="provider-icon" style={{background:'rgba(99,102,241,0.1)',color:'var(--accent-primary)'}}><FileText size={18}/></div>
          <div className="list-item-content">
            <div className="list-item-title">{d.title}</div>
            <div className="list-item-subtitle">
              {d.page_id ? `Assigned to: ${pages.find(p => p.page_id === d.page_id)?.page_name || d.page_id}` : 'Global (All Pages)'} • {d.chunk_count} chunks • {new Date(d.created_at).toLocaleDateString()}
            </div>
          </div>
          <div className="list-item-actions">
            <span className={`badge ${d.chunk_count > 0 ? 'badge-success' : 'badge-warning'}`}>{d.chunk_count > 0 ? 'Embedded' : 'Not Embedded'}</span>
            <button className={`btn btn-sm ${d.is_active ? 'btn-secondary' : 'btn-danger'}`} onClick={() => toggle(d)}>{d.is_active ? 'Active' : 'Inactive'}</button>
            <button className="btn btn-sm btn-secondary" onClick={() => openEdit(d)}>Edit</button>
            <button className="btn-ghost btn-icon" onClick={() => del(d.id)}><Trash2 size={14}/></button>
          </div>
        </div>
      ))}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit Document' : 'Add Document'}</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18}/></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="doc-title">Title</label>
                  <input id="doc-title" className="form-input" placeholder="e.g., Product Catalog" value={title} onChange={e=>setTitle(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="doc-page">Assign to Page (Optional)</label>
                  <select id="doc-page" className="form-select" value={selectedPageId} onChange={e=>setSelectedPageId(e.target.value)}>
                    <option value="">Global (Applies to all connected pages)</option>
                    {pages.map(p => (
                      <option key={p.page_id} value={p.page_id}>{p.page_name || p.page_id}</option>
                    ))}
                  </select>
                  <p className="form-hint">If you select a page, only that specific Facebook Page will use this document.</p>
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="doc-content">Content</label>
                  <textarea id="doc-content" className="form-textarea" placeholder="Paste your document text..." value={content} onChange={e=>setContent(e.target.value)} required style={{minHeight:'200px'}} />
                  <p className="form-hint">Text will be chunked & embedded for AI search.{content.length > 0 && ` (~${Math.ceil(content.length/4)} tokens)`}</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/> : <Save size={14}/>} 
                  {saving ? 'Saving...' : (editMode ? 'Save Changes' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
