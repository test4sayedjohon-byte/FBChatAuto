import { Shield, Globe, FileText, BookOpen, Cpu, MessageSquare, Eye, Trash2 } from 'lucide-react';
import type { SuperAdminUser, UserRole } from './types';

interface UserTableProps {
  users: SuperAdminUser[];
  currentUserId: string | undefined;
  currentUserRole: UserRole;  // role of the logged-in admin viewing this table
  globalProviders: any[];
  onChangePlan: (userId: string, plan: string) => void;
  onToggleSuspension: (userId: string, currentStatus: boolean) => void;
  onChangeRole: (userId: string, newRole: UserRole) => void;
  onAssignProvider: (userId: string, providerId: string, type: 'chat' | 'embedding' | 'fallback') => void;
  onInspect: (user: SuperAdminUser) => void;
  onDelete: (userId: string) => void;
}

export default function UserTable({
  users,
  currentUserId,
  currentUserRole,
  globalProviders,
  onChangePlan,
  onToggleSuspension,
  onChangeRole,
  onAssignProvider,
  onInspect,
  onDelete,
}: UserTableProps) {
  const canChangeRoles = currentUserRole === 'super_admin';

  return (
    <div className="card" style={{ padding: 0, border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              <th style={{ padding: '16px' }}>User / Account</th>
              <th style={{ padding: '16px' }}>Plan</th>
              <th style={{ padding: '16px' }}>Status</th>
              <th style={{ padding: '16px' }}>Role</th>
              <th style={{ padding: '16px' }}>Resource Stats</th>
              <th style={{ padding: '16px' }}>Custom AI Models</th>
              <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr 
                key={u.id} 
                style={{ 
                  borderBottom: '1px solid var(--border-light)',
                  background: u.is_suspended ? 'rgba(239, 68, 68, 0.02)' : 'transparent',
                  transition: 'background 0.2s'
                }}
              >
                <td style={{ padding: '16px' }}>
                  <div style={{ fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {u.display_name}
                    {u.role !== 'user' && (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '2px',
                        background: u.role === 'super_admin' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                        color: u.role === 'super_admin' ? 'var(--accent-primary)' : '#818cf8',
                        padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold'
                      }}>
                        <Shield size={10} /> {u.role === 'super_admin' ? 'SUPER ADMIN' : 'ADMIN'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{u.email}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Joined {new Date(u.created_at).toLocaleDateString()}
                  </div>
                </td>

                <td style={{ padding: '16px' }}>
                  <select
                    className="form-select"
                    style={{ 
                      padding: '6px 10px', 
                      fontSize: '13px', 
                      background: 'var(--bg-secondary)', 
                      color: 'var(--text-primary)', 
                      borderRadius: '6px', 
                      border: '1px solid var(--border-light)',
                      width: '120px'
                    }}
                    value={u.plan}
                    onChange={(e) => onChangePlan(u.id, e.target.value)}
                  >
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </td>

                <td style={{ padding: '16px' }}>
                  <button
                    onClick={() => onToggleSuspension(u.id, u.is_suspended)}
                    disabled={u.id === currentUserId}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      border: 'none',
                      cursor: u.id === currentUserId ? 'not-allowed' : 'pointer',
                      background: u.is_suspended ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                      color: u.is_suspended ? '#ef4444' : '#22c55e',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {u.is_suspended ? 'Suspended' : 'Active'}
                  </button>
                </td>

                <td style={{ padding: '16px' }}>
                  {canChangeRoles ? (
                    <select
                      className="form-select"
                      style={{ padding: '4px 8px', fontSize: '12px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', borderRadius: '6px', border: '1px solid var(--border-light)', opacity: u.id === currentUserId ? 0.5 : 1 }}
                      value={u.role}
                      disabled={u.id === currentUserId}
                      onChange={(e) => onChangeRole(u.id, e.target.value as UserRole)}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                      {u.role.replace('_', ' ')}
                    </span>
                  )}
                </td>

                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '240px' }}>
                    <span title="Facebook Pages Connected" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Globe size={13} style={{ opacity: 0.7 }} /> {u.pageCount}
                    </span>
                    <span title="Documents Uploaded" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={13} style={{ opacity: 0.7 }} /> {u.documentCount}
                    </span>
                    <span title="Knowledge Fields" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <BookOpen size={13} style={{ opacity: 0.7 }} /> {u.fieldCount}
                    </span>
                    <span title="Total Chat Sessions" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Cpu size={13} style={{ opacity: 0.7 }} /> {u.sessionCount}
                    </span>
                    <span title="Messages Processed" style={{ display: 'flex', alignItems: 'center', gap: '4px', gridColumn: 'span 2' }}>
                      <MessageSquare size={13} style={{ opacity: 0.7 }} /> {u.messageCount} msgs
                    </span>
                  </div>
                </td>

                <td style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '170px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '9px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Primary Chat</span>
                      <select 
                        className="form-select" 
                        style={{ padding: '4px 6px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                        value={u.assigned_chat_provider_id || 'default'}
                        onChange={(e) => onAssignProvider(u.id, e.target.value, 'chat')}
                      >
                        <option value="default">Default Global Chat</option>
                        {globalProviders.map(p => (
                          <option key={p.id} value={p.id}>{p.display_name}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '9px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fallback Chat</span>
                      <select 
                        className="form-select" 
                        style={{ padding: '4px 6px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                        value={u.assigned_fallback_chat_provider_id || 'default'}
                        onChange={(e) => onAssignProvider(u.id, e.target.value, 'fallback')}
                      >
                        <option value="default">No Fallback Chat</option>
                        {globalProviders.map(p => (
                          <option key={p.id} value={p.id}>{p.display_name}</option>
                        ))}
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '9px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Embeddings</span>
                      <select 
                        className="form-select" 
                        style={{ padding: '4px 6px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                        value={u.assigned_embedding_provider_id || 'default'}
                        onChange={(e) => onAssignProvider(u.id, e.target.value, 'embedding')}
                      >
                        <option value="default">Default Global Embed</option>
                        {globalProviders.map(p => (
                          <option key={p.id} value={p.id}>{p.display_name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </td>

                <td style={{ padding: '16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button 
                      className="btn btn-secondary btn-sm" 
                      onClick={() => onInspect(u)} 
                      title="Manage User Resources"
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Eye size={14} /> Manage
                    </button>
                    <button 
                      className="btn-ghost btn-icon text-danger" 
                      onClick={() => onDelete(u.id)} 
                      disabled={u.id === currentUserId}
                      title="Delete User"
                      style={{ color: u.id === currentUserId ? 'var(--text-muted)' : '#ef4444', opacity: u.id === currentUserId ? 0.3 : 1 }}
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
    </div>
  );
}
