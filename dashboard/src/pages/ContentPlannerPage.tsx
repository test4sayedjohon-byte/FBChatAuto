import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';
import { 
  Plus, Calendar as CalendarIcon, Clock, Image as ImageIcon, 
  Loader2, List, Calendar, Edit3, Sparkles, Trash2, X, ChevronDown, CheckCircle, Undo
} from 'lucide-react';
import PostComposerModal from '../components/content/PostComposerModal';
import { BulkActionsBar } from '../components/content/BulkActionsBar';
import CalendarInspector from '../components/content/CalendarInspector';
import type { ScheduledPost, PageConn } from '../types/content';
import { workerPost } from '../lib/workerApi';

const getStoragePathFromUrl = (url: string): string | null => {
  const marker = '/media_assets/';
  const index = url.indexOf(marker);
  if (index === -1) return null;
  const pathWithQuery = url.substring(index + marker.length);
  const path = pathWithQuery.split('?')[0];
  return decodeURIComponent(path);
};

export default function ContentPlannerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [channels, setChannels] = useState<PageConn[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal control states
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [inspectedPost, setInspectedPost] = useState<ScheduledPost | null>(null);
  const [initialDate, setInitialDate] = useState<Date | null>(null);

  // List View Filters
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');
  const [filterDate, setFilterDate] = useState<string>('');



  // Bulk Delete Modal States
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showBulkActionsDropdown, setShowBulkActionsDropdown] = useState(false);
  const [bulkDeleteChannel, setBulkDeleteChannel] = useState('all');
  const [bulkDeletePlatform, setBulkDeletePlatform] = useState('all');
  const [bulkDeleteRangeType, setBulkDeleteRangeType] = useState<'today' | 'tomorrow' | 'this_week' | 'this_month' | 'all_future' | 'custom'>('today');
  const [bulkDeleteStart, setBulkDeleteStart] = useState('');
  const [bulkDeleteEnd, setBulkDeleteEnd] = useState('');
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

  // Floating Multi-Select & Bulk Actions States
  const [selectedPostIds, setSelectedPostIds] = useState<string[]>([]);
  const [bulkActionsLoading, setBulkActionsLoading] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (!bulkDeleteStart) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      setBulkDeleteStart(`${year}-${month}-${day}`);
    }
    if (!bulkDeleteEnd) {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      nextWeek.setHours(23,59,59,999);
      const year = nextWeek.getFullYear();
      const month = String(nextWeek.getMonth() + 1).padStart(2, '0');
      const day = String(nextWeek.getDate()).padStart(2, '0');
      setBulkDeleteEnd(`${year}-${month}-${day}`);
    }
  }, []);

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

  const handleOpenComposeForDay = (date: Date) => {
    setInitialDate(date);
    setSelectedPost(null);
    setShowComposeModal(true);
  };

  const handleOpenInspector = (post: ScheduledPost) => {
    setInspectedPost(post);
    setShowInspector(true);
  };

  const handleEditFromInspector = () => {
    if (!inspectedPost) return;
    setShowInspector(false);
    setSelectedPost(inspectedPost);
    setInitialDate(null);
    setShowComposeModal(true);
  };

  const handleCloseComposer = () => {
    setShowComposeModal(false);
    setSelectedPost(null);
    setInitialDate(null);
  };

  async function handleDeletePost(id: string) {
    if (!confirm('Are you sure you want to delete this scheduled post?')) return;
    try {
      const post = posts.find(p => p.id === id);
      if (post && post.media_urls && post.media_urls.length > 0) {
        const pathsToDelete: string[] = [];
        post.media_urls.forEach(url => {
          const storagePath = getStoragePathFromUrl(url);
          if (storagePath && url.includes('.supabase.')) {
            pathsToDelete.push(storagePath);
          }
        });
        if (pathsToDelete.length > 0) {
          await supabase.storage.from('media_assets').remove(pathsToDelete);
        }
      }

      const { error } = await supabase.from('scheduled_posts').delete().eq('id', id);
      if (error) throw error;
      toast.success('Scheduled post deleted.');
      setShowInspector(false);
      loadData();
    } catch (err: any) {
      toast.error('Error deleting post: ' + err.message);
    }
  }



  async function handleBulkDeleteSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    let start: Date;
    let end: Date;

    if (bulkDeleteRangeType === 'custom') {
      if (!bulkDeleteStart || !bulkDeleteEnd) {
        toast.error('Please specify start and end dates.');
        return;
      }
      start = new Date(bulkDeleteStart);
      start.setHours(0,0,0,0);
      end = new Date(bulkDeleteEnd);
      end.setHours(23,59,59,999);

      if (start > end) {
        toast.error('Start date cannot be after end date.');
        return;
      }
    } else {
      const now = new Date();
      start = new Date();
      end = new Date();

      if (bulkDeleteRangeType === 'today') {
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
      } else if (bulkDeleteRangeType === 'tomorrow') {
        start.setDate(start.getDate() + 1);
        start.setHours(0, 0, 0, 0);
        end.setDate(end.getDate() + 1);
        end.setHours(23, 59, 59, 999);
      } else if (bulkDeleteRangeType === 'this_week') {
        // Monday to Sunday of current week
        const currentDay = now.getDay();
        const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        start.setDate(now.getDate() + distanceToMonday);
        start.setHours(0, 0, 0, 0);
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
      } else if (bulkDeleteRangeType === 'this_month') {
        // 1st of current month to last day of current month
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      } else if (bulkDeleteRangeType === 'all_future') {
        start.setHours(0, 0, 0, 0);
        end = new Date(now.getFullYear() + 5, 11, 31, 23, 59, 59, 999);
      }
    }

    const rangeLabel = bulkDeleteRangeType === 'custom' 
      ? `between ${start.toLocaleDateString()} and ${end.toLocaleDateString()}`
      : `for ${bulkDeleteRangeType.replace('_', ' ')}`;

    if (!confirm(`Are you sure you want to bulk delete scheduled posts ${rangeLabel}? This action is permanent.`)) {
      return;
    }

    try {
      setBulkDeleteLoading(true);
      const data = await workerPost<{ success: boolean; message: string }>(
        '/api/agent/delete-bulk',
        {
          pageConnectionId: bulkDeleteChannel === 'all' ? null : bulkDeleteChannel,
          platform: bulkDeletePlatform === 'all' ? null : bulkDeletePlatform,
          startTime: start.toISOString(),
          endTime: end.toISOString()
        }
      );

      if (data.success) {
        toast.success(data.message || 'Successfully deleted posts.');
        setShowBulkDeleteModal(false);
        loadData();
      }
    } catch (err: any) {
      toast.error(err.message || 'Error executing bulk deletion.');
    } finally {
      setBulkDeleteLoading(false);
    }
  }

  async function handleBulkApprove() {
    if (!confirm('Are you sure you want to approve all current draft scheduled posts?')) return;
    try {
      setLoading(true);
      const { error } = await supabase
        .from('scheduled_posts')
        .update({ approval_status: 'approved' })
        .eq('approval_status', 'draft');
      if (error) throw error;
      toast.success('Successfully approved all draft posts.');
      loadData();
    } catch (err: any) {
      toast.error('Failed to approve posts: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkApproveSelected() {
    if (selectedPostIds.length === 0) return;
    try {
      setBulkActionsLoading(true);
      const { error } = await supabase
        .from('scheduled_posts')
        .update({ approval_status: 'approved' })
        .in('id', selectedPostIds);
      if (error) throw error;
      toast.success(`Successfully approved ${selectedPostIds.length} posts.`);
      setSelectedPostIds([]);
      loadData();
    } catch (err: any) {
      toast.error('Failed to approve selected posts: ' + err.message);
    } finally {
      setBulkActionsLoading(false);
    }
  }

  async function handleBulkDraftSelected() {
    if (selectedPostIds.length === 0) return;
    try {
      setBulkActionsLoading(true);
      const { error } = await supabase
        .from('scheduled_posts')
        .update({ approval_status: 'draft' })
        .in('id', selectedPostIds);
      if (error) throw error;
      toast.success(`Successfully converted ${selectedPostIds.length} posts to drafts.`);
      setSelectedPostIds([]);
      loadData();
    } catch (err: any) {
      toast.error('Failed to convert selected posts: ' + err.message);
    } finally {
      setBulkActionsLoading(false);
    }
  }

  async function handleBulkDeleteSelected() {
    if (selectedPostIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedPostIds.length} selected posts?`)) return;
    try {
      setBulkActionsLoading(true);
      
      const { data: postsToDelete } = await supabase
        .from('scheduled_posts')
        .select('media_urls')
        .in('id', selectedPostIds);

      if (postsToDelete) {
        const pathsToDelete: string[] = [];
        postsToDelete.forEach(p => {
          if (p.media_urls) {
            p.media_urls.forEach((url: string) => {
              const storagePath = getStoragePathFromUrl(url);
              if (storagePath && url.includes('.supabase.')) {
                pathsToDelete.push(storagePath);
              }
            });
          }
        });
        if (pathsToDelete.length > 0) {
          await supabase.storage.from('media_assets').remove(pathsToDelete);
        }
      }

      const { error } = await supabase
        .from('scheduled_posts')
        .delete()
        .in('id', selectedPostIds);
      if (error) throw error;
      toast.success(`Successfully deleted ${selectedPostIds.length} posts.`);
      setSelectedPostIds([]);
      loadData();
    } catch (err: any) {
      toast.error('Failed to delete selected posts: ' + err.message);
    } finally {
      setBulkActionsLoading(false);
    }
  }

  async function handleUndoLastAiBatch() {
    try {
      setLoading(true);
      // Fetch the most recent post with a batch_id
      const { data: recent, error: fetchErr } = await supabase
        .from('scheduled_posts')
        .select('ai_generated_options')
        .eq('media_source_type', 'ai_generated')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      const batchId = (recent?.ai_generated_options as any)?.batch_id;
      if (!batchId) {
        toast.error('No undoable AI generation batch was found.');
        return;
      }

      // Find how many posts are in this batch
      const { count, error: countErr } = await supabase
        .from('scheduled_posts')
        .select('*', { count: 'exact', head: true })
        .eq('media_source_type', 'ai_generated')
        .filter('ai_generated_options->>batch_id', 'eq', batchId);

      if (countErr) throw countErr;

      if (!confirm(`Are you sure you want to undo the last AI generation batch? This will delete all ${count || 0} scheduled posts from that batch.`)) {
        return;
      }

      const { error: delErr } = await supabase
        .from('scheduled_posts')
        .delete()
        .eq('media_source_type', 'ai_generated')
        .filter('ai_generated_options->>batch_id', 'eq', batchId);

      if (delErr) throw delErr;

      toast.success(`Successfully undone the last batch (${count} posts deleted).`);
      loadData();
    } catch (err: any) {
      toast.error('Failed to undo last batch: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-slideUp" style={{ position: 'relative' }}>
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
        .bulk-action-item {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 8px 12px;
          text-align: left;
          cursor: pointer;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 8px;
          border-radius: 6px;
          width: 100%;
          transition: all 0.15s ease;
        }
        .bulk-action-item:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
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
              className="btn btn-sm btn-ghost" 
              onClick={() => navigate('/calendar')}
              style={{ borderRadius: '6px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Calendar size={14} />
              Calendar
            </button>
            <button 
              className="btn btn-sm btn-primary" 
              style={{ borderRadius: '6px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <List size={14} />
              List
            </button>
          </div>

          <button 
            className="btn btn-ghost" 
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) setSelectedPostIds([]);
            }} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              border: isSelectMode ? '1px solid var(--accent-primary)' : '1px solid rgba(255, 255, 255, 0.08)', 
              background: isSelectMode ? 'rgba(249, 115, 22, 0.1)' : 'rgba(255, 255, 255, 0.02)', 
              color: isSelectMode ? 'var(--accent-primary)' : '#fff', 
              padding: '6px 14px', 
              fontSize: '0.85rem', 
              height: '36px', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontWeight: 600 
            }}
          >
            {isSelectMode ? 'Cancel Selection' : 'Select Posts'}
          </button>

          {isSelectMode && (
            <button 
              className="btn btn-ghost" 
              onClick={() => {
                const today = new Date();
                today.setHours(0,0,0,0);
                const visible = posts.filter(post => {
                  if (timeFilter === 'today') {
                    const postDate = new Date(post.scheduled_time);
                    return postDate.getFullYear() === today.getFullYear() &&
                           postDate.getMonth() === today.getMonth() &&
                           postDate.getDate() === today.getDate();
                  } else if (timeFilter === 'upcoming') {
                    return new Date(post.scheduled_time) > today;
                  } else if (timeFilter === 'past') {
                    return new Date(post.scheduled_time) < today || post.status === 'published';
                  }
                  if (filterDate) {
                    const pickDate = new Date(filterDate);
                    const postDate = new Date(post.scheduled_time);
                    return postDate.getFullYear() === pickDate.getFullYear() &&
                           postDate.getMonth() === pickDate.getMonth() &&
                           postDate.getDate() === pickDate.getDate();
                  }
                  return true;
                });
                if (selectedPostIds.length === visible.length) {
                  setSelectedPostIds([]);
                } else {
                  setSelectedPostIds(visible.map(v => v.id));
                }
              }}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                border: '1px solid rgba(255, 255, 255, 0.08)', 
                background: 'rgba(255, 255, 255, 0.02)', 
                color: '#fff', 
                padding: '6px 14px', 
                fontSize: '0.85rem', 
                height: '36px', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                fontWeight: 600 
              }}
            >
              {selectedPostIds.length > 0 ? 'Deselect All' : 'Select All'}
            </button>
          )}

          <button className="btn btn-accent" onClick={() => navigate('/campaign-planner')} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, var(--primary) 0%, #a78bfa 100%)', border: 'none', color: '#fff', padding: '6px 14px', fontSize: '0.85rem', height: '36px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
            <Sparkles size={14} /> AI Generate
          </button>

          <div style={{ position: 'relative' }}>
            <button 
              className="btn btn-ghost" 
              onClick={() => setShowBulkActionsDropdown(!showBulkActionsDropdown)} 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                border: '1px solid rgba(255, 255, 255, 0.08)', 
                background: 'rgba(255, 255, 255, 0.02)', 
                color: '#fff', 
                padding: '6px 14px', 
                fontSize: '0.85rem', 
                height: '36px', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                fontWeight: 600 
              }}
            >
              Bulk Actions <ChevronDown size={14} />
            </button>
            {showBulkActionsDropdown && (
              <>
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} onClick={() => setShowBulkActionsDropdown(false)} />
                <div style={{ 
                  position: 'absolute', 
                  right: 0, 
                  top: '40px', 
                  background: '#151719', 
                  border: '1px solid rgba(255,255,255,0.08)', 
                  borderRadius: '8px', 
                  padding: '6px', 
                  minWidth: '180px', 
                  boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)', 
                  zIndex: 1000,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}>
                  <button 
                    onClick={() => { setShowBulkActionsDropdown(false); setShowBulkDeleteModal(true); }}
                    className="bulk-action-item"
                  >
                    <Trash2 size={14} color="#f87171" /> Bulk Delete...
                  </button>
                  <button 
                    onClick={() => { setShowBulkActionsDropdown(false); handleBulkApprove(); }}
                    className="bulk-action-item"
                  >
                    <CheckCircle size={14} color="#34d399" /> Bulk Approve Drafts
                  </button>
                  <button 
                    onClick={() => { setShowBulkActionsDropdown(false); handleUndoLastAiBatch(); }}
                    className="bulk-action-item"
                  >
                    <Undo size={14} color="#60a5fa" /> Undo Last AI Batch
                  </button>
                </div>
              </>
            )}
          </div>

          <button className="btn btn-primary" onClick={() => handleOpenComposeForDay(new Date())} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 14px', fontSize: '0.85rem', height: '36px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
            <Plus size={14} /> Compose Post
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
      ) : (
        /* Enhanced list view */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* List Filter Toolbar */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: '12px',
            padding: '12px 16px',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            {/* Quick filters */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button 
                type="button"
                className="btn btn-sm"
                onClick={() => setTimeFilter('all')}
                style={{
                  background: timeFilter === 'all' ? 'var(--bg-tertiary)' : 'transparent',
                  border: `1px solid ${timeFilter === 'all' ? 'var(--border-secondary)' : 'var(--border-primary)'}`,
                  color: 'var(--text-primary)',
                  borderRadius: '8px',
                  padding: '6px 16px',
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                All Posts
              </button>
              <button 
                type="button"
                className="btn btn-sm"
                onClick={() => setTimeFilter('today')}
                style={{
                  background: timeFilter === 'today' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  border: `1px solid ${timeFilter === 'today' ? 'rgb(16, 185, 129)' : 'var(--border-primary)'}`,
                  color: timeFilter === 'today' ? '#10B981' : 'var(--text-secondary)',
                  borderRadius: '8px',
                  padding: '6px 16px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 6px #10B981' }}></span>
                Today
              </button>
              <button 
                type="button"
                className="btn btn-sm"
                onClick={() => setTimeFilter('upcoming')}
                style={{
                  background: timeFilter === 'upcoming' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                  border: `1px solid ${timeFilter === 'upcoming' ? 'rgb(139, 92, 246)' : 'var(--border-primary)'}`,
                  color: timeFilter === 'upcoming' ? '#A78BFA' : 'var(--text-secondary)',
                  borderRadius: '8px',
                  padding: '6px 16px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#A78BFA', display: 'inline-block', boxShadow: '0 0 6px #A78BFA' }}></span>
                Upcoming
              </button>
              <button 
                type="button"
                className="btn btn-sm"
                onClick={() => setTimeFilter('past')}
                style={{
                  background: timeFilter === 'past' ? 'rgba(148, 163, 184, 0.15)' : 'transparent',
                  border: `1px solid ${timeFilter === 'past' ? 'rgb(148, 163, 184)' : 'var(--border-primary)'}`,
                  color: timeFilter === 'past' ? '#94A3B8' : 'var(--text-secondary)',
                  borderRadius: '8px',
                  padding: '6px 16px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  cursor: 'pointer'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#94A3B8', display: 'inline-block' }}></span>
                Past Days
              </button>
            </div>

            {/* Date Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Jump to Date:</span>
              <input 
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: '8px',
                  padding: '5px 10px',
                  fontSize: '0.8rem',
                  color: 'var(--text-primary)',
                  outline: 'none'
                }}
              />
              {filterDate && (
                <button 
                  type="button" 
                  className="btn btn-ghost btn-xs" 
                  onClick={() => setFilterDate('')}
                  style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', padding: '2px 6px', border: 'none', background: 'transparent', cursor: 'pointer' }}
                >
                  Clear Date
                </button>
              )}
            </div>
          </div>

          {/* Grouped date list container */}
          {(() => {
            const filteredPosts = posts.filter(post => {
              const postDate = new Date(post.scheduled_time);
              const today = new Date();
              
              // Time Filter
              if (timeFilter === 'today') {
                const isToday = postDate.getFullYear() === today.getFullYear() &&
                                postDate.getMonth() === today.getMonth() &&
                                postDate.getDate() === today.getDate();
                if (!isToday) return false;
              } else if (timeFilter === 'upcoming') {
                const startOfTomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
                if (postDate < startOfTomorrow) return false;
              } else if (timeFilter === 'past') {
                const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                if (postDate >= startOfToday) return false;
              }

              // Date picker filter
              if (filterDate) {
                const pickDate = new Date(filterDate);
                const isSame = postDate.getFullYear() === pickDate.getFullYear() &&
                               postDate.getMonth() === pickDate.getMonth() &&
                               postDate.getDate() === pickDate.getDate();
                if (!isSame) return false;
              }

              return true;
            });

            if (filteredPosts.length === 0) {
              return (
                <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No posts match the selected filters.
                </div>
              );
            }

            // Sort descending: latest time / date on top
            const sortedPosts = [...filteredPosts].sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());

            // Group by Date header
            const groups: { [key: string]: ScheduledPost[] } = {};
            sortedPosts.forEach(post => {
              const dateStr = new Date(post.scheduled_time).toLocaleDateString('default', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
              if (!groups[dateStr]) {
                groups[dateStr] = [];
              }
              groups[dateStr].push(post);
            });

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {Object.keys(groups).map(dateHeader => {
                  const groupPosts = groups[dateHeader];
                  const firstPostTime = new Date(groupPosts[0].scheduled_time);
                  const today = new Date();
                  const isToday = firstPostTime.getFullYear() === today.getFullYear() &&
                                  firstPostTime.getMonth() === today.getMonth() &&
                                  firstPostTime.getDate() === today.getDate();
                  const isPast = firstPostTime < new Date(today.getFullYear(), today.getMonth(), today.getDate());

                  // Badge styling for date header
                  let headerTheme: { color: string; bg: string; border: string; badge: string | null } = {
                    color: 'var(--text-primary)',
                    bg: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-primary)',
                    badge: null
                  };

                  if (isToday) {
                    headerTheme = {
                      color: '#10B981',
                      bg: 'rgba(16, 185, 129, 0.05)',
                      border: '1px solid rgba(16, 185, 129, 0.2)',
                      badge: 'Today'
                    };
                  } else if (isPast) {
                    headerTheme = {
                      color: '#94A3B8',
                      bg: 'rgba(148, 163, 184, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      badge: 'Past Day'
                    };
                  } else {
                    headerTheme = {
                      color: 'var(--accent-primary)',
                      bg: 'rgba(124, 58, 237, 0.05)',
                      border: '1px solid rgba(124, 58, 237, 0.2)',
                      badge: 'Upcoming'
                    };
                  }

                  return (
                    <div key={dateHeader} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {/* Date Header */}
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                        background: headerTheme.bg,
                        border: headerTheme.border,
                        padding: '10px 16px',
                        borderRadius: '8px'
                      }}>
                        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: headerTheme.color }}>
                          {dateHeader}
                        </h3>
                        {headerTheme.badge && (
                          <span style={{ 
                            fontSize: '0.65rem', 
                            fontWeight: 700, 
                            padding: '2px 8px', 
                            borderRadius: '12px',
                            background: isToday ? 'rgba(16, 185, 129, 0.15)' : isPast ? 'rgba(148, 163, 184, 0.15)' : 'rgba(124, 58, 237, 0.15)',
                            color: headerTheme.color
                          }}>
                            {headerTheme.badge}
                          </span>
                        )}
                      </div>

                      {/* Post Card Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                        {groupPosts.map(post => {
                          const channelName = channels.find(c => c.page_id === post.page_connection_id && c.platform === post.platform)?.page_name || 'Channel';
                          const isIg = post.platform === 'instagram';
                          
                          // Card visual styling based on past/today/upcoming status
                          const cardIsPast = new Date(post.scheduled_time) < new Date(today.getFullYear(), today.getMonth(), today.getDate()) || post.status === 'published';
                          const cardIsToday = new Date(post.scheduled_time).getFullYear() === today.getFullYear() &&
                                              new Date(post.scheduled_time).getMonth() === today.getMonth() &&
                                              new Date(post.scheduled_time).getDate() === today.getDate();

                          let cardStyle: React.CSSProperties = {
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            position: 'relative',
                            padding: '12px',
                            borderRadius: '10px',
                            transition: 'all 0.2s',
                            cursor: 'pointer'
                          };

                          if (cardIsToday) {
                            cardStyle = {
                              ...cardStyle,
                              border: '1px solid rgba(16, 185, 129, 0.35)',
                              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.05)',
                            };
                          } else if (cardIsPast) {
                            cardStyle = {
                              ...cardStyle,
                              opacity: 0.75,
                              border: '1px solid rgba(255, 255, 255, 0.05)',
                              background: 'rgba(255,255,255,0.01)',
                            };
                          } else {
                            cardStyle = {
                              ...cardStyle,
                              border: '1px solid rgba(124, 58, 237, 0.3)',
                              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.03)',
                            };
                          }

                          const isChecked = selectedPostIds.includes(post.id);
                          if (isChecked) {
                            cardStyle = {
                              ...cardStyle,
                              border: '1px solid var(--accent-primary)',
                              background: 'rgba(249, 115, 22, 0.03)'
                            };
                          }
                          return (
                            <div 
                              key={post.id} 
                              className="card" 
                              style={cardStyle} 
                              onClick={(e) => {
                                if (isSelectMode) {
                                  e.stopPropagation();
                                  if (isChecked) {
                                    setSelectedPostIds(selectedPostIds.filter(id => id !== post.id));
                                  } else {
                                    setSelectedPostIds([...selectedPostIds, post.id]);
                                  }
                                } else {
                                  handleOpenInspector(post);
                                }
                              }}
                            >
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {(isSelectMode || isChecked) && (
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          if (e.target.checked) {
                                            setSelectedPostIds([...selectedPostIds, post.id]);
                                          } else {
                                            setSelectedPostIds(selectedPostIds.filter(id => id !== post.id));
                                          }
                                        }}
                                        style={{ width: '14px', height: '14px', accentColor: 'var(--accent-primary)', cursor: 'pointer', margin: 0 }}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    )}
                                    <span className="badge" style={{
                                      background: isIg ? 'rgba(225,48,108,0.1)' : 'rgba(24,119,242,0.1)',
                                      color: isIg ? '#E1306C' : '#1877F2',
                                      fontSize: '10px',
                                      fontWeight: 600,
                                      padding: '2px 6px'
                                    }}>
                                      {channelName.replace(' (Instagram)', '')}
                                    </span>
                                  </div>
                                  <span className={`badge badge-${post.status === 'published' ? 'success' : post.status === 'failed' ? 'error' : 'secondary'}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
                                    {post.status}
                                  </span>
                                </div>

                                {/* 4/3 Aspect Ratio Image Box */}
                                <div style={{ width: '100%', aspectRatio: '4/3', overflow: 'hidden', borderRadius: '6px', marginBottom: '10px', background: 'var(--bg-tertiary)' }}>
                                  {post.media_urls && post.media_urls[0] ? (
                                    post.media_urls[0].startsWith('file://localhost/') ? (
                                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', border: '1px dashed var(--border-primary)', padding: '8px', textAlign: 'center' }}>
                                        <ImageIcon size={20} style={{ color: 'var(--accent-primary)', opacity: 0.8 }} />
                                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', wordBreak: 'break-all' }}>
                                          Cleaned Up
                                        </span>
                                      </div>
                                    ) : post.media_urls[0].toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/) ? (
                                      <video src={post.media_urls[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
                                    ) : (
                                      <img src={post.media_urls[0]} alt="Attachment" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    )
                                  ) : (
                                    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                                      <span style={{ fontSize: '0.65rem', opacity: 0.5 }}>Text Only</span>
                                    </div>
                                  )}
                                </div>

                                <p style={{ 
                                  fontSize: '0.8rem', 
                                  color: 'var(--text-primary)', 
                                  marginBottom: '12px', 
                                  whiteSpace: 'pre-line',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 3,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  minHeight: '3.6em',
                                  lineHeight: '1.2'
                                }}>
                                  {post.message || <em style={{ color: 'var(--text-secondary)' }}>No caption.</em>}
                                </p>
                              </div>

                              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                                  <Clock size={10} />
                                  <span>{new Date(post.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  {(post.status === 'scheduled' || post.status === 'failed') && (
                                    <>
                                      <button className="btn btn-sm btn-secondary btn-icon" onClick={(e) => { e.stopPropagation(); handleOpenInspector(post); }} title="View Details" style={{ padding: '4px' }}>
                                        <Edit3 size={10} />
                                      </button>
                                      <button className="btn btn-sm btn-danger" onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }} style={{ padding: '2px 6px', fontSize: '10px' }}>
                                        Cancel
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Inspector Panel Drawer */}
      <CalendarInspector
        isOpen={showInspector}
        onClose={() => setShowInspector(false)}
        post={inspectedPost}
        channels={channels}
        onEditClick={handleEditFromInspector}
        onDeleteClick={handleDeletePost}
      />

      {/* Post Composer Modal */}
      <PostComposerModal
        isOpen={showComposeModal}
        onClose={handleCloseComposer}
        post={selectedPost}
        initialDate={initialDate}
        channels={channels}
        posts={posts}
        onSaveSuccess={loadData}
      />



      {/* Bulk Operations Selection Bar */}
      <BulkActionsBar
        selectedCount={selectedPostIds.length}
        onApprove={handleBulkApproveSelected}
        onDraft={handleBulkDraftSelected}
        onDelete={handleBulkDeleteSelected}
        onClear={() => setSelectedPostIds([])}
        loading={bulkActionsLoading}
      />

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
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
            background: '#151719',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            width: '95%',
            maxWidth: '500px',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)',
            overflow: 'hidden'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={18} color="#ef4444" />
                Bulk Delete Scheduled Posts
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowBulkDeleteModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                <X size={18} color="var(--text-secondary)" />
              </button>
            </div>

            <form onSubmit={handleBulkDeleteSubmit} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Select Channel
                  </label>
                  <select
                    className="form-input"
                    value={bulkDeleteChannel}
                    onChange={(e) => setBulkDeleteChannel(e.target.value)}
                    style={{ width: '100%', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px' }}
                  >
                    <option value="all">All Channels</option>
                    {channels.filter((c, index, self) => self.findIndex(t => t.page_id === c.page_id) === index).map(c => (
                      <option key={c.page_id} value={c.page_id}>{c.page_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Select Platform
                  </label>
                  <select
                    className="form-input"
                    value={bulkDeletePlatform}
                    onChange={(e) => setBulkDeletePlatform(e.target.value)}
                    style={{ width: '100%', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px' }}
                  >
                    <option value="all">All Platforms</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Deletion Range / Period
                  </label>
                  <select
                    className="form-input"
                    value={bulkDeleteRangeType}
                    onChange={(e) => setBulkDeleteRangeType(e.target.value as any)}
                    style={{ width: '100%', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px' }}
                  >
                    <option value="today">Today (Daily delete)</option>
                    <option value="tomorrow">Tomorrow</option>
                    <option value="this_week">This Week (Weekly delete)</option>
                    <option value="this_month">This Month (Monthly delete)</option>
                    <option value="all_future">All Future Scheduled Posts</option>
                    <option value="custom">Custom Date Range...</option>
                  </select>
                </div>

                {bulkDeleteRangeType === 'custom' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        Start Date
                      </label>
                      <input
                        type="date"
                        className="form-input"
                        value={bulkDeleteStart}
                        onChange={(e) => setBulkDeleteStart(e.target.value)}
                        required
                        style={{ width: '100%', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 'bold', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                        End Date
                      </label>
                      <input
                        type="date"
                        className="form-input"
                        value={bulkDeleteEnd}
                        onChange={(e) => setBulkDeleteEnd(e.target.value)}
                        required
                        style={{ width: '100%', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px' }}
                      />
                    </div>
                  </div>
                )}

                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.15)', fontSize: '0.85rem', color: '#f87171' }}>
                  <strong>WARNING:</strong> This will delete all matching scheduled posts for the selected range. This action cannot be undone.
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginTop: '20px' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setShowBulkDeleteModal(false)} disabled={bulkDeleteLoading} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={bulkDeleteLoading} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#ef4444', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                  {bulkDeleteLoading ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                  Bulk Delete
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
