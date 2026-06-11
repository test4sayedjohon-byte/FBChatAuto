import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';
import { Plus, Trash2, Edit2, Play, Pause, GitBranch, Search, Loader2, Upload } from 'lucide-react';
import { importFlow } from '../lib/FlowJsonHandler';

interface Flow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function FlowsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Create Modal State
  const [showModal, setShowModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [newFlowDesc, setNewFlowDesc] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleImportFlowFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      try {
        toast.info('Importing flow...');
        const result = await importFlow(content, user.id);
        if (result.success && result.flowId) {
          toast.success('Flow imported successfully!');
          loadFlows();
        } else {
          toast.error(result.error || 'Failed to import flow.');
        }
      } catch (err: any) {
        toast.error('Import error: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  useEffect(() => {
    if (user) {
      loadFlows();
    }
  }, [user]);

  useEffect(() => {
    const handleReload = () => {
      loadFlows();
    };
    window.addEventListener('agent-data-updated', handleReload);
    return () => window.removeEventListener('agent-data-updated', handleReload);
  }, [user]);

  async function loadFlows() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('dm_flows')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFlows(data || []);
    } catch (err: any) {
      toast.error('Failed to load flows: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateFlow(e: React.FormEvent) {
    e.preventDefault();
    if (!newFlowName.trim()) {
      toast.error('Flow name is required');
      return;
    }

    try {
      setCreating(true);
      const { data, error } = await supabase
        .from('dm_flows')
        .insert({
          user_id: user?.id,
          name: newFlowName.trim(),
          description: newFlowDesc.trim() || null,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Flow created successfully!');
      setShowModal(false);
      setNewFlowName('');
      setNewFlowDesc('');
      
      // Redirect to builder canvas for this new flow
      navigate(`/flows/${data.id}`);
    } catch (err: any) {
      toast.error('Failed to create flow: ' + err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(flow: Flow) {
    try {
      const { error } = await supabase
        .from('dm_flows')
        .update({ is_active: !flow.is_active })
        .eq('id', flow.id);

      if (error) throw error;
      
      setFlows(prev =>
        prev.map(f => (f.id === flow.id ? { ...f, is_active: !flow.is_active } : f))
      );
      toast.success(`Flow ${!flow.is_active ? 'activated' : 'paused'} successfully.`);
    } catch (err: any) {
      toast.error('Failed to update flow: ' + err.message);
    }
  }

  async function handleDeleteFlow(id: string) {
    if (!confirm('Are you sure you want to delete this flow? This will delete all nodes and connections.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('dm_flows')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setFlows(prev => prev.filter(f => f.id !== id));
      toast.success('Flow deleted.');
    } catch (err: any) {
      toast.error('Failed to delete flow: ' + err.message);
    }
  }

  const filteredFlows = flows.filter(flow =>
    flow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (flow.description && flow.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="container-fluid" style={{ padding: '24px', minHeight: 'calc(100vh - 80px)', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GitBranch size={24} color="var(--accent-primary)" />
            DM Flow Builder & Sequences
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Design interactive visual workflows and automated DMs for your social channels.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn-import-flow" onClick={() => document.getElementById('import-flow-file-input')?.click()}>
            <Upload size={16} /> Import Flow
          </button>
          <button className="btn-create-flow" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Create Flow
          </button>
          <input
            id="import-flow-file-input"
            type="file"
            accept=".json"
            onChange={handleImportFlowFile}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Total Flows</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px', color: 'var(--accent-primary)' }}>{flows.length}</div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Active Flows</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px', color: 'var(--success)' }}>
            {flows.filter(f => f.is_active).length}
          </div>
        </div>
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Paused Flows</div>
          <div style={{ fontSize: '24px', fontWeight: 'bold', marginTop: '8px', color: 'var(--text-secondary)' }}>
            {flows.filter(f => !f.is_active).length}
          </div>
        </div>
      </div>

      {/* Filter and List Panel */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', padding: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Search flows..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                borderRadius: 'var(--radius-md)',
                color: '#fff',
                fontSize: '14px'
              }}
            />
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px', color: 'var(--text-secondary)' }}>
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : filteredFlows.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 12px', color: 'var(--text-secondary)', border: '1px dashed var(--border-primary)', borderRadius: 'var(--radius-md)' }}>
            <GitBranch size={40} style={{ opacity: 0.5, marginBottom: '12px' }} />
            <h3 style={{ fontSize: '16px', fontWeight: 'semibold', color: '#fff' }}>No Flows Found</h3>
            <p style={{ fontSize: '14px', marginTop: '4px', maxWidth: '360px', margin: '4px auto 16px' }}>
              {searchQuery ? 'Try adjusting your search filters.' : 'Create your first automation sequence flow to engage clients automatically.'}
            </p>
            {!searchQuery && (
              <button className="btn-secondary" onClick={() => setShowModal(true)}>
                Create Flow
              </button>
            )}
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)', textAlign: 'left' }}>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>NAME</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>DESCRIPTION</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>STATUS</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px' }}>CREATED</th>
                  <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: '12px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlows.map(flow => (
                  <tr key={flow.id} style={{ borderBottom: '1px solid var(--border-primary)', verticalAlign: 'middle' }}>
                    <td style={{ padding: '16px 12px' }}>
                      <div style={{ fontWeight: 'semibold', color: '#fff', fontSize: '14px' }}>{flow.name}</div>
                    </td>
                    <td style={{ padding: '16px 12px', color: 'var(--text-secondary)', fontSize: '13px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {flow.description || '—'}
                    </td>
                    <td style={{ padding: '16px 12px' }}>
                      <button
                        onClick={() => handleToggleActive(flow)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          border: 'none',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          background: flow.is_active ? 'rgba(46, 204, 113, 0.15)' : 'rgba(127, 140, 141, 0.15)',
                          color: flow.is_active ? 'var(--success)' : 'var(--text-secondary)'
                        }}
                      >
                        {flow.is_active ? <Play size={10} fill="var(--success)" /> : <Pause size={10} />}
                        {flow.is_active ? 'Active' : 'Paused'}
                      </button>
                    </td>
                    <td style={{ padding: '16px 12px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      {new Date(flow.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px 12px', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '8px' }}>
                        <button
                          className="btn-ghost btn-icon"
                          title="Edit Flow Builder"
                          onClick={() => navigate(`/flows/${flow.id}`)}
                          style={{ color: 'var(--accent-primary)' }}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          className="btn-ghost btn-icon"
                          title="Delete Flow"
                          onClick={() => handleDeleteFlow(flow.id)}
                          style={{ color: 'var(--error)' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Flow Modal */}
      {showModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '480px',
            padding: '24px',
            boxShadow: 'var(--shadow-xl)'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 16px 0', color: '#fff' }}>Create New Flow</h3>
            
            <form onSubmit={handleCreateFlow} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>FLOW NAME</label>
                <input
                  type="text"
                  placeholder="e.g. Lead Qualification Sequence"
                  value={newFlowName}
                  onChange={e => setNewFlowName(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    color: '#fff',
                    fontSize: '14px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>DESCRIPTION (OPTIONAL)</label>
                <textarea
                  placeholder="Briefly describe what this flow does..."
                  value={newFlowDesc}
                  onChange={e => setNewFlowDesc(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
                    color: '#fff',
                    fontSize: '14px',
                    resize: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)} disabled={creating}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={creating} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {creating ? <Loader2 className="animate-spin" size={16} /> : 'Create & Edit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
