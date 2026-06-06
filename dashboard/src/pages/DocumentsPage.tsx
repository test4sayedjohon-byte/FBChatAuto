import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Trash2, FileText, Upload, X, Save, Loader2, Filter } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface Doc {
  id: string;
  title: string;
  source_type: string;
  original_content?: string;
  chunk_count: number;
  is_active: boolean;
  created_at: string;
  // Legacy single page_id kept for reference; real scoping is in document_page_assignments
  page_id: string | null;
  // Populated after loading assignments
  assignedPageIds?: string[];
}

interface PageOption {
  page_id: string;
  page_name: string | null;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  // Multi-select: empty array = Global, non-empty = specific pages
  const [selectedPageIds, setSelectedPageIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Filter
  const [filterPageId, setFilterPageId] = useState<string>('all');

  useEffect(() => {
    if (user) {
      load();
    }
  }, [user]);

  async function load() {
    if (!user) return;
    // Run pages + documents queries in parallel
    const [pagesRes, docsRes] = await Promise.all([
      supabase.from('page_connections').select('page_id, page_name').eq('user_id', user.id),
      supabase.from('documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    const loadedPages: PageOption[] = pagesRes.data ?? [];
    setPages(loadedPages);

    const docsData = docsRes.data;
    if (!docsData) { setLoading(false); return; }

    // Load page assignments (only needs doc IDs from above)
    const docIds = docsData.map((d) => d.id);
    const { data: assignments } = docIds.length > 0
      ? await supabase.from('document_page_assignments').select('document_id, page_id').in('document_id', docIds)
      : { data: [] };

    // Map assignments to docs
    const assignmentMap: Record<string, string[]> = {};
    for (const a of assignments ?? []) {
      if (!assignmentMap[a.document_id]) assignmentMap[a.document_id] = [];
      assignmentMap[a.document_id].push(a.page_id);
    }

    const enriched: Doc[] = docsData.map((d) => ({
      ...d,
      assignedPageIds: assignmentMap[d.id] ?? [],
    }));
    setDocs(enriched);
    setLoading(false);
  }

  // Filter docs visible for the selected page
  const visibleDocs = docs.filter((d) => {
    if (filterPageId === 'all') return true;
    if (filterPageId === 'global') return (d.assignedPageIds ?? []).length === 0;
    // Specific page: show global docs + docs assigned to this page
    return (d.assignedPageIds ?? []).length === 0 || (d.assignedPageIds ?? []).includes(filterPageId);
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { alert('You must be logged in.'); setSaving(false); return; }

    let targetDocId = editingDocId;

    if (editMode && editingDocId) {
      const { error } = await supabase.from('documents').update({
        title,
        original_content: content,
        // Keep legacy page_id as null (scoping now via assignments table)
        page_id: null,
      }).eq('id', editingDocId);

      if (error) { alert('Error updating document: ' + error.message); setSaving(false); return; }
    } else {
      const { data, error } = await supabase.from('documents').insert({
        user_id: user.id,
        page_id: null, // Scoping handled by document_page_assignments
        title,
        source_type: 'text',
        original_content: content,
      }).select().single();

      if (error) { alert('Error saving document: ' + error.message); setSaving(false); return; }
      targetDocId = data.id;
    }

    // Sync page assignments: delete old ones, insert new ones
    if (targetDocId) {
      await supabase.from('document_page_assignments').delete().eq('document_id', targetDocId);

      if (selectedPageIds.length > 0) {
        const rows = selectedPageIds.map((pid) => ({ document_id: targetDocId!, page_id: pid }));
        const { error: assignError } = await supabase.from('document_page_assignments').insert(rows);
        if (assignError) { alert('Error saving page assignments: ' + assignError.message); }
      }
    }

    // Trigger embedding
    try {
      const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://metachat.junoverseai.com';
      const response = await fetch(`${WORKER_URL}/api/documents/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: targetDocId, userId: user.id }),
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
    setSelectedPageIds([]);
    setShowModal(true);
  }

  function openEdit(d: Doc) {
    setEditMode(true);
    setEditingDocId(d.id);
    setTitle(d.title);
    setContent(d.original_content || '');
    setSelectedPageIds(d.assignedPageIds ?? []);
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

  function togglePageSelection(pageId: string) {
    setSelectedPageIds((prev) =>
      prev.includes(pageId) ? prev.filter((p) => p !== pageId) : [...prev, pageId]
    );
  }

  function getAssignmentLabel(d: Doc) {
    const ids = d.assignedPageIds ?? [];
    if (ids.length === 0) return 'Global (all pages)';
    if (ids.length === 1) {
      const p = pages.find((p) => p.page_id === ids[0]);
      return p?.page_name || ids[0];
    }
    return `${ids.length} pages`;
  }

  function getAssignmentColor(d: Doc) {
    const ids = d.assignedPageIds ?? [];
    return ids.length === 0
      ? { bg: 'rgba(16,185,129,0.12)', color: '#10b981' }
      : { bg: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)' };
  }

  return (
    <div className="animate-slideUp">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Documents</h1>
          <p>Upload text for the AI to search when answering questions (RAG).</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={16} /> Add Document</button>
      </div>

      {/* Page Filter Bar */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <Filter size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', flexShrink: 0 }}>View docs visible to:</span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${filterPageId === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterPageId('all')}
          >All Docs</button>
          <button
            className={`btn btn-sm ${filterPageId === 'global' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterPageId('global')}
          >🌐 Global Only</button>
          {pages.map((p) => (
            <button
              key={p.page_id}
              className={`btn btn-sm ${filterPageId === p.page_id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterPageId(p.page_id)}
            >{p.page_name || p.page_id}</button>
          ))}
        </div>
        {filterPageId !== 'all' && filterPageId !== 'global' && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            Showing global + page-specific docs
          </span>
        )}
      </div>

      {loading
        ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1,2,3].map(i => (
              <div key={i} className="card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '8px', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="skeleton" style={{ height: '16px', width: '40%', borderRadius: '4px' }} />
                  <div className="skeleton" style={{ height: '12px', width: '60%', borderRadius: '4px' }} />
                </div>
                <div className="skeleton" style={{ width: '80px', height: '28px', borderRadius: '6px' }} />
              </div>
            ))}
          </div>
        )
        : visibleDocs.length === 0
        ? (
          <div className="card"><div className="empty-state">
            <FileText className="empty-state-icon" />
            <h3>No Documents{filterPageId !== 'all' ? ' for this filter' : ' Yet'}</h3>
            <p>Upload text content that the AI can search through to answer detailed customer questions.</p>
            <button className="btn btn-primary" onClick={openAdd}><Upload size={16} /> Upload First Document</button>
          </div></div>
        ) : visibleDocs.map((d) => {
          const { bg, color } = getAssignmentColor(d);
          return (
            <div key={d.id} className="list-item" style={{ opacity: d.is_active ? 1 : 0.5 }}>
              <div className="provider-icon" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)' }}><FileText size={18} /></div>
              <div className="list-item-content">
                <div className="list-item-title">{d.title}</div>
                <div className="list-item-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span>{d.chunk_count} chunks</span>
                  <span>•</span>
                  <span>{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
                <div style={{ marginTop: '4px' }}>
                  <span style={{ fontSize: '0.75rem', background: bg, color, padding: '2px 8px', borderRadius: '99px', display: 'inline-block' }}>
                    {(d.assignedPageIds ?? []).length === 0 ? '🌐' : '📄'} {getAssignmentLabel(d)}
                  </span>
                </div>
              </div>
              <div className="list-item-actions">
                <span className={`badge ${d.chunk_count > 0 ? 'badge-success' : 'badge-warning'}`}>{d.chunk_count > 0 ? 'Embedded' : 'Not Embedded'}</span>
                <button className={`btn btn-sm ${d.is_active ? 'btn-secondary' : 'btn-danger'}`} onClick={() => toggle(d)}>{d.is_active ? 'Active' : 'Inactive'}</button>
                <button className="btn btn-sm btn-secondary" onClick={() => openEdit(d)}>Edit</button>
                <button className="btn-ghost btn-icon" onClick={() => del(d.id)}><Trash2 size={14} /></button>
              </div>
            </div>
          );
        })
      }

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode ? 'Edit Document' : 'Add Document'}</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="doc-title">Title</label>
                  <input id="doc-title" className="form-input" placeholder="e.g., Product Catalog" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>

                {/* Multi-page assignment */}
                <div className="form-group">
                  <label className="form-label">Assign to Pages</label>
                  <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                    {/* Global option */}
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                      cursor: 'pointer', borderBottom: pages.length > 0 ? '1px solid var(--border)' : 'none',
                      background: selectedPageIds.length === 0 ? 'rgba(16,185,129,0.08)' : 'transparent'
                    }}>
                      <input
                        type="radio"
                        name="page-scope"
                        checked={selectedPageIds.length === 0}
                        onChange={() => setSelectedPageIds([])}
                        style={{ accentColor: '#10b981' }}
                      />
                      <span style={{ fontSize: '0.9rem' }}>🌐 <strong>Global</strong> — visible to all pages</span>
                    </label>
                    {/* Per-page checkboxes */}
                    {pages.map((p, i) => (
                      <label key={p.page_id} style={{
                        display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
                        cursor: 'pointer', borderBottom: i < pages.length - 1 ? '1px solid var(--border)' : 'none',
                        background: selectedPageIds.includes(p.page_id) ? 'rgba(99,102,241,0.08)' : 'transparent'
                      }}>
                        <input
                          type="checkbox"
                          checked={selectedPageIds.includes(p.page_id)}
                          onChange={() => {
                            // When selecting a specific page, switch from global mode
                            togglePageSelection(p.page_id);
                          }}
                          style={{ accentColor: 'var(--accent-primary)' }}
                        />
                        <span style={{ fontSize: '0.9rem' }}>📄 {p.page_name || p.page_id}</span>
                      </label>
                    ))}
                  </div>
                  <p className="form-hint">
                    <strong>Global</strong> = all pages can use this doc. Selecting specific pages restricts it to only those.
                  </p>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="doc-content" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ marginBottom: 0 }}>Content</span>
                    <label className="btn btn-sm btn-secondary" style={{ cursor: 'pointer', margin: 0, fontWeight: 500 }}>
                      <Upload size={14} /> Upload File (.txt, .md, .json)
                      <input 
                        type="file" 
                        accept=".txt,.md,.json" 
                        style={{ display: 'none' }} 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result;
                            if (typeof result === 'string') {
                               setContent(result);
                               if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
                            }
                          };
                          reader.readAsText(file);
                          e.target.value = '';
                        }} 
                      />
                    </label>
                  </label>
                  <textarea
                    id="doc-content"
                    className="form-textarea"
                    placeholder="Paste your document text or upload a file..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    required
                    style={{ minHeight: '200px' }}
                  />
                  <p className="form-hint">Text will be chunked & embedded for AI search.{content.length > 0 && ` (~${Math.ceil(content.length / 4)} tokens)`}</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
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
