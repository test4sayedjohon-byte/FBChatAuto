import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';
import { WORKER_URL } from '../lib/workerApi';
import {
  Brain, ToggleLeft, ToggleRight, Loader2, AlertTriangle,
  Coins, Globe, FileText, X, ChevronDown, ChevronUp, Sparkles, Info
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PageConnection {
  page_id: string;
  page_name: string;
  platform: string;
}

interface Post {
  id: string;
  message: string;
  picture: string | null;
  created_time: string;
}

interface ActiveAiRule {
  id: string;
  trigger_type: string;
  page_connection_id: string;
}

interface Props {
  pages: PageConnection[];
  /** Callback so parent can react (e.g. re-read analysis state) */
  onSettingsChanged?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ScopeChip({ scope, count }: { scope: string; count?: number }) {
  if (scope === 'global') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        background: 'rgba(99,102,241,0.15)', color: '#818cf8',
        padding: '2px 8px', borderRadius: '20px', fontSize: '0.73rem', fontWeight: 700,
      }}>
        <Globe size={10} /> Global
      </span>
    );
  }
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: 'rgba(139,92,246,0.15)', color: '#a78bfa',
      padding: '2px 8px', borderRadius: '20px', fontSize: '0.73rem', fontWeight: 700,
    }}>
      <FileText size={10} /> {count ?? '?'} Post{(count ?? 0) !== 1 ? 's' : ''}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ActivityMonitorSentimentPanel({ pages, onSettingsChanged }: Props) {
  const { user, profile, refreshCreditBalance } = useAuth();

  // Local mirror of DB values
  const [analysisEnabled, setAnalysisEnabled] = useState<boolean>(false);
  const [scope, setScope] = useState<'global' | 'specific_posts'>('global');
  const [watchedPostIds, setWatchedPostIds] = useState<string[]>([]);

  // UI state
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Post selector
  const [selectedPageForPosts, setSelectedPageForPosts] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);

  // Auto-moderation AI rules running
  const [activeAiRules, setActiveAiRules] = useState<ActiveAiRule[]>([]);

  // ── Sync profile → local state ────────────────────────────────────────────
  // Only sync from profile when the panel is collapsed to prevent background database updates 
  // (e.g. from credit deductions) from overwriting user's active unsaved post selections.
  useEffect(() => {
    if (profile !== null && !expanded) {
      setAnalysisEnabled(!!profile.allow_comment_analysis);
      setScope((profile.sentiment_analysis_scope as 'global' | 'specific_posts') ?? 'global');
      setWatchedPostIds(profile.sentiment_watched_post_ids ?? []);
    }
  }, [profile?.allow_comment_analysis, profile?.sentiment_analysis_scope, profile?.sentiment_watched_post_ids, expanded]);

  // ── Fetch active AI rules from Auto-Moderation ───────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase
      .from('comment_rules')
      .select('id, trigger_type, page_connection_id')
      .in('trigger_type', ['ai_sentiment', 'ai_custom'])
      .eq('is_active', true)
      .then(({ data }) => {
        setActiveAiRules(data ?? []);
      });
  }, [user]);

  // ── Fetch posts for post selector ─────────────────────────────────────────
  useEffect(() => {
    if (!selectedPageForPosts) { setPosts([]); return; }
    const fetchPosts = async () => {
      setLoadingPosts(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? '';
        const res = await fetch(`${WORKER_URL}/api/page-posts/${selectedPageForPosts}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed');
        const json = await res.json() as any;
        setPosts(json.posts ?? []);
      } catch {
        setPosts([]);
        toast.error('Could not load posts for this page.');
      } finally {
        setLoadingPosts(false);
      }
    };
    fetchPosts();
  }, [selectedPageForPosts]);

  // ── Toggle enable / disable ───────────────────────────────────────────────
  function handleToggleClick() {
    if (!analysisEnabled) {
      // Turning ON → show credit warning first
      setShowConfirm(true);
    } else {
      disableAnalysis();
    }
  }

  async function disableAnalysis() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ allow_comment_analysis: false })
        .eq('id', user.id);
      if (error) throw error;
      setAnalysisEnabled(false);
      await refreshCreditBalance();
      toast.success('Sentiment analysis disabled. Comments still visible — no credits charged.');
      onSettingsChanged?.();
    } catch (err: any) {
      toast.error('Failed to disable: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmEnable() {
    if (!user) return;
    setShowConfirm(false);
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          allow_comment_analysis: true,
          sentiment_analysis_scope: scope,
          sentiment_watched_post_ids: scope === 'specific_posts' ? watchedPostIds : null,
        })
        .eq('id', user.id);
      if (error) throw error;
      setAnalysisEnabled(true);
      await refreshCreditBalance();
      toast.success('Sentiment analysis enabled — 1 credit per comment.');
      setExpanded(false);
      onSettingsChanged?.();
    } catch (err: any) {
      toast.error('Failed to enable: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Save scope change (when already enabled) ──────────────────────────────
  async function saveScope() {
    if (!user || !analysisEnabled) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          sentiment_analysis_scope: scope,
          sentiment_watched_post_ids: scope === 'specific_posts' ? watchedPostIds : null,
        })
        .eq('id', user.id);
      if (error) throw error;
      toast.success('Analysis scope updated.');
      setExpanded(false);
      onSettingsChanged?.();
    } catch (err: any) {
      toast.error('Failed to save scope: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleWatchedPost(postId: string) {
    setWatchedPostIds(prev =>
      prev.includes(postId) ? prev.filter(id => id !== postId) : [...prev, postId]
    );
  }

  const creditsUsed = profile?.credits_used_this_month ?? 0;
  const creditsLimit = (profile?.monthly_credits_limit ?? 1000) + (profile?.extra_credits_balance ?? 0);
  const creditsRemaining = Math.max(0, creditsLimit - creditsUsed);

  return (
    <>
      {/* ── Credit Warning Confirmation Dialog ─────────────────────────────── */}
      {showConfirm && (
        <div
          onClick={() => setShowConfirm(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 3000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
              <div style={{
                width: 46, height: 46, borderRadius: '12px', flexShrink: 0,
                background: 'rgba(239,68,68,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <AlertTriangle size={22} color="#f87171" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Credit Usage Warning
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  Enabling AI Sentiment Analysis deducts <strong style={{ color: 'var(--text-primary)' }}>1 credit per comment</strong> analyzed.
                  Analysis starts from this point forward — no retroactive charges.
                </p>
              </div>
            </div>

            {/* Credit summary */}
            <div style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-primary)',
              borderRadius: '10px',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}>
              <Coins size={20} color="var(--accent-primary)" />
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Credits remaining this cycle</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: creditsRemaining < 50 ? '#f87171' : 'var(--text-primary)' }}>
                  {creditsRemaining.toLocaleString()} / {creditsLimit.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Scope summary */}
            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Info size={13} />
              Scope: <ScopeChip scope={scope} count={watchedPostIds.length} />
              {scope === 'specific_posts' && watchedPostIds.length === 0 && (
                <span style={{ color: '#f87171', fontSize: '0.78rem' }}>— No posts selected yet</span>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowConfirm(false)}
                style={{ padding: '9px 18px', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={confirmEnable}
                disabled={saving || (scope === 'specific_posts' && watchedPostIds.length === 0)}
                style={{
                  padding: '9px 18px', fontSize: '0.85rem',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                }}
              >
                {saving ? <Loader2 size={14} className="spin" /> : <Brain size={14} />}
                Enable Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Panel ──────────────────────────────────────────────────────── */}
      <div style={{
        margin: '0 0 2px 0',
        borderRadius: '10px',
        border: `1.5px solid ${analysisEnabled ? 'rgba(99,102,241,0.3)' : 'var(--border-primary)'}`,
        background: analysisEnabled
          ? 'linear-gradient(135deg, rgba(99,102,241,0.07) 0%, rgba(139,92,246,0.05) 100%)'
          : 'var(--bg-tertiary)',
        overflow: 'hidden',
        transition: 'all 0.25s ease',
        flexShrink: 0,
      }}>
        {/* ── Collapsed row ─────────────────────────────────────────────── */}
        <div style={{
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          {/* Brain icon */}
          <div style={{
            width: 32, height: 32, borderRadius: '8px', flexShrink: 0,
            background: analysisEnabled ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.05)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.25s',
          }}>
            <Brain size={16} color={analysisEnabled ? '#fff' : 'var(--text-secondary)'} />
          </div>

          {/* Label + badges */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                Sentiment Analysis
              </span>
              <span style={{
                padding: '1px 7px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700,
                background: analysisEnabled ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
                color: analysisEnabled ? '#818cf8' : 'var(--text-secondary)',
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                {analysisEnabled ? 'Active' : 'Off'}
              </span>
              {analysisEnabled && <ScopeChip scope={scope} count={scope === 'specific_posts' ? watchedPostIds.length : undefined} />}
              {activeAiRules.length > 0 && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '3px',
                  background: 'rgba(249,115,22,0.12)', color: 'var(--accent-primary)',
                  padding: '1px 7px', borderRadius: '20px', fontSize: '0.68rem', fontWeight: 700,
                }}>
                  <Sparkles size={9} />
                  {activeAiRules.length} Auto-Mod rule{activeAiRules.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {!analysisEnabled && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                Comments shown without labels · no credits charged
              </div>
            )}
          </div>

          {/* Toggle + expand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <button
              onClick={handleToggleClick}
              disabled={saving}
              title={analysisEnabled ? 'Disable sentiment analysis' : 'Enable sentiment analysis'}
              style={{
                background: 'none', border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
                padding: '4px', display: 'flex', alignItems: 'center',
                color: analysisEnabled ? '#818cf8' : 'var(--text-secondary)',
                opacity: saving ? 0.5 : 1, transition: 'all 0.2s',
              }}
            >
              {saving
                ? <Loader2 size={22} className="spin" />
                : analysisEnabled
                  ? <ToggleRight size={26} />
                  : <ToggleLeft size={26} />}
            </button>

            <button
              onClick={() => setExpanded(v => !v)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '4px', display: 'flex', alignItems: 'center',
                color: 'var(--text-secondary)',
              }}
              title="Expand settings"
            >
              {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
          </div>
        </div>

        {/* ── Auto-mod sync notice (always visible if relevant) ─────────── */}
        {activeAiRules.length > 0 && (
          <div style={{
            margin: '0 14px 10px',
            padding: '8px 12px',
            borderRadius: '8px',
            background: 'rgba(249,115,22,0.07)',
            border: '1px solid rgba(249,115,22,0.18)',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.4,
          }}>
            <Sparkles size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px', color: 'var(--accent-primary)' }} />
            <strong style={{ color: 'var(--text-primary)' }}>Auto-Moderation AI running:</strong>{' '}
            {activeAiRules.length} active rule{activeAiRules.length > 1 ? 's' : ''} already process sentiment.
            This toggle controls <em>additional per-comment analysis</em> visible here.
          </div>
        )}

        {/* ── Expanded settings area ───────────────────────────────────── */}
        {expanded && (
          <div style={{
            borderTop: '1px solid var(--border-primary)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}>

            {/* Scope selection */}
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Analysis Scope
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['global', 'specific_posts'] as const).map(s => (
                  <button
                    key={s}
                    onClick={() => setScope(s)}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '8px',
                      border: `1.5px solid ${scope === s ? 'rgba(99,102,241,0.5)' : 'var(--border-primary)'}`,
                      background: scope === s ? 'rgba(99,102,241,0.12)' : 'var(--bg-primary)',
                      color: scope === s ? '#818cf8' : 'var(--text-secondary)',
                      fontWeight: scope === s ? 700 : 500,
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      transition: 'all 0.18s',
                    }}
                  >
                    {s === 'global' ? <Globe size={13} /> : <FileText size={13} />}
                    {s === 'global' ? 'All Comments' : 'Specific Posts'}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: 1.4 }}>
                {scope === 'global'
                  ? 'Every incoming comment across all connected pages will be analyzed.'
                  : 'Only comments on selected posts below will be analyzed — saves credits.'}
              </div>
            </div>

            {/* Post selector (specific_posts only) */}
            {scope === 'specific_posts' && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Select Posts to Watch
                </div>

                {/* Page picker */}
                <select
                  className="form-input"
                  value={selectedPageForPosts}
                  onChange={e => setSelectedPageForPosts(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px', fontSize: '0.82rem', marginBottom: '8px' }}
                >
                  <option value="">— Choose a connected page to load posts —</option>
                  {pages.map(p => (
                    <option key={p.page_id} value={p.page_id}>{p.page_name}</option>
                  ))}
                </select>

                {/* Currently watching chips */}
                {watchedPostIds.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {watchedPostIds.map(pid => {
                      const postObj = posts.find(p => p.id === pid);
                      const displayLabel = postObj?.message 
                        ? (postObj.message.substring(0, 16) + (postObj.message.length > 16 ? '…' : ''))
                        : (pid.length > 16 ? pid.slice(0, 16) + '…' : pid);
                      return (
                        <span key={pid} style={{
                          display: 'inline-flex', alignItems: 'center', gap: '5px',
                          background: 'rgba(99,102,241,0.12)', color: '#818cf8',
                          border: '1px solid rgba(99,102,241,0.25)',
                          padding: '2px 8px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600,
                        }}>
                          {displayLabel}
                          <button
                            onClick={() => toggleWatchedPost(pid)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, color: 'inherit' }}
                          >
                            <X size={10} />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Posts list */}
                {selectedPageForPosts && (
                  <div style={{
                    border: '1px solid var(--border-primary)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    maxHeight: '200px',
                    overflowY: 'auto',
                  }}>
                    {loadingPosts ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <Loader2 size={14} className="spin" /> Loading posts…
                      </div>
                    ) : posts.length === 0 ? (
                      <div style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                        No posts found for this page.
                      </div>
                    ) : (
                      posts.map(post => {
                        const watched = watchedPostIds.includes(post.id);
                        return (
                          <div
                            key={post.id}
                            onClick={() => toggleWatchedPost(post.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '9px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-primary)',
                              background: watched ? 'rgba(99,102,241,0.06)' : 'transparent',
                              transition: 'background 0.15s',
                            }}
                          >
                            {/* Checkbox */}
                            <div style={{
                              width: 16, height: 16, borderRadius: '4px', flexShrink: 0,
                              border: `2px solid ${watched ? '#6366f1' : 'var(--border-primary)'}`,
                              background: watched ? '#6366f1' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.15s',
                            }}>
                              {watched && (
                                <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                  <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            {/* Thumbnail */}
                            {post.picture && (
                              <img src={post.picture} alt="" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
                            )}
                            {/* Text */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {post.message?.substring(0, 70) || '[No caption]'}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '1px' }}>
                                {post.id}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setExpanded(false)}
                style={{ padding: '7px 14px', fontSize: '0.8rem' }}
              >
                Cancel
              </button>
              {analysisEnabled ? (
                <button
                  className="btn btn-primary"
                  onClick={saveScope}
                  disabled={saving || (scope === 'specific_posts' && watchedPostIds.length === 0)}
                  style={{
                    padding: '7px 14px', fontSize: '0.8rem',
                    display: 'flex', alignItems: 'center', gap: '6px',
                  }}
                >
                  {saving ? <Loader2 size={13} className="spin" /> : null}
                  Save Scope
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowConfirm(true)}
                  disabled={saving || (scope === 'specific_posts' && watchedPostIds.length === 0)}
                  style={{
                    padding: '7px 14px', fontSize: '0.8rem',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  }}
                >
                  <Brain size={13} /> Enable with this scope
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
