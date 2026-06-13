// ─── SettingsPanel ─────────────────────────────────────────────────────────
// Sidebar inspector for editing the active node's attributes.
// Each node type renders its own sub-form section.
// ───────────────────────────────────────────────────────────────────────────
import { useState, useEffect } from 'react';
import {
  HelpCircle,
  Trash2,
  AlertCircle,
  Shuffle,
  X,
  Plus,
  Loader2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { workerGet } from '../../lib/workerApi';
import AssetSelector from '../../components/AssetSelector';
import type { FlowNode, FlowNodeData } from './types';
import { useAuth } from '../../hooks/useAuth';

interface SettingsPanelProps {
  selectedNode: FlowNode | null;
  otherFlows: Array<{ id: string; name: string }>;
  flowId: string | undefined;
  onUpdateNodeData: (nodeId: string, data: Partial<FlowNodeData>) => void;
  onDeleteNode: (nodeId: string) => void;
}

// Shared input style to avoid repetition
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--bg-primary)',
  border: '1px solid var(--border-primary)',
  borderRadius: 'var(--radius-md)',
  color: '#fff',
  fontSize: '13px',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  color: 'var(--text-secondary)',
  marginBottom: '6px',
  fontWeight: 600,
  letterSpacing: '0.4px',
};

const slugify = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
};

export default function SettingsPanel({
  selectedNode,
  otherFlows,
  flowId,
  onUpdateNodeData,
  onDeleteNode,
}: SettingsPanelProps) {
  const { profile } = useAuth();
  const [channels, setChannels] = useState<Array<{ page_id: string; page_name: string; platform: string }>>([]);
  const [posts, setPosts] = useState<Array<{ id: string; message: string }>>([]);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);

  useEffect(() => {
    if (selectedNode?.type === 'trigger' && (selectedNode.data.triggerType === 'comment' || selectedNode.data.triggerType === 'keyword')) {
      const fetchChannels = async () => {
        try {
          setLoadingChannels(true);
          const { data: channelsData } = await supabase
            .from('page_connections')
            .select('page_id, page_name, whatsapp_phone_number_id, instagram_account_id, is_whatsapp_active, is_instagram_active');

          const triggerType = selectedNode.data.triggerType;
          const mapped = (channelsData || []).flatMap((c: any) => {
            const results: { page_id: string; page_name: string; platform: string }[] = [];
            // For comment triggers: only Facebook pages (no WhatsApp)
            if (triggerType === 'comment') {
              if (!c.whatsapp_phone_number_id && !c.instagram_account_id) {
                results.push({ page_id: c.page_id, page_name: c.page_name || c.page_id, platform: 'Facebook' });
              }
            } else {
              // For keyword/DM triggers: include ALL channel types
              if (!c.whatsapp_phone_number_id && !c.instagram_account_id) {
                results.push({ page_id: c.page_id, page_name: c.page_name || c.page_id, platform: 'Facebook Messenger' });
              }
              if (c.whatsapp_phone_number_id && c.is_whatsapp_active) {
                results.push({ page_id: c.whatsapp_phone_number_id, page_name: c.page_name || c.whatsapp_phone_number_id, platform: 'WhatsApp' });
              }
              if (c.instagram_account_id && c.is_instagram_active) {
                results.push({ page_id: c.instagram_account_id, page_name: c.page_name || c.instagram_account_id, platform: 'Instagram' });
              }
            }
            return results;
          });
          setChannels(mapped);
        } catch (err) {
          console.error('Error fetching page connections:', err);
        } finally {
          setLoadingChannels(false);
        }
      };
      fetchChannels();
    }
  }, [selectedNode?.id, selectedNode?.data.triggerType]);

  useEffect(() => {
    const pageId = selectedNode?.data.triggerPageConnectionId;
    if (selectedNode?.type === 'trigger' && selectedNode.data.triggerType === 'comment' && pageId) {
      const fetchPosts = async () => {
        try {
          setLoadingPosts(true);
          const res = await workerGet<{ posts?: Array<{ id: string; message: string }> }>(`/api/page-posts/${pageId}`);
          setPosts(res.posts || []);
        } catch (err) {
          console.error('Error fetching posts:', err);
          setPosts([]);
        } finally {
          setLoadingPosts(false);
        }
      };
      fetchPosts();
    } else {
      setPosts([]);
    }
  }, [selectedNode?.id, selectedNode?.data.triggerPageConnectionId]);

  if (!selectedNode) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '24px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
        }}
      >
        <HelpCircle size={32} style={{ opacity: 0.5, marginBottom: '12px' }} />
        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>No Block Selected</div>
        <p style={{ fontSize: '11px', marginTop: '4px', lineHeight: '1.5' }}>
          Click on any block to configure it here. Right-click a block for more options.
        </p>
      </div>
    );
  }

  const { id, type, data } = selectedNode;
  const update = (patch: Partial<FlowNodeData>) => onUpdateNodeData(id, patch);

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <h3 style={{ fontSize: '15px', fontWeight: 'bold', margin: 0, textTransform: 'capitalize' }}>
          {type.replace(/_/g, ' ')} Options
        </h3>
        <button
          className="btn-ghost btn-icon"
          style={{ color: 'var(--error)' }}
          onClick={() => onDeleteNode(id)}
          title="Delete Block"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* ─── TRIGGER ──────────────────────────────────────────────────────── */}
      {type === 'trigger' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>TRIGGER TYPE</label>
            <select
              value={data.triggerType ?? 'keyword'}
              onChange={e => update({ triggerType: e.target.value as any })}
              style={inputStyle}
            >
              <option value="keyword">Keyword (DM / Chat)</option>
              <option value="comment">Post Comment</option>
            </select>
          </div>

          {data.triggerType === 'keyword' && (
            <>
              <div>
                <label style={labelStyle}>SELECT SOCIAL CHANNEL / PAGE</label>
                {loadingChannels ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Loader2 size={12} className="animate-spin" /> Fetching pages...
                  </div>
                ) : (
                  <select
                    value={data.triggerPageConnectionId ?? ''}
                    onChange={e => update({ triggerPageConnectionId: e.target.value })}
                    style={inputStyle}
                  >
                    <option value="">-- Choose Connected Channel --</option>
                    {channels.map(c => (
                      <option key={`${c.platform}-${c.page_id}`} value={c.page_id}>[{c.platform}] {c.page_name}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label style={labelStyle}>KEYWORDS (one per line)</label>
                <textarea
                  rows={4}
                  placeholder={'price\ninfo\nhello'}
                  value={(data.triggerKeywords ?? []).join('\n')}
                  onChange={e =>
                    update({
                      triggerKeywords: e.target.value
                        .split('\n')
                        .map(k => k.trim())
                        .filter(Boolean),
                    })
                  }
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace' }}
                />
                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  When a user sends any of these keywords, this flow will start.
                </p>
              </div>
              <div>
                <label style={labelStyle}>MATCH TYPE</label>
                <select
                  value={data.triggerMatchType === 'any' ? 'contains' : (data.triggerMatchType ?? 'contains')}
                  onChange={e => update({ triggerMatchType: e.target.value as any })}
                  style={inputStyle}
                >
                  <option value="contains">Contains keyword anywhere</option>
                  <option value="exact">Exact match only</option>
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="trigger-case"
                  checked={data.triggerCaseSensitive ?? false}
                  onChange={e => update({ triggerCaseSensitive: e.target.checked })}
                  style={{ accentColor: 'var(--accent-primary)', width: '15px', height: '15px' }}
                />
                <label htmlFor="trigger-case" style={{ fontSize: '12px', cursor: 'pointer' }}>
                  Case-sensitive matching
                </label>
              </div>
            </>
          )}

          {data.triggerType === 'comment' && (
            <>
              <div>
                <label style={labelStyle}>SELECT SOCIAL CHANNEL / PAGE</label>
                {loadingChannels ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <Loader2 size={12} className="animate-spin" /> Fetching pages...
                  </div>
                ) : (
                  <select
                    value={data.triggerPageConnectionId ?? ''}
                    onChange={e => update({ 
                      triggerPageConnectionId: e.target.value,
                      triggerPostId: '',
                      triggerApplyToPostType: 'global'
                    })}
                    style={inputStyle}
                  >
                    <option value="">-- Choose Connected Page --</option>
                    {channels.map(c => (
                      <option key={`${c.platform}-${c.page_id}`} value={c.page_id}>[{c.platform}] {c.page_name}</option>
                    ))}
                  </select>
                )}
              </div>

              {data.triggerPageConnectionId && (
                <>
                  <div>
                    <label style={labelStyle}>RULE SCOPE</label>
                    <select
                      value={data.triggerApplyToPostType ?? 'global'}
                      onChange={e => update({ triggerApplyToPostType: e.target.value as any, triggerPostId: '' })}
                      style={inputStyle}
                    >
                      <option value="global">Apply to All Posts on Page (Global)</option>
                      <option value="specific">Apply to a Specific Post</option>
                    </select>
                  </div>

                  {data.triggerApplyToPostType === 'specific' && (
                    <div>
                      <label style={labelStyle}>SELECT TARGET POST</label>
                      {loadingPosts ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          <Loader2 size={12} className="animate-spin" /> Fetching posts...
                        </div>
                      ) : posts.length === 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          No recent posts found.
                        </div>
                      ) : (
                        <select
                          value={data.triggerPostId ?? ''}
                          onChange={e => update({ triggerPostId: e.target.value })}
                          style={inputStyle}
                        >
                          <option value="">-- Choose a Post --</option>
                          {posts.map(post => (
                            <option key={post.id} value={post.id}>
                              {post.message.substring(0, 60)}{post.message.length > 60 ? '...' : ''}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}
                </>
              )}

              <div>
                <label style={labelStyle}>COMMENT TRIGGER TYPE</label>
                <select
                  value={data.triggerCommentType ?? 'all'}
                  onChange={e => update({ triggerCommentType: e.target.value as any })}
                  style={inputStyle}
                >
                  <option value="all">Any comment on post</option>
                  <option value="keywords">Comments containing keywords</option>
                </select>
              </div>
              {data.triggerCommentType === 'keywords' && (
                <div>
                  <label style={labelStyle}>KEYWORDS (one per line)</label>
                  <textarea
                    rows={4}
                    placeholder={'buy\ndiscount\noffer'}
                    value={(data.triggerKeywords ?? []).join('\n')}
                    onChange={e =>
                      update({
                        triggerKeywords: e.target.value
                          .split('\n')
                          .map(k => k.trim())
                          .filter(Boolean),
                      })
                    }
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace' }}
                  />
                </div>
              )}
              <div>
                <label style={labelStyle}>AUTO-REPLY TEMPLATES (one per line – rotated randomly)</label>
                <textarea
                  rows={4}
                  placeholder={'Thanks! Check your DM\nWe just sent you a message!'}
                  value={(data.triggerReplyTemplates ?? []).join('\n')}
                  onChange={e =>
                    update({
                      triggerReplyTemplates: e.target.value
                        .split('\n')
                        .map(t => t.trim())
                        .filter(Boolean),
                    })
                  }
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  These are posted as a public comment reply before the DM flow starts.
                </p>
              </div>
            </>
          )}

          <div
            style={{
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.2)',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '11px',
              lineHeight: '1.5',
              color: 'var(--text-secondary)',
            }}
          >
            💡 <strong>Save Flow</strong> to sync these trigger settings with the keyword/comment rules database.
          </div>
        </div>
      )}

      {/* ─── MESSAGE ──────────────────────────────────────────────────────── */}
      {type === 'message' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>MESSAGE CONTENT</label>
            <textarea
              value={data.text ?? ''}
              onChange={e => update({ text: e.target.value })}
              rows={5}
              placeholder="Type the message that will be sent..."
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>
          <div>
            <label style={labelStyle}>ATTACH IMAGE/MEDIA (OPTIONAL)</label>
            <AssetSelector
              selectedUrl={data.mediaUrl}
              onSelect={(url, mediaType) =>
                update({ mediaUrl: url || undefined, mediaType: mediaType as any })
              }
            />
            {data.mediaUrl && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1,
                  }}
                >
                  {data.mediaUrl}
                </span>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => update({ mediaUrl: undefined, mediaType: undefined })}
                  style={{ fontSize: '10px', color: 'var(--error)', padding: '2px 6px' }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── INTERACTIVE ──────────────────────────────────────────────────── */}
      {type === 'interactive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>BODY TEXT</label>
            <textarea
              value={data.text ?? ''}
              onChange={e => update({ text: e.target.value })}
              rows={3}
              placeholder="Question or description text..."
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>
          <div>
            <label style={labelStyle}>HEADER IMAGE (OPTIONAL)</label>
            <AssetSelector
              selectedUrl={data.mediaUrl}
              onSelect={(url, mediaType) =>
                update({ mediaUrl: url || undefined, mediaType: mediaType as any })
              }
            />
            {data.mediaUrl && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-secondary)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {data.mediaUrl}
                </span>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => update({ mediaUrl: undefined, mediaType: undefined })}
                  style={{ fontSize: '10px', color: 'var(--error)', padding: '2px 6px' }}
                >
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Messenger Buttons */}
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}
            >
              <label style={{ ...labelStyle, marginBottom: 0 }}>MESSENGER BUTTONS (MAX 3)</label>
              {(data.buttons ?? []).length < 3 && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: '2px 6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                  onClick={() => {
                    const btns = [...(data.buttons ?? [])];
                    btns.push({
                      type: 'postback',
                      title: `Option ${btns.length + 1}`,
                      payload: `option_${btns.length + 1}`,
                    });
                    update({ buttons: btns });
                  }}
                >
                  <Plus size={10} /> Add
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(data.buttons ?? []).map((btn, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-primary)',
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                    <input
                      type="text"
                      value={btn.title}
                      placeholder="Button text"
                      onChange={e => {
                        const btns = [...(data.buttons ?? [])];
                        const val = e.target.value;
                        btns[idx] = { 
                          ...btns[idx], 
                          title: val,
                          payload: btns[idx].type === 'postback' ? slugify(val) : btns[idx].payload 
                        };
                        update({ buttons: btns });
                      }}
                      style={{
                        flex: 1,
                        padding: '4px 6px',
                        fontSize: '11px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-primary)',
                        color: '#fff',
                        borderRadius: '3px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const btns = (data.buttons ?? []).filter((_, i) => i !== idx);
                        update({ buttons: btns });
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--error)',
                        cursor: 'pointer',
                      }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <select
                    value={btn.type}
                    onChange={e => {
                      const btns = [...(data.buttons ?? [])];
                      const newType = e.target.value as any;
                      btns[idx] = { 
                        ...btns[idx], 
                        type: newType,
                        payload: newType === 'postback' ? slugify(btns[idx].title) : ''
                      };
                      update({ buttons: btns });
                    }}
                    style={{
                      width: '100%',
                      padding: '4px 6px',
                      fontSize: '10px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-primary)',
                      color: '#fff',
                      borderRadius: '3px',
                      marginBottom: '4px',
                    }}
                  >
                    <option value="postback">Postback (Next step link)</option>
                    <option value="web_url">Open Web URL</option>
                    <option value="phone_number">Call Phone Number</option>
                  </select>
                  {btn.type === 'web_url' && (
                    <input
                      type="text"
                      value={btn.url ?? ''}
                      placeholder="https://example.com"
                      onChange={e => {
                        const btns = [...(data.buttons ?? [])];
                        btns[idx] = { ...btns[idx], url: e.target.value };
                        update({ buttons: btns });
                      }}
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        fontSize: '10px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-primary)',
                        color: '#fff',
                        borderRadius: '3px',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                  {btn.type === 'phone_number' && (
                    <input
                      type="text"
                      value={btn.payload ?? ''}
                      placeholder="Phone number (e.g. +1234567890)"
                      onChange={e => {
                        const btns = [...(data.buttons ?? [])];
                        btns[idx] = { ...btns[idx], payload: e.target.value };
                        update({ buttons: btns });
                      }}
                      style={{
                        width: '100%',
                        padding: '4px 6px',
                        fontSize: '10px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-primary)',
                        color: '#fff',
                        borderRadius: '3px',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* WhatsApp Type & Buttons */}
          <div>
            <label style={labelStyle}>WHATSAPP TYPE</label>
            <select
              value={data.whatsappType ?? 'button'}
              onChange={e => update({ whatsappType: e.target.value as any })}
              style={inputStyle}
            >
              <option value="button">Quick Reply Buttons (max 3)</option>
              <option value="list">List Menu (up to 10 items)</option>
            </select>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                WHATSAPP BUTTONS (MAX {data.whatsappType === 'list' ? '10' : '3'})
              </label>
              {(data.whatsappButtons ?? []).length < (data.whatsappType === 'list' ? 10 : 3) && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ padding: '2px 6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px' }}
                  onClick={() => {
                    const btns = [...(data.whatsappButtons ?? [])];
                    btns.push({ id: `option_${btns.length + 1}`, title: `Option ${btns.length + 1}` });
                    update({ whatsappButtons: btns });
                  }}
                >
                  <Plus size={10} /> Add
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(data.whatsappButtons ?? []).map((btn, idx) => (
                <div
                  key={idx}
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)', padding: '8px', borderRadius: 'var(--radius-sm)' }}
                >
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="text"
                      value={btn.title}
                      placeholder="Label (20 chars)"
                      maxLength={20}
                      onChange={e => {
                        const btns = [...(data.whatsappButtons ?? [])];
                        const val = e.target.value;
                        btns[idx] = { 
                          ...btns[idx], 
                          title: val,
                          id: slugify(val)
                        };
                        update({ whatsappButtons: btns });
                      }}
                      style={{ flex: 1, padding: '4px 6px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: '#fff', borderRadius: '3px' }}
                    />
                    <button type="button" onClick={() => update({ whatsappButtons: (data.whatsappButtons ?? []).filter((_, i) => i !== idx) })} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
              WhatsApp button IDs link each choice to the next flow block.
            </p>
          </div>
        </div>
      )}

      {/* ─── DELAY ────────────────────────────────────────────────────────── */}
      {type === 'delay' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>WAIT DURATION (SECONDS)</label>
            <input
              type="number"
              min="1"
              max="60"
              value={data.delaySeconds ?? 3}
              onChange={e => update({ delaySeconds: parseInt(e.target.value) || 3 })}
              style={inputStyle}
            />
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
              A simulated &ldquo;typing indicator&rdquo; is shown to the user during this delay.
            </p>
          </div>
        </div>
      )}

      {/* ─── CONDITION ────────────────────────────────────────────────────── */}
      {type === 'condition' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>ATTRIBUTE / KEY</label>
            <input
              type="text"
              placeholder="e.g. user_tag or first_name"
              value={data.conditionKey ?? ''}
              onChange={e => update({ conditionKey: e.target.value })}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>OPERATOR</label>
            <select
              value={data.conditionOperator ?? 'equals'}
              onChange={e => update({ conditionOperator: e.target.value as any })}
              style={inputStyle}
            >
              <option value="equals">Equals</option>
              <option value="contains">Contains</option>
              <option value="exists">Exists (Has any value)</option>
            </select>
          </div>
          {data.conditionOperator !== 'exists' && (
            <div>
              <label style={labelStyle}>MATCHING VALUE</label>
              <input
                type="text"
                placeholder="e.g. vip"
                value={data.conditionValue ?? ''}
                onChange={e => update({ conditionValue: e.target.value })}
                style={inputStyle}
              />
            </div>
          )}
        </div>
      )}

      {/* ─── ACTION ───────────────────────────────────────────────────────── */}
      {type === 'action' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>ACTION TYPE</label>
            <select
              value={data.actionType ?? 'add_tag'}
              onChange={e => {
                const t = e.target.value as any;
                update({
                  actionType: t,
                  actionParams:
                    t === 'set_attribute'
                      ? { key: 'attribute', value: '' }
                      : { tag: '' },
                });
              }}
              style={inputStyle}
            >
              <option value="add_tag">Add Tag</option>
              <option value="remove_tag">Remove Tag</option>
              <option value="set_attribute">Set Custom Attribute</option>
              <option value="pause_bot">Pause AI Chatbot</option>
              <option value="resume_bot">Resume AI Chatbot</option>
            </select>
          </div>
          {data.actionType === 'set_attribute' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input
                type="text"
                placeholder="Key"
                value={data.actionParams?.key ?? ''}
                onChange={e =>
                  update({ actionParams: { ...data.actionParams, key: e.target.value } })
                }
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="Value"
                value={data.actionParams?.value ?? ''}
                onChange={e =>
                  update({ actionParams: { ...data.actionParams, value: e.target.value } })
                }
                style={inputStyle}
              />
            </div>
          )}
          {(data.actionType === 'add_tag' || data.actionType === 'remove_tag') && (
            <div>
              <label style={labelStyle}>TAG NAME</label>
              <input
                type="text"
                placeholder="e.g. lead_qualified"
                value={data.actionParams?.tag ?? ''}
                onChange={e => update({ actionParams: { tag: e.target.value } })}
                style={inputStyle}
              />
            </div>
          )}
        </div>
      )}

      {/* ─── AI ROUTE ─────────────────────────────────────────────────────── */}
      {type === 'ai_route' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.85 }}>
          <AlertCircle size={28} color="#f43f5e" />
          <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
            This block exits the sequence flow and hands conversational control back to your standard AI chatbot agent.
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Note: If you don&apos;t connect a block to anything, it will automatically complete and resume standard chatbot control by default.
          </div>
        </div>
      )}

      {/* ─── CAPTURE INPUT ────────────────────────────────────────────────── */}
      {type === 'capture_input' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>VARIABLE KEY (AUTO-SAVES TO USER PROFILE)</label>
            <input
              type="text"
              placeholder="e.g. email or whatsapp_num"
              value={data.captureKey ?? ''}
              onChange={e =>
                update({ captureKey: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })
              }
              style={inputStyle}
            />
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Lowercase letters, numbers, and underscores only.
            </p>
          </div>
          <div>
            <label style={labelStyle}>VALIDATION TYPE</label>
            <select
              value={data.captureType ?? 'text'}
              onChange={e => update({ captureType: e.target.value as any })}
              style={inputStyle}
            >
              <option value="text">Any Text (No Validation)</option>
              <option value="email">Email Address</option>
              <option value="phone">Phone Number</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>QUESTION PROMPT TEXT</label>
            <textarea
              value={data.text ?? ''}
              onChange={e => update({ text: e.target.value })}
              rows={3}
              placeholder="e.g. Please reply with your email address:"
              style={{ ...inputStyle, resize: 'none' }}
            />
          </div>
          <div>
            <label style={labelStyle}>VALIDATION ERROR MESSAGE</label>
            <input
              type="text"
              placeholder="e.g. That doesn't look valid. Please try again:"
              value={data.validationErrorMessage ?? ''}
              onChange={e => update({ validationErrorMessage: e.target.value })}
              style={inputStyle}
            />
          </div>
        </div>
      )}

      {/* ─── LEAD WEBHOOK ─────────────────────────────────────────────────── */}
      {type === 'lead_webhook' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>ZAPIER / MAKE / CUSTOM WEBHOOK URL</label>
            <input
              type="url"
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              value={data.webhookUrl ?? ''}
              onChange={e => update({ webhookUrl: e.target.value })}
              style={inputStyle}
            />
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
              When a lead reaches this block, the engine will POST a JSON payload (name, platform, phone, email, choices) directly to this webhook.
            </p>
          </div>
        </div>
      )}

      {/* ─── RANDOMIZER ───────────────────────────────────────────────────── */}
      {type === 'randomizer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', opacity: 0.85 }}>
          <Shuffle size={28} color="#ec4899" />
          <div style={{ fontSize: '12px', lineHeight: '1.5' }}>
            This block splits your audience randomly in a 50/50 ratio. Half the users flow down <strong>Path A</strong>, and half flow down <strong>Path B</strong>.
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
            Use this to A/B test different marketing copy, offers, or sequences to see which converts better.
          </div>
        </div>
      )}

      {/* ─── GOTO FLOW ────────────────────────────────────────────────────── */}
      {type === 'goto_flow' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>SELECT TARGET FLOW</label>
            <select
              value={data.targetFlowId ?? ''}
              onChange={e => update({ targetFlowId: e.target.value })}
              style={inputStyle}
            >
              <option value="">-- Select Target Flow --</option>
              {otherFlows
                .filter(f => f.id !== flowId)
                .map(f => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '6px', lineHeight: '1.4' }}>
              Transitions execution instantly from this block into the selected flow&apos;s starting block.
            </p>
          </div>
        </div>
      )}

      {/* ─── AI AGENT ─────────────────────────────────────────────────────── */}
      {type === 'ai_agent' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>AI AGENT SYSTEM INSTRUCTIONS</label>
            <textarea
              value={data.promptInstructions ?? ''}
              onChange={e => update({ promptInstructions: e.target.value })}
              rows={6}
              placeholder="e.g. You are a helpful sales assistant talking to {{name}}. Pitch the service and keep responses brief."
              style={{ ...inputStyle, resize: 'none' }}
            />
            <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: '1.4' }}>
              Use template placeholders: {'{{name}}'}, {'{{phone}}'}, {'{{email}}'}, or any custom variable keys.
            </p>
          </div>
          <div>
            <label style={labelStyle}>AI MODEL ROLE</label>
            <select
              value={data.aiModel ?? ''}
              onChange={e => update({ aiModel: e.target.value })}
              style={inputStyle}
            >
              <option value="">-- Select Model Role --</option>
              <option value="conversational" disabled={profile?.allow_chat === false}>
                Conversational Model {profile?.allow_chat === false ? ' (Blocked)' : ''}
              </option>
              <option value="agent" disabled={profile?.allow_agent === false}>
                Agent Model {profile?.allow_agent === false ? ' (Blocked)' : ''}
              </option>
              <option value="summarize" disabled={profile?.allow_summarization === false}>
                Summarization Model {profile?.allow_summarization === false ? ' (Blocked)' : ''}
              </option>
              <option value="vision" disabled={profile?.allow_vision === false}>
                Vision Model {profile?.allow_vision === false ? ' (Blocked)' : ''}
              </option>
              <option value="image_gen" disabled={profile?.allow_image_gen === false}>
                Image Generation Model {profile?.allow_image_gen === false ? ' (Blocked)' : ''}
              </option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
