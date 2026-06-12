import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';
import { 
  Plus, Calendar as CalendarIcon, Clock, Image as ImageIcon, 
  Loader2, List, Calendar, Edit3
} from 'lucide-react';
import PostComposerModal from '../components/content/PostComposerModal';
import CalendarInspector from '../components/content/CalendarInspector';
import type { ScheduledPost, PageConn } from '../types/content';

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

                          return (
                            <div key={post.id} className="card" style={cardStyle} onClick={() => handleOpenInspector(post)}>
                              <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                  <span className="badge" style={{
                                    background: isIg ? 'rgba(225,48,108,0.1)' : 'rgba(24,119,242,0.1)',
                                    color: isIg ? '#E1306C' : '#1877F2',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    padding: '2px 6px'
                                  }}>
                                    {channelName.replace(' (Instagram)', '')}
                                  </span>
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
    </div>
  );
}
