import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { toast } from '../../hooks/useToast';
import { workerPost } from '../../lib/workerApi';
import type { ScheduledPost, PageConn } from '../../types/content';
import { 
  X, Image as ImageIcon, Send, Save, Loader2, 
  Sparkles, AlertTriangle, Plus, Trash2, Globe, ChevronRight
} from 'lucide-react';

const Facebook = ({ size = 24, ...props }: { size?: number | string } & React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const Instagram = ({ size = 24, ...props }: { size?: number | string } & React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" width={size} height={size} stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

const getStoragePathFromUrl = (url: string): string | null => {
  const marker = '/media_assets/';
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const pathWithQuery = url.substring(index + marker.length);
  const path = pathWithQuery.split('?')[0];
  return decodeURIComponent(path);
};

interface PostComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: ScheduledPost | null;
  initialDate: Date | null;
  channels: PageConn[];
  posts: ScheduledPost[];
  onSaveSuccess: () => void;
}

export default function PostComposerModal({
  isOpen,
  onClose,
  post,
  initialDate,
  channels,
  posts,
  onSaveSuccess
}: PostComposerModalProps) {
  const { user } = useAuth();
  
  // Composer Form State
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [firstComments, setFirstComments] = useState<{ id: string; text: string }[]>([]);
  const [hasConflict, setHasConflict] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<'facebook' | 'instagram'>('facebook');
  const [saving, setSaving] = useState(false);

  // Load/Restore state on open/change
  useEffect(() => {
    if (isOpen) {
      if (post) {
        // Edit mode
        const channelInfo = channels.find(c => c.page_id === post.page_connection_id && c.platform === post.platform);
        setSelectedChannels(channelInfo?.id ? [channelInfo.id] : []);
        setMessage(post.message || '');
        setMediaUrls(post.media_urls || []);
        
        const date = new Date(post.scheduled_time);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        setScheduledTime(`${year}-${month}-${day}T${hours}:${minutes}`);
        
        const mappedComments = (post.first_comments || []).map(c => ({ id: Math.random().toString(), text: c }));
        setFirstComments(mappedComments);
      } else {
        // Create mode
        const date = initialDate || new Date();
        let initialTime = new Date(date);
        const today = new Date();
        if (date.getFullYear() === today.getFullYear() &&
            date.getMonth() === today.getMonth() &&
            date.getDate() === today.getDate()) {
          initialTime = new Date(today.getTime() + 15 * 60 * 1000); // 15 mins from now
        } else {
          initialTime.setHours(12, 0, 0, 0); // Default to noon
        }

        const year = initialTime.getFullYear();
        const month = String(initialTime.getMonth() + 1).padStart(2, '0');
        const day = String(initialTime.getDate()).padStart(2, '0');
        const hours = String(initialTime.getHours()).padStart(2, '0');
        const minutes = String(initialTime.getMinutes()).padStart(2, '0');

        const savedDraftStr = localStorage.getItem('content_planner_draft');
        if (savedDraftStr) {
          try {
            const draft = JSON.parse(savedDraftStr);
            setMessage(draft.message || '');
            setMediaUrls(draft.mediaUrls || []);
            setScheduledTime(draft.scheduledTime || `${year}-${month}-${day}T${hours}:${minutes}`);
            
            const parsedComments = Array.isArray(draft.firstComments)
              ? draft.firstComments.map((c: any) => typeof c === 'string' ? { id: Math.random().toString(), text: c } : c)
              : [];
            setFirstComments(parsedComments);
            
            if (Array.isArray(draft.selectedChannels)) {
              setSelectedChannels(draft.selectedChannels);
              const firstCh = channels.find(c => draft.selectedChannels.includes(c.id));
              if (firstCh) setPreviewPlatform(firstCh.platform as 'facebook' | 'instagram');
            } else if (draft.selectedChannel) {
              setSelectedChannels([draft.selectedChannel]);
              const ch = channels.find(c => c.id === draft.selectedChannel);
              if (ch) setPreviewPlatform(ch.platform as 'facebook' | 'instagram');
            } else {
              setSelectedChannels([]);
            }
          } catch (e) {
            console.error('Error parsing draft:', e);
            setScheduledTime(`${year}-${month}-${day}T${hours}:${minutes}`);
            setSelectedChannels([]);
            setMessage('');
            setMediaUrls([]);
            setFirstComments([]);
          }
        } else {
          setScheduledTime(`${year}-${month}-${day}T${hours}:${minutes}`);
          setSelectedChannels([]);
          setMessage('');
          setMediaUrls([]);
          setFirstComments([]);
        }
      }
    }
  }, [isOpen, post, initialDate, channels]);

  // Conflict Checker
  useEffect(() => {
    if (scheduledTime && selectedChannels.length > 0) {
      const selectedTime = new Date(scheduledTime).getTime();
      const conflict = selectedChannels.some(chId => {
        const channelInfo = channels.find(c => c.id === chId);
        const pageConnectionId = channelInfo?.page_id;
        const platform = channelInfo?.platform;
        return posts.some(p => {
          if (post && p.id === post.id) return false;
          const postTime = new Date(p.scheduled_time).getTime();
          return p.page_connection_id === pageConnectionId && p.platform === platform && Math.abs(postTime - selectedTime) < 10 * 60 * 1000;
        });
      });
      setHasConflict(conflict);
    } else {
      setHasConflict(false);
    }
  }, [scheduledTime, selectedChannels, posts, channels, post]);

  // Auto-save draft to localStorage when composing
  useEffect(() => {
    if (isOpen && !post) {
      const draft = {
        selectedChannels,
        message,
        mediaUrls,
        scheduledTime,
        firstComments
      };
      localStorage.setItem('content_planner_draft', JSON.stringify(draft));
    }
  }, [selectedChannels, message, mediaUrls, scheduledTime, firstComments, isOpen, post]);

  const handleResetForm = () => {
    if (confirm('Are you sure you want to reset and clear all inputs?')) {
      setMessage('');
      setMediaUrls([]);
      setFirstComments([]);
      setSelectedChannels([]);
      localStorage.removeItem('content_planner_draft');
      
      const date = new Date();
      const initialTime = new Date(date.getTime() + 15 * 60 * 1000);
      const year = initialTime.getFullYear();
      const month = String(initialTime.getMonth() + 1).padStart(2, '0');
      const day = String(initialTime.getDate()).padStart(2, '0');
      const hours = String(initialTime.getHours()).padStart(2, '0');
      const minutes = String(initialTime.getMinutes()).padStart(2, '0');
      setScheduledTime(`${year}-${month}-${day}T${hours}:${minutes}`);
    }
  };

  const handleCloseComposer = () => {
    setMessage('');
    setMediaUrls([]);
    setScheduledTime('');
    setFirstComments([]);
    setSelectedChannels([]);
    setDropdownOpen(false);
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploading(true);
    const newUrls = [...mediaUrls];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('media_assets')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('media_assets')
          .getPublicUrl(filePath);

        if (publicUrl) {
          const urlWithLocal = `${publicUrl}?local_name=${encodeURIComponent(file.name)}`;
          newUrls.push(urlWithLocal);
        }
      }
      setMediaUrls(newUrls);
      toast.success('Files uploaded successfully!');
    } catch (err: any) {
      toast.error('Failed to upload file(s): ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    if (selectedChannels.length === 0) {
      toast.error('Please select at least one social channel.');
      return;
    }

    const minutesDiff = (new Date(scheduledTime).getTime() - Date.now()) / (60 * 1000);
    if (minutesDiff < 10) {
      toast.error('Meta API requires posts to be scheduled at least 10 minutes in the future.');
      return;
    }
    if (minutesDiff > 30 * 24 * 60) {
      toast.error('Meta API limits scheduling to a maximum of 30 days in advance.');
      return;
    }

    setSaving(true);
    const postType = mediaUrls.length > 0
      ? (mediaUrls.some(url => url.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/) !== null) ? 'video' : 'photo')
      : 'text';

    try {
      if (post) {
        // Edit mode
        const channelInfo = channels.find(c => c.id === selectedChannels[0]);
        const payload = {
          page_connection_id: channelInfo?.page_id,
          platform: channelInfo?.platform || 'facebook',
          post_type: postType,
          message: message || null,
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          scheduled_time: new Date(scheduledTime).toISOString(),
          first_comments: firstComments.map(c => c.text.trim()).filter(c => c.length > 0),
          status: 'scheduled',
          retry_count: 0,
          error_message: null
        };

        if (post.media_urls) {
          const removedUrls = post.media_urls.filter(url => !mediaUrls.includes(url));
          const pathsToDelete: string[] = [];
          removedUrls.forEach(url => {
            const storagePath = getStoragePathFromUrl(url);
            if (storagePath && url.includes('.supabase.')) {
              pathsToDelete.push(storagePath);
            }
          });
          if (pathsToDelete.length > 0) {
            await supabase.storage.from('media_assets').remove(pathsToDelete);
          }
        }

        const { error } = await supabase
          .from('scheduled_posts')
          .update(payload)
          .eq('id', post.id);

        if (error) throw error;
        toast.success('Post updated successfully!');
      } else {
        // Create mode
        const rows = selectedChannels.map(chId => {
          const channelInfo = channels.find(c => c.id === chId);
          return {
            user_id: user.id,
            page_connection_id: channelInfo?.page_id,
            platform: channelInfo?.platform || 'facebook',
            post_type: postType,
            message: message || null,
            media_urls: mediaUrls.length > 0 ? mediaUrls : null,
            scheduled_time: new Date(scheduledTime).toISOString(),
            first_comments: firstComments.map(c => c.text.trim()).filter(c => c.length > 0),
            status: 'scheduled',
            retry_count: 0,
            error_message: null
          };
        });

        const { error } = await supabase
          .from('scheduled_posts')
          .insert(rows);

        if (error) throw error;
        toast.success(
          selectedChannels.length > 1
            ? `✅ Post scheduled to ${selectedChannels.length} channels!`
            : 'Post scheduled successfully!'
        );
      }

      localStorage.removeItem('content_planner_draft');
      onSaveSuccess();
      handleCloseComposer();
    } catch (err: any) {
      toast.error('Failed to save post: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const handlePostNow = async () => {
    if (!user) return;
    if (selectedChannels.length === 0) {
      toast.error('Please select at least one social channel first.');
      return;
    }

    setSaving(true);
    const postType = mediaUrls.length > 0
      ? (mediaUrls.some(url => url.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/) !== null) ? 'video' : 'photo')
      : 'text';

    try {
      if (post) {
        const channelInfo = channels.find(c => c.id === selectedChannels[0]);
        const payload = {
          page_connection_id: channelInfo?.page_id,
          platform: channelInfo?.platform || 'facebook',
          post_type: postType,
          message: message || null,
          media_urls: mediaUrls.length > 0 ? mediaUrls : null,
          scheduled_time: new Date().toISOString(),
          first_comments: firstComments.map(c => c.text.trim()).filter(c => c.length > 0),
          status: 'scheduled',
          retry_count: 0,
          error_message: null
        };
        const { error } = await supabase
          .from('scheduled_posts')
          .update(payload)
          .eq('id', post.id);

        if (error) throw error;
      } else {
        const rows = selectedChannels.map(chId => {
          const channelInfo = channels.find(c => c.id === chId);
          return {
            user_id: user.id,
            page_connection_id: channelInfo?.page_id,
            platform: channelInfo?.platform || 'facebook',
            post_type: postType,
            message: message || null,
            media_urls: mediaUrls.length > 0 ? mediaUrls : null,
            scheduled_time: new Date().toISOString(),
            first_comments: firstComments.map(c => c.text.trim()).filter(c => c.length > 0),
            status: 'scheduled',
            retry_count: 0,
            error_message: null
          };
        });

        const { error } = await supabase
          .from('scheduled_posts')
          .insert(rows);

        if (error) throw error;
      }

      toast.success('Publishing post immediately...');

      try {
        await workerPost('/api/scheduler/run', {});
        toast.success('Post published successfully!');
      } catch (err: any) {
        console.error('Trigger scheduler failed:', err);
        toast.error('Post queued. Immediate trigger failed, but it will publish shortly.');
      }

      localStorage.removeItem('content_planner_draft');
      onSaveSuccess();
      handleCloseComposer();
    } catch (err: any) {
      toast.error('Failed to publish post: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAIAssist = async (type: 'enhance' | 'hashtags' | 'punchy' | 'shorten') => {
    if (aiGenerating) return;
    setAiGenerating(true);
    try {
      let prompt = '';
      if (type === 'enhance') {
        prompt = `Rewrite the following caption to make it highly engaging, professional, and well-structured, incorporating relevant emojis where appropriate. Respond with ONLY the improved caption text and nothing else, no greetings, no introductory text, no quotes:\n\n${message}`;
      } else if (type === 'hashtags') {
        prompt = `Generate a set of 5-10 highly relevant, trending hashtags for a social media post with this description. Return ONLY the hashtags separated by spaces, nothing else:\n\n${message || 'General marketing post'}`;
      } else if (type === 'punchy') {
        prompt = `Make this social media caption more punchy, exciting, and direct. Use short sentences and strong hooks. Respond with ONLY the modified caption, no comments or introductory text:\n\n${message}`;
      } else if (type === 'shorten') {
        prompt = `Shorten this social media caption to be concise and straight to the point while keeping the core message. Respond with ONLY the shortened caption, no comments or introductory text:\n\n${message}`;
      }
      
      const data = await workerPost('/api/agent/chat', {
        messages: [{ role: 'user', content: prompt }],
        channelId: 'global',
        contextType: 'global',
        agentType: 'content_copilot'
      });
      
      if (data && data.message && data.message.content) {
        let content = data.message.content.trim();
        if (content.startsWith('"') && content.endsWith('"')) {
          content = content.slice(1, -1);
        }
        if (content.startsWith('`') && content.endsWith('`')) {
          content = content.replace(/^`+|`+$/g, '');
        }
        
        if (type === 'hashtags') {
          setMessage(prev => prev ? `${prev}\n\n${content}` : content);
        } else {
          setMessage(content);
        }
        toast.success('AI updated your caption!');
      } else {
        toast.error('AI generated empty content.');
      }
    } catch (err: any) {
      console.error('AI assistant error:', err);
      toast.error('AI assistant failed: ' + err.message);
    } finally {
      setAiGenerating(false);
    }
  };

  const handleAddComment = () => {
    setFirstComments([...firstComments, { id: Math.random().toString(), text: '' }]);
  };

  const handleRemoveComment = (index: number) => {
    setFirstComments(firstComments.filter((_, i) => i !== index));
  };

  const handleCommentTextChange = (index: number, text: string) => {
    const next = [...firstComments];
    next[index].text = text;
    setFirstComments(next);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal" style={{ maxWidth: '800px', background: 'rgba(20, 20, 20, 0.95)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>{post ? 'Edit Scheduled Post' : 'Compose Scheduled Post'}</h2>
          <button className="btn-ghost btn-icon" type="button" onClick={handleCloseComposer}><X size={18} /></button>
        </div>
        
        <form onSubmit={handleCreatePost}>
          <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', padding: '24px' }}>
            
            {/* Form Fields Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Select Channel */}
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label" style={{ fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Select Social Channels</span>
                  {selectedChannels.length > 0 && (
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--accent-primary)', background: 'rgba(124, 58, 237, 0.1)', padding: '2px 8px', borderRadius: '20px' }}>
                      {selectedChannels.length} selected
                    </span>
                  )}
                </label>
                
                <div 
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'rgba(0,0,0,0.4)',
                    cursor: 'pointer',
                    minHeight: '40px',
                    userSelect: 'none',
                    color: '#fff'
                  }}
                >
                  <span style={{ color: selectedChannels.length > 0 ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                    {selectedChannels.length === 0 
                      ? '-- Choose Connected Pages --' 
                      : selectedChannels.map(chId => channels.find(c => c.id === chId)?.page_name).filter(Boolean).join(', ')}
                  </span>
                  <ChevronRight size={16} style={{ transform: dropdownOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
                </div>

                {dropdownOpen && (
                  <>
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} onClick={() => setDropdownOpen(false)} />
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '6px',
                      background: 'rgba(20, 20, 20, 0.98)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '10px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                      maxHeight: '220px',
                      overflowY: 'auto',
                      zIndex: 999,
                      padding: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px 8px 6px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '6px' }}>
                        <button type="button" className="btn btn-ghost btn-xs" style={{ fontSize: '0.75rem', padding: '2px 6px', color: 'var(--accent-primary)', background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => {
                          setSelectedChannels(channels.map(c => c.id));
                          if (channels.length > 0) setPreviewPlatform(channels[0].platform as 'facebook' | 'instagram');
                        }}>
                          Select All
                        </button>
                        <button type="button" className="btn btn-ghost btn-xs" style={{ fontSize: '0.75rem', padding: '2px 6px', color: 'rgba(255,255,255,0.4)', background: 'transparent', border: 'none', cursor: 'pointer' }} onClick={() => setSelectedChannels([])}>
                          Clear
                        </button>
                      </div>
                      {channels.map(c => {
                        const isSelected = selectedChannels.includes(c.id);
                        const isIg = c.platform === 'instagram';
                        return (
                          <div
                            key={c.id}
                            onClick={() => {
                              const next = isSelected 
                                ? selectedChannels.filter(id => id !== c.id) 
                                : [...selectedChannels, c.id];
                              setSelectedChannels(next);
                              if (next.length > 0) {
                                const firstCh = channels.find(ch => ch.id === next[0]);
                                if (firstCh) setPreviewPlatform(firstCh.platform as 'facebook' | 'instagram');
                              }
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              background: isSelected ? (isIg ? 'rgba(225,48,108,0.1)' : 'rgba(24,119,242,0.1)') : 'transparent',
                              transition: 'background 0.15s',
                              marginBottom: '2px',
                              color: isSelected ? '#fff' : 'rgba(255,255,255,0.8)'
                            }}
                          >
                            <div style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '4px',
                              border: `2px solid ${isSelected ? (isIg ? '#E1306C' : '#1877F2') : 'rgba(255,255,255,0.3)'}`,
                              background: isSelected ? (isIg ? '#E1306C' : '#1877F2') : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              color: '#fff',
                              fontWeight: 'bold',
                              flexShrink: 0
                            }}>
                              {isSelected && '✓'}
                            </div>
                            <span style={{ fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.page_name}</span>
                            <span style={{
                              fontSize: '0.65rem',
                              marginLeft: 'auto',
                              padding: '2px 6px',
                              borderRadius: '10px',
                              background: isIg ? 'rgba(225,48,108,0.2)' : 'rgba(24,119,242,0.2)',
                              color: isIg ? '#FF4B72' : '#3B82F6',
                              flexShrink: 0
                            }}>
                              {isIg ? 'Instagram' : 'Facebook'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Caption Message */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Caption / Message</label>
                <textarea 
                  className="form-textarea" 
                  placeholder="What would you like to share? Add hashtags, emojis..." 
                  value={message} 
                  onChange={e => setMessage(e.target.value)} 
                  style={{ minHeight: '120px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }} 
                />
                
                {/* AI Assistant presets */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm" 
                    onClick={() => handleAIAssist('enhance')}
                    disabled={aiGenerating}
                    style={{ fontSize: '0.75rem', height: '28px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {aiGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    <span style={{ marginLeft: '4px' }}>✨ Enhance Caption</span>
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm" 
                    onClick={() => handleAIAssist('hashtags')}
                    disabled={aiGenerating}
                    style={{ fontSize: '0.75rem', height: '28px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {aiGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    <span style={{ marginLeft: '4px' }}>🏷️ Add Hashtags</span>
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm" 
                    onClick={() => handleAIAssist('punchy')}
                    disabled={aiGenerating}
                    style={{ fontSize: '0.75rem', height: '28px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {aiGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    <span style={{ marginLeft: '4px' }}>⚡ Make Punchy</span>
                  </button>
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm" 
                    onClick={() => handleAIAssist('shorten')}
                    disabled={aiGenerating}
                    style={{ fontSize: '0.75rem', height: '28px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                  >
                    {aiGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    <span style={{ marginLeft: '4px' }}>📝 Shorten</span>
                  </button>
                </div>
              </div>

              {/* Attach Media */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Media Attachments</label>
                
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  {mediaUrls.map((url, idx) => {
                    const isVideo = url.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/) !== null;
                    return (
                      <div key={idx} style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.1)', background: '#000' }}>
                        {isVideo ? (
                          <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                        ) : (
                          <img src={url} alt="Attached asset" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Error'; }} />
                        )}
                        <button 
                          type="button" 
                          onClick={() => setMediaUrls(mediaUrls.filter((_, i) => i !== idx))}
                          style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#EF4444' }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    );
                  })}
                  
                  <label style={{ width: '80px', height: '80px', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: uploading ? 'not-allowed' : 'pointer', color: 'var(--text-secondary)' }}>
                    {uploading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <>
                        <ImageIcon size={18} />
                        <span style={{ fontSize: '0.65rem' }}>Upload</span>
                      </>
                    )}
                    <input type="file" multiple onChange={handleFileUpload} accept="image/*,video/*" disabled={uploading} style={{ display: 'none' }} />
                  </label>
                </div>
              </div>

              {/* Schedule Date Time */}
              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 600 }}>Scheduled Time</label>
                <input 
                  type="datetime-local" 
                  className="form-input" 
                  value={scheduledTime} 
                  onChange={e => setScheduledTime(e.target.value)} 
                  required
                  style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', height: '40px' }}
                />
                
                {hasConflict && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#F59E0B', fontSize: '0.75rem', marginTop: '6px' }}>
                    <AlertTriangle size={12} />
                    <span>Warning: Another post is scheduled on this channel within 10 minutes.</span>
                  </div>
                )}
              </div>

              {/* First Comment Threads */}
              <div className="form-group" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>First Comment Threads (Optional)</label>
                  <button type="button" className="btn btn-secondary btn-xs" onClick={handleAddComment} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', height: '24px', background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Plus size={12} /> Add Thread
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '160px', overflowY: 'auto', paddingRight: '2px' }}>
                  {firstComments.map((c, index) => (
                    <div key={c.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <textarea 
                        className="form-input"
                        placeholder={`Comment Thread #${index + 1} (automatically posted when scheduled post goes live)`}
                        value={c.text}
                        onChange={e => handleCommentTextChange(index, e.target.value)}
                        rows={3}
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 12px', resize: 'vertical', minHeight: '60px', flex: 1, fontSize: '0.85rem' }}
                      />
                      <button type="button" className="btn btn-danger btn-sm btn-icon" onClick={() => handleRemoveComment(index)} style={{ padding: '6px', marginTop: '2px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <Trash2 size={12} style={{ color: '#EF4444' }} />
                      </button>
                    </div>
                  ))}
                  
                  {firstComments.length === 0 && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      No comment threads added.
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* Platform Live Preview Column */}
            <div>
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>Live Feed Preview</span>
                  <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <button 
                      type="button" 
                      onClick={() => setPreviewPlatform('facebook')}
                      style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: '4px', border: 'none', background: previewPlatform === 'facebook' ? 'rgba(255,255,255,0.1)' : 'transparent', color: previewPlatform === 'facebook' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Facebook
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setPreviewPlatform('instagram')}
                      style={{ fontSize: '0.7rem', padding: '4px 8px', borderRadius: '4px', border: 'none', background: previewPlatform === 'instagram' ? 'rgba(255,255,255,0.1)' : 'transparent', color: previewPlatform === 'instagram' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Instagram
                    </button>
                  </div>
                </div>

                {previewPlatform === 'facebook' ? (
                  /* Facebook Preview Card */
                  <div className="card" style={{ border: '1px solid rgba(255,255,255,0.08)', padding: '0', overflow: 'hidden', background: 'rgba(255,255,255,0.01)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Facebook size={16} style={{ color: '#1877F2' }} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: '#fff' }}>
                          {channels.find(c => c.id === selectedChannels[0])?.page_name || 'Your Brand Page'}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          <span>Just now</span>
                          <span>•</span>
                          <Globe size={10} />
                        </div>
                      </div>
                    </div>

                    <p style={{ margin: '0 12px 12px 12px', fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-line', lineHeight: '1.4' }}>
                      {message || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Facebook caption message will appear here...</span>}
                    </p>

                    {mediaUrls.length > 0 ? (
                      <div style={{ width: '100%', height: '220px', background: '#000', overflow: 'hidden', position: 'relative' }}>
                        {mediaUrls[0].toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/) ? (
                          <video src={mediaUrls[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls muted playsInline />
                        ) : (
                          <img src={mediaUrls[0]} alt="Preview attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Invalid+Image+URL'; }} />
                        )}
                        {mediaUrls.length > 1 && (
                          <div style={{ position: 'absolute', bottom: '12px', right: '12px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>
                            +{mediaUrls.length - 1} more
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ width: '100%', height: '160px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                         <ImageIcon size={24} style={{ opacity: 0.3 }} />
                        <span style={{ fontSize: '0.75rem' }}>No media attached (Text-only post)</span>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 0', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      <span>👍 Like</span>
                      <span>💬 Comment</span>
                      <span>🔄 Share</span>
                    </div>
                  </div>
                ) : (
                  /* Instagram Preview Card */
                  <div className="card" style={{ border: '1px solid rgba(255,255,255,0.08)', padding: '0', overflow: 'hidden', background: 'rgba(15,15,15,0.95)', borderRadius: '12px' }}>
                    {/* Instagram Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ 
                          background: 'linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)', 
                          padding: '1.5px', 
                          borderRadius: '50%', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Instagram size={14} style={{ color: '#E1306C' }} />
                          </div>
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 700, color: '#fff' }}>
                            {channels.find(c => c.id === selectedChannels[0])?.page_name.toLowerCase().replace(/\s+/g, '') || 'yourbrandpage'}
                          </h4>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', display: 'block', marginTop: '-2px' }}>Sponsored</span>
                        </div>
                      </div>
                      <span style={{ color: '#fff', fontSize: '14px', cursor: 'pointer', fontWeight: 'bold' }}>•••</span>
                    </div>

                    {/* Instagram Media Body */}
                    {mediaUrls.length > 0 ? (
                      <div style={{ width: '100%', height: '260px', background: '#000', overflow: 'hidden', position: 'relative' }}>
                        {mediaUrls[0].toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/) ? (
                          <video src={mediaUrls[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls muted playsInline />
                        ) : (
                          <img src={mediaUrls[0]} alt="Preview attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x600?text=Invalid+Image+URL'; }} />
                        )}
                        {mediaUrls.length > 1 && (
                          <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.7)', color: 'white', padding: '3px 6px', borderRadius: '10px', fontSize: '0.65rem', fontWeight: 600 }}>
                            1/{mediaUrls.length}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ width: '100%', height: '260px', background: '#000', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <ImageIcon size={32} style={{ opacity: 0.3 }} />
                        <span style={{ fontSize: '0.75rem' }}>Instagram requires photo or video.</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--accent-primary)' }}>Please attach media.</span>
                      </div>
                    )}

                    {/* Instagram Actions Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 12px 6px 12px' }}>
                      <div style={{ display: 'flex', gap: '14px', color: '#fff' }}>
                        <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Heart">🤍</span>
                        <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Comment">💬</span>
                        <span style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Share">✈️</span>
                      </div>
                      <span style={{ cursor: 'pointer', color: '#fff' }} title="Bookmark">🔖</span>
                    </div>

                    {/* Instagram Likes & Caption */}
                    <div style={{ padding: '0 12px 12px 12px', fontSize: '0.75rem' }}>
                      <span style={{ fontWeight: 700, color: '#fff', display: 'block', marginBottom: '4px' }}>Liked by copilot and others</span>
                      <p style={{ margin: 0, color: 'var(--text-primary)', lineHeight: '1.4' }}>
                        <strong style={{ color: '#fff', marginRight: '6px' }}>
                          {channels.find(c => c.id === selectedChannels[0])?.page_name.toLowerCase().replace(/\s+/g, '') || 'yourbrandpage'}
                        </strong>
                        {message || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Instagram caption will appear here...</span>}
                      </p>
                      <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '6px' }}>View all comments</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
          <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '16px 24px' }}>
            <div style={{ marginRight: 'auto' }}>
              <button type="button" className="btn btn-danger" onClick={handleResetForm} disabled={saving} style={{ padding: '8px 16px', fontSize: '13px' }}>
                Reset Form
              </button>
            </div>
            <button type="button" className="btn btn-secondary" onClick={handleCloseComposer}>Cancel</button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={handlePostNow} 
              disabled={saving || selectedChannels.length === 0}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(124, 58, 237, 0.1)', color: '#a78bfa', border: '1px solid rgba(124, 58, 237, 0.25)' }}
            >
              {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
              Post Now
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
              {saving ? 'Saving...' : post ? 'Update Post' : 'Schedule Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
