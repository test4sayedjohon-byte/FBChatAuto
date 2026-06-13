import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { workerPost } from '../lib/workerApi';
import { toast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { 
  Sparkles, ArrowLeft, Loader2, Layers, Calendar, Tag, Image, ShieldAlert, Clock, Settings, FileText, Trash2, Undo
} from 'lucide-react';
import type { ScheduledPost } from '../types/content';

interface PageConn {
  id: string;
  page_id: string;
  page_name: string;
  platform: string;
}

export default function CampaignPlannerPage() {
  useDocumentTitle('Campaign Planner — AutometaBot');
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState<PageConn[]>([]);

  // Form States
  const [pageConnectionId, setPageConnectionId] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [preset, setPreset] = useState<'thematic' | 'daily_consistency' | 'sequential_story' | 'product_showcase'>('daily_consistency');
  const [themeText, setThemeText] = useState('');
  
  const [count, setCount] = useState(5);
  const [frequency, setFrequency] = useState<'daily' | 'every_other_day' | 'weekly' | 'monthly'>('daily');
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [postTimes, setPostTimes] = useState<string[]>(['09:00']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationMode, setDurationMode] = useState<'count' | 'date_range'>('count');

  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  
  const [mediaType, setMediaType] = useState<'text' | 'catalog' | 'ai'>('text');
  const [imageModel, setImageModel] = useState('flux');
  const [aestheticTheme, setAestheticTheme] = useState('Modern Minimalist');
  const [enableMiddleAi, setEnableMiddleAi] = useState(true);

  const [addFirstComment, setAddFirstComment] = useState(false);
  const [publishStatus, setPublishStatus] = useState<'draft' | 'scheduled'>('draft');

  const [recentAiPosts, setRecentAiPosts] = useState<ScheduledPost[]>([]);
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Load page connections & products
  useEffect(() => {
    async function loadInitialData() {
      if (!user) return;
      try {
        // Fetch page connections
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
        setChannels(formattedChannels);
        if (formattedChannels.length > 0) {
          setPageConnectionId(formattedChannels[0].page_id);
        }

        // Fetch products
        const { data: prodsData, error: prodsError } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true });
        
        if (prodsError) throw prodsError;
        if (prodsData) setProducts(prodsData);
        loadRecentAiPosts();
      } catch (err: any) {
        console.error('Error loading page connections/products:', err.message);
      }
    }
    loadInitialData();
    
    // Default startDate tomorrow at 9 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(tomorrow.getTime() - tzOffset)).toISOString().slice(0, 16);
    setStartDate(localISOTime);

    // Default endDate
    const spacing = 24 * 60 * 60 * 1000;
    const endMs = tomorrow.getTime() + (5 - 1) * spacing;
    const localEndISOTime = (new Date(endMs - tzOffset)).toISOString().slice(0, 16);
    setEndDate(localEndISOTime);
  }, [user]);

  async function handleDeleteSelected() {
    if (selectedPostIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedPostIds.size} selected posts?`)) return;

    try {
      setLoading(true);
      const ids = Array.from(selectedPostIds);

      const { data: postsToDelete } = await supabase
        .from('scheduled_posts')
        .select('media_urls')
        .in('id', ids);

      if (postsToDelete) {
        const pathsToDelete: string[] = [];
        postsToDelete.forEach(post => {
          post.media_urls?.forEach((url: string) => {
            const path = url.split('/media_assets/')[1]?.split('?')[0];
            if (path) pathsToDelete.push(decodeURIComponent(path));
          });
        });
        if (pathsToDelete.length > 0) {
          await supabase.storage.from('media_assets').remove(pathsToDelete);
        }
      }

      const { error } = await supabase
        .from('scheduled_posts')
        .delete()
        .in('id', ids);

      if (error) throw error;
      toast.success(`Successfully deleted ${ids.length} posts.`);
      setSelectedPostIds(new Set());
      loadRecentAiPosts();
    } catch (err: any) {
      toast.error('Failed to delete selected posts: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleUndoLastBatch() {
    try {
      setLoading(true);
      const { data: recent, error: fetchErr } = await supabase
        .from('scheduled_posts')
        .select('ai_generated_options')
        .eq('media_source_type', 'ai_generated')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchErr || !recent) {
        toast.error('No undoable AI generation batch was found.');
        return;
      }

      const batchId = (recent?.ai_generated_options as any)?.batch_id;
      if (!batchId) {
        toast.error('The last AI generation did not have a batch ID. Cannot undo automatically.');
        return;
      }

      const { data: postsToDelete, count, error: countErr } = await supabase
        .from('scheduled_posts')
        .select('id, media_urls', { count: 'exact' })
        .eq('media_source_type', 'ai_generated')
        .filter('ai_generated_options->>batch_id', 'eq', batchId);

      if (countErr) throw countErr;

      if (!confirm(`Are you sure you want to undo the last AI generation batch? This will delete all ${count || 0} scheduled posts from that batch.`)) {
        return;
      }

      if (postsToDelete && postsToDelete.length > 0) {
        let pathsToDelete: string[] = [];
        postsToDelete.forEach(post => {
          post.media_urls?.forEach((url: string) => {
            const path = url.split('/media_assets/')[1]?.split('?')[0];
            if (path) pathsToDelete.push(decodeURIComponent(path));
          });
        });
        if (pathsToDelete.length > 0) {
          await supabase.storage.from('media_assets').remove(pathsToDelete);
        }
      }

      const { error: delErr } = await supabase
        .from('scheduled_posts')
        .delete()
        .eq('media_source_type', 'ai_generated')
        .filter('ai_generated_options->>batch_id', 'eq', batchId);

      if (delErr) throw delErr;

      toast.success(`Successfully undid the last batch (${count} posts removed).`);
      setSelectedPostIds(new Set());
      loadRecentAiPosts();
    } catch (err: any) {
      toast.error('Failed to undo last batch: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadRecentAiPosts() {
    try {
      setLoadingPosts(true);
      const { data, error } = await supabase
        .from('scheduled_posts')
        .select('*')
        .eq('media_source_type', 'ai_generated')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setRecentAiPosts(data || []);
      setSelectedPostIds(new Set());
    } catch (err: any) {
      console.error('Error fetching recent AI posts:', err.message);
    } finally {
      setLoadingPosts(false);
    }
  }

  function getSpacingMs(freq: string, ppd: number): number {
    const dayMs = 24 * 60 * 60 * 1000;
    if (freq === 'daily') {
      return Math.round(dayMs / ppd);
    }
    if (freq === 'every_other_day') {
      return 2 * dayMs;
    }
    if (freq === 'weekly') {
      return 7 * dayMs;
    }
    if (freq === 'monthly') {
      return 30 * dayMs;
    }
    return dayMs;
  }

  // Reactively sync end date in 'count' mode
  useEffect(() => {
    if (durationMode === 'count' && startDate && count > 0) {
      const startMs = new Date(startDate).getTime();
      const spacing = getSpacingMs(frequency, postsPerDay);
      const endMs = startMs + (count - 1) * spacing;
      
      const date = new Date(endMs);
      const tzOffset = date.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
      setEndDate(localISOTime);
    }
  }, [durationMode, startDate, count, frequency, postsPerDay]);

  // Reactively sync count in 'date_range' mode
  useEffect(() => {
    if (durationMode === 'date_range' && startDate && endDate) {
      const startMs = new Date(startDate).getTime();
      const endMs = new Date(endDate).getTime();
      const diff = endMs - startMs;
      if (diff > 0) {
        const spacing = getSpacingMs(frequency, postsPerDay);
        const computedCount = Math.floor(diff / spacing) + 1;
        setCount(Math.max(1, computedCount));
      } else {
        setCount(1);
      }
    }
  }, [durationMode, startDate, endDate, frequency, postsPerDay]);

  // Sync postTimes array based on postsPerDay
  useEffect(() => {
    if (frequency === 'daily') {
      const defaults: Record<number, string[]> = {
        1: ['09:00'],
        2: ['09:00', '18:00'],
        3: ['09:00', '14:00', '19:00'],
        4: ['09:00', '13:00', '17:00', '21:00']
      };
      setPostTimes(defaults[postsPerDay] || ['09:00']);
    } else {
      setPostTimes(['09:00']);
    }
  }, [postsPerDay, frequency]);

  const costPerPost = mediaType === 'ai' ? 40 : 10;
  const totalCost = count * costPerPost;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pageConnectionId) return toast.error('Please select a channel.');
    if (!startDate) return toast.error('Please select a start date.');
    if (preset === 'thematic' && !themeText) return toast.error('Please specify a campaign theme.');
    if (preset === 'product_showcase' && selectedProductIds.length === 0) {
      return toast.error('Please select at least one product for the Showcase preset.');
    }
    if (durationMode === 'date_range' && !endDate) {
      return toast.error('Please specify an ending date/time.');
    }
    if (durationMode === 'date_range' && new Date(endDate) <= new Date(startDate)) {
      return toast.error('End Date must be after the Start Date.');
    }

    try {
      setLoading(true);
      const res = await workerPost<{ success: boolean; message: string; posts?: any[] }>(
        '/agent/generate-bulk',
        {
          pageConnectionId,
          count,
          generateImages: mediaType === 'ai',
          startDate,
          frequency,
          postsPerDay: frequency === 'daily' ? postsPerDay : 1,
          postTimes,
          preset,
          productIds: selectedProductIds,
          mediaType,
          imageModel,
          aestheticTheme,
          enableMiddleAi,
          addFirstComment,
          publishStatus,
          themeText
        }
      );

      if (res.success) {
        toast.success(res.message || 'Campaign successfully generated.');
        navigate('/planner');
      } else {
        toast.error(res.message || 'Failed to generate campaign.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error occurred while calling generator.');
    } finally {
      setLoading(false);
    }
  }

  const presetDescriptions = {
    daily_consistency: 'Generates mixed value tips, question posts, and product promos spaced consistently.',
    thematic: 'Creates a deep-dive series focusing on a single theme or topic specified by you.',
    sequential_story: 'Builds a chronological story arc where each post naturally leads into the next.',
    product_showcase: 'High-intent conversion posts rotating through chosen product catalog specifications.'
  };

  return (
    <div style={{ padding: '24px', maxWidth: '840px', margin: '0 auto', color: '#fff' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
        <button 
          type="button"
          onClick={() => navigate('/planner')} 
          style={{ 
            background: 'rgba(255, 255, 255, 0.03)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            borderRadius: '10px', 
            width: '38px', 
            height: '38px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            cursor: 'pointer',
            color: '#fff',
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={20} color="var(--accent-primary)" />
            AI Campaign Creator
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>Design, cadence, and schedule automated AI content campaigns</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {/* Section 1: Campaign Setup & Strategy */}
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={16} color="var(--accent-primary)" />
            1. Campaign Setup & Strategy
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Campaign Channel</label>
                <select
                  value={pageConnectionId}
                  onChange={(e) => setPageConnectionId(e.target.value)}
                  required
                  style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '40px', borderRadius: '8px', padding: '0 12px', outline: 'none' }}
                >
                  <option value="" disabled>Choose a connected channel...</option>
                  {channels.filter((c, index, self) => self.findIndex(t => t.page_id === c.page_id) === index).map(c => (
                    <option key={c.page_id} value={c.page_id}>{c.page_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Campaign Name (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Summer Promo 2026"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '40px', borderRadius: '8px', padding: '0 12px', outline: 'none' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Preset Campaign Strategy</label>
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value as any)}
                style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '40px', borderRadius: '8px', padding: '0 12px', outline: 'none' }}
              >
                <option value="daily_consistency">Daily Consistency Preset</option>
                <option value="thematic">Thematic Campaign Preset</option>
                <option value="sequential_story">Sequential Story Preset</option>
                <option value="product_showcase">Product Showcase Preset</option>
              </select>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem', color: 'var(--accent-primary)' }}>
                ℹ️ {presetDescriptions[preset]}
              </p>
            </div>

            {preset === 'thematic' && (
              <div className="animate-fadeIn">
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Specify Campaign Theme / Focus Topic</label>
                <textarea
                  placeholder="e.g. Core features of our productivity dashboard, targeting high-volume developers."
                  value={themeText}
                  onChange={(e) => setThemeText(e.target.value)}
                  required
                  style={{ width: '100%', minHeight: '80px', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', borderRadius: '8px', padding: '12px', fontSize: '0.85rem', resize: 'none', outline: 'none' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Cadence & Timing */}
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} color="var(--accent-primary)" />
            2. Cadence & Schedule
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Campaign Duration Calculation</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setDurationMode('count')}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: durationMode === 'count' ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.06)',
                    background: durationMode === 'count' ? 'rgba(249, 115, 22, 0.05)' : '#121212',
                    color: '#fff',
                    fontSize: '0.85rem',
                    fontWeight: durationMode === 'count' ? 700 : 500,
                    cursor: 'pointer'
                  }}
                >
                  Total Post Count Mode
                </button>
                <button
                  type="button"
                  onClick={() => setDurationMode('date_range')}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: durationMode === 'date_range' ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.06)',
                    background: durationMode === 'date_range' ? 'rgba(249, 115, 22, 0.05)' : '#121212',
                    color: '#fff',
                    fontSize: '0.85rem',
                    fontWeight: durationMode === 'date_range' ? 700 : 500,
                    cursor: 'pointer'
                  }}
                >
                  Date Range Mode (Start to End Date)
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {durationMode === 'count' ? (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Total Post Count</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={count}
                    onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px', fontSize: '0.9rem', outline: 'none' }}
                  />
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Calculated Total Posts</label>
                  <div style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: 'var(--accent-primary)', height: '38px', borderRadius: '8px', padding: '0 10px', display: 'flex', alignItems: 'center', fontSize: '0.95rem', fontWeight: 700 }}>
                    {count} Posts
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Posting Frequency</label>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {[
                    { value: 'daily', label: 'Daily', desc: 'Every 24h' },
                    { value: 'every_other_day', label: 'Every Other', desc: 'Every 48h' },
                    { value: 'weekly', label: 'Weekly', desc: 'Every 7d' },
                    { value: 'monthly', label: 'Monthly', desc: 'Every 30d' }
                  ].map(f => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => { setFrequency(f.value as any); setPostsPerDay(1); }}
                      style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '8px',
                        border: frequency === f.value ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.08)',
                        background: frequency === f.value ? 'rgba(249,115,22,0.08)' : '#121212',
                        color: frequency === f.value ? 'var(--accent-primary)' : '#fff',
                        fontWeight: frequency === f.value ? 700 : 500,
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      <span>{f.label}</span>
                      <span style={{ fontSize: '0.65rem', opacity: 0.7, color: frequency === f.value ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>{f.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {frequency === 'daily' && (
              <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Posts Per Day</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    {[
                      { n: 1, label: 'Once' },
                      { n: 2, label: 'Twice' },
                      { n: 3, label: 'Three Times' },
                      { n: 4, label: 'Four Times' }
                    ].map(({ n, label }) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setPostsPerDay(n)}
                        style={{
                          flex: 1,
                          padding: '9px 0',
                          borderRadius: '8px',
                          border: postsPerDay === n ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.08)',
                          background: postsPerDay === n ? 'rgba(249,115,22,0.08)' : '#121212',
                          color: postsPerDay === n ? 'var(--accent-primary)' : 'var(--text-secondary)',
                          fontWeight: postsPerDay === n ? 700 : 500,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                      >
                        <span>{label}</span>
                        <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>Daily</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255, 255, 255, 0.01)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <label style={{ display: 'flex', fontSize: '0.85rem', fontWeight: 600, color: '#fff', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} color="var(--accent-primary)" />
                    Configure Daily Posting Times
                  </label>
                  <p style={{ margin: '0 0 6px 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Choose the exact times your daily posts will be scheduled.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
                    {postTimes.map((time, idx) => (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Post #{idx + 1}:</span>
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => {
                            const newTimes = [...postTimes];
                            newTimes[idx] = e.target.value;
                            setPostTimes(newTimes);
                          }}
                          style={{
                            background: '#121212',
                            border: '1px solid rgba(255,255,255,0.06)',
                            color: '#fff',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            fontSize: '0.85rem',
                            outline: 'none',
                            width: '100%'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Start Date & Time</label>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {['Today', 'Tomorrow'].map(lbl => (
                      <button
                        key={lbl}
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          if (lbl === 'Tomorrow') d.setDate(d.getDate() + 1);
                          d.setHours(9, 0, 0, 0);
                          const tz = d.getTimezoneOffset() * 60000;
                          setStartDate(new Date(d.getTime() - tz).toISOString().slice(0, 16));
                        }}
                        style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer' }}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px', outline: 'none' }}
                />
              </div>

              {durationMode === 'date_range' ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '6px' }}>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>End Date & Time</label>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {['+1 Week', '+1 Month'].map(lbl => (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => {
                            if (!startDate) return;
                            const d = new Date(startDate);
                            if (lbl === '+1 Week') d.setDate(d.getDate() + 7);
                            if (lbl === '+1 Month') d.setMonth(d.getMonth() + 1);
                            const tz = d.getTimezoneOffset() * 60000;
                            setEndDate(new Date(d.getTime() - tz).toISOString().slice(0, 16));
                          }}
                          style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer' }}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                    style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px', outline: 'none' }}
                  />
                </div>
              ) : (
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Calculated End Date</label>
                  <div style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: 'var(--text-secondary)', height: '38px', borderRadius: '8px', padding: '0 10px', display: 'flex', alignItems: 'center', fontSize: '0.85rem' }}>
                    {endDate ? new Date(endDate).toLocaleString() : 'N/A'}
                  </div>
                </div>
              )}
            </div>

            {durationMode === 'date_range' && endDate && startDate && new Date(endDate) <= new Date(startDate) && (
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#f87171', fontWeight: 500 }}>
                ⚠️ End Date must be after Start Date.
              </p>
            )}
          </div>
        </div>

        {/* Section 3: Product Integration */}
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Tag size={16} color="var(--accent-primary)" />
            3. Product Catalog Integration
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 12px 0' }}>
            Link products to display prices and details in catalog or product showcase presets.
          </p>

          {products.length === 0 ? (
            <div style={{ padding: '20px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '8px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              No products active in catalog. (Skip/None)
            </div>
          ) : (
            <div style={{ border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', background: '#121212', maxHeight: '180px', overflowY: 'auto' }}>
              {products.map(p => {
                const isSelected = selectedProductIds.includes(p.id);
                return (
                  <label key={p.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '10px 14px', 
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    background: isSelected ? 'rgba(249, 115, 22, 0.03)' : 'transparent'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedProductIds([...selectedProductIds, p.id]);
                          } else {
                            setSelectedProductIds(selectedProductIds.filter(id => id !== p.id));
                          }
                        }}
                        style={{ accentColor: 'var(--accent-primary)' }}
                      />
                      <span style={{ fontSize: '0.85rem', color: '#fff', fontWeight: 500 }}>{p.name}</span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>{p.price} {p.currency}</span>
                  </label>
                );
              })}
            </div>
          )}
          {preset === 'product_showcase' && selectedProductIds.length === 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#f87171', marginTop: '8px' }}>
              <ShieldAlert size={12} /> Product Showcase preset requires at least one selected product.
            </div>
          )}
        </div>

        {/* Section 4: Visuals & Aesthetics */}
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Image size={16} color="var(--accent-primary)" />
            4. Visuals & Art Style
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Post Media Type</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', background: mediaType === 'text' ? 'rgba(249, 115, 22, 0.05)' : '#121212', border: mediaType === 'text' ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '8px', flex: 1, color: '#fff' }}>
                  <input type="radio" name="mediaType" checked={mediaType === 'text'} onChange={() => setMediaType('text')} style={{ accentColor: 'var(--accent-primary)' }} />
                  Text Only
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', background: mediaType === 'catalog' ? 'rgba(249, 115, 22, 0.05)' : '#121212', border: mediaType === 'catalog' ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '8px', flex: 1, color: '#fff', opacity: selectedProductIds.length === 0 ? 0.5 : 1 }}>
                  <input type="radio" name="mediaType" checked={mediaType === 'catalog'} disabled={selectedProductIds.length === 0} onChange={() => setMediaType('catalog')} style={{ accentColor: 'var(--accent-primary)' }} />
                  Catalog Photo
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', background: mediaType === 'ai' ? 'rgba(249, 115, 22, 0.05)' : '#121212', border: mediaType === 'ai' ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '8px', flex: 1, color: '#fff' }}>
                  <input type="radio" name="mediaType" checked={mediaType === 'ai'} onChange={() => setMediaType('ai')} style={{ accentColor: 'var(--accent-primary)' }} />
                  AI Image Gen
                </label>
              </div>
            </div>

            {mediaType === 'ai' && (
              <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Image Model</label>
                    <select
                      value={imageModel}
                      onChange={(e) => setImageModel(e.target.value)}
                      style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '40px', borderRadius: '8px', padding: '0 10px', outline: 'none' }}
                    >
                      <option value="flux">Flux (Ultra Detail/Photorealistic)</option>
                      <option value="nano_banana">Nano Banana (Vibrant Graphics/Vector)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Aesthetic Theme</label>
                    <select
                      value={aestheticTheme}
                      onChange={(e) => setAestheticTheme(e.target.value)}
                      style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '40px', borderRadius: '8px', padding: '0 10px', outline: 'none' }}
                    >
                      <option value="Modern Minimalist">Modern Minimalist</option>
                      <option value="Corporate B2B">Corporate B2B</option>
                      <option value="Vibrant Tech">Vibrant Tech</option>
                      <option value="Moody Studio">Moody Studio</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '14px', borderRadius: '8px' }}>
                  <input
                    type="checkbox"
                    id="enableMiddleAi"
                    checked={enableMiddleAi}
                    onChange={(e) => setEnableMiddleAi(e.target.checked)}
                    style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                  />
                  <label htmlFor="enableMiddleAi" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                    <strong style={{ color: '#fff' }}>Enable Middle AI Enhancer</strong> — Refines prompts automatically for premium aesthetics.
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Deploy Settings */}
        <div style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={16} color="var(--accent-primary)" />
            5. Deployment & Publish Options
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', color: '#fff' }}>
              <input
                type="checkbox"
                checked={addFirstComment}
                onChange={(e) => setAddFirstComment(e.target.checked)}
                style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
              />
              Generate AI First Comment (CTAs, engagement hashtags)
            </label>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Deployment Status</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', background: publishStatus === 'draft' ? 'rgba(249, 115, 22, 0.05)' : '#121212', border: publishStatus === 'draft' ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '8px', flex: 1, color: '#fff' }}>
                  <input type="radio" name="publishStatus" checked={publishStatus === 'draft'} onChange={() => setPublishStatus('draft')} style={{ accentColor: 'var(--accent-primary)' }} />
                  Create as Drafts (Review in calendar before going live)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', background: publishStatus === 'scheduled' ? 'rgba(249, 115, 22, 0.05)' : '#121212', border: publishStatus === 'scheduled' ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '8px', flex: 1, color: '#fff' }}>
                  <input type="radio" name="publishStatus" checked={publishStatus === 'scheduled'} onChange={() => setPublishStatus('scheduled')} style={{ accentColor: 'var(--accent-primary)' }} />
                  Schedule Immediately (Auto-post on designated times)
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Section 6: Summary & Submit */}
        <div style={{ 
          background: 'var(--accent-primary-glow)', 
          border: '1px solid var(--border-accent)',
          padding: '20px 24px', 
          borderRadius: '16px', 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <ShieldAlert size={20} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <h3 style={{ margin: 0, fontWeight: 700, color: '#fff', fontSize: '0.9rem' }}>Campaign Summary</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Generating <strong style={{ color: '#fff' }}>{count} posts</strong> spaced <strong style={{ color: '#fff' }}>{frequency === 'daily' && postsPerDay > 1 ? `${postsPerDay}×/day` : frequency}</strong>. 
                Est. Credit usage: <strong style={{ color: 'var(--accent-primary)' }}>{totalCost} credits</strong>.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={() => navigate('/planner')}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#fff',
                padding: '10px 20px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                padding: '10px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.85rem'
              }}
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={14} />
                  Generating Campaign...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Deploy Campaign
                </>
              )}
            </button>
          </div>
        </div>

      </form>

      {/* Section 7: Recent Generations & Bulk Actions */}
      <div style={{ marginTop: '40px', background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '16px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} color="var(--accent-primary)" />
            Recent AI Generations
          </h2>
          <div style={{ display: 'flex', gap: '12px' }}>
            {selectedPostIds.size > 0 && (
              <button
                type="button"
                onClick={handleDeleteSelected}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  color: '#ef4444',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600
                }}
              >
                <Trash2 size={14} /> Delete Selected ({selectedPostIds.size})
              </button>
            )}
            <button
              type="button"
              onClick={handleUndoLastBatch}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(96, 165, 250, 0.1)',
                color: '#60a5fa',
                border: '1px solid rgba(96, 165, 250, 0.2)',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600
              }}
            >
              <Undo size={14} /> Undo Last Batch
            </button>
          </div>
        </div>

        {loadingPosts ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <Loader2 className="animate-spin" size={24} style={{ margin: '0 auto 10px' }} />
            Loading recent posts...
          </div>
        ) : recentAiPosts.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.08)' }}>
            No recent AI generations found.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', marginBottom: '4px' }}>
              <input
                type="checkbox"
                checked={selectedPostIds.size === recentAiPosts.length && recentAiPosts.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedPostIds(new Set(recentAiPosts.map(p => p.id)));
                  } else {
                    setSelectedPostIds(new Set());
                  }
                }}
                style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px', marginRight: '16px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1 }}>Message Preview</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', width: '150px' }}>Scheduled For</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', width: '100px', textAlign: 'right' }}>Status</span>
            </div>

            <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentAiPosts.map(post => (
                <div key={post.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#121212',
                  border: '1px solid rgba(255,255,255,0.04)',
                  padding: '12px',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                  borderLeft: selectedPostIds.has(post.id) ? '3px solid var(--accent-primary)' : '3px solid transparent'
                }}>
                  <input
                    type="checkbox"
                    checked={selectedPostIds.has(post.id)}
                    onChange={(e) => {
                      const newSet = new Set(selectedPostIds);
                      if (e.target.checked) newSet.add(post.id);
                      else newSet.delete(post.id);
                      setSelectedPostIds(newSet);
                    }}
                    style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px', marginRight: '16px', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1, fontSize: '0.85rem', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', paddingRight: '16px' }}>
                    {post.message || 'No text content'}
                  </div>
                  <div style={{ width: '150px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {new Date(post.scheduled_time).toLocaleString()}
                  </div>
                  <div style={{ width: '100px', textAlign: 'right' }}>
                    <span style={{
                      fontSize: '0.7rem',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      background: post.status === 'published' ? 'rgba(34, 197, 94, 0.1)' : post.status === 'failed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.1)',
                      color: post.status === 'published' ? '#4ade80' : post.status === 'failed' ? '#ef4444' : '#fff'
                    }}>
                      {post.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
