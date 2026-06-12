import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';
import { workerPost, WORKER_URL } from '../lib/workerApi';
import { 
  ArrowLeft, Save, Sparkles, Plus, Trash2, X, Loader2, FileText, 
  FolderOpen, HelpCircle, Settings, BookOpen 
} from 'lucide-react';

interface Channel {
  page_id: string;
  page_name: string;
}

interface Folder {
  id: string;
  name: string;
  description: string;
  assigned_page_ids: string[];
}

interface Doc {
  id: string;
  title: string;
  original_content?: string;
  chunk_count: number;
  is_active: boolean;
  folder_id: string;
}

interface KnowledgeField {
  id: string;
  field_name: string;
  field_value: string;
  category: string;
  is_active: boolean;
  page_id: string | null;
}

interface ChatAsset {
  id: string;
  name: string;
  friendly_name: string;
  file_url: string;
  file_type: string;
}

export default function AutoModerationRuleEditPage() {
  const { ruleId } = useParams<{ ruleId?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Loading States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [savingDoc, setSavingDoc] = useState(false);

  // Meta Channels, Folders, Docs, Flows, Assets lists
  const [channels, setChannels] = useState<Channel[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [knowledgeFields, setKnowledgeFields] = useState<KnowledgeField[]>([]);
  const [flows, setFlows] = useState<{ id: string; name: string; is_active: boolean }[]>([]);
  const [chatAssets, setChatAssets] = useState<ChatAsset[]>([]);
  const [posts, setPosts] = useState<{ id: string; message: string; created_time: string; picture: string | null }[]>([]);

  // Config States (Form Values)
  const [selectedChannel, setSelectedChannel] = useState('');
  const [triggerType, setTriggerType] = useState('keywords');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [sentimentTarget, setSentimentTarget] = useState('negative');
  const [aiCustomCriteria, setAiCustomCriteria] = useState('');
  const [useDynamicAiReply, setUseDynamicAiReply] = useState(false);
  const [aiCommentInstruction, setAiCommentInstruction] = useState('');
  const [selectedActions, setSelectedActions] = useState<string[]>(['like']);
  const [replyInput, setReplyInput] = useState('');
  const [dmReplyInput, setDmReplyInput] = useState('');
  const [responseType, setResponseType] = useState<'text' | 'flow'>('text');
  const [selectedDmFlowId, setSelectedDmFlowId] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const [selectedDmAttachments, setSelectedDmAttachments] = useState<string[]>([]);
  const [applyToPostType, setApplyToPostType] = useState('global');
  const [selectedPostId, setSelectedPostId] = useState('');
  const [aiFolderOverrides, setAiFolderOverrides] = useState<string[] | null>(null);
  const [mustBeFollower, setMustBeFollower] = useState(false);

  // Document inline editor temporary text
  const [docTempContent, setDocTempContent] = useState('');

  // Inline Quick Answer Row Editor states
  const [editingFactId, setEditingFactId] = useState<string | null>(null);
  const [factTempName, setFactTempName] = useState('');
  const [factTempValue, setFactTempValue] = useState('');
  const [factTempCategory, setFactTempCategory] = useState('general');

  // Inline new Quick Answer field states
  const [showNewFactRow, setShowNewFactRow] = useState(false);
  const [newFactName, setNewFactName] = useState('');
  const [newFactValue, setNewFactValue] = useState('');
  const [newFactCategory, setNewFactCategory] = useState('general');

  // Load baseline rules, folders, fields, etc.
  useEffect(() => {
    if (user) {
      loadBaselines();
    }
  }, [user, ruleId]);

  async function loadBaselines() {
    try {
      setLoading(true);

      // Fetch active connected channels (Pages)
      const { data: channelsData } = await supabase
        .from('page_connections')
        .select('page_id, page_name, whatsapp_phone_number_id')
        .eq('user_id', user?.id);
      const filteredChannels = (channelsData || [])
        .filter((c: any) => !c.whatsapp_phone_number_id)
        .map((c: any) => ({ page_id: c.page_id, page_name: c.page_name }));
      setChannels(filteredChannels);

      // Fetch folders
      const { data: foldersData } = await supabase
        .from('document_folders')
        .select('*')
        .eq('user_id', user?.id);
      
      // Fetch Assignments
      const { data: assignmentsData } = await supabase
        .from('folder_page_assignments')
        .select('folder_id, page_id')
        .eq('user_id', user?.id);
      
      const combinedFolders = (foldersData || []).map(f => ({
        ...f,
        assigned_page_ids: (assignmentsData || []).filter(a => a.folder_id === f.id).map(a => a.page_id)
      }));
      setFolders(combinedFolders);

      // Fetch docs
      const { data: docsData } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user?.id);
      setDocs(docsData || []);

      // Fetch knowledge fields
      const { data: fieldsData } = await supabase
        .from('knowledge_fields')
        .select('*')
        .eq('user_id', user?.id);
      setKnowledgeFields(fieldsData || []);

      // Fetch DM Flows
      const { data: flowsData } = await supabase
        .from('dm_flows')
        .select('id, name, is_active')
        .eq('user_id', user?.id);
      setFlows(flowsData || []);

      // Fetch Media Assets
      const { data: assetsData } = await supabase
        .from('media')
        .select('id, name, friendly_name, file_url, file_type')
        .eq('user_id', user?.id);
      setChatAssets(assetsData || []);

      // If editing, load the specific rule details
      if (ruleId) {
        const { data: rule, error } = await supabase
          .from('comment_rules')
          .select('*')
          .eq('id', ruleId)
          .single();

        if (error) throw error;

        if (rule) {
          setSelectedChannel(rule.page_connection_id || '');
          setTriggerType(rule.trigger_type);
          setKeywords(rule.keywords || []);
          setSentimentTarget(rule.sentiment_target || 'negative');
          setAiCustomCriteria(rule.ai_custom_criteria || '');
          setUseDynamicAiReply(rule.use_dynamic_ai_reply || false);
          setAiCommentInstruction(rule.ai_comment_instruction || '');
          setSelectedActions(rule.action_to_take.split(','));
          setReplyInput(rule.reply_templates?.[0] || '');
          setDmReplyInput(rule.dm_reply_templates?.[0] || '');
          setResponseType(rule.dm_flow_id ? 'flow' : 'text');
          setSelectedDmFlowId(rule.dm_flow_id || '');
          setSelectedAttachments(rule.attachment_urls || []);
          setSelectedDmAttachments(rule.dm_attachment_urls || []);
          setApplyToPostType(rule.post_id ? 'specific' : 'global');
          setSelectedPostId(rule.post_id || '');
          setAiFolderOverrides(rule.ai_folder_overrides || null);
          setMustBeFollower(rule.must_be_follower || false);

          if (rule.page_connection_id) {
            fetchPagePosts(rule.page_connection_id);
          }
        }
      }
    } catch (err: any) {
      toast.error('Error loading metadata: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchPagePosts(pageId: string) {
    if (!pageId) return;
    try {
      setLoadingPosts(true);
      const sessionRes = await supabase.auth.getSession();
      const token = sessionRes.data.session?.access_token || '';
      
      const response = await fetch(`${WORKER_URL}/api/page-posts/${pageId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch posts');
      const data = await response.json() as any;
      setPosts(data.posts || []);
    } catch (err: any) {
      console.error('Error fetching page posts:', err);
      setPosts([]);
    } finally {
      setLoadingPosts(false);
    }
  }

  // Active knowledge folders (assigned to this page OR overridden by this rule)
  const activeFolders = useMemo(() => {
    if (!selectedChannel) return [];
    return folders.filter(f => {
      if (aiFolderOverrides) {
        return aiFolderOverrides.includes(f.id);
      }
      return f.assigned_page_ids.includes(selectedChannel);
    });
  }, [folders, selectedChannel, aiFolderOverrides]);


  // Quick Answers filtered for the selected page and global ones
  const activeQuickAnswers = useMemo(() => {
    return knowledgeFields.filter(kf => {
      return kf.page_id === selectedChannel || kf.page_id === null;
    });
  }, [knowledgeFields, selectedChannel]);

  // Handle toggling folder overrides
  function handleToggleFolderOverride(folderId: string) {
    if (!aiFolderOverrides) {
      // Initialize with currently active folders except/including the toggled one
      const currentAssigned = folders
        .filter(f => f.assigned_page_ids.includes(selectedChannel))
        .map(f => f.id);
      if (currentAssigned.includes(folderId)) {
        setAiFolderOverrides(currentAssigned.filter(id => id !== folderId));
      } else {
        setAiFolderOverrides([...currentAssigned, folderId]);
      }
    } else {
      if (aiFolderOverrides.includes(folderId)) {
        const next = aiFolderOverrides.filter(id => id !== folderId);
        setAiFolderOverrides(next.length === 0 ? [] : next);
      } else {
        setAiFolderOverrides([...aiFolderOverrides, folderId]);
      }
    }
  }

  // Handle resetting folder override to inherit page default
  function handleResetFolderOverrides() {
    setAiFolderOverrides(null);
    toast.info('Rule-level folders reset to inherit page defaults.');
  }

  // Handle inline doc save
  async function handleSaveDocumentText(docId: string) {
    if (!user) return;
    try {
      setSavingDoc(true);
      const { error } = await supabase
        .from('documents')
        .update({ original_content: docTempContent })
        .eq('id', docId);

      if (error) throw error;

      // Trigger embedding re-processing on local worker
      try {
        await workerPost('/api/documents/process', {
          documentId: docId,
          userId: user.id,
        });
      } catch (err: any) {
        toast.warning('Document content saved, but embedding regeneration failed: ' + err.message);
      }

      // Refresh docs state
      const { data: docsData } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', user.id);
      setDocs(docsData || []);

      toast.success('Document updated and embedded successfully.');
      setEditingDocId(null);
    } catch (err: any) {
      toast.error('Failed to update document: ' + err.message);
    } finally {
      setSavingDoc(false);
    }
  }

  // Handle inline Quick Answer Save
  async function handleSaveFact(factId: string) {
    try {
      const { error } = await supabase
        .from('knowledge_fields')
        .update({
          field_name: factTempName.trim(),
          field_value: factTempValue.trim(),
          category: factTempCategory
        })
        .eq('id', factId);

      if (error) throw error;

      // Update local state
      setKnowledgeFields(prev => prev.map(f => {
        if (f.id === factId) {
          return { ...f, field_name: factTempName, field_value: factTempValue, category: factTempCategory };
        }
        return f;
      }));

      toast.success('Fact updated.');
      setEditingFactId(null);
    } catch (err: any) {
      toast.error('Failed to update fact: ' + err.message);
    }
  }

  // Handle inline Quick Answer Delete
  async function handleDeleteFact(factId: string) {
    if (!confirm('Are you sure you want to delete this Quick Answer?')) return;
    try {
      const { error } = await supabase
        .from('knowledge_fields')
        .delete()
        .eq('id', factId);

      if (error) throw error;

      setKnowledgeFields(prev => prev.filter(f => f.id !== factId));
      toast.success('Fact deleted.');
    } catch (err: any) {
      toast.error('Failed to delete fact: ' + err.message);
    }
  }

  // Handle adding new Quick Answer inline
  async function handleCreateNewFact() {
    if (!newFactName.trim() || !newFactValue.trim() || !user) {
      toast.error('Please fill in both field name and value.');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('knowledge_fields')
        .insert({
          user_id: user.id,
          page_id: selectedChannel || null,
          field_name: newFactName.trim(),
          field_value: newFactValue.trim(),
          category: newFactCategory,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setKnowledgeFields(prev => [...prev, data]);
        toast.success(`Quick Answer "${newFactName}" added.`);
        setNewFactName('');
        setNewFactValue('');
        setShowNewFactRow(false);
      }
    } catch (err: any) {
      toast.error('Failed to add fact: ' + err.message);
    }
  }

  // Create or update the complete Trigger Rule
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      let finalKeywords = [...keywords];
      if (keywordsInput.trim()) {
        const word = keywordsInput.trim();
        if (!finalKeywords.includes(word)) {
          finalKeywords.push(word);
        }
      }

      if (triggerType === 'keywords' && finalKeywords.length === 0) {
        throw new Error('Please specify at least one keyword.');
      }

      if (triggerType === 'ai_custom' && !aiCustomCriteria.trim()) {
        throw new Error('Please specify the custom AI trigger criteria.');
      }

      if (selectedActions.length === 0) {
        throw new Error('Please select at least one action.');
      }

      const rulePayload = {
        user_id: user.id,
        page_connection_id: selectedChannel || null,
        trigger_type: triggerType,
        keywords: triggerType === 'keywords' ? finalKeywords : null,
        sentiment_target: triggerType === 'ai_sentiment' ? sentimentTarget : null,
        ai_custom_criteria: triggerType === 'ai_custom' ? aiCustomCriteria.trim() : null,
        use_dynamic_ai_reply: selectedActions.includes('reply') ? useDynamicAiReply : false,
        ai_comment_instruction: selectedActions.includes('reply') && useDynamicAiReply ? aiCommentInstruction.trim() : null,
        action_to_take: selectedActions.join(','),
        reply_templates: selectedActions.includes('reply') && !useDynamicAiReply && replyInput.trim() ? [replyInput.trim()] : null,
        dm_reply_templates: selectedActions.includes('dm') && responseType === 'text' && dmReplyInput.trim() ? [dmReplyInput.trim()] : null,
        attachment_urls: selectedActions.includes('reply') && selectedAttachments.length > 0 ? selectedAttachments : null,
        dm_attachment_urls: selectedActions.includes('dm') && responseType === 'text' && selectedDmAttachments.length > 0 ? selectedDmAttachments : null,
        dm_flow_id: selectedActions.includes('dm') && responseType === 'flow' ? selectedDmFlowId || null : null,
        post_id: applyToPostType === 'specific' && selectedPostId ? selectedPostId : null,
        ai_folder_overrides: useDynamicAiReply ? aiFolderOverrides : null,
        must_be_follower: mustBeFollower,
      };

      if (ruleId) {
        const { error } = await supabase
          .from('comment_rules')
          .update(rulePayload)
          .eq('id', ruleId);
        if (error) throw error;
        toast.success('Moderation rule updated successfully!');
      } else {
        const { error } = await supabase
          .from('comment_rules')
          .insert({ ...rulePayload, is_active: true });
        if (error) throw error;
        toast.success('Moderation rule connected successfully!');
      }

      navigate('/moderation');
    } catch (err: any) {
      toast.error('Failed to save rule: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '12px', color: 'var(--text-secondary)' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
        <span>Loading RAG Studio details...</span>
      </div>
    );
  }

  return (
    <div className="animate-slideUp" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button className="btn-ghost btn-icon" onClick={() => navigate('/moderation')} title="Back to Rules">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.6rem' }}>
            {ruleId ? 'Edit Trigger Rule' : 'Connect Trigger Rule'}
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Set up automatic actions and configure real-time context models.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: useDynamicAiReply ? '1.1fr 1fr' : '1fr', gap: '30px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Configuration Form */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '24px' }}>
          
          <div className="form-group">
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings size={15} style={{ color: 'var(--primary)' }} />
              Select Social Channel
            </label>
            <select className="form-input" value={selectedChannel} onChange={e => {
              const val = e.target.value;
              setSelectedChannel(val);
              setSelectedPostId('');
              setApplyToPostType('global');
              setAiFolderOverrides(null);
              if (val) fetchPagePosts(val);
            }} required>
              <option value="">-- Choose Connected Page --</option>
              {channels.map(c => (
                <option key={c.page_id} value={c.page_id}>{c.page_name}</option>
              ))}
            </select>
          </div>

          {selectedChannel && (
            <>
              <div className="form-group animate-fadeIn">
                <label className="form-label">Rule Scope</label>
                <select className="form-input" value={applyToPostType} onChange={e => setApplyToPostType(e.target.value)}>
                  <option value="global">Apply to All Posts on Page (Global)</option>
                  <option value="specific">Apply to a Specific Post</option>
                </select>
              </div>

              {applyToPostType === 'specific' && (
                <div className="form-group animate-fadeIn">
                  <label className="form-label">Select Target Post</label>
                  {loadingPosts ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <Loader2 size={14} className="animate-spin" /> Fetching recent page posts...
                    </div>
                  ) : posts.length === 0 ? (
                    <div style={{ padding: '8px 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      No posts found on this page.
                    </div>
                  ) : (
                    <>
                      <select 
                        className="form-input" 
                        value={selectedPostId} 
                        onChange={e => setSelectedPostId(e.target.value)}
                        required={applyToPostType === 'specific'}
                      >
                        <option value="">-- Choose a Post --</option>
                        {posts.map(post => (
                          <option key={post.id} value={post.id}>
                            {post.message.substring(0, 60)}{post.message.length > 60 ? '...' : ''}
                          </option>
                        ))}
                      </select>

                      {selectedPostId && (
                        (() => {
                          const selectedPost = posts.find(p => p.id === selectedPostId);
                          if (!selectedPost) return null;
                          return (
                            <div style={{ 
                              display: 'flex', 
                              gap: '12px', 
                              background: 'var(--bg-secondary)', 
                              padding: '12px', 
                              borderRadius: '8px', 
                              marginTop: '8px', 
                              border: '1px solid var(--border-primary)',
                              alignItems: 'center'
                            }}>
                              {selectedPost.picture && (
                                <img 
                                  src={selectedPost.picture} 
                                  alt="Post thumbnail" 
                                  style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px' }} 
                                />
                              )}
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', flex: 1 }}>
                                <div style={{ fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>Selected Post Preview:</div>
                                "{selectedPost.message.substring(0, 100)}{selectedPost.message.length > 100 ? '...' : ''}"
                              </div>
                            </div>
                          );
                        })()
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          <div className="form-group">
            <label className="form-label">Trigger Event Type</label>
            <select className="form-input" value={triggerType} onChange={e => setTriggerType(e.target.value)} required>
              <option value="keywords">Keyword Match</option>
              <option value="ai_sentiment">AI Sentiment Analysis</option>
              <option value="ai_custom">Custom AI Trigger (Natural Language)</option>
              <option value="all">All Comments</option>
            </select>
          </div>

          {triggerType === 'keywords' && (
            <div className="form-group animate-fadeIn">
              <label className="form-label">Trigger Keywords (Type and press comma or Enter)</label>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '8px 12px',
                background: 'var(--bg-secondary)',
                border: '1.5px solid var(--border-primary)',
                borderRadius: '8px',
                minHeight: '42px',
                alignItems: 'center',
                cursor: 'text'
              }} onClick={() => document.getElementById('keyword-tag-input')?.focus()}>
                {keywords.map((kw, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'var(--bg-primary)',
                    border: '1.5px solid var(--accent-primary)',
                    borderRadius: '6px',
                    padding: '2px 8px',
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: 'var(--text-primary)'
                  }}>
                    <span>{kw}</span>
                    <button 
                      type="button" 
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                      onClick={(e) => { e.stopPropagation(); setKeywords(keywords.filter((_, i) => i !== idx)); }}
                    >
                      <X size={14} color="var(--text-secondary)" />
                    </button>
                  </div>
                ))}
                <input 
                  id="keyword-tag-input"
                  type="text"
                  placeholder={keywords.length === 0 ? "e.g. price, cost, buy" : ""}
                  value={keywordsInput}
                  onChange={e => {
                    const val = e.target.value;
                    if (val.endsWith(',')) {
                      const word = val.slice(0, -1).trim();
                      if (word && !keywords.includes(word)) {
                        setKeywords([...keywords, word]);
                      }
                      setKeywordsInput('');
                    } else {
                      setKeywordsInput(val);
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const word = keywordsInput.trim();
                      if (word && !keywords.includes(word)) {
                        setKeywords([...keywords, word]);
                      }
                      setKeywordsInput('');
                    } else if (e.key === 'Backspace' && !keywordsInput && keywords.length > 0) {
                      setKeywords(keywords.slice(0, -1));
                    }
                  }}
                  style={{
                    flex: 1,
                    minWidth: '120px',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    padding: 0,
                    fontSize: '0.9rem'
                  }}
                />
              </div>
              <span className="form-hint">Type a keyword and press Enter.</span>
            </div>
          )}

          {triggerType === 'ai_sentiment' && (
            <div className="form-group animate-fadeIn">
              <label className="form-label">Target AI Sentiment</label>
              <select className="form-input" value={sentimentTarget} onChange={e => setSentimentTarget(e.target.value)} required>
                <option value="negative">Negative</option>
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
              </select>
            </div>
          )}

          {triggerType === 'ai_custom' && (
            <div className="form-group animate-fadeIn">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <label className="form-label" style={{ margin: 0 }}>Custom AI Trigger Prompt</label>
                <span title="Define a natural language instruction for the AI. The comment triggers if the AI matches your criteria.">
                  <HelpCircle size={15} style={{ color: 'var(--text-secondary)' }} />
                </span>
              </div>
              
              <textarea 
                className="form-textarea" 
                placeholder="e.g. Comments asking about prices, rates, or buying." 
                value={aiCustomCriteria} 
                onChange={e => setAiCustomCriteria(e.target.value)} 
                required 
              />
              
              <div style={{ marginTop: '8px' }}>
                <span className="form-hint" style={{ display: 'block', marginBottom: '6px', fontSize: '0.75rem' }}>Presets:</span>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {['Pricing/Buy', 'Issues/Support', 'Availability', 'Positive/Praise'].map(preset => {
                    const values: Record<string, string> = {
                      'Pricing/Buy': "Comments asking about pricing, cost, rates, fees, or how to buy.",
                      'Issues/Support': "Comments expressing customer support issues, technical problems, or complaints.",
                      'Availability': "Comments asking if the product is in stock, where it is available, or shipping times.",
                      'Positive/Praise': "Comments containing general praise, compliments, or positive feedback."
                    };
                    return (
                      <button 
                        key={preset}
                        type="button" 
                        className="btn btn-sm btn-secondary" 
                        style={{ fontSize: '11px', padding: '2px 8px' }}
                        onClick={() => setAiCustomCriteria(values[preset])}
                      >
                        {preset}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
              <input 
                type="checkbox" 
                checked={mustBeFollower} 
                onChange={e => setMustBeFollower(e.target.checked)}
                style={{ accentColor: 'var(--primary)' }}
              />
              Must be a follower (Instagram Only)
            </label>
            <span className="form-hint" style={{ display: 'block', marginTop: '4px', marginLeft: '22px' }}>
              If enabled and the platform is Instagram, the automation only triggers if the user follows your page (requires the user to have messaged your page in the past). Facebook comments ignore this check and always trigger.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Actions to Take (Select all that apply)</label>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', 
              gap: '12px', 
              background: 'var(--bg-secondary)', 
              padding: '12px', 
              borderRadius: '8px',
              border: '1.5px solid var(--border-primary)'
            }}>
              {[
                { id: 'hide', label: 'Hide Comment' },
                { id: 'delete', label: 'Delete Comment' },
                { id: 'like', label: 'Auto-Like Comment' },
                { id: 'block', label: 'Block User on Page' },
                { id: 'reply', label: 'Public Comment Reply' },
                { id: 'dm', label: 'Private DM Handshake' },
                { id: 'trash_queue', label: 'Send to Safety Queue' },
                { id: 'ignore', label: 'Ignore Comment (Skip Automation)' },
              ].map(act => {
                const checked = selectedActions.includes(act.id);
                return (
                  <label key={act.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    fontWeight: checked ? '600' : 'normal',
                    color: checked ? 'var(--text-primary)' : 'var(--text-secondary)'
                  }}>
                    <input 
                      type="checkbox" 
                      checked={checked}
                      onChange={() => {
                        if (act.id === 'ignore') {
                          if (checked) {
                            setSelectedActions(selectedActions.filter(a => a !== 'ignore'));
                          } else {
                            setSelectedActions(['ignore']);
                            setUseDynamicAiReply(false);
                          }
                        } else {
                          if (checked) {
                            setSelectedActions(selectedActions.filter(a => a !== act.id));
                          } else {
                            setSelectedActions([...selectedActions.filter(a => a !== 'ignore'), act.id]);
                          }
                        }
                      }}
                      style={{ accentColor: 'var(--primary)' }}
                    />
                    {act.label}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Canned / Static reply forms (if reply is checked and Autopilot is OFF) */}
          {selectedActions.includes('reply') && (
            <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></span>
                Public Comment Reply Settings
              </h4>
              
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                  <input 
                    type="checkbox" 
                    checked={useDynamicAiReply} 
                    onChange={e => setUseDynamicAiReply(e.target.checked)}
                    style={{ accentColor: '#10b981' }}
                  />
                  Enable AI Autopilot Reply (Contextual AI Responses)
                </label>
                <span className="form-hint" style={{ display: 'block', marginTop: '4px', marginLeft: '22px' }}>
                  If enabled, the AI will dynamically write a contextual reply using the post caption, comment, and your business files instead of a canned template.
                </span>
              </div>

              {!useDynamicAiReply && (
                <div className="form-group animate-fadeIn" style={{ margin: 0 }}>
                  <label className="form-label">Public Reply Message Template</label>
                  <textarea className="form-textarea" placeholder="Type your public response template..." value={replyInput} onChange={e => setReplyInput(e.target.value)} required={!useDynamicAiReply} />
                </div>
              )}

              {useDynamicAiReply && (
                <div className="form-group animate-fadeIn" style={{ background: 'rgba(16,185,129,0.02)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(16,185,129,0.1)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600', color: '#10b981' }}>
                      <Sparkles size={14} /> Custom AI Commenting Behavior
                    </label>
                  </div>
                  <textarea 
                    className="form-textarea" 
                    style={{ borderColor: 'rgba(16,185,129,0.2)' }}
                    placeholder="Instructions for how the AI should reply (e.g. 'Always offer them the promo code FARM10 and tell them to check their inbox'). If blank, defaults to matching post context & brand voice." 
                    value={aiCommentInstruction} 
                    onChange={e => setAiCommentInstruction(e.target.value)} 
                  />
                  <span className="form-hint" style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '6px', display: 'block' }}>
                    This overrides page-level default guidelines. The AI will strictly follow these comment rules.
                  </span>
                </div>
              )}

              {/* Public Reply Attachments (Canned only) */}
              {!useDynamicAiReply && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Public Reply Attachments (Optional)</label>
                  <select 
                    className="form-input" 
                    value="" 
                    onChange={e => {
                      const val = e.target.value;
                      if (val && !selectedAttachments.includes(val)) {
                        setSelectedAttachments([...selectedAttachments, val]);
                      }
                    }}
                  >
                    <option value="">-- Attach a file from Chat Assets --</option>
                    {chatAssets.map(asset => (
                      <option key={asset.id} value={asset.file_url}>{asset.friendly_name} ({asset.file_type})</option>
                    ))}
                  </select>

                  {selectedAttachments.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                      {selectedAttachments.map((url, idx) => {
                        const asset = chatAssets.find(a => a.file_url === url);
                        const displayName = asset ? asset.friendly_name : url.split('/').pop() || 'File';
                        return (
                          <div key={idx} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: 'var(--bg-primary)',
                            border: '1.5px solid var(--accent-primary)',
                            borderRadius: '6px',
                            padding: '2px 8px',
                            fontSize: '0.8rem',
                            color: 'var(--text-primary)'
                          }}>
                            <span>{displayName}</span>
                            <button 
                              type="button" 
                              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                              onClick={() => setSelectedAttachments(selectedAttachments.filter((_, i) => i !== idx))}
                            >
                              <X size={12} color="var(--text-secondary)" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* DM Handshake details */}
          {selectedActions.includes('dm') && (
            <div style={{ borderTop: '1px solid var(--border-primary)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontSize: '0.95rem' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6' }}></span>
                Private DM Handshake Settings
              </h4>
              
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>Response Type</label>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="responseType"
                      value="text"
                      checked={responseType === 'text'}
                      onChange={() => setResponseType('text')}
                      style={{ accentColor: '#8b5cf6' }}
                    />
                    Send static text message
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="responseType"
                      value="flow"
                      checked={responseType === 'flow'}
                      onChange={() => setResponseType('flow')}
                      style={{ accentColor: '#8b5cf6' }}
                    />
                    Trigger a structured DM Flow
                  </label>
                </div>
              </div>

              {responseType === 'text' ? (
                <>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Private DM Message Template</label>
                    <textarea className="form-textarea" placeholder="Type your private DM template..." value={dmReplyInput} onChange={e => setDmReplyInput(e.target.value)} required={responseType === 'text'} />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Private DM Attachments (Optional)</label>
                    <select 
                      className="form-input" 
                      value="" 
                      onChange={e => {
                        const val = e.target.value;
                        if (val && !selectedDmAttachments.includes(val)) {
                          setSelectedDmAttachments([...selectedDmAttachments, val]);
                        }
                      }}
                    >
                      <option value="">-- Attach a file from Chat Assets --</option>
                      {chatAssets.map(asset => (
                        <option key={asset.id} value={asset.file_url}>{asset.friendly_name} ({asset.file_type})</option>
                      ))}
                    </select>

                    {selectedDmAttachments.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                        {selectedDmAttachments.map((url, idx) => {
                          const asset = chatAssets.find(a => a.file_url === url);
                          const displayName = asset ? asset.friendly_name : url.split('/').pop() || 'File';
                          return (
                            <div key={idx} style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: 'var(--bg-primary)',
                              border: '1.5px solid var(--accent-primary)',
                              borderRadius: '6px',
                              padding: '2px 8px',
                              fontSize: '0.8rem',
                              color: 'var(--text-primary)'
                            }}>
                              <span>{displayName}</span>
                              <button 
                                type="button" 
                                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                                onClick={() => setSelectedDmAttachments(selectedDmAttachments.filter((_, i) => i !== idx))}
                              >
                                <X size={12} color="var(--text-secondary)" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Select DM Flow</label>
                  <select
                    className="form-input"
                    value={selectedDmFlowId}
                    onChange={e => setSelectedDmFlowId(e.target.value)}
                    required={responseType === 'flow'}
                  >
                    <option value="">-- Choose an active Flow --</option>
                    {flows.map(f => (
                      <option key={f.id} value={f.id}>{f.name} {!f.is_active ? '(Inactive)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-primary)', paddingTop: '20px', marginTop: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/moderation')}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              {ruleId ? 'Save Changes' : 'Connect Rule'}
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: RAG Studio (Only displays when dynamic AI replies are checked) */}
        {useDynamicAiReply && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }} className="animate-fadeIn">
            
            {/* RAG Documents Studio Card */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                  <FolderOpen size={18} style={{ color: 'var(--primary)' }} />
                  Page Documents (RAG Context)
                </h3>
                {aiFolderOverrides && (
                  <button type="button" className="btn btn-ghost btn-xs" style={{ fontSize: '10px', color: 'var(--error)' }} onClick={handleResetFolderOverrides}>
                    Reset Override
                  </button>
                )}
              </div>
              
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 16px 0', lineHeight: '1.4' }}>
                Manage the files matching this channel. The AI dynamically vector-searches these text blocks to answer questions.
              </p>

              {/* Folder List and Toggle overrides */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {folders.map(folder => {
                  const isLinked = activeFolders.some(f => f.id === folder.id);
                  const folderDocs = docs.filter(d => d.folder_id === folder.id);
                  
                  return (
                    <div key={folder.id} style={{ 
                      border: '1px solid var(--border-primary)', 
                      borderRadius: '8px', 
                      background: isLinked ? 'rgba(var(--primary-rgb), 0.02)' : 'transparent',
                      padding: '12px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: isLinked ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                            📁 {folder.name}
                          </strong>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: '8px' }}>
                            ({folderDocs.length} files)
                          </span>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '0.75rem' }}>
                          <input 
                            type="checkbox" 
                            checked={isLinked} 
                            onChange={() => handleToggleFolderOverride(folder.id)}
                            style={{ accentColor: 'var(--primary)' }}
                          />
                          {isLinked ? 'Active RAG' : 'Ignored'}
                        </label>
                      </div>

                      {/* Doc files list with inline block text editor */}
                      {isLinked && folderDocs.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px', borderTop: '1px dashed var(--border-primary)', paddingTop: '8px' }}>
                          {folderDocs.map(doc => {
                            const isEditing = editingDocId === doc.id;
                            return (
                              <div key={doc.id} style={{ background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <FileText size={12} style={{ color: 'var(--text-secondary)' }} />
                                    {doc.title}
                                  </span>
                                  {!isEditing ? (
                                    <button 
                                      type="button" 
                                      className="btn btn-ghost btn-xs" 
                                      style={{ padding: '2px 6px', fontSize: '10px' }}
                                      onClick={() => {
                                        setEditingDocId(doc.id);
                                        setDocTempContent(doc.original_content || '');
                                      }}
                                    >
                                      Edit Block
                                    </button>
                                  ) : (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                      <button 
                                        type="button" 
                                        className="btn btn-ghost btn-xs" 
                                        style={{ color: 'var(--error)', padding: '2px 6px', fontSize: '10px' }}
                                        onClick={() => setEditingDocId(null)}
                                        disabled={savingDoc}
                                      >
                                        Cancel
                                      </button>
                                      <button 
                                        type="button" 
                                        className="btn btn-xs btn-primary" 
                                        style={{ padding: '2px 6px', fontSize: '10px' }}
                                        onClick={() => handleSaveDocumentText(doc.id)}
                                        disabled={savingDoc}
                                      >
                                        {savingDoc ? <Loader2 size={10} className="animate-spin" /> : 'Save'}
                                      </button>
                                    </div>
                                  )}
                                </div>

                                {isEditing ? (
                                  <textarea 
                                    className="form-textarea" 
                                    style={{ fontSize: '0.8rem', minHeight: '120px', background: 'var(--bg-primary)', fontFamily: 'monospace' }}
                                    value={docTempContent}
                                    onChange={e => setDocTempContent(e.target.value)}
                                  />
                                ) : (
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'pre-line', maxHeight: '60px', overflowY: 'hidden', textOverflow: 'ellipsis' }}>
                                    {doc.original_content ? doc.original_content.substring(0, 150) + (doc.original_content.length > 150 ? '...' : '') : '(Empty document)'}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Answers Facts Grid Card */}
            <div className="card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                  <BookOpen size={18} style={{ color: 'var(--primary)' }} />
                  Page Quick Answers (Facts)
                </h3>
                <button type="button" className="btn btn-secondary btn-xs" style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setShowNewFactRow(!showNewFactRow)}>
                  <Plus size={12} /> Add Fact
                </button>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', margin: '0 0 16px 0', lineHeight: '1.4' }}>
                Structured details injected into response prompts. Double-click keys or values to edit in place.
              </p>

              {/* Add New Quick Answer Row */}
              {showNewFactRow && (
                <div style={{ 
                  background: 'var(--bg-secondary)', 
                  border: '1px solid var(--border-primary)', 
                  padding: '14px', 
                  borderRadius: '8px', 
                  marginBottom: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }} className="animate-slideUp">
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ height: '36px', fontSize: '0.8rem' }}
                        placeholder="Key (e.g. Delivery fee)" 
                        value={newFactName}
                        onChange={e => setNewFactName(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        style={{ height: '36px', fontSize: '0.8rem' }}
                        placeholder="Value (e.g. 60 Taka)" 
                        value={newFactValue}
                        onChange={e => setNewFactValue(e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <select 
                      className="form-input" 
                      style={{ width: '130px', height: '32px', fontSize: '0.75rem', margin: 0 }}
                      value={newFactCategory}
                      onChange={e => setNewFactCategory(e.target.value)}
                    >
                      <option value="general">General</option>
                      <option value="pricing">Pricing</option>
                      <option value="faq">FAQ</option>
                      <option value="policies">Policies</option>
                    </select>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowNewFactRow(false)}>Cancel</button>
                      <button type="button" className="btn btn-primary btn-xs" onClick={handleCreateNewFact}>Add Row</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Table of Quick Answers */}
              {activeQuickAnswers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  No page-specific Quick Answers registered. Facts will fall back to Global ones.
                </div>
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-primary)', borderRadius: '8px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
                        <th style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: '600' }}>Key / Label</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: '600' }}>Value</th>
                        <th style={{ padding: '10px 12px', color: 'var(--text-primary)', fontWeight: '600', width: '60px' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeQuickAnswers.map(fact => {
                        const isEditing = editingFactId === fact.id;
                        return (
                          <tr key={fact.id} style={{ borderBottom: '1px solid var(--border-primary)', transition: 'background 0.2s' }} className="table-row-hover">
                            <td 
                              style={{ padding: '10px 12px', wordBreak: 'break-word', color: 'var(--text-primary)', fontWeight: '500' }}
                              onDoubleClick={() => {
                                setEditingFactId(fact.id);
                                setFactTempName(fact.field_name);
                                setFactTempValue(fact.field_value);
                                setFactTempCategory(fact.category || 'general');
                              }}
                            >
                              {isEditing ? (
                                <input 
                                  type="text" 
                                  className="form-input" 
                                  style={{ height: '30px', fontSize: '0.75rem', margin: 0 }} 
                                  value={factTempName} 
                                  onChange={e => setFactTempName(e.target.value)} 
                                />
                              ) : (
                                <span>{fact.field_name}</span>
                              )}
                            </td>
                            <td 
                              style={{ padding: '10px 12px', wordBreak: 'break-word', color: 'var(--text-secondary)' }}
                              onDoubleClick={() => {
                                setEditingFactId(fact.id);
                                setFactTempName(fact.field_name);
                                setFactTempValue(fact.field_value);
                                setFactTempCategory(fact.category || 'general');
                              }}
                            >
                              {isEditing ? (
                                <input 
                                  type="text" 
                                  className="form-input" 
                                  style={{ height: '30px', fontSize: '0.75rem', margin: 0 }} 
                                  value={factTempValue} 
                                  onChange={e => setFactTempValue(e.target.value)} 
                                />
                              ) : (
                                <span>{fact.field_value}</span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {isEditing ? (
                                  <>
                                    <button 
                                      type="button" 
                                      className="btn btn-xs btn-primary" 
                                      style={{ padding: '2px 6px', fontSize: '10px' }}
                                      onClick={() => handleSaveFact(fact.id)}
                                    >
                                      Save
                                    </button>
                                    <button 
                                      type="button" 
                                      className="btn-ghost btn-icon" 
                                      onClick={() => setEditingFactId(null)}
                                    >
                                      <X size={14} />
                                    </button>
                                  </>
                                ) : (
                                  <button 
                                    type="button" 
                                    className="btn-ghost btn-icon" 
                                    style={{ color: 'var(--error)' }}
                                    onClick={() => handleDeleteFact(fact.id)}
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

      </form>
    </div>
  );
}
