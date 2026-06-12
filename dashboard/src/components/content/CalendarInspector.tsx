import React, { useState, useEffect } from 'react';
import type { ScheduledPost, PageConn, PostMetrics } from '../../types/content';
import { workerGet } from '../../lib/workerApi';
import { 
  X, Clock, Loader2, Info, ThumbsUp, MessageCircle, 
  Share2, Eye, Globe, Image as ImageIcon, Edit3, Trash2
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

interface CalendarInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  post: ScheduledPost | null;
  channels: PageConn[];
  onEditClick: () => void;
  onDeleteClick: (id: string) => Promise<void> | void;
}

export default function CalendarInspector({
  isOpen,
  onClose,
  post,
  channels,
  onEditClick,
  onDeleteClick
}: CalendarInspectorProps) {
  const [fetchingMetrics, setFetchingMetrics] = useState(false);
  const [postMetrics, setPostMetrics] = useState<PostMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  // Fetch metrics when inspector is opened for a published post
  useEffect(() => {
    if (isOpen && post && post.status === 'published') {
      fetchLiveMetrics();
    } else {
      setPostMetrics(null);
      setMetricsError(null);
    }
  }, [isOpen, post]);

  const fetchLiveMetrics = async () => {
    if (!post || !post.meta_post_id) return;
    setFetchingMetrics(true);
    setMetricsError(null);
    try {
      const data = await workerGet(`/api/post-metrics/${post.meta_post_id}`);
      if (data && data.metrics) {
        setPostMetrics(data.metrics);
      } else {
        setMetricsError('Could not retrieve metrics.');
      }
    } catch (err: any) {
      console.error('Metrics fetch error:', err);
      setMetricsError(err.message || 'Error communicating with Meta API.');
    } finally {
      setFetchingMetrics(false);
    }
  };

  if (!post) return null;

  const channelName = channels.find(c => c.page_id === post.page_connection_id && c.platform === post.platform)?.page_name || 'Channel';
  const isIg = post.platform === 'instagram';

  return (
    <>
      <div className={`inspector-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <div className={`inspector-panel ${isOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          
          {/* Drawer Header */}
          <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isIg ? <Instagram size={18} style={{ color: '#E1306C' }} /> : <Facebook size={18} style={{ color: '#1877F2' }} />}
              <span className="badge" style={{
                background: isIg ? 'rgba(225,48,108,0.1)' : 'rgba(24,119,242,0.1)',
                color: isIg ? '#E1306C' : '#1877F2',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}>
                {post.platform}
              </span>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#fff' }}>Post Inspector</h3>
            </div>
            <button className="btn-ghost btn-icon" onClick={onClose} style={{ width: '32px', height: '32px', padding: 0 }}><X size={18} /></button>
          </div>

          {/* Drawer Body */}
          <div className="custom-scrollbar" style={{ padding: '20px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Channel metadata */}
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>PUBLISHED TO</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>
                {channelName}
              </span>
            </div>

            {/* Status and Time */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>STATUS</span>
                <span className={`badge badge-${post.status === 'published' ? 'success' : post.status === 'failed' ? 'error' : 'secondary'}`} style={{ textTransform: 'uppercase', fontSize: '10px', fontWeight: 800 }}>
                  {post.status}
                </span>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>SCHEDULED FOR</span>
                <span style={{ fontSize: '0.85rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                  <Clock size={12} style={{ color: 'var(--accent-primary)' }} />
                  {new Date(post.scheduled_time).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Real-time Metrics Section */}
            {post.status === 'published' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 700 }}>LIVE ENGAGEMENT INSIGHTS</span>
                  {fetchingMetrics && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />}
                </div>

                {fetchingMetrics ? (
                  <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '12px', padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    <Loader2 size={18} className="animate-spin" style={{ margin: '0 auto 8px auto', color: 'var(--accent-primary)' }} />
                    Fetching real-time metrics from Meta...
                  </div>
                ) : metricsError ? (
                  <div style={{ display: 'flex', gap: '8px', background: 'rgba(239,68,68,0.05)', color: '#ef4444', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.1)', fontSize: '0.75rem' }}>
                    <Info size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong>Could not load insights:</strong> {metricsError}
                      <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)' }}>Basic indicators (likes/comments) are simulated below.</p>
                    </div>
                  </div>
                ) : postMetrics ? (
                  /* Display actual fetched metrics */
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="metrics-grid-card">
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><ThumbsUp size={10} /> LIKES</span>
                      <span className="metrics-num">{postMetrics.likes.toLocaleString()}</span>
                    </div>
                    <div className="metrics-grid-card">
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><MessageCircle size={10} /> COMMENTS</span>
                      <span className="metrics-num">{postMetrics.comments.toLocaleString()}</span>
                    </div>
                    <div className="metrics-grid-card">
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><Share2 size={10} /> SHARES</span>
                      <span className="metrics-num">{postMetrics.shares.toLocaleString()}</span>
                    </div>
                    <div className="metrics-grid-card">
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}><Eye size={10} /> IMPRESSIONS</span>
                      <span className="metrics-num">{postMetrics.impressions !== undefined && postMetrics.impressions !== null ? postMetrics.impressions.toLocaleString() : 'N/A'}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

            {/* Feed Preview Mock Card */}
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, display: 'block', marginBottom: '8px' }}>FEED PREVIEW</span>
              <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)', overflow: 'hidden' }}>
                {/* Fake header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Globe size={14} style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 600, color: '#fff' }}>
                      {channelName}
                    </h4>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Just now • 🌐</span>
                  </div>
                </div>

                {/* Caption */}
                {post.message && (
                  <p style={{ margin: '0 10px 10px 10px', fontSize: '0.8rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                    {post.message}
                  </p>
                )}

                {/* Media */}
                {post.media_urls && post.media_urls[0] ? (
                  <div style={{ width: '100%', height: '180px', background: '#000', overflow: 'hidden', position: 'relative' }}>
                    {post.media_urls[0].startsWith('file://localhost/') ? (
                      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px dashed rgba(255,255,255,0.06)', padding: '12px' }}>
                        <ImageIcon size={22} style={{ color: 'var(--accent-primary)', opacity: 0.8 }} />
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', wordBreak: 'break-all' }}>
                          Published & Cleaned Up<br/>
                          <strong style={{ color: 'var(--text-primary)' }}>{decodeURIComponent(post.media_urls[0].replace('file://localhost/', ''))}</strong>
                        </span>
                      </div>
                    ) : post.media_urls[0].toLowerCase().match(/\.(mp4|mov|avi|mkv|webm)$/) ? (
                      <video src={post.media_urls[0]} style={{ width: '100%', height: '100%', objectFit: 'cover' }} controls muted playsInline />
                    ) : (
                      <img src={post.media_urls[0]} alt="Post Media" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '80px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                    Text-only Timeline Post
                  </div>
                )}

                {/* Fake footer */}
                <div style={{ display: 'flex', justifyContent: 'space-around', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <span>👍 Like</span>
                  <span>💬 Comment</span>
                  <span>🔄 Share</span>
                </div>
              </div>
            </div>

            {/* Error Message */}
            {post.error_message && (
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', fontSize: '0.8rem', color: '#EF4444' }}>
                <strong style={{ display: 'block', marginBottom: '2px' }}>Publishing Error:</strong>
                {post.error_message}
              </div>
            )}

          </div>

          {/* Drawer Footer Actions */}
          <div style={{ padding: '20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '10px' }}>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => onDeleteClick(post.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}>
              <Trash2 size={12} /> Delete Post
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close</button>
            {(post.status === 'scheduled' || post.status === 'failed') && (
              <button type="button" className="btn btn-primary btn-sm" onClick={onEditClick} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Edit3 size={12} /> Edit Details
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
