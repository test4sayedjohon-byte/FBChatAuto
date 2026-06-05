import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { Users, ShieldAlert } from 'lucide-react';

interface Tenant {
  id: string;
  email: string;
  display_name: string;
  plan: string;
  created_at: string;
  assigned_chat_provider_id: string | null;
  assigned_embedding_provider_id: string | null;
}

export default function SuperAdminUsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<Tenant[]>([]);
  const [globalProviders, setGlobalProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.is_super_admin) {
      loadUsers();
    }
  }, [profile]);

  async function loadUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id, email, display_name, plan, created_at, assigned_chat_provider_id, assigned_embedding_provider_id
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      const { data: gData } = await supabase.from('ai_providers').select('id, display_name, model_chat').eq('is_global', true);
      if (gData) setGlobalProviders(gData);

      if (data) setUsers(data as Tenant[]);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }

  async function assignProvider(userId: string, providerId: string, type: 'chat' | 'embedding') {
    const field = type === 'chat' ? 'assigned_chat_provider_id' : 'assigned_embedding_provider_id';
    const val = providerId === 'default' ? null : providerId;
    
    await supabase.from('users').update({ [field]: val }).eq('id', userId);
    setUsers(users.map(u => u.id === userId ? { ...u, [field]: val } : u));
  }

  if (profile && !profile.is_super_admin) {
    return (
      <div className="card" style={{padding:'48px',textAlign:'center',color:'var(--text-secondary)'}}>
        <ShieldAlert size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
        <h3>Access Denied</h3>
        <p>You must be a super admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="animate-slideUp">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Tenant Management 👥</h1>
          <p>Super Admin control over all users on the platform.</p>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{padding:'48px',textAlign:'center',color:'var(--text-secondary)'}}>Loading...</div>
      ) : users.length === 0 ? (
        <div className="card"><div className="empty-state">
          <Users className="empty-state-icon" />
          <h3>No Users Found</h3>
        </div></div>
      ) : (
        <div className="card">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '16px' }}>Name</th>
                <th style={{ padding: '16px' }}>Email</th>
                <th style={{ padding: '16px' }}>Plan</th>
                <th style={{ padding: '16px' }}>Joined</th>
                <th style={{ padding: '16px' }}>Custom AI Models</th>
                <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                  <td style={{ padding: '16px', fontWeight: '500' }}>{u.display_name}</td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px',
                      background: 'rgba(255,255,255,0.05)',
                      textTransform: 'uppercase'
                    }}>
                      {u.plan}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--text-secondary)' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <select 
                        className="form-select" 
                        style={{ padding: '4px', fontSize: '12px' }}
                        value={u.assigned_chat_provider_id || 'default'}
                        onChange={(e) => assignProvider(u.id, e.target.value, 'chat')}
                      >
                        <option value="default">Default Global Chat</option>
                        {globalProviders.map(p => (
                          <option key={p.id} value={p.id}>{p.display_name} (Chat)</option>
                        ))}
                      </select>

                      <select 
                        className="form-select" 
                        style={{ padding: '4px', fontSize: '12px' }}
                        value={u.assigned_embedding_provider_id || 'default'}
                        onChange={(e) => assignProvider(u.id, e.target.value, 'embedding')}
                      >
                        <option value="default">Default Global Embed</option>
                        {globalProviders.map(p => (
                          <option key={p.id} value={p.id}>{p.display_name} (Embed)</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                      Auto-saved
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
