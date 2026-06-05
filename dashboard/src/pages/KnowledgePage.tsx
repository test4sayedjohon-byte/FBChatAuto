import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Pencil, Trash2, BookOpen, Save, X } from 'lucide-react';

interface KnowledgeField {
  id: string;
  field_name: string;
  field_value: string;
  category: string;
  is_active: boolean;
}

export default function KnowledgePage() {
  const [fields, setFields] = useState<KnowledgeField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingField, setEditingField] = useState<KnowledgeField | null>(null);

  // Form state
  const [fieldName, setFieldName] = useState('');
  const [fieldValue, setFieldValue] = useState('');
  const [category, setCategory] = useState('general');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadFields(); }, []);

  async function loadFields() {
    const { data, error } = await supabase
      .from('knowledge_fields')
      .select('*')
      .order('sort_order', { ascending: true });

    if (!error && data) {
      setFields(data);
    }
    setLoading(false);
  }

  function openAddModal() {
    setEditingField(null);
    setFieldName('');
    setFieldValue('');
    setCategory('general');
    setShowModal(true);
  }

  function openEditModal(field: KnowledgeField) {
    setEditingField(field);
    setFieldName(field.field_name);
    setFieldValue(field.field_value);
    setCategory(field.category);
    setShowModal(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);

    if (editingField) {
      await supabase
        .from('knowledge_fields')
        .update({ field_name: fieldName, field_value: fieldValue, category })
        .eq('id', editingField.id);
    } else {
      await supabase
        .from('knowledge_fields')
        .insert({ field_name: fieldName, field_value: fieldValue, category });
    }

    setSaving(false);
    setShowModal(false);
    loadFields();
  }

  async function deleteField(id: string) {
    if (!confirm('Delete this knowledge field?')) return;
    await supabase.from('knowledge_fields').delete().eq('id', id);
    loadFields();
  }

  async function toggleActive(field: KnowledgeField) {
    await supabase
      .from('knowledge_fields')
      .update({ is_active: !field.is_active })
      .eq('id', field.id);
    loadFields();
  }

  // Group fields by category
  const grouped = fields.reduce((acc, field) => {
    const cat = field.category || 'general';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(field);
    return acc;
  }, {} as Record<string, KnowledgeField[]>);

  return (
    <div className="animate-slideUp">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Knowledge Base</h1>
          <p>Add business information that the AI will use to answer customer questions.</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} /> Add Field
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          Loading...
        </div>
      ) : fields.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <BookOpen className="empty-state-icon" />
            <h3>No Knowledge Fields Yet</h3>
            <p>Add your business information like hours, pricing, and policies. The AI will use this to answer customer questions.</p>
            <button className="btn btn-primary" onClick={openAddModal}>
              <Plus size={16} /> Add Your First Field
            </button>
          </div>
        </div>
      ) : (
        Object.entries(grouped).map(([cat, catFields]) => (
          <div key={cat} style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', paddingLeft: '4px' }}>
              {cat.replace(/[_-]/g, ' ')}
            </h3>
            {catFields.map((field) => (
              <div key={field.id} className="list-item" style={{ opacity: field.is_active ? 1 : 0.5 }}>
                <div className="list-item-content">
                  <div className="list-item-title">{field.field_name}</div>
                  <div className="list-item-subtitle">{field.field_value}</div>
                </div>
                <div className="list-item-actions">
                  <button
                    className={`btn btn-sm ${field.is_active ? 'btn-secondary' : 'btn-danger'}`}
                    onClick={() => toggleActive(field)}
                    title={field.is_active ? 'Disable' : 'Enable'}
                  >
                    {field.is_active ? 'Active' : 'Inactive'}
                  </button>
                  <button className="btn-ghost btn-icon" onClick={() => openEditModal(field)} title="Edit">
                    <Pencil size={14} />
                  </button>
                  <button className="btn-ghost btn-icon" onClick={() => deleteField(field.id)} title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))
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
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="general">General</option>
                    <option value="pricing">Pricing</option>
                    <option value="products">Products</option>
                    <option value="services">Services</option>
                    <option value="policies">Policies</option>
                    <option value="contact">Contact Info</option>
                    <option value="shipping">Shipping & Delivery</option>
                    <option value="faq">FAQ</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
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
