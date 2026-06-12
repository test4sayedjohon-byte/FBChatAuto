import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';
import { 
  Plus, Calendar as CalendarIcon, Image as ImageIcon, 
  ChevronLeft, ChevronRight, List, MessageCircle, Loader2
} from 'lucide-react';
import PostComposerModal from '../components/content/PostComposerModal';
import CalendarInspector from '../components/content/CalendarInspector';
import type { ScheduledPost, PageConn } from '../types/content';

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

const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

export default function ContentCalendarPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [channels, setChannels] = useState<PageConn[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Composer Modal State
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null);
  const [initialDate, setInitialDate] = useState<Date | null>(null);

  // Calendar State
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // View mode
  const [view, setView] = useState<'calendar' | 'list'>('calendar');

  // Filter States
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [listFilter, setListFilter] = useState<'all' | 'today' | 'upcoming' | 'past'>('all');

  // Inspector Panel State
  const [showInspector, setShowInspector] = useState(false);
  const [inspectedPost, setInspectedPost] = useState<ScheduledPost | null>(null);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

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
      toast.error('Failed to load calendar data: ' + err.message);
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

  const getFilteredPosts = () => {
    return posts.filter(post => {
      const matchChannel = filterChannel === 'all' || post.page_connection_id === filterChannel;
      const matchPlatform = filterPlatform === 'all' || post.platform === filterPlatform;
      const matchStatus = filterStatus === 'all' || post.status === filterStatus;
      return matchChannel && matchPlatform && matchStatus;
    });
  };

  const getPostsForDate = (date: Date) => {
    const filtered = getFilteredPosts();
    return filtered.filter(post => {
      const postDate = new Date(post.scheduled_time);
      return postDate.getFullYear() === date.getFullYear() &&
             postDate.getMonth() === date.getMonth() &&
             postDate.getDate() === date.getDate();
    });
  };

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

  async function handleDragReschedule(postId: string, targetDate: Date) {
    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;
      if (post.status === 'published') {
        toast.error('Published posts cannot be rescheduled.');
        return;
      }

      const originalTime = new Date(post.scheduled_time);
      const newScheduledTime = new Date(targetDate);
      
      newScheduledTime.setHours(originalTime.getHours());
      newScheduledTime.setMinutes(originalTime.getMinutes());
      newScheduledTime.setSeconds(0);
      newScheduledTime.setMilliseconds(0);

      const now = new Date();
      let finalTime = newScheduledTime;
      if (finalTime.getTime() - now.getTime() < 10 * 60 * 1000) {
        finalTime = new Date(now.getTime() + 15 * 60 * 1000);
        toast.warning('Post rescheduled to today. Auto-adjusted to 15 minutes from now to satisfy Meta API requirements.');
      } else if (finalTime.getTime() - now.getTime() > 30 * 24 * 60 * 60 * 1000) {
        toast.error('Meta API limits scheduling to a maximum of 30 days in advance.');
        return;
      }

      const { error } = await supabase
        .from('scheduled_posts')
        .update({
          scheduled_time: finalTime.toISOString(),
          status: 'scheduled',
          retry_count: 0,
          error_message: null
        })
        .eq('id', postId);

      if (error) throw error;

      toast.success(`Post rescheduled successfully to ${finalTime.toLocaleDateString()} at ${finalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
      loadData();
    } catch (err: any) {
      toast.error('Failed to reschedule post: ' + err.message);
    }
  }

  // Generate Calendar Cell Days
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarCells: { date: Date; isCurrentMonth: boolean }[] = [];

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    calendarCells.push({
      date: new Date(year, month - 1, daysInPrevMonth - i),
      isCurrentMonth: false,
    });
  }

  for (let i = 1; i <= daysInCurrentMonth; i++) {
    calendarCells.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }

  const totalCells = Math.ceil(calendarCells.length / 7) * 7;
  const nextDaysToAdd = totalCells - calendarCells.length;
  for (let i = 1; i <= nextDaysToAdd; i++) {
    calendarCells.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  return (
    <div className="animate-slideUp" style={{ color: 'var(--text-primary)', minHeight: '80vh', position: 'relative' }}>
      <style>{`
        .calendar-day-grid {
          display: grid; 
          grid-template-columns: repeat(7, 1fr); 
          gap: 1px; 
          background: rgba(255,255,255,0.06); 
          border-radius: 16px; 
          overflow: hidden; 
          border: 1px solid rgba(255,255,255,0.08); 
          min-width: 900px;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }
        .calendar-cell-block {
          background: rgba(20, 20, 20, 0.4);
          backdrop-filter: blur(12px);
          min-height: 140px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(255,255,255,0.02);
          min-width: 0;
        }
        .calendar-cell-block:hover {
          background: rgba(255, 255, 255, 0.035);
          box-shadow: inset 0 0 12px rgba(255, 255, 255, 0.03);
        }
        .calendar-cell-block:hover .hover-plus-btn {
          opacity: 1 !important;
          transform: scale(1) !important;
        }
        .post-strip-card {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
          width: 100%;
          min-width: 0;
        }
        .post-strip-card:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-1px);
        }
        .post-strip-card::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
        }
        .post-strip-card.status-published::before { background: #10b981; }
        .post-strip-card.status-scheduled::before { background: #f59e0b; }
        .post-strip-card.status-failed::before { background: #ef4444; }

        /* List View Styles */
        .list-day-group {
          margin-bottom: 28px;
        }
        .list-day-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          position: sticky;
          top: 0;
          z-index: 10;
          padding: 8px 0 4px;
          background: linear-gradient(to bottom, var(--bg-primary, #0a0a0a) 70%, transparent);
        }
        .list-day-label {
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #fff;
          white-space: nowrap;
        }
        .list-day-label.is-today {
          color: var(--accent-primary);
        }
        .list-day-label.is-past {
          color: rgba(255,255,255,0.35);
        }
        .list-day-divider {
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.06);
        }
        .list-day-count {
          font-size: 0.7rem;
          font-weight: 600;
          color: rgba(255,255,255,0.3);
          white-space: nowrap;
        }
        .list-posts-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
        }
        @media (max-width: 1100px) { .list-posts-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 750px)  { .list-posts-grid { grid-template-columns: repeat(2, 1fr); } }
        .list-post-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          overflow: hidden;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          position: relative;
        }
        .list-post-card:hover {
          transform: translateY(-2px);
          border-color: rgba(255,255,255,0.15);
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }
        .list-post-card.is-past {
          opacity: 0.45;
        }
        .list-post-card.is-past:hover {
          opacity: 0.75;
        }
        .list-post-card-thumb {
          width: 100%;
          aspect-ratio: 4/3;
          background: rgba(255,255,255,0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
          position: relative;
        }
        .list-post-card-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .list-post-card-status-bar {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
        }
        .list-post-card-status-bar.status-published { background: #10b981; }
        .list-post-card-status-bar.status-scheduled { background: #f59e0b; }
        .list-post-card-status-bar.status-failed    { background: #ef4444; }
        .list-post-card-body {
          padding: 8px 10px 10px;
          display: flex;
          flex-direction: column;
          gap: 5px;
          flex: 1;
        }
        .list-post-card-time {
          font-size: 0.7rem;
          font-weight: 700;
          color: rgba(255,255,255,0.45);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .list-post-card-caption {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.75);
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .list-post-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
        }
        .status-pill {
          font-size: 0.6rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          padding: 2px 6px;
          border-radius: 20px;
        }
        .status-pill.published { background: rgba(16,185,129,0.15); color: #10b981; }
        .status-pill.scheduled { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .status-pill.failed    { background: rgba(239,68,68,0.15);  color: #ef4444; }
        .list-filter-tabs {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .list-filter-tab {
          font-size: 0.78rem;
          font-weight: 700;
          padding: 6px 14px;
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.1);
          background: transparent;
          color: rgba(255,255,255,0.5);
          cursor: pointer;
          transition: all 0.18s;
        }
        .list-filter-tab.active {
          background: var(--accent-primary);
          border-color: var(--accent-primary);
          color: #fff;
          box-shadow: 0 2px 12px rgba(124, 58, 237, 0.4);
        }
        .list-filter-tab:not(.active):hover {
          border-color: rgba(255,255,255,0.22);
          color: rgba(255,255,255,0.8);
        }
        
        .metrics-grid-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 12px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .metrics-num {
          font-size: 1.6rem;
          font-weight: 700;
          color: #fff;
        }
      `}</style>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <CalendarIcon size={24} style={{ color: 'var(--accent-primary)' }} />
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.025em' }}>Social Calendar</h1>
          </div>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Schedule posts and track live engagement metrics in real-time.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <button 
              className={`btn btn-sm ${view === 'calendar' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setView('calendar')}
              style={{ borderRadius: '6px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', color: view === 'calendar' ? undefined : 'var(--text-secondary)' }}
            >
              <CalendarIcon size={14} />
              Calendar
            </button>
            <button 
              className={`btn btn-sm ${view === 'list' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setView('list')}
              style={{ borderRadius: '6px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', color: view === 'list' ? undefined : 'var(--text-secondary)' }}
            >
              <List size={14} />
              List
            </button>
          </div>

          <button className="btn btn-primary" onClick={() => handleOpenComposeForDay(new Date())} style={{ display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px 0 rgba(124, 58, 237, 0.4)' }}>
            <Plus size={16} /> Compose Post
          </button>
        </div>
      </div>

      {/* Filters & Navigation Toolbar */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: '20px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>

          {/* Left: Month nav (calendar) OR list filter tabs (list) */}
          {view === 'calendar' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, minWidth: '160px', color: '#fff' }}>
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h2>
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.04)', padding: '3px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                <button className="btn btn-ghost btn-icon" onClick={handlePrevMonth} title="Previous Month" style={{ width: '28px', height: '28px', padding: 0 }}>
                  <ChevronLeft size={16} />
                </button>
                <button className="btn btn-ghost" onClick={handleToday} style={{ fontSize: '0.75rem', padding: '0 10px', height: '28px', fontWeight: 600 }}>
                  Today
                </button>
                <button className="btn btn-ghost btn-icon" onClick={handleNextMonth} title="Next Month" style={{ width: '28px', height: '28px', padding: 0 }}>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            <div className="list-filter-tabs">
              <button className={`list-filter-tab ${listFilter === 'all' ? 'active' : ''}`} onClick={() => setListFilter('all')}>All Posts</button>
              <button className={`list-filter-tab ${listFilter === 'today' ? 'active' : ''}`} onClick={() => setListFilter('today')}>Today</button>
              <button className={`list-filter-tab ${listFilter === 'upcoming' ? 'active' : ''}`} onClick={() => setListFilter('upcoming')}>Upcoming</button>
              <button className={`list-filter-tab ${listFilter === 'past' ? 'active' : ''}`} onClick={() => setListFilter('past')}>Past</button>
            </div>
          )}

          {/* Right: Dropdown Filters */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="form-input" value={filterChannel} onChange={e => setFilterChannel(e.target.value)} style={{ width: '150px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.8rem', padding: '6px 10px', height: '34px', borderRadius: '8px' }}>
              <option value="all">All Pages</option>
              {channels.filter(c => c.platform === 'facebook').map(c => (
                <option key={c.id} value={c.page_id}>{c.page_name}</option>
              ))}
            </select>
            <select className="form-input" value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} style={{ width: '130px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.8rem', padding: '6px 10px', height: '34px', borderRadius: '8px' }}>
              <option value="all">All Platforms</option>
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>
            <select className="form-input" value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ width: '120px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', color: '#fff', fontSize: '0.8rem', padding: '6px 10px', height: '34px', borderRadius: '8px' }}>
              <option value="all">All Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="failed">Failed</option>
            </select>
          </div>

        </div>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '64px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <Loader2 className="animate-spin" style={{ margin: '0 auto 16px', color: 'var(--accent-primary)' }} />
          <p style={{ margin: 0 }}>Syncing with Meta Scheduler...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="card" style={{ padding: '64px', textAlign: 'center' }}>
          <CalendarIcon size={48} style={{ margin: '0 auto 16px', color: 'var(--text-secondary)', opacity: 0.3 }} />
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>No Scheduled Posts</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '6px', fontSize: '0.9rem' }}>Connect pages, write your message, and let AI post for you.</p>
          <button className="btn btn-primary" onClick={() => handleOpenComposeForDay(new Date())} style={{ marginTop: '16px' }}>Compose Post</button>
        </div>
      ) : view === 'list' ? (
        /* ===== LIST VIEW ===== */
        (() => {
          const filtered = getFilteredPosts();
          
          // Filter by Tab
          const timeFiltered = filtered.filter(post => {
            const postDate = new Date(post.scheduled_time);
            const today = new Date(); today.setHours(0,0,0,0);
            if (listFilter === 'today') {
              return isSameDay(postDate, new Date());
            } else if (listFilter === 'upcoming') {
              const startOfTomorrow = new Date(today.getTime() + 86400000);
              return postDate >= startOfTomorrow;
            } else if (listFilter === 'past') {
              return postDate < today;
            }
            return true;
          });

          // Sort: newest/latest first (descending)
          const sorted = [...timeFiltered].sort((a, b) => new Date(b.scheduled_time).getTime() - new Date(a.scheduled_time).getTime());

          // Group by date key YYYY-MM-DD
          const groups: { dateKey: string; date: Date; posts: ScheduledPost[] }[] = [];
          const keyMap: Record<string, number> = {};
          for (const post of sorted) {
            const d = new Date(post.scheduled_time);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            if (keyMap[key] === undefined) {
              keyMap[key] = groups.length;
              groups.push({ dateKey: key, date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), posts: [] });
            }
            groups[keyMap[key]].posts.push(post);
          }

          // Helper: label for a date group
          const dayLabel = (date: Date) => {
            const today = new Date(); today.setHours(0,0,0,0);
            const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
            const tom   = new Date(today); tom.setDate(tom.getDate() + 1);
            if (isSameDay(date, today)) return { label: '📅 Today', cls: 'is-today' };
            if (isSameDay(date, yest))  return { label: '🕒 Yesterday', cls: 'is-past' };
            if (isSameDay(date, tom))   return { label: '🚀 Tomorrow', cls: '' };
            const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
            if (diff > 0) return { label: date.toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' }), cls: '' };
            return { label: date.toLocaleDateString('default', { weekday: 'long', month: 'short', day: 'numeric' }), cls: 'is-past' };
          };

          if (groups.length === 0) {
            return (
              <div className="card" style={{ padding: '64px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <CalendarIcon size={40} style={{ margin: '0 auto 16px', opacity: 0.25 }} />
                <p style={{ margin: 0, fontWeight: 600 }}>No posts found</p>
                <p style={{ margin: '6px 0 0', fontSize: '0.85rem', opacity: 0.6 }}>Try a different filter or schedule your first post.</p>
              </div>
            );
          }

          return (
            <div style={{ paddingBottom: '40px' }}>
              {groups.map(group => {
                const today = new Date(); today.setHours(0,0,0,0);
                const isPastDay = group.date < today;
                const { label, cls } = dayLabel(group.date);
                return (
                  <div key={group.dateKey} className="list-day-group">
                    <div className="list-day-header">
                      <span className={`list-day-label ${cls}`}>{label}</span>
                      <div className="list-day-divider" />
                      <span className="list-day-count">{group.posts.length} post{group.posts.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="list-posts-grid">
                      {group.posts.map(post => {
                        const channelName = channels.find(c => c.page_id === post.page_connection_id && c.platform === post.platform)?.page_name || 'Channel';
                        const postTime = new Date(post.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                        const hasMedia = post.media_urls && post.media_urls.length > 0;
                        const isCleanedMedia = hasMedia && post.media_urls![0].startsWith('file://localhost/');
                        const isVideo = hasMedia && !isCleanedMedia && post.media_urls![0].toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/);
                        const isIg = post.platform === 'instagram';

                        return (
                          <div
                            key={post.id}
                            className={`list-post-card${isPastDay && post.status !== 'published' ? ' is-past' : ''}`}
                            onClick={() => handleOpenInspector(post)}
                            title={`${channelName} — ${postTime}\n${post.message || 'No caption'}`}
                          >
                            {/* Status stripe at top */}
                            <div className={`list-post-card-status-bar status-${post.status}`} />

                            {/* 4:3 Thumbnail */}
                            <div className="list-post-card-thumb">
                              {hasMedia && !isCleanedMedia ? (
                                isVideo ? (
                                  <div style={{ width: '100%', height: '100%', background: '#1a1a1a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                    <span style={{ fontSize: '1.5rem' }}>▶</span>
                                    <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.4)' }}>Video</span>
                                  </div>
                                ) : (
                                  <img src={post.media_urls![0]} alt="Media" onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/200x150/1a1a1a/555?text=img'; }} />
                                )
                              ) : hasMedia && isCleanedMedia ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.2)' }}>
                                  <ImageIcon size={22} />
                                  <span style={{ fontSize: '0.65rem' }}>Media attached</span>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.1)' }}>
                                  <span style={{ fontSize: '1.6rem', lineHeight: 1 }}>{isIg ? '📷' : '📝'}</span>
                                  <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)' }}>Text post</span>
                                </div>
                              )}
                            </div>

                            {/* Card body */}
                            <div className="list-post-card-body">
                              <div className="list-post-card-time">
                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {isIg
                                    ? <Instagram size={11} style={{ color: '#E1306C' }} />
                                    : <Facebook size={11} style={{ color: '#1877F2' }} />}
                                  <span style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff', fontWeight: 600 }}>
                                    {channelName.replace(' (Instagram)', '')}
                                  </span>
                                </span>
                                <span>⏱ {postTime}</span>
                              </div>
                              <div className="list-post-card-caption">
                                {post.message || <em style={{ opacity: 0.4 }}>No caption</em>}
                              </div>
                              <div className="list-post-card-footer">
                                <span className={`status-pill ${post.status}`}>{post.status}</span>
                                {post.first_comments && post.first_comments.length > 0 && (
                                  <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <MessageCircle size={10} /> {post.first_comments.length}
                                  </span>
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
        })()
      ) : (
        /* ===== CALENDAR (MONTH) VIEW ===== */
        <div style={{ overflowX: 'auto', width: '100%', paddingBottom: '16px' }}>
          <div className="calendar-day-grid">
            {/* Days of the Week Header */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
                  className="calendar-cell-block"
                  onDragOver={(e) => {
                    if (e.dataTransfer.types.includes('text/plain')) {
                      e.preventDefault();
                    }
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const postId = e.dataTransfer.getData('text/plain');
                    if (postId) {
                      await handleDragReschedule(postId, cell.date);
                    }
                  }}
                  style={{
                    background: cell.isCurrentMonth ? 'rgba(20, 20, 20, 0.4)' : 'rgba(10, 10, 10, 0.15)',
                    opacity: cell.isCurrentMonth ? 1 : 0.3,
                    border: isToday ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.02)',
                    boxShadow: isToday ? 'inset 0 0 12px rgba(124, 58, 237, 0.15)' : 'none',
                  }}
                >
                  {/* Cell Day Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ 
                      fontSize: '0.8rem', 
                      fontWeight: isToday ? 800 : 600,
                      color: isToday ? 'white' : 'var(--text-primary)',
                      background: isToday ? 'var(--accent-primary)' : 'transparent',
                      width: '22px',
                      height: '22px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '50%',
                      boxShadow: isToday ? '0 0 8px rgba(124, 58, 237, 0.6)' : 'none'
                    }}>
                      {cell.date.getDate()}
                    </span>
                    <span className="hover-plus-btn" style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', opacity: 0, transform: 'scale(0.8)', transition: 'all 0.2s', fontWeight: 'bold' }}>
                      +
                    </span>
                  </div>
                  
                  {/* Posts listed on this day */}
                  <div className="custom-scrollbar" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto', maxHeight: '110px', minWidth: 0, width: '100%' }} onClick={e => e.stopPropagation()}>
                    {dayPosts.map(post => {
                      const channelName = channels.find(c => c.page_id === post.page_connection_id && c.platform === post.platform)?.page_name || 'Channel';
                      const postTime = new Date(post.scheduled_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      const isIg = post.platform === 'instagram';
                      const hasMedia = post.media_urls && post.media_urls.length > 0;
                      const isCleanedMedia = hasMedia && post.media_urls![0].startsWith('file://localhost/');
                      
                      return (
                        <div 
                          key={post.id} 
                          onClick={(e) => { e.stopPropagation(); handleOpenInspector(post); }}
                          draggable={post.status === 'scheduled' || post.status === 'failed'}
                          onDragStart={(e) => {
                            e.stopPropagation();
                            e.dataTransfer.setData('text/plain', post.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          className={`post-strip-card status-${post.status}`}
                          title={`${channelName} (${postTime}): ${post.message || 'No caption'}`}
                        >
                          {/* Mini Thumbnail */}
                          {hasMedia && !isCleanedMedia ? (
                            <div style={{ width: '22px', height: '22px', borderRadius: '4px', overflow: 'hidden', background: '#000', flexShrink: 0 }}>
                              {post.media_urls![0].toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/) ? (
                                <div style={{ width: '100%', height: '100%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: '#fff' }}>▶</div>
                              ) : (
                                <img src={post.media_urls![0]} alt="Media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/40x40?text=x'; }} />
                              )}
                            </div>
                          ) : hasMedia && isCleanedMedia ? (
                            <div style={{ width: '22px', height: '22px', borderRadius: '4px', background: 'rgba(124, 58, 237, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <ImageIcon size={10} style={{ color: 'var(--accent-primary)' }} />
                            </div>
                          ) : (
                            <div style={{ width: '22px', height: '22px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: '8px', opacity: 0.6 }}>T</span>
                            </div>
                          )}

                          {/* Content Preview */}
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              {isIg ? <Instagram size={10} style={{ color: '#E1306C', flexShrink: 0 }} /> : <Facebook size={10} style={{ color: '#1877F2', flexShrink: 0 }} />}
                              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {channelName.replace(' (Instagram)', '')}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {post.message || 'Attached Media'}
                            </span>
                          </div>

                          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', flexShrink: 0, opacity: 0.8 }}>
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
    </div>
  );
}
