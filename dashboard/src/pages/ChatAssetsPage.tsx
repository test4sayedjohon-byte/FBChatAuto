import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';
import { 
  Plus, 
  X, 
  Trash2, 
  FileText, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Music as AudioIcon, 
  ExternalLink, 
  Loader2, 
  Check
} from 'lucide-react';

interface ChatAsset {
  id: string;
  user_id: string;
  name: string;
  friendly_name: string;
  description: string | null;
  file_url: string;
  file_type: 'image' | 'video' | 'audio' | 'file';
  facebook_media_id: string | null;
  ai_auto_send: boolean;
  times_sent: number;
  created_at: string;
}

const getStoragePathFromUrl = (url: string): string | null => {
  const marker = '/media_assets/';
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const pathWithQuery = url.substring(index + marker.length);
  return decodeURIComponent(pathWithQuery.split('?')[0]);
};

export default function ChatAssetsPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<ChatAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [friendlyName, setFriendlyName] = useState('');
  const [description, setDescription] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileType, setFileType] = useState<'image' | 'video' | 'audio' | 'file'>('file');
  const [aiAutoSend, setAiAutoSend] = useState(true);

  useEffect(() => {
    if (user) {
      loadAssets();
    }
  }, [user]);

  async function loadAssets() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('chat_assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (err: any) {
      toast.error('Failed to load assets: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop() || '';
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${user.id}/chat_assets/${fileName}`;

      const { error } = await supabase.storage
        .from('media_assets')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('media_assets')
        .getPublicUrl(filePath);

      if (publicUrl) {
        setFileUrl(publicUrl);
        
        // Auto-detect type
        const lowerExt = fileExt.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(lowerExt)) {
          setFileType('image');
        } else if (['mp4', 'mov', 'avi', 'webm'].includes(lowerExt)) {
          setFileType('video');
        } else if (['mp3', 'wav', 'm4a', 'ogg'].includes(lowerExt)) {
          setFileType('audio');
        } else {
          setFileType('file');
        }

        // Auto-fill names if empty
        if (!friendlyName) {
          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
          setFriendlyName(baseName);
          setName(baseName.toLowerCase().replace(/[^a-z0-9_-]/g, '_'));
        }
      }
      toast.success('File uploaded successfully!');
    } catch (err: any) {
      toast.error('File upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  async function handleCreateAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (!name.trim()) {
      toast.error('Please specify an alias name.');
      return;
    }

    if (!fileUrl) {
      toast.error('Please upload a file or specify a URL.');
      return;
    }

    // Validate alias format
    const aliasRegex = /^[a-z0-9_-]+$/;
    if (!aliasRegex.test(name)) {
      toast.error('Alias can only contain lowercase letters, numbers, underscores, and dashes.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        user_id: user.id,
        name: name.trim(),
        friendly_name: friendlyName.trim() || name,
        description: description.trim() || null,
        file_url: fileUrl,
        file_type: fileType,
        ai_auto_send: aiAutoSend,
        times_sent: 0
      };

      const { error } = await supabase
        .from('chat_assets')
        .insert(payload);

      if (error) {
        if (error.code === '23505') {
          throw new Error('An asset with this alias name already exists.');
        }
        throw error;
      }

      toast.success('Asset added to library!');
      setShowModal(false);
      resetForm();
      loadAssets();
    } catch (err: any) {
      toast.error('Failed to create asset: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAsset(asset: ChatAsset) {
    if (!confirm(`Are you sure you want to delete '${asset.friendly_name}'?`)) return;

    try {
      // 1. Delete from storage if it is stored in our Supabase bucket
      const storagePath = getStoragePathFromUrl(asset.file_url);
      if (storagePath && asset.file_url.includes('.supabase.')) {
        await supabase.storage
          .from('media_assets')
          .remove([storagePath]);
      }

      // 2. Delete from DB
      const { error } = await supabase
        .from('chat_assets')
        .delete()
        .eq('id', asset.id);

      if (error) throw error;
      toast.success('Asset deleted successfully.');
      loadAssets();
    } catch (err: any) {
      toast.error('Failed to delete asset: ' + err.message);
    }
  }

  async function toggleAiAutoSend(asset: ChatAsset) {
    try {
      const nextVal = !asset.ai_auto_send;
      const { error } = await supabase
        .from('chat_assets')
        .update({ ai_auto_send: nextVal })
        .eq('id', asset.id);

      if (error) throw error;
      setAssets(assets.map(a => a.id === asset.id ? { ...a, ai_auto_send: nextVal } : a));
      toast.success(`AI auto-send ${nextVal ? 'enabled' : 'disabled'} for ${asset.friendly_name}`);
    } catch (err: any) {
      toast.error('Failed to update toggle: ' + err.message);
    }
  }

  function resetForm() {
    setName('');
    setFriendlyName('');
    setDescription('');
    setFileUrl('');
    setFileType('file');
    setAiAutoSend(true);
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'image': return <ImageIcon size={18} style={{ color: '#10b981' }} />;
      case 'video': return <VideoIcon size={18} style={{ color: '#3b82f6' }} />;
      case 'audio': return <AudioIcon size={18} style={{ color: '#eab308' }} />;
      default: return <FileText size={18} style={{ color: '#a855f7' }} />;
    }
  };

  return (
    <div className="page-container animate-slideUp">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Chat Assets Library</h1>
          <p>Upload files (pricing PDFs, menus, images) and define aliases for AI triggers in Messenger.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus size={16} /> Upload Asset
        </button>
      </header>

      {loading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Loader2 className="animate-spin" style={{ margin: '0 auto 16px auto' }} />
          Loading asset library...
        </div>
      ) : assets.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', background: 'var(--bg-secondary)' }}>
          <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <FileText size={48} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />
            <h3>No Assets Registered</h3>
            <p>Upload document sheets, media files, or links to share with your customers dynamically.</p>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>Upload Asset</button>
          </div>
        </div>
      ) : (
        <div className="table-responsive" style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
          <table className="table" style={{ margin: 0, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>Type</th>
                <th>Asset / Friendly Name</th>
                <th>AI Alias (Trigger)</th>
                <th>Description</th>
                <th>Usage Count</th>
                <th>AI Auto-Send</th>
                <th style={{ width: '100px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assets.map(asset => (
                <tr key={asset.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '6px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', overflow: 'hidden' }}>
                      {asset.file_type === 'image' ? (
                        <img src={asset.file_url} alt={asset.friendly_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        getIcon(asset.file_type)
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{asset.friendly_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                      Uploaded {new Date(asset.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td>
                    <code style={{ background: 'var(--bg-primary)', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--border-light)', color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 600 }}>
                      [SendFile: {asset.name}]
                    </code>
                  </td>
                  <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={asset.description || ''}>
                    {asset.description || '-'}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                    {asset.times_sent} times sent
                  </td>
                  <td>
                    <label className="switch" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={asset.ai_auto_send}
                        onChange={() => toggleAiAutoSend(asset)}
                        style={{ display: 'none' }} 
                      />
                      <div style={{
                        width: '36px',
                        height: '20px',
                        borderRadius: '10px',
                        background: asset.ai_auto_send ? 'var(--success)' : 'var(--border-primary)',
                        position: 'relative',
                        transition: 'background 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '2px'
                      }}>
                        <div style={{
                          width: '16px',
                          height: '16px',
                          borderRadius: '50%',
                          background: '#fff',
                          position: 'absolute',
                          left: asset.ai_auto_send ? '18px' : '2px',
                          transition: 'left 0.2s'
                        }} />
                      </div>
                    </label>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <a 
                        href={asset.file_url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="btn btn-secondary btn-sm btn-icon"
                        title="View direct link"
                        style={{ padding: '6px' }}
                      >
                        <ExternalLink size={14} />
                      </a>
                      <button 
                        className="btn btn-danger btn-sm btn-icon"
                        onClick={() => handleDeleteAsset(asset)}
                        title="Delete asset"
                        style={{ padding: '6px' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload/Creation Modal */}
      {showModal && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div className="modal animate-scaleUp" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '24px', borderRadius: '16px', maxWidth: '500px', width: '100%', margin: '16px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>Upload Chat Asset</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateAsset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* File Upload Section */}
              <div className="form-group">
                <label className="form-label">Upload File (PDF, Catalog, Image, etc.)</label>
                <div style={{
                  border: '1.5px dashed var(--border-primary)',
                  borderRadius: '10px',
                  padding: '24px',
                  textAlign: 'center',
                  background: 'rgba(255,255,255,0.01)',
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {uploading ? (
                    <>
                      <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent-primary)' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Uploading to secure vault...</span>
                    </>
                  ) : fileUrl ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      {fileType === 'image' ? (
                        <img src={fileUrl} alt="Preview" style={{ width: '80px', height: '80px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-primary)' }} />
                      ) : (
                        <Check size={24} style={{ color: 'var(--success)' }} />
                      )}
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>File uploaded successfully!</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', wordBreak: 'break-all', maxWidth: '200px' }} title={fileUrl}>
                        {fileUrl.substring(fileUrl.lastIndexOf('/') + 1)}
                      </span>
                    </div>
                  ) : (
                    <>
                      <FileText size={24} style={{ color: 'var(--text-secondary)' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Click to browse and upload file</span>
                      <input 
                        type="file" 
                        onChange={handleFileUpload} 
                        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0, cursor: 'pointer' }} 
                      />
                    </>
                  )}
                </div>
              </div>

              {/* URL fallback (if they just paste an external link) */}
              <div className="form-group">
                <label className="form-label" htmlFor="fileUrl">Or Paste Public Asset URL</label>
                <input 
                  id="fileUrl"
                  className="form-input" 
                  placeholder="https://example.com/assets/price-sheet.pdf"
                  value={fileUrl}
                  onChange={e => setFileUrl(e.target.value)}
                  disabled={uploading}
                />
              </div>

              {/* Alias Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="assetName">AI Alias (Trigger Tag Name)</label>
                <input 
                  id="assetName"
                  className="form-input" 
                  placeholder="e.g. price_list"
                  value={name}
                  onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '_'))}
                  disabled={uploading}
                  required
                />
                <span className="form-hint">Must be alphanumeric (lowercase) with underscores/dashes. AI will trigger this with <code>[SendFile: {name || 'alias'}]</code>.</span>
              </div>

              {/* Friendly Name */}
              <div className="form-group">
                <label className="form-label" htmlFor="friendlyName">Display Name (Friendly Name)</label>
                <input 
                  id="friendlyName"
                  className="form-input" 
                  placeholder="e.g. 2026 Price List PDF"
                  value={friendlyName}
                  onChange={e => setFriendlyName(e.target.value)}
                  disabled={uploading}
                  required
                />
              </div>

              {/* File Type Select */}
              <div className="form-group">
                <label className="form-label" htmlFor="fileType">File Type Category</label>
                <select 
                  id="fileType"
                  className="form-input"
                  value={fileType}
                  onChange={e => setFileType(e.target.value as any)}
                  disabled={uploading}
                >
                  <option value="file">Document File / PDF</option>
                  <option value="image">Image (JPG, PNG, WebP)</option>
                  <option value="video">Video (MP4, MOV)</option>
                  <option value="audio">Audio (MP3, Voice)</option>
                </select>
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label" htmlFor="description">Description for AI instructions</label>
                <textarea 
                  id="description"
                  className="form-input" 
                  placeholder="Tell the AI what this file contains so it knows when to send it (e.g. 'Use this to answer queries about our service costs')"
                  rows={2}
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  disabled={uploading}
                  style={{ resize: 'none', padding: '10px' }}
                />
              </div>

              {/* AI Auto-send flag */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  id="aiAutoSend"
                  type="checkbox" 
                  checked={aiAutoSend}
                  onChange={e => setAiAutoSend(e.target.checked)}
                  disabled={uploading}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                />
                <label htmlFor="aiAutoSend" style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', cursor: 'pointer' }}>
                  Enable AI Auto-Send (Let AI trigger this in chat)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || uploading || !fileUrl}>
                  {saving ? 'Saving...' : 'Add to Library'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
