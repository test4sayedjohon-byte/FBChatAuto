import { useEffect, useState, type FormEvent } from 'react';
import { toast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { workerPost } from '../lib/workerApi';
import { 
  Plus, 
  Trash2, 
  FileText, 
  Upload, 
  X, 
  Save, 
  Loader2, 
  Folder as FolderIcon, 
  Pencil, 
  ArrowLeft, 
  Database,
  Image as ImageIcon, 
  Video as VideoIcon, 
  Music as AudioIcon, 
  Globe, 
  MessageSquare, 
  Calendar, 
  Clock, 
  ExternalLink 
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import HelpTooltip from '../components/HelpTooltip';

interface Folder {
  id: string;
  name: string;
  description: string;
  assigned_page_ids: string[];
}

interface PageOption {
  page_id: string;
  page_name: string | null;
}

interface Doc {
  id: string;
  title: string;
  source_type: string;
  original_content?: string;
  chunk_count: number;
  is_active: boolean;
  created_at: string;
  folder_id: string;
}

interface MediaAsset {
  id: string;
  friendly_name: string;
  name: string;
  description: string | null;
  file_url: string;
  file_type: 'image' | 'video' | 'audio' | 'file';
  created_at: string;
  folder_id: string | null;
  use_in_chat: boolean;
  use_in_comments: boolean;
  use_in_scheduler: boolean;
  is_permanent: boolean;
}

export default function DocumentsPage() {
  useDocumentTitle('Knowledge Base — AutometaBot');
  const { user } = useAuth();
  
  // Data States
  const [folders, setFolders] = useState<Folder[]>([]);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);

  // View State
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // Folder Modal States
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderDescription, setFolderDescription] = useState('');
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [savingFolder, setSavingFolder] = useState(false);

  const [showDocModal, setShowDocModal] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [savingDoc, setSavingDoc] = useState(false);

  // Warning Modal State
  const [showNoFolderModal, setShowNoFolderModal] = useState(false);

  useEffect(() => {
    if (user) {
      loadAll();
      const handleAgentUpdate = () => loadAll();
      window.addEventListener('agent-data-updated', handleAgentUpdate);
      return () => window.removeEventListener('agent-data-updated', handleAgentUpdate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function loadAll() {
    if (!user) return;
    setLoading(true);

    const [foldersRes, assignmentsRes, pagesRes, docsRes, mediaRes] = await Promise.all([
      supabase.from('document_folders').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('folder_page_assignments').select('folder_id, page_id').eq('user_id', user.id),
      supabase.from('page_connections').select('page_id, page_name').eq('user_id', user.id),
      supabase.from('documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
      supabase.from('media').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    ]);

    if (pagesRes.data) setPages(pagesRes.data);
    if (docsRes.data) setDocs(docsRes.data);
    if (mediaRes.data) setMedia(mediaRes.data);

    if (foldersRes.data) {
      const assignments = assignmentsRes.data || [];
      const combined = foldersRes.data.map(folder => ({
        ...folder,
        assigned_page_ids: assignments.filter(a => a.folder_id === folder.id).map(a => a.page_id)
      }));
      setFolders(combined);
    }
    
    setLoading(false);
  }

  // --- Folder Logic ---
  function openAddFolder() {
    setEditingFolder(null);
    setFolderName('');
    setFolderDescription('');
    setSelectedPages([]);
    setShowFolderModal(true);
  }

  function openEditFolder(folder: Folder) {
    setEditingFolder(folder);
    setFolderName(folder.name);
    setFolderDescription(folder.description || '');
    setSelectedPages(folder.assigned_page_ids || []);
    setShowFolderModal(true);
  }

  function togglePageSelection(pageId: string) {
    setSelectedPages(prev => 
      prev.includes(pageId) ? prev.filter(p => p !== pageId) : [...prev, pageId]
    );
  }

  async function handleFolderSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingFolder(true);

    if (!user) return;

    try {
      let folderId = editingFolder?.id;

      if (editingFolder) {
        const { error: folderError } = await supabase
          .from('document_folders')
          .update({ name: folderName, description: folderDescription })
          .eq('id', editingFolder.id);
        if (folderError) throw folderError;

        await supabase.from('folder_page_assignments').delete().eq('folder_id', editingFolder.id);
      } else {
        const { data, error: folderError } = await supabase
          .from('document_folders')
          .insert({ user_id: user.id, name: folderName, description: folderDescription })
          .select('id')
          .single();
        if (folderError) throw folderError;
        if (data) folderId = data.id;
      }

      if (folderId && selectedPages.length > 0) {
        const assignmentsPayload = selectedPages.map(pageId => ({
          user_id: user.id,
          folder_id: folderId!,
          page_id: pageId
        }));
        const { error: assignError } = await supabase.from('folder_page_assignments').insert(assignmentsPayload);
        if (assignError) throw assignError;
      }

      toast.success(editingFolder ? `Folder "${folderName}" updated successfully.` : `Folder "${folderName}" created successfully.`);
      setShowFolderModal(false);
      loadAll();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    }
    setSavingFolder(false);
  }

  async function deleteFolder(id: string) {
    if (!confirm('Are you sure you want to delete this folder? Documents inside may be orphaned or deleted.')) return;
    const folder = folders.find(f => f.id === id);
    const folderNameForToast = folder?.name || '';
    try {
      await supabase.from('folder_page_assignments').delete().eq('folder_id', id);
      const { error } = await supabase.from('document_folders').delete().eq('id', id);
      if (error) throw error;
      toast.success(`Folder "${folderNameForToast}" deleted successfully.`);
      if (activeFolderId === id) setActiveFolderId(null);
      loadAll();
    } catch (err: any) {
      toast.error('Error deleting folder: ' + err.message);
    }
  }

  function getPageName(pageId: string) {
    return pages.find((p) => p.page_id === pageId)?.page_name || pageId;
  }

  // --- Document Logic ---
  const activeFolderDocs = docs.filter(d => d.folder_id === activeFolderId);
  const activeFolderMedia = media.filter(m => m.folder_id === activeFolderId);
  const activeFolder = folders.find(f => f.id === activeFolderId);

  const getIcon = (type: string) => {
    switch (type) {
      case 'image': return <ImageIcon size={18} style={{ color: '#10b981' }} />;
      case 'video': return <VideoIcon size={18} style={{ color: '#3b82f6' }} />;
      case 'audio': return <AudioIcon size={18} style={{ color: '#eab308' }} />;
      default: return <FileText size={18} style={{ color: '#a855f7' }} />;
    }
  };

  function handleTopLevelAddDoc() {
    if (folders.length === 0) {
      setShowNoFolderModal(true);
    } else {
      openAddDoc();
    }
  }

  function openAddDoc() {
    setEditingDocId(null);
    setDocTitle('');
    setDocContent('');
    setSelectedFolderId(activeFolderId || (folders.length > 0 ? folders[0].id : ''));
    setShowDocModal(true);
  }

  function openEditDoc(d: Doc) {
    setEditingDocId(d.id);
    setDocTitle(d.title);
    setDocContent(d.original_content || '');
    setSelectedFolderId(d.folder_id);
    setShowDocModal(true);
  }

  async function handleDocSubmit(e: FormEvent) {
    e.preventDefault();
    setSavingDoc(true);

    if (!user || !selectedFolderId) {
      toast.error('Please select a folder for this document.');
      setSavingDoc(false);
      return;
    }

    let targetDocId = editingDocId;
    let embeddingSuccess = true;

    try {
      if (editingDocId) {
        const { error } = await supabase.from('documents').update({
          title: docTitle,
          original_content: docContent,
          folder_id: selectedFolderId,
        }).eq('id', editingDocId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('documents').insert({
          user_id: user.id,
          folder_id: selectedFolderId,
          title: docTitle,
          source_type: 'text',
          original_content: docContent,
        }).select().single();
        if (error) throw error;
        targetDocId = data.id;
      }

      // Trigger embedding
      try {
        await workerPost('/api/documents/process', {
          documentId: targetDocId,
          userId: user.id,
        });
      } catch (err: any) {
        embeddingSuccess = false;
        toast.warning('Document saved, but embedding failed. ' + err.message);
      }

      if (embeddingSuccess) {
        toast.success(editingDocId ? `Document "${docTitle}" updated and embedded successfully.` : `Document "${docTitle}" created and embedded successfully.`);
      }

      setShowDocModal(false);
      loadAll();
    } catch (err: any) {
      toast.error('Error saving document: ' + err.message);
    }
    setSavingDoc(false);
  }

  async function deleteDoc(id: string) {
    if (!confirm('Delete this document?')) return;
    const doc = docs.find(d => d.id === id);
    const docTitleForToast = doc?.title || '';
    try {
      const { error } = await supabase.from('documents').delete().eq('id', id);
      if (error) throw error;
      toast.success(`Document "${docTitleForToast}" deleted successfully.`);
      loadAll();
    } catch (err: any) {
      toast.error('Error deleting document: ' + err.message);
    }
  }

  async function toggleDocStatus(d: Doc) {
    const nextActive = !d.is_active;
    try {
      const { error } = await supabase.from('documents').update({ is_active: nextActive }).eq('id', d.id);
      if (error) throw error;
      toast.success(`Document "${d.title}" is now ${nextActive ? 'active' : 'inactive'}.`);
      loadAll();
    } catch (err: any) {
      toast.error('Error updating status: ' + err.message);
    }
  }

  return (
    <div className="animate-slideUp">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center' }}>
            Knowledge Base
            <HelpTooltip id="knowledgeBaseUnified" />
          </h1>
          <p>Organize your knowledge into folders (Data Sources) and add documents.</p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1,2,3].map(i => (
            <div key={i} className="card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div className="skeleton" style={{ height: '16px', width: '35%', borderRadius: '4px' }} />
            </div>
          ))}
        </div>
      ) : activeFolderId === null ? (
        // FOLDERS VIEW
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Data Sources (Folders)</h2>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary btn-sm" onClick={handleTopLevelAddDoc}>
                <Plus size={16} /> Add Document
              </button>
              <button className="btn btn-primary btn-sm" onClick={openAddFolder}>
                <Plus size={16} /> Add Folder
              </button>
            </div>
          </div>

          {folders.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <Database className="empty-state-icon" />
                <h3>No Data Sources</h3>
                <p>Create a Data Source folder to organize your knowledge base documents.</p>
                <button className="btn btn-primary" onClick={openAddFolder} style={{ marginTop: '16px' }}>
                  <Plus size={16} /> Create First Folder
                </button>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '20px'
            }}>
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="card"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '20px',
                    minHeight: '160px',
                    margin: 0,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    border: '1px solid var(--border-primary)',
                  }}
                  onClick={() => setActiveFolderId(folder.id)}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)', wordBreak: 'break-word', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FolderIcon size={18} style={{ color: 'var(--accent-primary)' }} />
                      {folder.name}
                    </div>
                    {folder.description && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        {folder.description}
                      </div>
                    )}
                    {folder.assigned_page_ids.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                        {folder.assigned_page_ids.map(pid => (
                          <span key={pid} className="badge" style={{ fontSize: '0.65rem', background: 'var(--accent-primary-glow)', color: 'var(--accent-primary-hover)', textTransform: 'none', padding: '3px 8px', borderRadius: '99px' }}>
                            📄 {getPageName(pid)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px', fontStyle: 'italic' }}>
                        Unassigned (Global or unused)
                      </div>
                    )}
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    borderTop: '1px solid var(--border-primary)',
                    paddingTop: '14px',
                    marginTop: 'auto',
                    gap: '8px'
                  }}>
                    <button className="btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); openEditFolder(folder); }} title="Edit Folder" style={{ width: '32px', height: '32px' }}>
                      <Pencil size={14} />
                    </button>
                    <button className="btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); deleteFolder(folder.id); }} title="Delete Folder" style={{ width: '32px', height: '32px', color: 'var(--error)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // DOCUMENTS VIEW
        <div className="animate-slideUp">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <button className="btn-ghost btn-sm" onClick={() => setActiveFolderId(null)} style={{ padding: '8px' }}>
              <ArrowLeft size={18} />
            </button>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              <FolderIcon size={20} style={{ color: 'var(--accent-primary)' }} />
              {activeFolder?.name}
            </h2>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Documents in this folder</h3>
            <button className="btn btn-primary btn-sm" onClick={openAddDoc}>
              <Plus size={16} /> Add Document
            </button>
          </div>

          {activeFolderDocs.length === 0 ? (
            <div className="card">
              <div className="empty-state">
                <FileText className="empty-state-icon" />
                <h3>No Documents</h3>
                <p>Add documents to this folder to increase the AI's knowledge.</p>
                <button className="btn btn-primary" onClick={openAddDoc} style={{ marginTop: '16px' }}>
                  <Upload size={16} /> Upload First Document
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeFolderDocs.map((d) => (
                <div key={d.id} className="list-item list-item-responsive" style={{ opacity: d.is_active ? 1 : 0.5 }}>
                  <div className="provider-icon" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)' }}><FileText size={18} /></div>
                  <div className="list-item-content">
                    <div className="list-item-title">{d.title}</div>
                    <div className="list-item-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{d.chunk_count} chunks</span>
                      <span>•</span>
                      <span>{new Date(d.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="list-item-actions list-item-actions-responsive">
                    <span className={`badge ${d.chunk_count > 0 ? 'badge-success' : 'badge-warning'}`}>{d.chunk_count > 0 ? 'Embedded' : 'Not Embedded'}</span>
                    <button className={`btn btn-sm ${d.is_active ? 'btn-secondary' : 'btn-danger'}`} onClick={() => toggleDocStatus(d)}>{d.is_active ? 'Active' : 'Inactive'}</button>
                    <button className="btn btn-sm btn-secondary" onClick={() => openEditDoc(d)}>Edit</button>
                    <button className="btn-ghost btn-icon" onClick={() => deleteDoc(d.id)}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Media Files Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '32px', marginBottom: '16px', borderTop: '1px solid var(--border-primary)', paddingTop: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Media Assets in this folder</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Manage all uploads in the Media Vault</span>
          </div>

          {activeFolderMedia.length === 0 ? (
            <div className="card" style={{ padding: '24px', textAlign: 'center', background: 'var(--bg-secondary)', borderStyle: 'dashed' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No media files are assigned to this folder.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activeFolderMedia.map((m) => (
                <div key={m.id} className="list-item list-item-responsive">
                  <div className="provider-icon" style={{ 
                    background: 'var(--bg-primary)', 
                    border: '1px solid var(--border-light)', 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '6px', 
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {m.file_type === 'image' ? (
                      <img src={m.file_url} alt={m.friendly_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      getIcon(m.file_type)
                    )}
                  </div>
                  <div className="list-item-content">
                    <div className="list-item-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {m.friendly_name}
                      <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-secondary)', background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: '4px' }}>
                        [{m.name}]
                      </span>
                    </div>
                    <div className="list-item-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
                      {m.use_in_chat && (
                        <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'none', padding: '3px 8px', borderRadius: '99px' }}>
                          <MessageSquare size={10} /> Chat
                        </span>
                      )}
                      {m.use_in_comments && (
                        <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(59,130,246,0.1)', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'none', padding: '3px 8px', borderRadius: '99px' }}>
                          <Globe size={10} /> Comments
                        </span>
                      )}
                      {m.use_in_scheduler && (
                        <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(234,179,8,0.1)', color: '#eab308', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'none', padding: '3px 8px', borderRadius: '99px' }}>
                          <Calendar size={10} /> Scheduler
                        </span>
                      )}
                      {m.is_permanent ? (
                        <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(168,85,247,0.1)', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'none', padding: '3px 8px', borderRadius: '99px' }}>
                          <Clock size={10} /> Permanent
                        </span>
                      ) : (
                        <span className="badge" style={{ fontSize: '0.65rem', background: 'rgba(239,68,68,0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'none', padding: '3px 8px', borderRadius: '99px' }}>
                          <Clock size={10} /> Temp (24h)
                        </span>
                      )}
                      <span>•</span>
                      <span>{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="list-item-actions list-item-actions-responsive">
                    <a href={m.file_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ExternalLink size={12} /> View File
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* --- FOLDER MODAL --- */}
      {showFolderModal && (
        <div className="modal-overlay" onClick={() => setShowFolderModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingFolder ? 'Edit Folder' : 'New Folder'}</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowFolderModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleFolderSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Folder Name</label>
                  <input type="text" className="form-input" placeholder="e.g., Shipping Policies" value={folderName} onChange={(e) => setFolderName(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Description (Optional)</label>
                  <textarea className="form-textarea" placeholder="Briefly describe what this folder contains" value={folderDescription} onChange={(e) => setFolderDescription(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Assign to Pages</label>
                  <p className="form-hint" style={{ marginTop: '8px' }}>Only these channels will be able to search the documents in this Data Source.</p>
                  {pages.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No connected pages found.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-primary)', padding: '12px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)' }}>
                      {pages.map(page => (
                        <label key={page.page_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          <input type="checkbox" checked={selectedPages.includes(page.page_id)} onChange={() => togglePageSelection(page.page_id)} />
                          {page.page_name || page.page_id}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowFolderModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingFolder}>
                  <Save size={14} /> {savingFolder ? 'Saving...' : editingFolder ? 'Update Folder' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- DOCUMENT MODAL --- */}
      {showDocModal && (
        <div className="modal-overlay" onClick={() => setShowDocModal(false)}>
          <div className="modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingDocId ? 'Edit Document' : 'Add Document'}</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowDocModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleDocSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Title</label>
                  <input className="form-input" placeholder="e.g., Product Catalog" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Select Folder</label>
                  <select
                    className="form-select"
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select a folder...</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  <p className="form-hint">Every document must belong to a folder.</p>
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
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
                               setDocContent(result);
                               if (!docTitle) setDocTitle(file.name.replace(/\.[^/.]+$/, ""));
                            }
                          };
                          reader.readAsText(file);
                          e.target.value = '';
                        }} 
                      />
                    </label>
                  </label>
                  <textarea
                    className="form-textarea"
                    placeholder="Paste your document text or upload a file..."
                    value={docContent}
                    onChange={(e) => setDocContent(e.target.value)}
                    required
                    style={{ minHeight: '200px' }}
                  />
                  <p className="form-hint">Text will be chunked & embedded for AI search.{docContent.length > 0 && ` (~${Math.ceil(docContent.length / 4)} tokens)`}</p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDocModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={savingDoc}>
                  {savingDoc ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                  {savingDoc ? 'Saving...' : (editingDocId ? 'Save Changes' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- NO FOLDER INFO MODAL --- */}
      {showNoFolderModal && (
        <div className="modal-overlay" onClick={() => setShowNoFolderModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Setup Required</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowNoFolderModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--surface-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-primary)' }}>
                  <FolderIcon size={18} />
                  Why do I need a folder?
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '12px' }}>
                  Documents cannot exist loosely. They must be grouped into <strong>Data Sources (Folders)</strong>.
                </p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  When you connect a Facebook Page to your bot, you don't assign individual documents to it—you assign a Folder. This allows you to easily manage which AI knowledge base belongs to which business, without mixing up context.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNoFolderModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { setShowNoFolderModal(false); openAddFolder(); }}>
                <Plus size={16} /> Create Folder First
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
