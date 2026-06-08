import { useEffect, useState, useMemo, type FormEvent } from 'react';
import { toast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { Plus, Pencil, Trash2, BookOpen, Save, X, Filter, Upload } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import HelpTooltip from '../components/HelpTooltip';

interface KnowledgeField {
  id: string;
  field_name: string;
  field_value: string;
  category: string;
  is_active: boolean;
  page_id: string | null;
}

interface GroupedField {
  field_name: string;
  field_value: string;
  category: string;
  is_active: boolean;
  page_ids: (string | null)[];
  ids: string[];
}

interface PageOption {
  page_id: string;
  page_name: string | null;
}

export default function KnowledgePage() {
  useDocumentTitle('Quick Answers — AutometaBot');
  const { user } = useAuth();
  const [fields, setFields] = useState<KnowledgeField[]>([]);
  const [pages, setPages] = useState<PageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingField, setEditingField] = useState<GroupedField | null>(null);

  // Filter state
  const [filterPageId, setFilterPageId] = useState<string>('all');

  // Form state
  const [fieldName, setFieldName] = useState('');
  const [fieldValue, setFieldValue] = useState('');
  const [selectedCategoryOption, setSelectedCategoryOption] = useState('general');
  const [customCategoryValue, setCustomCategoryValue] = useState('');
  const [assignedPageIds, setAssignedPageIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const PREDEFINED_CATEGORIES = ['general', 'pricing', 'products', 'services', 'policies', 'contact', 'shipping', 'faq'];

  // Import State
  const [importJson, setImportJson] = useState('');
  const [importPageId, setImportPageId] = useState('');
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (user) {
      loadAll();
      
      const handleAgentUpdate = () => loadAll();
      window.addEventListener('agent-data-updated', handleAgentUpdate);
      return () => window.removeEventListener('agent-data-updated', handleAgentUpdate);
    }
  }, [user]);

  async function loadAll() {
    if (!user) return;
    const [fieldsRes, pagesRes] = await Promise.all([
      supabase.from('knowledge_fields').select('*').eq('user_id', user.id).order('sort_order', { ascending: true }),
      supabase.from('page_connections').select('page_id, page_name').eq('user_id', user.id),
    ]);
    if (fieldsRes.data) setFields(fieldsRes.data);
    if (pagesRes.data) setPages(pagesRes.data);
    setLoading(false);
  }

  // Group fields on the fly
  const groupedFields = useMemo(() => {
    const groups: Record<string, GroupedField> = {};
    for (const f of fields) {
      // Group by field_name + category
      const key = `${f.field_name.toLowerCase().trim()}::${f.category.toLowerCase().trim()}`;
      if (!groups[key]) {
        groups[key] = {
          field_name: f.field_name,
          field_value: f.field_value,
          category: f.category,
          is_active: f.is_active,
          page_ids: [f.page_id],
          ids: [f.id]
        };
      } else {
        if (!groups[key].page_ids.includes(f.page_id)) {
          groups[key].page_ids.push(f.page_id);
        }
        groups[key].ids.push(f.id);
        if (f.is_active) groups[key].is_active = true;
      }
    }
    return Object.values(groups);
  }, [fields]);

  // Filter groups based on selected page
  const visibleFields = useMemo(() => {
    return groupedFields.filter((g) => {
      if (filterPageId === 'all') return true;
      if (filterPageId === 'global') return g.page_ids.includes(null);
      return g.page_ids.includes(filterPageId) || g.page_ids.includes(null);
    });
  }, [groupedFields, filterPageId]);

  function openAddModal() {
    setEditingField(null);
    setFieldName('');
    setFieldValue('');
    setSelectedCategoryOption('general');
    setCustomCategoryValue('');
    setAssignedPageIds([]);
    setShowModal(true);
  }

  function openEditModal(field: GroupedField) {
    setEditingField(field);
    setFieldName(field.field_name);
    setFieldValue(field.field_value);
    if (PREDEFINED_CATEGORIES.includes(field.category)) {
      setSelectedCategoryOption(field.category);
      setCustomCategoryValue('');
    } else {
      setSelectedCategoryOption('custom');
      setCustomCategoryValue(field.category);
    }
    const pageIds = field.page_ids.filter((id): id is string => id !== null);
    setAssignedPageIds(pageIds);
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error('You must be logged in.'); setSaving(false); return; }

    const finalCategory = selectedCategoryOption === 'custom'
      ? customCategoryValue.trim().toLowerCase().replace(/\s+/g, '_') || 'general'
      : selectedCategoryOption;

    const payloadTemplate = {
      field_name: fieldName,
      field_value: fieldValue,
      category: finalCategory,
      user_id: user.id
    };

    try {
      if (editingField) {
        // Delete all rows in the editing group
        const { error: deleteError } = await supabase
          .from('knowledge_fields')
          .delete()
          .in('id', editingField.ids);
        if (deleteError) throw deleteError;
      }

      // If assignedPageIds is empty, it means Global (page_id: null)
      if (assignedPageIds.length === 0) {
        const { error } = await supabase
          .from('knowledge_fields')
          .insert({ ...payloadTemplate, page_id: null });
        if (error) throw error;
      } else {
        // Insert a row for each page ID
        const payloads = assignedPageIds.map(pageId => ({
          ...payloadTemplate,
          page_id: pageId
        }));
        const { error } = await supabase
          .from('knowledge_fields')
          .insert(payloads);
        if (error) throw error;
      }

      toast.success(editingField ? 'Quick Answer updated successfully!' : 'Quick Answer added successfully!');
      setShowModal(false);
      loadAll();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleImport(e: FormEvent) {
    e.preventDefault();
    setImporting(true);
    try {
      const parsed = JSON.parse(importJson);
      
      const fieldsToImport = Array.isArray(parsed) ? parsed : (parsed.knowledge_fields || []);
      
      if (!Array.isArray(fieldsToImport) || fieldsToImport.length === 0) {
        throw new Error('Invalid JSON format. Expected an array of knowledge fields or { knowledge_fields: [...] }');
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not logged in');

      const payloads = fieldsToImport.map((f: any) => ({
        user_id: user.id,
        page_id: importPageId || null,
        field_name: f.field_name || 'Untitled Field',
        field_value: f.field_value || '',
        category: f.category || 'general',
        value_type: f.value_type || 'string',
        display_label: f.display_label || null,
        description: f.description || null
      }));

      // Upsert to handle conflicts gracefully if same field_name exists for the same page
      const { error } = await supabase
        .from('knowledge_fields')
        .upsert(payloads, { onConflict: 'user_id,page_id,field_name' });
        
      if (error) throw error;

      if (parsed.system_prompt && importPageId) {
        await supabase
          .from('page_connections')
          .update({ custom_system_prompt: parsed.system_prompt })
          .eq('page_id', importPageId);
      }

      setShowImportModal(false);
      setImportJson('');
      loadAll();
      toast.success('Knowledge base imported successfully!');
    } catch (err: any) {
      toast.error('Import failed: ' + err.message);
    }
    setImporting(false);
  }

  async function deleteField(ids: string[]) {
    if (!confirm('Delete this quick answer?')) return;
    const { error } = await supabase.from('knowledge_fields').delete().in('id', ids);
    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      toast.success('Quick Answer deleted successfully!');
      loadAll();
    }
  }

  async function toggleActive(field: GroupedField) {
    const nextActive = !field.is_active;
    const { error } = await supabase
      .from('knowledge_fields')
      .update({ is_active: nextActive })
      .in('id', field.ids);
      
    if (error) {
      toast.error('Error: ' + error.message);
    } else {
      loadAll();
    }
  }

  // Sort visible fields by category, then by name
  const sortedFields = useMemo(() => {
    return [...visibleFields].sort((a, b) => {
      const catA = (a.category || 'general').toLowerCase();
      const catB = (b.category || 'general').toLowerCase();
      if (catA !== catB) return catA.localeCompare(catB);
      return a.field_name.localeCompare(b.field_name);
    });
  }, [visibleFields]);

  function getPageName(pageId: string | null) {
    if (!pageId) return null;
    return pages.find((p) => p.page_id === pageId)?.page_name || pageId;
  }

  return (
    <div className="animate-slideUp">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center' }}>
            Quick Answers
            <HelpTooltip id="quickAnswers" />
          </h1>
          <p>Store short, strict rules and facts about your business that the AI can instantly look up.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
            <Upload size={16} /> Import AI Data
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={16} /> Add Field
          </button>
        </div>
      </div>

      {/* Page Filter Bar */}
      <div className="card" style={{ padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <Filter size={14} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', flexShrink: 0 }}>Show fields for:</span>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`btn btn-sm ${filterPageId === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterPageId('all')}
          >
            All Fields
          </button>
          <button
            className={`btn btn-sm ${filterPageId === 'global' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilterPageId('global')}
          >
            🌐 Global Only
          </button>
          {pages.map((p) => (
            <button
              key={p.page_id}
              className={`btn btn-sm ${filterPageId === p.page_id ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterPageId(p.page_id)}
            >
              {p.page_name || p.page_id}
            </button>
          ))}
        </div>
        {filterPageId !== 'all' && filterPageId !== 'global' && (
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
            Showing global + page-specific fields
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1,2,3].map(i => (
            <div key={i} className="card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="skeleton" style={{ height: '16px', width: '35%', borderRadius: '4px' }} />
                <div className="skeleton" style={{ height: '12px', width: '55%', borderRadius: '4px' }} />
              </div>
              <div className="skeleton" style={{ width: '70px', height: '28px', borderRadius: '6px' }} />
            </div>
          ))}
        </div>
      ) : visibleFields.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <BookOpen className="empty-state-icon" />
            <h3>No Quick Answers</h3>
            <p>Add fields below to give the AI factual context about your business. The AI will inject these into every response.</p>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setShowImportModal(true)}>
                <Upload size={16} /> Import AI Data
              </button>
              <button className="btn btn-primary" onClick={openAddModal}>
                <Plus size={16} /> Add Your First Field
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px'
        }}>
          {sortedFields.map((field) => (
            <div
              key={field.ids.join(',')}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '20px',
                opacity: field.is_active ? 1 : 0.5,
                minHeight: '210px',
                margin: 0,
                transition: 'all 0.2s ease',
              }}
            >
              <div>
                {/* Badges row with wrap */}
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <span 
                    className="badge"
                    style={{ fontSize: '0.62rem', background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)', textTransform: 'uppercase', padding: '3px 8px', borderRadius: '99px' }}
                  >
                    📁 {field.category || 'general'}
                  </span>
                  {field.page_ids.map((pid, idx) => (
                    pid ? (
                      <span 
                        key={idx}
                        className="badge"
                        style={{ fontSize: '0.62rem', background: 'var(--accent-primary-glow)', color: 'var(--accent-primary-hover)', textTransform: 'none', padding: '3px 8px', borderRadius: '99px', whiteSpace: 'nowrap' }}
                        title={getPageName(pid) || ''}
                      >
                        📄 {getPageName(pid) || 'Page'}
                      </span>
                    ) : (
                      <span 
                        key={idx}
                        className="badge"
                        style={{ fontSize: '0.62rem', background: 'var(--success-bg)', color: 'var(--success)', textTransform: 'none', padding: '3px 8px', borderRadius: '99px', whiteSpace: 'nowrap' }}
                      >
                        🌐 Global
                      </span>
                    )
                  ))}
                </div>

                {/* Title gets 100% card width - no side squeezing */}
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', wordBreak: 'break-word', lineHeight: '1.4', marginBottom: '10px' }}>
                  {field.field_name}
                </div>
                
                {/* Value/Description */}
                <div style={{
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.5',
                  wordBreak: 'break-word',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  marginBottom: '12px'
                }} title={field.field_value}>
                  {field.field_value}
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid var(--border-primary)',
                paddingTop: '14px',
                marginTop: 'auto'
              }}>
                <button
                  className={`btn btn-sm ${field.is_active ? 'btn-secondary' : 'btn-danger'}`}
                  style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={() => toggleActive(field)}
                >
                  {field.is_active ? 'Active' : 'Inactive'}
                </button>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn-ghost btn-icon" onClick={() => openEditModal(field)} title="Edit" style={{ width: '28px', height: '28px' }}>
                    <Pencil size={14} />
                  </button>
                  <button className="btn-ghost btn-icon" onClick={() => deleteField(field.ids)} title="Delete" style={{ width: '28px', height: '28px' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Import JSON Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Import Quick Answers</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowImportModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleImport}>
              <div className="modal-body">
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Paste the JSON output from your Custom GPT AI below to instantly generate your knowledge fields.
                </p>
                
                <div className="form-group">
                  <label className="form-label" htmlFor="import-page">Assign to Page</label>
                  <select
                    id="import-page"
                    className="form-select"
                    value={importPageId}
                    onChange={(e) => setImportPageId(e.target.value)}
                  >
                    <option value="">🌐 Global (all pages)</option>
                    {pages.map((p) => (
                      <option key={p.page_id} value={p.page_id}>{p.page_name || p.page_id}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="import-json" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ marginBottom: 0 }}>JSON Data</span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <a 
                        href="https://gemini.google.com/gem/1yHjGZWpGIn2qTRQkwhKWo85zyId-S2TW?usp=sharing" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="btn btn-sm btn-secondary" 
                        style={{ textDecoration: 'none', color: 'var(--accent-primary)', borderColor: 'var(--border-accent)', background: 'rgba(249, 115, 22, 0.05)' }}
                      >
                        🤖 Auto-Generate via AI
                      </a>
                      <label className="btn btn-sm btn-secondary" style={{ cursor: 'pointer', margin: 0, fontWeight: 500 }}>
                        <Upload size={14} /> Upload File (.json, .txt)
                        <input 
                          type="file" 
                          accept=".txt,.json" 
                          style={{ display: 'none' }} 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const result = event.target?.result;
                              if (typeof result === 'string') {
                                 setImportJson(result);
                              }
                            };
                            reader.readAsText(file);
                            e.target.value = '';
                          }} 
                        />
                      </label>
                    </div>
                  </label>
                  <textarea
                    id="import-json"
                    className="form-textarea"
                    style={{ fontFamily: 'monospace', minHeight: '200px', fontSize: '0.85rem' }}
                    placeholder='{"knowledge_fields": [{"field_name": "Hours", "field_value": "9-5", "category": "General"}]}'
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={importing}>
                  <Upload size={14} />
                  {importing ? 'Importing...' : 'Import Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingField ? 'Edit Field' : 'Add Knowledge Field'}</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label" htmlFor="kf-name">Field Name</label>
                  <input
                    id="kf-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g., Business Hours"
                    value={fieldName}
                    onChange={(e) => setFieldName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="kf-value">Value</label>
                  <textarea
                    id="kf-value"
                    className="form-textarea"
                    placeholder="e.g., Monday–Friday, 9am to 5pm EST"
                    value={fieldValue}
                    onChange={(e) => setFieldValue(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="kf-category">Category</label>
                  <select
                    id="kf-category"
                    className="form-select"
                    value={selectedCategoryOption}
                    onChange={(e) => setSelectedCategoryOption(e.target.value)}
                  >
                    <option value="general">General</option>
                    <option value="pricing">Pricing</option>
                    <option value="products">Products</option>
                    <option value="services">Services</option>
                    <option value="policies">Policies</option>
                    <option value="contact">Contact Info</option>
                    <option value="shipping">Shipping & Delivery</option>
                    <option value="faq">FAQ</option>
                    <option value="custom">Custom...</option>
                  </select>
                </div>
                {selectedCategoryOption === 'custom' && (
                  <div className="form-group animate-slideUp">
                    <label className="form-label" htmlFor="kf-custom-category">Custom Category Name</label>
                    <input
                      id="kf-custom-category"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Holiday Promo"
                      value={customCategoryValue}
                      onChange={(e) => setCustomCategoryValue(e.target.value)}
                      required
                    />
                  </div>
                )}
                <div className="form-group">
                  <label className="form-label">Assign to Pages</label>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={assignedPageIds.length === 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAssignedPageIds([]); // Empty means Global
                          }
                        }}
                      />
                      <span>🌐 Global (all pages)</span>
                    </label>

                    {pages.map((p) => (
                      <label key={p.page_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', marginLeft: '16px' }}>
                        <input
                          type="checkbox"
                          checked={assignedPageIds.includes(p.page_id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAssignedPageIds([...assignedPageIds, p.page_id]);
                            } else {
                              setAssignedPageIds(assignedPageIds.filter(id => id !== p.page_id));
                            }
                          }}
                        />
                        <span>📄 {p.page_name || p.page_id}</span>
                      </label>
                    ))}
                  </div>

                  <p className="form-hint" style={{ marginTop: '8px' }}>
                    Global fields are injected for every page. Check specific pages to restrict this fact to those bots.
                  </p>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  <Save size={14} />
                  {saving ? 'Saving...' : editingField ? 'Update' : 'Add Field'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
