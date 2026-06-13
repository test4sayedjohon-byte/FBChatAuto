import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { workerPost } from '../../lib/workerApi';
import { toast } from '../../hooks/useToast';
import { 
  Sparkles, X, ChevronLeft, ChevronRight, Loader2, 
  Layers, Calendar, Tag, Image, ShieldAlert 
} from 'lucide-react';

interface PageConn {
  id: string;
  page_id: string;
  page_name: string;
  platform: string;
}

interface AiGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  channels: PageConn[];
  onSuccess: () => void;
}

export function AiGeneratorModal({ isOpen, onClose, channels, onSuccess }: AiGeneratorModalProps) {
  if (!isOpen) return null;

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Form States
  const [pageConnectionId, setPageConnectionId] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [preset, setPreset] = useState<'thematic' | 'daily_consistency' | 'sequential_story' | 'product_showcase'>('daily_consistency');
  const [themeText, setThemeText] = useState('');
  
  const [count, setCount] = useState(5);
  const [frequency, setFrequency] = useState<'daily' | 'every_other_day' | 'weekly' | 'monthly'>('daily');
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [durationMode, setDurationMode] = useState<'count' | 'date_range'>('count');

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

  // Effect to automatically calculate End Date when count/cadence changes in 'count' mode
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

  // Effect to automatically calculate Post Count when date range changes in 'date_range' mode
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

  const [products, setProducts] = useState<any[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  
  const [mediaType, setMediaType] = useState<'text' | 'catalog' | 'ai'>('text');
  const [imageModel, setImageModel] = useState('flux');
  const [aestheticTheme, setAestheticTheme] = useState('Modern Minimalist');
  const [enableMiddleAi, setEnableMiddleAi] = useState(true);

  const [addFirstComment, setAddFirstComment] = useState(false);
  const [publishStatus, setPublishStatus] = useState<'draft' | 'scheduled'>('draft');

  // Load products from DB
  useEffect(() => {
    async function loadProducts() {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('is_active', true)
          .order('name', { ascending: true });
        if (error) throw error;
        if (data) setProducts(data);
      } catch (err: any) {
        console.error('Error loading products:', err.message);
      }
    }
    loadProducts();
    
    // Set default startDate to tomorrow at 9 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    // Format to YYYY-MM-DDTHH:MM
    const tzOffset = tomorrow.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(tomorrow.getTime() - tzOffset)).toISOString().slice(0, 16);
    setStartDate(localISOTime);

    // Set default endDate based on default count=5 and frequency=daily, postsPerDay=1
    const spacing = 24 * 60 * 60 * 1000;
    const endMs = tomorrow.getTime() + (5 - 1) * spacing;
    const localEndISOTime = (new Date(endMs - tzOffset)).toISOString().slice(0, 16);
    setEndDate(localEndISOTime);

    // Default connection
    if (channels.length > 0) {
      setPageConnectionId(channels[0].page_id);
    }
  }, [channels]);

  // Dynamic Credit Cost Calculator
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
        toast.success(res.message || 'Bulk content campaign successfully generated.');
        onSuccess();
        onClose();
      } else {
        toast.error(res.message || 'Failed to generate campaign.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error occurred while calling generator.');
    } finally {
      setLoading(false);
    }
  }

  const stepsList = [
    { num: 1, name: 'Setup', icon: <Layers size={14} /> },
    { num: 2, name: 'Cadence', icon: <Calendar size={14} /> },
    { num: 3, name: 'Products', icon: <Tag size={14} /> },
    { num: 4, name: 'Visuals', icon: <Image size={14} /> },
    { num: 5, name: 'Confirm', icon: <ShieldAlert size={14} /> }
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 2000,
      padding: '16px'
    }}>
      <div className="animate-scaleUp" style={{
        background: '#0a0a0a',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '560px',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.7)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          padding: '18px 24px', 
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.01)'
        }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={18} color="var(--accent-primary)" />
            Enterprise Campaign Planner
          </h2>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '4px' }}>
            <X size={18} color="var(--text-secondary)" />
          </button>
        </div>

        {/* Step Indicator */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          padding: '14px 24px', 
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid rgba(255,255,255,0.04)'
        }}>
          {stepsList.map(s => {
            const isActive = step === s.num;
            const isCompleted = step > s.num;
            return (
              <div key={s.num} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                opacity: isActive ? 1 : isCompleted ? 0.8 : 0.4,
                color: isActive ? 'var(--accent-primary)' : isCompleted ? '#34d399' : 'var(--text-secondary)',
                fontSize: '0.8rem',
                fontWeight: isActive ? 700 : 500
              }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isActive ? 'var(--accent-primary-glow)' : isCompleted ? 'rgba(52,211,153,0.1)' : 'rgba(255,255,255,0.04)',
                  border: isActive ? '1px solid var(--accent-primary)' : isCompleted ? '1px solid #34d399' : '1px solid transparent',
                  fontSize: '0.75rem'
                }}>
                  {s.num}
                </div>
                <span>{s.name}</span>
              </div>
            );
          })}
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
            
            {/* STEP 1: General Setup */}
            {step === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Campaign Channel</label>
                  <select
                    className="form-input"
                    value={pageConnectionId}
                    onChange={(e) => setPageConnectionId(e.target.value)}
                    required
                    style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px' }}
                  >
                    <option value="" disabled>Choose a connected channel...</option>
                    {channels.filter((c, index, self) => self.findIndex(t => t.page_id === c.page_id) === index).map(c => (
                      <option key={c.page_id} value={c.page_id}>{c.page_name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Campaign Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. June Product Launch"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Campaign Preset Strategy</label>
                  <select
                    className="form-input"
                    value={preset}
                    onChange={(e) => setPreset(e.target.value as any)}
                    style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px' }}
                  >
                    <option value="daily_consistency">Daily Consistency (Mixed Tips & Promos)</option>
                    <option value="thematic">Thematic Campaign (Deep Dive on Single Topic)</option>
                    <option value="sequential_story">Sequential Story (Chronological Story Arc)</option>
                    <option value="product_showcase">Product Showcase (High-Intent Conversion)</option>
                  </select>
                </div>

                {preset === 'thematic' && (
                  <div className="animate-fadeIn">
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Describe Campaign Theme / Keywords</label>
                    <textarea
                      placeholder="e.g. Core features of our productivity dashboard, targeting high-volume developers."
                      value={themeText}
                      onChange={(e) => setThemeText(e.target.value)}
                      required
                      style={{ width: '100%', minHeight: '80px', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', borderRadius: '8px', padding: '10px', fontSize: '0.9rem', resize: 'none' }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Cadence & Timing */}
            {step === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Define Campaign Duration By</label>
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
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Total Post Count
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
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      Date Range (Start → End)
                    </button>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {durationMode === 'count' ? (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Total Post Count</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={count}
                        onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                        style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px', fontSize: '0.9rem' }}
                      />
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Calculated Post Count</label>
                      <div style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', color: 'var(--accent-primary)', height: '38px', borderRadius: '8px', padding: '0 10px', display: 'flex', alignItems: 'center', fontSize: '0.95rem', fontWeight: 700 }}>
                        {count} Posts
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Posting Frequency</label>
                    <select
                      value={frequency}
                      onChange={(e) => { setFrequency(e.target.value as any); setPostsPerDay(1); }}
                      style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px' }}
                    >
                      <option value="daily">Daily (Every 24h)</option>
                      <option value="every_other_day">Every Other Day (Every 48h)</option>
                      <option value="weekly">Weekly (Every 7 days)</option>
                      <option value="monthly">Monthly (Every 30 days)</option>
                    </select>
                  </div>
                </div>

                {/* Posts Per Day — only visible when Daily is selected */}
                {frequency === 'daily' && (
                  <div className="animate-fadeIn">
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Posts Per Day</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {[1, 2, 3, 4].map(n => (
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
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {n === 1 ? '1×/day' : `${n}×/day`}
                        </button>
                      ))}
                    </div>
                    {postsPerDay > 1 && (
                      <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Posts will be spaced {postsPerDay === 2 ? '12h' : postsPerDay === 3 ? '8h' : '6h'} apart throughout each day.
                      </p>
                    )}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Start Date & Time</label>
                    <input
                      type="datetime-local"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                      style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px' }}
                    />
                  </div>

                  {durationMode === 'date_range' ? (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>End Date & Time</label>
                      <input
                        type="datetime-local"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        required
                        style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px' }}
                      />
                    </div>
                  ) : (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Calculated End Date</label>
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
            )}

            {/* STEP 3: Product Selector */}
            {step === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#fff', margin: 0, fontWeight: 600 }}>Linked Product Catalog</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Link products to display specifications (prices, descriptions) in your posts.
                </p>

                {products.length === 0 ? (
                  <div style={{ padding: '16px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: '8px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    No products active in catalog. (Skip)
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: '#f87171' }}>
                    <ShieldAlert size={12} /> Product Showcase preset requires at least one selected product.
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: Visuals & Art Style */}
            {step === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Post Media Type</label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', background: mediaType === 'text' ? 'rgba(249, 115, 22, 0.05)' : '#121212', border: mediaType === 'text' ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '8px', flex: 1, color: '#fff' }}>
                      <input type="radio" checked={mediaType === 'text'} onChange={() => setMediaType('text')} style={{ accentColor: 'var(--accent-primary)' }} />
                      Text Only
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', background: mediaType === 'catalog' ? 'rgba(249, 115, 22, 0.05)' : '#121212', border: mediaType === 'catalog' ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '8px', flex: 1, color: '#fff', opacity: selectedProductIds.length === 0 ? 0.5 : 1 }}>
                      <input type="radio" checked={mediaType === 'catalog'} disabled={selectedProductIds.length === 0} onChange={() => setMediaType('catalog')} style={{ accentColor: 'var(--accent-primary)' }} />
                      Catalog Photo
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', background: mediaType === 'ai' ? 'rgba(249, 115, 22, 0.05)' : '#121212', border: mediaType === 'ai' ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '8px', flex: 1, color: '#fff' }}>
                      <input type="radio" checked={mediaType === 'ai'} onChange={() => setMediaType('ai')} style={{ accentColor: 'var(--accent-primary)' }} />
                      AI Image Gen
                    </label>
                  </div>
                </div>

                {mediaType === 'ai' && (
                  <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Image Model</label>
                        <select
                          value={imageModel}
                          onChange={(e) => setImageModel(e.target.value)}
                          style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px' }}
                        >
                          <option value="flux">Flux (Ultra Detail/Photorealistic)</option>
                          <option value="nano_banana">Nano Banana (Vibrant Graphics/Vector)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Aesthetic Theme</label>
                        <select
                          value={aestheticTheme}
                          onChange={(e) => setAestheticTheme(e.target.value)}
                          style={{ width: '100%', background: '#121212', border: '1px solid rgba(255,255,255,0.06)', color: '#fff', height: '38px', borderRadius: '8px', padding: '0 10px' }}
                        >
                          <option value="Modern Minimalist">Modern Minimalist</option>
                          <option value="Corporate B2B">Corporate B2B</option>
                          <option value="Vibrant Tech">Vibrant Tech</option>
                          <option value="Moody Studio">Moody Studio</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255, 255, 255, 0.01)', border: '1px solid rgba(255,255,255,0.04)', padding: '12px', borderRadius: '8px' }}>
                      <input
                        type="checkbox"
                        id="enableMiddleAi"
                        checked={enableMiddleAi}
                        onChange={(e) => setEnableMiddleAi(e.target.checked)}
                        style={{ accentColor: 'var(--accent-primary)', cursor: 'pointer' }}
                      />
                      <label htmlFor="enableMiddleAi" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                        <strong style={{ color: '#fff' }}>Enable Middle AI Enhancer</strong> — Uses secondary completion to optimize raw prompts to match high-grade aesthetics.
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 5: Confirm & Publish */}
            {step === 5 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '0.9rem', color: '#fff', margin: 0, fontWeight: 600 }}>Review & Deploy Campaign</h3>

                {/* Settings list */}
                <div style={{ background: '#121212', border: '1px solid rgba(255,255,255,0.06)', padding: '16px', borderRadius: '10px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Campaign Preset:</span><span style={{ fontWeight: 600, color: '#fff' }}>{preset.toUpperCase()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Post Count / Cadence:</span><span style={{ fontWeight: 600, color: '#fff' }}>{count} posts ({frequency}{frequency === 'daily' && postsPerDay > 1 ? `, ${postsPerDay}×/day` : ''})</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Media Settings:</span><span style={{ fontWeight: 600, color: '#fff' }}>{mediaType.toUpperCase()} ({mediaType === 'ai' ? imageModel : 'N/A'})</span></div>
                  {selectedProductIds.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-secondary)' }}>Linked Products:</span><span style={{ fontWeight: 600, color: '#fff' }}>{selectedProductIds.length} items</span></div>
                  )}
                </div>

                {/* Toggles */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', color: '#fff' }}>
                    <input
                      type="checkbox"
                      checked={addFirstComment}
                      onChange={(e) => setAddFirstComment(e.target.checked)}
                      style={{ accentColor: 'var(--accent-primary)', width: '16px', height: '16px' }}
                    />
                    Generate AI First Comment (CTAs, engagement tags)
                  </label>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Publish Status</label>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', background: publishStatus === 'draft' ? 'rgba(249, 115, 22, 0.05)' : '#121212', border: publishStatus === 'draft' ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '8px', flex: 1, color: '#fff' }}>
                        <input type="radio" checked={publishStatus === 'draft'} onChange={() => setPublishStatus('draft')} style={{ accentColor: 'var(--accent-primary)' }} />
                        Create as Drafts (Review first)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', background: publishStatus === 'scheduled' ? 'rgba(249, 115, 22, 0.05)' : '#121212', border: publishStatus === 'scheduled' ? '1px solid var(--accent-primary)' : '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', borderRadius: '8px', flex: 1, color: '#fff' }}>
                        <input type="radio" checked={publishStatus === 'scheduled'} onChange={() => setPublishStatus('scheduled')} style={{ accentColor: 'var(--accent-primary)' }} />
                        Schedule Immediately
                      </label>
                    </div>
                  </div>
                </div>

                {/* Credit summary */}
                <div style={{ 
                  background: 'var(--accent-primary-glow)', 
                  border: '1px solid var(--border-accent)',
                  padding: '14px', 
                  borderRadius: '10px', 
                  fontSize: '0.8rem', 
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px'
                }}>
                  <ShieldAlert size={18} color="var(--accent-primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <span style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.85rem' }}>Estimated Credit Usage:</span>{' '}
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      {totalCost} credits
                    </span>
                    <div style={{ marginTop: '4px' }}>
                      Workspace will burn 10 credits per post for text/catalog posts, and +30 credits per post if AI Image Generation is active.
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Footer Controls */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '16px 24px', 
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.01)'
          }}>
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '0.85rem'
                  }}
                >
                  <ChevronLeft size={16} />
                  Back
                </button>
              )}
            </div>

            <div>
              {step < 5 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (step === 1 && !pageConnectionId) return toast.error('Please select a channel connection.');
                    if (step === 1 && preset === 'thematic' && !themeText) return toast.error('Please specify a campaign theme.');
                    if (step === 2) {
                      if (!startDate) return toast.error('Please specify a starting date/time.');
                      if (durationMode === 'date_range') {
                        if (!endDate) return toast.error('Please specify an ending date/time.');
                        if (new Date(endDate) <= new Date(startDate)) {
                          return toast.error('End Date & Time must be chronologically after the Start Date.');
                        }
                      }
                    }
                    if (step === 3 && preset === 'product_showcase' && selectedProductIds.length === 0) {
                      return toast.error('Product Showcase preset requires at least one product.');
                    }
                    setStep(step + 1);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.85rem'
                  }}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              ) : (
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
                    padding: '8px 20px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.85rem'
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="animate-spin" size={14} />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      Create Campaign
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
