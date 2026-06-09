import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';
import { workerPost } from '../lib/workerApi';
import { Plus, X, Calendar as CalendarIcon, Clock, Globe, Image as ImageIcon, Save, Loader2, AlertTriangle, ChevronLeft, ChevronRight, List, Calendar, Edit3, Send, Upload } from 'lucide-react';

interface ScheduledPost {
  id: string;
  user_id: string;
  page_connection_id: string;
  platform: string;
  post_type: string;
  message: string | null;
  media_urls: string[] | null;
  scheduled_time: string;
  status: string;
  meta_post_id: string | null;
  error_message: string | null;
  first_comments?: string[] | null;
}

interface PageConn {
  id: string;
  page_id: string;
  page_name: string;
  platform: string;
}

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

export default function ContentPlannerPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [channels, setChannels] = useState<PageConn[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Calendar View State
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Post Detail / Inspector State
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [viewedPost, setViewedPost] = useState<ScheduledPost | null>(null);

  // Composer Form State
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [message, setMessage] = useState('');
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [firstComments, setFirstComments] = useState<string[]>([]);
  const [hasConflict, setHasConflict] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  // Conflict Checker
  useEffect(() => {
    if (scheduledTime && selectedChannel) {
      const selectedTime = new Date(scheduledTime).getTime();
      const channelInfo = channels.find(c => c.id === selectedChannel);
      const pageConnectionId = channelInfo?.page_id;
      const platform = channelInfo?.platform;
      const conflict = posts.some(p => {
        const postTime = new Date(p.scheduled_time).getTime();
        // Warn if posts are scheduled within 10 minutes of each other on the same channel/platform
        return p.page_connection_id === pageConnectionId && p.platform === platform && Math.abs(postTime - selectedTime) < 10 * 60 * 1000;
      });
      setHasConflict(conflict);
    } else {
      setHasConflict(false);
    }
  }, [scheduledTime, selectedChannel, posts, channels]);

  async function loadData() {
    try {
      setLoading(true);
      // Fetch posts
      const { data: postsData, error: postsError } = await supabase
        .from('scheduled_posts')
        .select('*')
        .order('scheduled_time', { ascending: true });

      if (postsError) throw postsError;

      // Fetch connected channels
      const { data: channelsData, error: channelsError } = await supabase
        .from('page_connections')
        .select('page_id, page_name, instagram_account_id, whatsapp_phone_number_id');

      if (channelsError) throw channelsError;

      const formattedChannels: PageConn[] = [];
      channelsData?.forEach(c => {
        // Exclude WhatsApp connections because WhatsApp is messaging-only and does not support timeline posts
        if (!c.whatsapp_phone_number_id) {
          formattedChannels.push({ id: c.page_id, page_id: c.page_id, page_name: c.page_name || 'Facebook Page', platform: 'facebook' });
          if (c.instagram_account_id) {
            formattedChannels.push({ id: `${c.page_id}-instagram`, page_id: c.page_id, page_name: `${c.page_name} (Instagram)`, platform: 'instagram' });
          }
        }
      });

      setPosts(postsData || []);
      setChannels(formattedChannels);
    } catch (err: any) {
      toast.error('Failed to load planner data: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getPostsForDate = (date: Date) => {
    return posts.filter(post => {
      const postDate = new Date(post.scheduled_time);
      return postDate.getFullYear() === date.getFullYear() &&
             postDate.getMonth() === date.getMonth() &&
             postDate.getDate() === date.getDate();
    });
  };

  const handleOpenComposeForDay = (date: Date) => {
    let initialTime = new Date(date);
    const today = new Date();
    if (isSameDay(date, today)) {
      initialTime = new Date(today.getTime() + 15 * 60 * 1000); // 15 mins from now
    } else {
      initialTime.setHours(12, 0, 0, 0); // Default to noon
    }

    const year = initialTime.getFullYear();
    const month = String(initialTime.getMonth() + 1).padStart(2, '0');
    const day = String(initialTime.getDate()).padStart(2, '0');
    const hours = String(initialTime.getHours()).padStart(2, '0');
    const minutes = String(initialTime.getMinutes()).padStart(2, '0');

    // Check if there is a saved draft in localStorage
    const savedDraftStr = localStorage.getItem('content_planner_draft');
    if (savedDraftStr) {
      try {
        const draft = JSON.parse(savedDraftStr);
        setSelectedChannel(draft.selectedChannel || '');
        setMessage(draft.message || '');
        setMediaUrls(draft.mediaUrls || []);
        setScheduledTime(draft.scheduledTime || `${year}-${month}-${day}T${hours}:${minutes}`);
        setFirstComments(draft.firstComments || []);
      } catch (e) {
        console.error('Error parsing draft:', e);
        setScheduledTime(`${year}-${month}-${day}T${hours}:${minutes}`);
        setSelectedChannel('');
        setMessage('');
        setMediaUrls([]);
        setFirstComments([]);
      }
    } else {
      setScheduledTime(`${year}-${month}-${day}T${hours}:${minutes}`);
      setSelectedChannel('');
      setMessage('');
      setMediaUrls([]);
      setFirstComments([]);
    }

    setSelectedPost(null);
    setIsEditing(false);
    setShowModal(true);
  };

  // Auto-save draft to localStorage when composing
  useEffect(() => {
    if (showModal && !isEditing) {
      const draft = {
        selectedChannel,
        message,
        mediaUrls,
        scheduledTime,
        firstComments
      };
      localStorage.setItem('content_planner_draft', JSON.stringify(draft));
    }
  }, [selectedChannel, message, mediaUrls, scheduledTime, firstComments, showModal, isEditing]);

  const handleResetForm = () => {
    if (confirm('Are you sure you want to reset and clear all inputs?')) {
      setMessage('');
      setMediaUrls([]);
      setFirstComments([]);
      setSelectedChannel('');
      localStorage.removeItem('content_planner_draft');
      
      const date = new Date();
      const initialTime = new Date(date.getTime() + 15 * 60 * 1000);
      const year = initialTime.getFullYear();
      const month = String(initialTime.getMonth() + 1).padStart(2, '0');
      const day = String(initialTime.getDate()).padStart(2, '0');
      const hours = String(initialTime.getHours()).padStart(2, '0');
      const minutes = String(initialTime.getMinutes()).padStart(2, '0');
      setScheduledTime(`${year}-${month}-${day}T${hours}:${minutes}`);
      toast.success('Form cleared!');
    }
  };

  const handleOpenViewDetails = (post: ScheduledPost) => {
    setViewedPost(post);
    setShowDetailModal(true);
  };

  const handleEditFromDetails = () => {
    if (!viewedPost) return;
    setShowDetailModal(false);

    setSelectedPost(viewedPost);
    setIsEditing(true);

    const channelInfo = channels.find(c => c.page_id === viewedPost.page_connection_id && c.platform === viewedPost.platform);
    setSelectedChannel(channelInfo?.id || '');
    setMessage(viewedPost.message || '');
    setMediaUrls(viewedPost.media_urls || []);

    const date = new Date(viewedPost.scheduled_time);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    setScheduledTime(`${year}-${month}-${day}T${hours}:${minutes}`);

    setFirstComments(viewedPost.first_comments || []);
    setShowModal(true);
  };

  const handleCloseComposer = () => {
    setShowModal(false);
    setIsEditing(false);
    setSelectedPost(null);
    setMessage('');
    setMediaUrls([]);
    setScheduledTime('');
    setFirstComments([]);
    setSelectedChannel('');
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

        const { error } = await supabase.storage
          .from('media_assets')
          .upload(filePath, file);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('media_assets')
          .getPublicUrl(filePath);

        if (publicUrl) {
          newUrls.push(publicUrl);
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

    // Meta constraints validation
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
    const channelInfo = channels.find(c => c.id === selectedChannel);
    const platform = channelInfo?.platform || 'facebook';
    const pageConnectionId = channelInfo?.page_id;

    try {
      const payload = {
        page_connection_id: pageConnectionId,
        platform,
        post_type: mediaUrls.length > 0 
          ? (mediaUrls.some(url => url.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/) !== null) ? 'video' : 'photo')
          : 'text',
        message: message || null,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        scheduled_time: new Date(scheduledTime).toISOString(),
        first_comments: firstComments.map(c => c.trim()).filter(c => c.length > 0),
        status: 'scheduled'
      };

      if (isEditing && selectedPost) {
        const { error } = await supabase
          .from('scheduled_posts')
          .update(payload)
          .eq('id', selectedPost.id);

        if (error) throw error;
        toast.success('Post updated successfully!');
      } else {
        const { error } = await supabase
          .from('scheduled_posts')
          .insert({
            user_id: user.id,
            ...payload
          });

        if (error) throw error;
        toast.success('Post scheduled successfully!');
      }

      setShowModal(false);
      // Reset composer
      setMessage('');
      setMediaUrls([]);
      setScheduledTime('');
      setFirstComments([]);
      setSelectedChannel('');
      setSelectedPost(null);
      setIsEditing(false);
      localStorage.removeItem('content_planner_draft');
      loadData();
    } catch (err: any) {
      toast.error('Failed to save post: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const handlePostNow = async () => {
    if (!user) return;
    const channelInfo = channels.find(c => c.id === selectedChannel);
    if (!channelInfo) {
      toast.error('Please select a social channel first.');
      return;
    }

    setSaving(true);
    const platform = channelInfo.platform || 'facebook';
    const pageConnectionId = channelInfo.page_id;

    try {
      const payload = {
        page_connection_id: pageConnectionId,
        platform,
        post_type: mediaUrls.length > 0 
          ? (mediaUrls.some(url => url.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/) !== null) ? 'video' : 'photo')
          : 'text',
        message: message || null,
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        scheduled_time: new Date().toISOString(),
        first_comments: firstComments.map(c => c.trim()).filter(c => c.length > 0),
        status: 'scheduled'
      };

      if (isEditing && selectedPost) {
        const { error } = await supabase
          .from('scheduled_posts')
          .update(payload)
          .eq('id', selectedPost.id);

        if (error) throw error;
      } else {
        await supabase
          .from('scheduled_posts')
          .insert({
            user_id: user.id,
            ...payload
          });
      }

      toast.success('Publishing post immediately...');
      setShowModal(false);

      // Trigger immediate scheduler run
      try {
        await workerPost('/api/scheduler/run', {});
        toast.success('Post published successfully!');
      } catch (err: any) {
        console.error('Trigger scheduler failed:', err);
        toast.error('Post queued. Immediate trigger failed, but it will publish shortly.');
      }

      // Reset composer
      setMessage('');
      setMediaUrls([]);
      setScheduledTime('');
      setFirstComments([]);
      setSelectedChannel('');
      setSelectedPost(null);
      setIsEditing(false);
      localStorage.removeItem('content_planner_draft');
      loadData();
    } catch (err: any) {
      toast.error('Failed to publish post: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  async function handleDeletePost(id: string) {
    if (!confirm('Are you sure you want to delete this scheduled post?')) return;
    try {
      const { error } = await supabase.from('scheduled_posts').delete().eq('id', id);
      if (error) throw error;
      toast.success('Scheduled post deleted.');
      loadData();
    } catch (err: any) {
      toast.error('Error deleting post: ' + err.message);
    }
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarCells: { date: Date; isCurrentMonth: boolean }[] = [];

  // Add previous month's ending days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarCells.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      isCurrentMonth: false,
    });
  }

  // Add current month's days
  for (let i = 1; i <= daysInCurrentMonth; i++) {
    calendarCells.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }

  // Add next month's starting days to fill grid (usually to 35 or 42)
  const totalCells = Math.ceil(calendarCells.length / 7) * 7;
  const nextDaysToAdd = totalCells - calendarCells.length;
  for (let i = 1; i <= nextDaysToAdd; i++) {
    calendarCells.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  return (
    <div className="animate-slideUp">
      <style>{`
        .calendar-day-cell {
          position: relative;
        }
        .calendar-day-cell:hover {
          background: rgba(255, 255, 255, 0.03) !important;
        }
        .calendar-day-cell:hover .add-post-indicator {
          opacity: 1 !important;
        }
        .calendar-day-cell::-webkit-scrollbar {
          width: 3px;
        }
      `}</style>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Content Planner</h1>
          <p>Schedule, plan, and automate posts for your connected Facebook and Instagram pages.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
            <button 
              className={`btn btn-sm ${viewMode === 'calendar' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => setViewMode('calendar')}
              style={{ borderRadius: '6px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Calendar size={14} />
              Calendar
            </button>
            <button 
              className={`btn btn-sm ${viewMode === 'list' ? 'btn-primary' : 'btn-ghost'}`} 
              onClick={() => setViewMode('list')}
              style={{ borderRadius: '6px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <List size={14} />
              List
            </button>
          </div>

          <button className="btn btn-primary" onClick={() => handleOpenComposeForDay(new Date())}>
            <Plus size={16} /> Compose Post
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Loader2 className="animate-spin" style={{ margin: '0 auto 16px auto' }} />
          Loading content calendar...
        </div>
      ) : posts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <CalendarIcon size={48} style={{ color: 'var(--text-secondary)', opacity: 0.5, marginBottom: '16px' }} />
            <h3>No Scheduled Posts</h3>
            <p>Write your first post and schedule it to go live automatically.</p>
            <button className="btn btn-primary" onClick={() => handleOpenComposeForDay(new Date())}>
              Compose Post
            </button>
          </div>
        </div>
      ) : viewMode === 'calendar' ? (
        /* Monthly Calendar View */
        <div className="card" style={{ padding: '24px' }}>
          {/* Calendar Navigation Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button className="btn btn-secondary btn-sm btn-icon" onClick={handlePrevMonth} title="Previous Month">
                  <ChevronLeft size={16} />
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleToday} style={{ fontSize: '0.8rem', padding: '6px 12px' }}>
                  Today
                </button>
                <button className="btn btn-secondary btn-sm btn-icon" onClick={handleNextMonth} title="Next Month">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: 'var(--border-primary)', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-primary)', minWidth: '750px' }}>
              {/* Days of the Week */}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} style={{ background: 'var(--bg-secondary)', padding: '12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {d}
                </div>
              ))}

              {/* Calendar Cells */}
              {calendarCells.map((cell, idx) => {
                const dayPosts = getPostsForDate(cell.date);
                const isToday = isSameDay(cell.date, new Date());
                return (
                  <div 
                    key={idx} 
                    onClick={() => handleOpenComposeForDay(cell.date)}
                    style={{
                      background: cell.isCurrentMonth ? 'var(--bg-card)' : 'rgba(10, 10, 10, 0.4)',
                      minHeight: '120px',
                      padding: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      transition: 'all var(--transition-fast)',
                      opacity: cell.isCurrentMonth ? 1 : 0.4,
                      border: isToday ? '1px solid var(--accent-primary)' : 'none',
                      boxShadow: isToday ? '0 0 10px var(--accent-primary-glow)' : 'none',
                    }}
                    className="calendar-day-cell"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ 
                        fontSize: '0.85rem', 
                        fontWeight: isToday ? 700 : 500,
                        color: isToday ? 'white' : 'var(--text-primary)',
                        background: isToday ? 'var(--accent-primary)' : 'transparent',
                        width: '24px',
                        height: '24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%'
                      }}>
                        {cell.date.getDate()}
                      </span>
                      <span className="add-post-indicator" style={{ fontSize: '0.9rem', color: 'var(--accent-primary)', opacity: 0, transition: 'opacity 0.2s', fontWeight: 'bold' }}>
                        +
                      </span>
                    </div>
                    
                    {/* Posts listed on this day */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', overflowY: 'auto', maxHeight: '80px' }} onClick={e => e.stopPropagation()}>
                      {dayPosts.map(post => {
                        const channelName = channels.find(c => c.page_id === post.page_connection_id && c.platform === post.platform)?.page_name || 'Channel';
                        const postTime = new Date(post.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const isIg = post.platform === 'instagram';
                        
                        return (
                          <div 
                            key={post.id} 
                            onClick={(e) => { e.stopPropagation(); handleOpenViewDetails(post); }}
                            style={{
                              background: isIg ? 'rgba(225,48,108,0.1)' : 'rgba(24,119,242,0.1)',
                              border: `1px solid ${isIg ? 'rgba(225,48,108,0.3)' : 'rgba(24,119,242,0.3)'}`,
                              color: isIg ? '#E1306C' : '#1877F2',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}
                            title={`${channelName} (${postTime}): ${post.message || 'No text'}`}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {post.message || 'Media post'}
                            </span>
                            <span style={{ fontSize: '0.6rem', opacity: 0.8, marginLeft: '4px', flexShrink: 0 }}>
                              {postTime}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        /* List view (original grid card view) */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {posts.map(post => {
            const channelName = channels.find(c => c.page_id === post.page_connection_id && c.platform === post.platform)?.page_name || 'Channel';
            return (
              <div key={post.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span className="badge" style={{
                      background: post.platform === 'instagram' ? 'rgba(225,48,108,0.1)' : 'rgba(24,119,242,0.1)',
                      color: post.platform === 'instagram' ? '#E1306C' : '#1877F2',
                      fontSize: '11px',
                      fontWeight: 600
                    }}>
                      {channelName}
                    </span>
                    <span className={`badge badge-${post.status === 'published' ? 'success' : post.status === 'failed' ? 'error' : 'secondary'}`} style={{ fontSize: '10px' }}>
                      {post.status}
                    </span>
                  </div>

                  {post.media_urls && post.media_urls[0] && (
                    <div style={{ width: '100%', height: '160px', overflow: 'hidden', borderRadius: '6px', marginBottom: '12px', background: 'var(--bg-tertiary)' }}>
                      {post.media_urls[0].toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/) ? (
                        <video src={post.media_urls[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                      ) : (
                        <img src={post.media_urls[0]} alt="Post media attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                  )}

                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '16px', whiteSpace: 'pre-line' }}>
                    {post.message || <em style={{ color: 'var(--text-secondary)' }}>No text message caption.</em>}
                  </p>
                </div>

                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    <Clock size={12} />
                    <span>{new Date(post.scheduled_time).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {post.status === 'scheduled' && (
                      <>
                        <button className="btn btn-sm btn-secondary btn-icon" onClick={() => handleOpenViewDetails(post)} title="Edit details">
                          <Edit3 size={12} />
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDeletePost(post.id)}>
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {post.error_message && (
                  <div style={{ marginTop: '12px', background: 'rgba(239,68,68,0.1)', color: '#EF4444', padding: '8px', borderRadius: '4px', fontSize: '0.75rem' }}>
                    <strong>Error:</strong> {post.error_message}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Post Composer Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <h2>{isEditing ? 'Edit Scheduled Post' : 'Compose Scheduled Post'}</h2>
              <button className="btn-ghost btn-icon" type="button" onClick={handleCloseComposer}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreatePost}>
              <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                
                {/* Form Fields Column */}
                <div>
                  <div className="form-group">
                    <label className="form-label">Select Social Channel</label>
                    <select className="form-input" value={selectedChannel} onChange={e => setSelectedChannel(e.target.value)} required>
                      <option value="">-- Choose Connected Page --</option>
                      {channels.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.page_name} ({c.platform === 'instagram' ? 'Instagram' : 'Facebook'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Caption / Message</label>
                    <textarea className="form-textarea" placeholder="What would you like to share? Add hashtags, emojis..." value={message} onChange={e => setMessage(e.target.value)} style={{ minHeight: '120px' }} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Post Media Attachments (Photos / Videos)</label>
                    
                    {/* Upload button & Text Input row */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                      <label 
                        className="btn btn-secondary"
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          cursor: 'pointer',
                          padding: '8px 12px',
                          fontSize: '13px',
                          margin: 0
                        }}
                      >
                        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        {uploading ? 'Uploading...' : 'Upload Media'}
                        <input 
                          type="file" 
                          accept="image/*,video/*" 
                          multiple 
                          onChange={handleFileUpload} 
                          style={{ display: 'none' }}
                          disabled={uploading}
                        />
                      </label>
                      
                      <input 
                        className="form-input" 
                        type="url" 
                        placeholder="Or paste media URL & press Enter..." 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val) {
                              setMediaUrls([...mediaUrls, val]);
                              (e.target as HTMLInputElement).value = '';
                            }
                          }
                        }}
                        style={{ flex: 1 }}
                      />
                    </div>

                    {/* Media Previews Grid */}
                    {mediaUrls.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px', marginTop: '8px', background: 'var(--bg-secondary)', padding: '8px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                        {mediaUrls.map((url, idx) => (
                          <div key={idx} style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-light)' }}>
                            {url.toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/) ? (
                              <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                            ) : (
                              <img src={url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Invalid+Image+URL'; }} />
                            )}
                            <button
                              type="button"
                              onClick={() => setMediaUrls(mediaUrls.filter((_, i) => i !== idx))}
                              style={{
                                position: 'absolute',
                                top: '2px',
                                right: '2px',
                                background: 'rgba(0,0,0,0.6)',
                                border: 'none',
                                borderRadius: '50%',
                                width: '18px',
                                height: '18px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                cursor: 'pointer'
                              }}
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="form-hint">Meta API requires publicly accessible links. Uploaded images will be hosted securely on our server.</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Schedule Time</label>
                    <input className="form-input" type="datetime-local" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} required />
                    <p className="form-hint">Must be between 10 minutes and 30 days in the future.</p>
                  </div>

                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label className="form-label" style={{ margin: 0 }}>First Comment Thread (Optional)</label>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setFirstComments([...firstComments, ''])}
                        style={{ padding: '2px 8px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', height: '24px' }}
                      >
                        <Plus size={12} /> Add Comment
                      </button>
                    </div>

                    {firstComments.length === 0 ? (
                      <div 
                        onClick={() => setFirstComments([''])}
                        style={{ 
                          border: '1px dashed var(--border-primary)', 
                          borderRadius: '8px', 
                          padding: '16px', 
                          textAlign: 'center', 
                          color: 'var(--text-secondary)', 
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                          background: 'rgba(255, 255, 255, 0.01)'
                        }}
                      >
                        No automated comments added. Click to add the first comment.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {firstComments.map((comment, index) => (
                          <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', width: '18px', flexShrink: 0 }}>#{index + 1}</span>
                            <input
                              className="form-input"
                              placeholder={`Write comment #${index + 1}...`}
                              value={comment}
                              onChange={(e) => {
                                const newComments = [...firstComments];
                                newComments[index] = e.target.value;
                                setFirstComments(newComments);
                              }}
                              style={{ flex: 1 }}
                            />
                            <button
                              type="button"
                              className="btn btn-ghost btn-icon"
                              onClick={() => {
                                const newComments = firstComments.filter((_, idx) => idx !== index);
                                setFirstComments(newComments);
                              }}
                              style={{ width: '32px', height: '32px', padding: 0 }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="form-hint">Instagram comments only support text. Comments will be posted sequentially immediately after the post goes live.</p>
                  </div>

                  {hasConflict && (
                    <div style={{ display: 'flex', gap: '10px', background: 'rgba(245,158,11,0.1)', color: '#D97706', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.8rem' }}>
                      <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                      <div>
                        <strong>Schedule Conflict Detected:</strong> Another post is scheduled to go live on this page around this exact time.
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Social Preview Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <span className="sidebar-section-label">Live Preview</span>
                  <div className="card" style={{ border: '1px solid var(--border-primary)', padding: '0', overflow: 'hidden' }}>
                    {/* Fake Feed Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Globe size={16} style={{ color: 'var(--text-secondary)' }} />
                      </div>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>
                          {channels.find(c => c.id === selectedChannel)?.page_name || 'Your Brand Page'}
                        </h4>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          <span>Just now</span>
                          <span>•</span>
                          <Globe size={10} />
                        </div>
                      </div>
                    </div>

                    {/* Fake Feed Message */}
                    <p style={{ margin: '0 12px 12px 12px', fontSize: '0.85rem', color: 'var(--text-primary)', whiteSpace: 'pre-line' }}>
                      {message || <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>Feed caption message will appear here...</span>}
                    </p>

                    {/* Fake Feed Image */}
                    {mediaUrls.length > 0 ? (
                      <div style={{ width: '100%', height: '220px', background: 'var(--bg-tertiary)', overflow: 'hidden', position: 'relative' }}>
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
                      <div style={{ width: '100%', height: '220px', background: 'var(--bg-tertiary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
                        <ImageIcon size={32} style={{ opacity: 0.5 }} />
                        <span style={{ fontSize: '0.75rem' }}>No media attached (Text-only post)</span>
                      </div>
                    )}

                    {/* Fake Feed Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid var(--border-color)', padding: '8px 0', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      <span>Like</span>
                      <span>Comment</span>
                      <span>Share</span>
                    </div>
                  </div>
                </div>

              </div>
              <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
                  disabled={saving || !selectedChannel}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', border: '1px solid rgba(124, 58, 237, 0.3)' }}
                >
                  {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
                  Post Now
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                  {saving ? 'Saving...' : isEditing ? 'Update Post' : 'Schedule Post'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Post Detail Inspector Modal */}
      {showDetailModal && viewedPost && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge" style={{
                  background: viewedPost.platform === 'instagram' ? 'rgba(225,48,108,0.1)' : 'rgba(24,119,242,0.1)',
                  color: viewedPost.platform === 'instagram' ? '#E1306C' : '#1877F2',
                  fontSize: '11px',
                  fontWeight: 600
                }}>
                  {viewedPost.platform === 'instagram' ? 'Instagram' : 'Facebook'}
                </span>
                <h2>Post Details</h2>
              </div>
              <button className="btn-ghost btn-icon" onClick={() => setShowDetailModal(false)}><X size={18} /></button>
            </div>
            
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
              <div>
                <div style={{ marginBottom: '16px' }}>
                  <span className="form-label" style={{ margin: 0 }}>Social Channel</span>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {channels.find(c => c.page_id === viewedPost.page_connection_id && c.platform === viewedPost.platform)?.page_name || 'Connected Channel'}
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <span className="form-label" style={{ margin: 0 }}>Scheduled Time</span>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} style={{ color: 'var(--accent-primary)' }} />
                    {new Date(viewedPost.scheduled_time).toLocaleString()}
                  </p>
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <span className="form-label" style={{ margin: 0 }}>Status</span>
                  <span className={`badge badge-${viewedPost.status === 'published' ? 'success' : viewedPost.status === 'failed' ? 'error' : 'secondary'}`}>
                    {viewedPost.status}
                  </span>
                </div>

                {viewedPost.message && (
                  <div style={{ marginBottom: '16px' }}>
                    <span className="form-label" style={{ margin: 0 }}>Caption / Message</span>
                    <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', border: '1px solid var(--border-primary)' }}>
                      {viewedPost.message}
                    </div>
                  </div>
                )}

                {viewedPost.first_comments && viewedPost.first_comments.length > 0 && (
                  <div>
                    <span className="form-label" style={{ margin: 0 }}>First Comment Thread</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                      {viewedPost.first_comments.map((comment, i) => (
                        <div key={i} style={{ background: 'var(--bg-input)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.8rem', color: 'var(--text-secondary)', borderLeft: '2px solid var(--accent-primary)' }}>
                          {comment}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {viewedPost.error_message && (
                  <div style={{ marginTop: '16px', background: 'var(--error-bg)', color: 'var(--error)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <strong>Error:</strong> {viewedPost.error_message}
                  </div>
                )}
              </div>

              {/* Feed Preview Column */}
              <div>
                <span className="sidebar-section-label" style={{ paddingLeft: 0 }}>Visual Preview</span>
                <div className="card" style={{ border: '1px solid var(--border-primary)', padding: '0', overflow: 'hidden', background: 'var(--bg-secondary)', marginTop: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Globe size={14} style={{ color: 'var(--text-secondary)' }} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600 }}>
                        {channels.find(c => c.page_id === viewedPost.page_connection_id && c.platform === viewedPost.platform)?.page_name || 'Brand Page'}
                      </h4>
                    </div>
                  </div>
                  
                  {viewedPost.media_urls && viewedPost.media_urls[0] ? (
                    <div style={{ width: '100%', height: '150px', background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                      {viewedPost.media_urls[0].toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/) ? (
                        <video src={viewedPost.media_urls[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls muted playsInline />
                      ) : (
                        <img src={viewedPost.media_urls[0]} alt="Attached visual" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                  ) : (
                    <div style={{ width: '100%', height: '120px', background: 'var(--bg-tertiary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                      <ImageIcon size={24} style={{ opacity: 0.5 }} />
                      <span style={{ fontSize: '0.7rem' }}>Text-only post</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                {viewedPost.status === 'scheduled' && (
                  <button type="button" className="btn btn-danger btn-sm" onClick={() => { setShowDetailModal(false); handleDeletePost(viewedPost.id); }}>
                    Cancel Post
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowDetailModal(false)}>Close</button>
                {viewedPost.status === 'scheduled' && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleEditFromDetails}>
                    Edit Details
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
