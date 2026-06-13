// ============================================================================
// SuperAdminUsersPage — Redesigned card-grid user list with filters
// ============================================================================
// Replaces the old table-based interface with a premium card grid,
// advanced filtering, and URL-based navigation to UserWorkspacePage.
// ============================================================================

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { workerPost, WORKER_URL } from '../lib/workerApi';
import { toast } from '../hooks/useToast';
import UserCard from './super-admin/UserCard';
import {
  Users,
  ShieldAlert,
  Search,
  Filter,
  ChevronDown,
  LayoutGrid,
  List,
  RefreshCw,
  X,
  Lock,
  Database,
  Download,
  Upload,
} from 'lucide-react';
import type { SuperAdminUser } from './super-admin/types';

// ── Filter types ─────────────────────────────────────────────────────────
type PlanFilter = 'all' | 'free' | 'pro' | 'enterprise';
type RoleFilter = 'all' | 'user' | 'admin' | 'super_admin';
type StatusFilter = 'all' | 'active' | 'suspended' | 'paused';
type DateFilter = 'all' | '24h' | '7d' | '30d' | 'custom';

export default function SuperAdminUsersPage() {
  const { profile, isAdmin, user: currentUser } = useAuth();
  const navigate = useNavigate();

  // Users state
  const [users, setUsers] = useState<SuperAdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');

  // View toggle
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Pagination
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  // ── Maintenance / Backup State ──────────────────────────────────────────
  const [, setSecretClickCount] = useState(0);
  const [showMaintenancePanel, setShowMaintenancePanel] = useState(false);
  const [passwordPromptOpen, setPasswordPromptOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [maintenanceUnlocked, setMaintenanceUnlocked] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupStatusText, setBackupStatusText] = useState('');
  const [backupLog, setBackupLog] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const BACKUP_TABLES = [
    'users',
    'ai_providers',
    'document_folders',
    'media',
    'page_connections',
    'folder_page_assignments',
    'knowledge_fields',
    'documents',
    'document_chunks',
    'chat_sessions',
    'chat_messages',
    'customer_profiles',
    'dm_flows',
    'dm_flow_nodes',
    'dm_flow_edges',
    'chat_session_flows',
    'scheduled_posts',
    'comment_rules',
    'comment_logs',
    'post_contexts',
    'user_blocklist',
    'integrations',
    'purchases',
    'billing_ledger',
    'admin_audit_log',
    'audit_logs',
    'version_history'
  ];

  const handleSecretClick = () => {
    setSecretClickCount(prev => {
      const next = prev + 1;
      if (next >= 5) {
        setShowMaintenancePanel(true);
        toast.success('Developer Easter Egg: Maintenance Panel Revealed!');
        return 0;
      }
      return next;
    });
  };

  const handleUnlockMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPassword) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error('Session expired, please sign in again.');
        return;
      }

      const response = await fetch(`${WORKER_URL}/api/super-admin/backup/verify-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ password: adminPassword })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Invalid password' }));
        throw new Error(err.error || 'Password verification failed');
      }

      setMaintenanceUnlocked(true);
      setPasswordPromptOpen(false);
      toast.success('Maintenance access unlocked successfully!');
      setBackupLog(prev => [...prev, `[System] Maintenance panel unlocked at ${new Date().toLocaleTimeString()}`]);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleExportBackup = async () => {
    if (!maintenanceUnlocked) {
      setPasswordPromptOpen(true);
      return;
    }

    setIsExporting(true);
    setBackupProgress(0);
    setBackupStatusText('Initializing Backup Export...');
    setBackupLog([`[Backup] Starting full system export...`]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired');

      const backupData: Record<string, any[]> = {};
      const totalSteps = BACKUP_TABLES.length;

      for (let i = 0; i < BACKUP_TABLES.length; i++) {
        const table = BACKUP_TABLES[i];
        setBackupStatusText(`Exporting table: ${table}...`);
        setBackupLog(prev => [...prev, `[Backup] Exporting table ${table}...`]);

        let allRows: any[] = [];
        let offset = 0;
        const limit = 500;
        let hasMoreRows = true;

        while (hasMoreRows) {
          const response = await fetch(`${WORKER_URL}/api/super-admin/backup/export-table`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              password: adminPassword,
              tableName: table,
              offset,
              limit
            })
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Failed' }));
            throw new Error(`Failed to export ${table}: ${err.error}`);
          }

          const res = await response.json();
          const rows = res.data || [];
          allRows = [...allRows, ...rows];

          if (rows.length < limit) {
            hasMoreRows = false;
          } else {
            offset += limit;
          }
        }

        backupData[table] = allRows;
        setBackupLog(prev => [...prev, `[Backup] Successfully exported ${allRows.length} rows from ${table}`]);
        setBackupProgress(Math.round(((i + 1) / totalSteps) * 100));
      }

      const backupPayload = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: backupData
      };

      const blob = new Blob([JSON.stringify(backupPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `autometabot_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setBackupStatusText('Backup completed successfully!');
      setBackupLog(prev => [...prev, `[Backup] Success! File downloaded.`]);
      toast.success('Backup file created and downloaded successfully!');
    } catch (err: any) {
      console.error(err);
      setBackupStatusText('Backup export failed');
      setBackupLog(prev => [...prev, `[Backup] Error: ${err.message}`]);
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.warning('Please select a backup JSON file first.');
      return;
    }

    if (!maintenanceUnlocked) {
      setPasswordPromptOpen(true);
      return;
    }

    if (!confirm('WARNING: This will restore database tables and could overwrite/update existing records. Are you absolutely sure?')) {
      return;
    }

    setIsRestoring(true);
    setBackupProgress(0);
    setBackupStatusText('Initializing Restore...');
    setBackupLog([`[Restore] Reading backup file...`]);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expired');

      const fileContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(selectedFile);
      });

      const backupPayload = JSON.parse(fileContent);
      if (!backupPayload.data || typeof backupPayload.data !== 'object') {
        throw new Error('Invalid backup file format: data object not found');
      }

      const totalSteps = BACKUP_TABLES.length;

      for (let i = 0; i < BACKUP_TABLES.length; i++) {
        const table = BACKUP_TABLES[i];
        const rows = backupPayload.data[table] || [];

        setBackupStatusText(`Restoring table: ${table}...`);
        setBackupLog(prev => [...prev, `[Restore] Table ${table}: restoring ${rows.length} rows...`]);

        if (rows.length === 0) {
          setBackupLog(prev => [...prev, `[Restore] Table ${table}: skipped (no rows)`]);
          setBackupProgress(Math.round(((i + 1) / totalSteps) * 100));
          continue;
        }

        const chunkSize = 200;
        for (let chunkIdx = 0; chunkIdx < rows.length; chunkIdx += chunkSize) {
          const chunk = rows.slice(chunkIdx, chunkIdx + chunkSize);
          const response = await fetch(`${WORKER_URL}/api/super-admin/backup/restore-batch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              password: adminPassword,
              tableName: table,
              rows: chunk
            })
          });

          if (!response.ok) {
            const err = await response.json().catch(() => ({ error: 'Failed' }));
            throw new Error(`Failed to restore chunk for ${table}: ${err.error}`);
          }
        }

        setBackupLog(prev => [...prev, `[Restore] Table ${table}: restored successfully`]);
        setBackupProgress(Math.round(((i + 1) / totalSteps) * 100));
      }

      // Finalize: Restore circular user -> provider references
      setBackupStatusText('Finalizing user-provider links...');
      setBackupLog(prev => [...prev, `[Restore] Finalizing user provider links...`]);
      const finalizeRes = await fetch(`${WORKER_URL}/api/super-admin/backup/restore-finalize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          password: adminPassword,
          rows: backupPayload.data['users'] || []
        })
      });

      if (!finalizeRes.ok) {
        const err = await finalizeRes.json().catch(() => ({ error: 'Failed' }));
        setBackupLog(prev => [...prev, `[Restore] Warning: failed to finalize provider links: ${err.error}`]);
      } else {
        setBackupLog(prev => [...prev, `[Restore] Provider links finalized successfully`]);
      }

      setBackupStatusText('Restore completed successfully!');
      setBackupLog(prev => [...prev, `[Restore] Success! All tables restored.`]);
      toast.success('Database restore completed successfully!');
      loadUsers();
    } catch (err: any) {
      console.error(err);
      setBackupStatusText('Restore failed');
      setBackupLog(prev => [...prev, `[Restore] Error: ${err.message}`]);
      toast.error(`Restore failed: ${err.message}`);
    } finally {
      setIsRestoring(false);
    }
  };

  useEffect(() => {
    if (isAdmin) loadUsers();
  }, [isAdmin]);

  async function loadUsers() {
    setLoading(true);
    try {
      const [usersRes, pagesRes, docsRes, fieldsRes, sessionsRes] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('page_connections').select('user_id'),
        supabase.from('documents').select('user_id'),
        supabase.from('knowledge_fields').select('user_id'),
        supabase.from('chat_sessions').select('user_id, message_count'),
      ]);

      if (usersRes.error) throw usersRes.error;

      const countMap = (list: any[]) => {
        const m: Record<string, number> = {};
        for (const item of list) {
          if (item.user_id) m[item.user_id] = (m[item.user_id] || 0) + 1;
        }
        return m;
      };

      const messageSumMap = (list: any[]) => {
        const m: Record<string, number> = {};
        for (const item of list) {
          if (item.user_id) m[item.user_id] = (m[item.user_id] || 0) + (item.message_count || 0);
        }
        return m;
      };

      const pageCounts = countMap(pagesRes.data || []);
      const docCounts = countMap(docsRes.data || []);
      const fieldCounts = countMap(fieldsRes.data || []);
      const sessionCounts = countMap(sessionsRes.data || []);
      const messageCounts = messageSumMap(sessionsRes.data || []);

      const enriched = (usersRes.data || []).map((u: any) => ({
        ...u,
        pageCount: pageCounts[u.id] || 0,
        documentCount: docCounts[u.id] || 0,
        fieldCount: fieldCounts[u.id] || 0,
        sessionCount: sessionCounts[u.id] || 0,
        messageCount: messageCounts[u.id] || 0,
      }));

      setUsers(enriched as SuperAdminUser[]);
    } catch (err) {
      console.error('Failed to load users:', err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  // ── Impersonation handler ───────────────────────────────────────────────
  async function handleImpersonate(user: SuperAdminUser) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) { toast.error('No active session'); return; }

      localStorage.setItem('autometabot_admin_session', JSON.stringify({
        accessToken: sessionData.session.access_token,
        refreshToken: sessionData.session.refresh_token,
        targetEmail: user.email,
      }));

      const result = await workerPost('/api/admin/impersonate', {
        targetEmail: user.email,
        redirectTo: window.location.origin
      });
      if (result.link) {
        window.location.href = result.link;
      } else {
        toast.error('Failed to generate impersonation link');
        localStorage.removeItem('autometabot_admin_session');
      }
    } catch (err: any) {
      toast.error('Impersonation failed: ' + err.message);
      localStorage.removeItem('autometabot_admin_session');
    }
  }

  // ── Suspension handler ────────────────────────────────────────────────
  async function handleToggleSuspension(userId: string, currentStatus: boolean) {
    if (userId === currentUser?.id) { toast.warning("You cannot suspend yourself!"); return; }
    const nextStatus = !currentStatus;

    const message = nextStatus
      ? "Suspend this user? They will be locked out and chatbots will stop."
      : "Lift suspension for this user?";
    if (!confirm(message)) return;

    const { error } = await supabase.from('users').update({ is_suspended: nextStatus }).eq('id', userId);
    if (error) { toast.error('Error: ' + error.message); return; }

    await supabase.from('admin_audit_log').insert({
      admin_id: currentUser?.id,
      target_id: userId,
      action: nextStatus ? 'suspend' : 'unsuspend',
      details: {},
    });

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_suspended: nextStatus } : u));
    toast.success(nextStatus ? 'User suspended' : 'Suspension lifted');
  }

  // ── Pause handler ───────────────────────────────────────────────────
  async function handleTogglePause(userId: string, currentStatus: boolean) {
    const nextStatus = !currentStatus;

    const message = nextStatus
      ? "Pause all activity for this user? Chatbot responses and comments automation will stop."
      : "Resume all activity for this user?";
    if (!confirm(message)) return;

    const { error } = await supabase.from('users').update({ is_paused: nextStatus }).eq('id', userId);
    if (error) { toast.error('Error: ' + error.message); return; }

    await supabase.from('admin_audit_log').insert({
      admin_id: currentUser?.id,
      target_id: userId,
      action: nextStatus ? 'pause' : 'unpause',
      details: {},
    });

    setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_paused: nextStatus } : u));
    toast.success(nextStatus ? 'User activity paused' : 'User activity resumed');
  }



  // ── Filter logic ──────────────────────────────────────────────────────
  const filteredUsers = users.filter(u => {
    // Text search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!u.display_name?.toLowerCase().includes(q) && !u.email?.toLowerCase().includes(q)) return false;
    }

    // Plan filter
    if (planFilter !== 'all' && u.plan !== planFilter) return false;

    // Role filter
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;

    // Status filter
    if (statusFilter === 'active' && (u.is_suspended || u.is_paused)) return false;
    if (statusFilter === 'suspended' && !u.is_suspended) return false;
    if (statusFilter === 'paused' && !u.is_paused) return false;

    // Date filter
    if (dateFilter !== 'all' && dateFilter !== 'custom') {
      const now = Date.now();
      const created = new Date(u.created_at).getTime();
      const ms = { '24h': 86400000, '7d': 604800000, '30d': 2592000000 }[dateFilter] || 0;
      if (now - created > ms) return false;
    }

    return true;
  });

  // Paginate
  const paginatedUsers = filteredUsers.slice(0, (page + 1) * PAGE_SIZE);
  const hasMore = paginatedUsers.length < filteredUsers.length;

  // Stats
  const totalActive = users.filter(u => !u.is_suspended && !u.is_paused).length;
  const totalSuspended = users.filter(u => u.is_suspended).length;
  const totalPaused = users.filter(u => u.is_paused).length;
  const activeFilters = [planFilter, roleFilter, statusFilter, dateFilter].filter(f => f !== 'all').length;

  // ── Access guard ──────────────────────────────────────────────────────
  if (profile && !isAdmin) {
    return (
      <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        <ShieldAlert size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
        <h3>Access Denied</h3>
        <p>You need admin or super admin access.</p>
      </div>
    );
  }

  const selectStyle: React.CSSProperties = {
    fontSize: '12px',
    padding: '6px 10px',
    background: 'var(--bg-tertiary)',
    border: '1px solid var(--border-primary)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    cursor: 'pointer',
    minWidth: '100px',
  };

  return (
    <div className="animate-slideUp" style={{ paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '24px' }}>
            <Users size={26} style={{ color: 'var(--accent-primary)', cursor: 'pointer' }} onClick={handleSecretClick} />
            Users
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            {users.length} total • {totalActive} active • {totalSuspended} suspended • {totalPaused} paused
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '8px', overflow: 'hidden' }}>
            <button onClick={() => setViewMode('grid')} style={{ padding: '6px 10px', background: viewMode === 'grid' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', cursor: 'pointer', color: viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
              <LayoutGrid size={16} />
            </button>
            <button onClick={() => setViewMode('list')} style={{ padding: '6px 10px', background: viewMode === 'list' ? 'var(--bg-tertiary)' : 'transparent', border: 'none', cursor: 'pointer', color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
              <List size={16} />
            </button>
          </div>
          <button className="btn btn-outline" onClick={loadUsers} style={{ padding: '6px 10px' }} title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px', maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            className="form-input"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
            style={{ paddingLeft: '36px', height: '36px', fontSize: '13px' }}
          />
        </div>

        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
            background: activeFilters > 0 ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
            border: `1px solid ${activeFilters > 0 ? 'var(--accent-primary)' : 'var(--border-primary)'}`,
            borderRadius: '8px', cursor: 'pointer', fontSize: '13px',
            color: activeFilters > 0 ? 'var(--accent-primary)' : 'var(--text-secondary)',
            fontWeight: 500,
          }}
        >
          <Filter size={14} />
          Filters {activeFilters > 0 && <span style={{ background: 'var(--accent-primary)', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700 }}>{activeFilters}</span>}
          <ChevronDown size={14} style={{ transform: filtersOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>
      </div>

      {/* Expandable filter panel */}
      {filtersOpen && (
        <div style={{
          display: 'flex', gap: '12px', flexWrap: 'wrap', padding: '14px 16px', marginBottom: '16px',
          background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>Plan</label>
            <select value={planFilter} onChange={e => { setPlanFilter(e.target.value as PlanFilter); setPage(0); }} style={selectStyle}>
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>Role</label>
            <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value as RoleFilter); setPage(0); }} style={selectStyle}>
              <option value="all">All Roles</option>
              <option value="user">User</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>Status</label>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as StatusFilter); setPage(0); }} style={selectStyle}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="paused">Paused</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text-secondary)' }}>Joined</label>
            <select value={dateFilter} onChange={e => { setDateFilter(e.target.value as DateFilter); setPage(0); }} style={selectStyle}>
              <option value="all">All Time</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          {activeFilters > 0 && (
            <button onClick={() => { setPlanFilter('all'); setRoleFilter('all'); setStatusFilter('all'); setDateFilter('all'); setPage(0); }} style={{ alignSelf: 'flex-end', fontSize: '12px', color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500, padding: '6px 0' }}>
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Results count */}
      {(searchQuery || activeFilters > 0) && (
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Showing {filteredUsers.length} of {users.length} users
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
          <Users size={48} style={{ margin: '0 auto 16px', opacity: 0.3 }} />
          <h3 style={{ color: 'var(--text-secondary)' }}>No users found</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Try adjusting your search or filters.</p>
        </div>
      ) : (
        <>
          {/* Card Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(340px, 1fr))' : '1fr',
            gap: viewMode === 'grid' ? '16px' : '8px',
          }}>
            {paginatedUsers.map(user => (
              <UserCard
                key={user.id}
                user={user}
                currentUserId={currentUser?.id}
                onManage={(u) => navigate(`/super-users/${u.id}`)}
                onToggleSuspension={handleToggleSuspension}
                onTogglePause={handleTogglePause}
                onImpersonate={handleImpersonate}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button className="btn btn-outline" onClick={() => setPage(p => p + 1)} style={{ fontSize: '13px' }}>
                Load More ({filteredUsers.length - paginatedUsers.length} remaining)
              </button>
            </div>
          )}
        </>
      )}


      {/* 🛠️ Hidden System Maintenance (Backup & Restore) Panel */}
      {showMaintenancePanel && (
        <div className="card animate-slideUp" style={{ marginTop: '24px', padding: '24px', border: '1px solid var(--border-primary)', borderRadius: '16px', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-primary)', paddingBottom: '12px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
              <Database size={18} style={{ color: 'var(--accent-primary)' }} />
              System Maintenance (Backup & Restore)
            </h3>
            <button className="btn-ghost btn-icon" onClick={() => setShowMaintenancePanel(false)} style={{ padding: '4px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
              <X size={18} />
            </button>
          </div>

          {!maintenanceUnlocked ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Lock size={32} style={{ color: 'var(--text-secondary)', marginBottom: '12px', opacity: 0.5 }} />
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                This area is password protected.
              </p>
              <button className="btn btn-primary" onClick={() => setPasswordPromptOpen(true)}>
                Unlock with Password
              </button>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '20px' }}>
                <div style={{ flex: 1, minWidth: '250px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--border-primary)' }}>
                  <h4 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                    <Download size={16} style={{ color: 'var(--accent-primary)' }} />
                    Export System Backup
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.4 }}>
                    Download a database-independent JSON backup file of all users, chats, posts, and keys.
                  </p>
                  <button 
                    className="btn btn-primary" 
                    onClick={handleExportBackup} 
                    disabled={isExporting || isRestoring}
                    style={{ width: '100%' }}
                  >
                    {isExporting ? 'Exporting...' : 'Export Backup JSON'}
                  </button>
                </div>

                <div style={{ flex: 1, minWidth: '250px', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--border-primary)' }}>
                  <h4 style={{ margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 600 }}>
                    <Upload size={16} style={{ color: '#10b981' }} />
                    Restore System Backup
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.4 }}>
                    Upload a previously exported JSON backup file to restore all tables and user data.
                  </p>
                  <form onSubmit={handleRestoreBackup} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input 
                      type="file" 
                      accept=".json"
                      onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                      style={{ fontSize: '12px', color: 'var(--text-primary)' }}
                    />
                    <button 
                      type="submit"
                      className="btn btn-secondary" 
                      disabled={isExporting || isRestoring || !selectedFile}
                      style={{ width: '100%', border: '1px solid #10b981', color: '#10b981', background: 'transparent' }}
                    >
                      {isRestoring ? 'Restoring...' : 'Restore Backup JSON'}
                    </button>
                  </form>
                </div>
              </div>

              {/* Progress Indicator */}
              {(isExporting || isRestoring) && (
                <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-tertiary)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{backupStatusText}</span>
                    <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{backupProgress}%</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: 'var(--border-primary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${backupProgress}%`, height: '100%', background: 'var(--accent-gradient, linear-gradient(90deg, #6366f1, #10b981))', transition: 'width 0.2s' }}></div>
                  </div>
                </div>
              )}

              {/* Activity Log Terminal */}
              {backupLog.length > 0 && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Maintenance Console Log</label>
                  <div style={{ 
                    background: '#0d0e10', 
                    color: '#34d399', 
                    fontFamily: 'monospace', 
                    fontSize: '11px', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    maxHeight: '150px', 
                    overflowY: 'auto',
                    border: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    {backupLog.map((log, idx) => (
                      <div key={idx} style={{ wordBreak: 'break-all' }}>{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 🔐 Password Prompt Modal */}
      {passwordPromptOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px'
          }}
          onClick={() => setPasswordPromptOpen(false)}
        >
          <form 
            onSubmit={handleUnlockMaintenance}
            className="card animate-scaleUp" 
            style={{
              maxWidth: '380px', 
              width: '100%', 
              background: 'var(--bg-primary, #111315)', 
              border: '1px solid var(--border-primary, rgba(255,255,255,0.08))',
              borderRadius: '16px',
              padding: '24px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.65)'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Lock size={18} style={{ color: 'var(--accent-primary)' }} />
                Verify Password
              </h3>
              <button 
                type="button"
                className="btn-ghost btn-icon" 
                onClick={() => setPasswordPromptOpen(false)}
                style={{ padding: '4px', borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.4 }}>
              Please confirm your Super Admin password to unlock system backup and restore operations.
            </p>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Password
              </label>
              <input 
                type="password"
                required
                placeholder="Enter your login password"
                className="form-input"
                value={adminPassword}
                onChange={e => setAdminPassword(e.target.value)}
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setPasswordPromptOpen(false)}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                style={{ 
                  background: 'var(--accent-gradient, linear-gradient(135deg, #6366f1, #8b5cf6))', 
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                Verify & Unlock
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
