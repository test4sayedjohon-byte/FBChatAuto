import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';
import { Loader2, Image as ImageIcon, Plus, Check } from 'lucide-react';

interface ChatAsset {
  id: string;
  friendly_name: string;
  file_url: string;
  file_type: string;
}

interface AssetSelectorProps {
  selectedUrl?: string;
  onSelect: (url: string, type: 'image' | 'video' | 'audio' | 'file') => void;
}

export default function AssetSelector({ selectedUrl, onSelect }: AssetSelectorProps) {
  const { user } = useAuth();
  const [assets, setAssets] = useState<ChatAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (user) {
      loadAssets();
    }
  }, [user]);

  async function loadAssets() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('media')
        .select('id, friendly_name, file_url, file_type')
        .eq('file_type', 'image') // Visual selector mainly targets images
        .eq('use_in_chat', true)  // Only load assets meant for chat
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
      const filePath = `${user.id}/media/${fileName}`;

      // 1. Upload to storage
      const { error: uploadErr } = await supabase.storage
        .from('media_assets')
        .upload(filePath, file);

      if (uploadErr) throw uploadErr;

      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media_assets')
        .getPublicUrl(filePath);

      if (!publicUrl) throw new Error('Failed to retrieve public URL');

      // 3. Register record in media table
      const friendlyName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      const aliasName = friendlyName.toLowerCase().replace(/[^a-z0-9_-]/g, '_');

      const { data: registeredData, error: dbErr } = await supabase
        .from('media')
        .insert({
          user_id: user.id,
          name: aliasName,
          friendly_name: friendlyName,
          file_url: publicUrl,
          file_type: 'image',
          ai_auto_send: false,
          use_in_chat: true,
          use_in_comments: false,
          use_in_scheduler: false,
          is_permanent: true
        })
        .select()
        .single();

      if (dbErr) throw dbErr;

      toast.success('Asset uploaded and registered successfully!');
      
      // Update state and trigger selection
      setAssets(prev => [registeredData, ...prev]);
      onSelect(publicUrl, 'image');
    } catch (err: any) {
      toast.error('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Selector Grid */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(3, 1fr)', 
        gap: '8px', 
        maxHeight: '220px', 
        overflowY: 'auto',
        padding: '4px',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-primary)'
      }}>
        {/* Upload Block */}
        <label style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          aspectRatio: '1',
          background: 'rgba(255,255,255,0.02)',
          border: '1px dashed var(--border-primary)',
          borderRadius: 'var(--radius-sm)',
          cursor: uploading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
          gap: '4px'
        }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-primary)'}
        >
          {uploading ? (
            <Loader2 className="animate-spin" size={16} color="var(--text-secondary)" />
          ) : (
            <>
              <Plus size={16} color="var(--text-secondary)" />
              <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Upload</span>
            </>
          )}
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleFileUpload} 
            disabled={uploading} 
            style={{ display: 'none' }} 
          />
        </label>

        {loading ? (
          <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60px' }}>
            <Loader2 className="animate-spin" size={16} color="var(--text-secondary)" />
          </div>
        ) : assets.length === 0 ? (
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px', opacity: 0.5 }}>
            <ImageIcon size={16} />
            <span style={{ fontSize: '9px', marginTop: '2px' }}>No assets</span>
          </div>
        ) : (
          assets.map(asset => {
            const isSelected = selectedUrl === asset.file_url;
            return (
              <div
                key={asset.id}
                onClick={() => onSelect(asset.file_url, 'image')}
                style={{
                  position: 'relative',
                  aspectRatio: '1',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                  background: '#0d0e10'
                }}
              >
                <img 
                  src={asset.file_url} 
                  alt={asset.friendly_name} 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                />
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: 'rgba(0,0,0,0.6)',
                  padding: '2px 4px',
                  fontSize: '8px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: '#fff'
                }}>
                  {asset.friendly_name}
                </div>
                {isSelected && (
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    background: 'var(--accent-primary)',
                    borderRadius: '50%',
                    width: '14px',
                    height: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check size={8} color="#fff" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
