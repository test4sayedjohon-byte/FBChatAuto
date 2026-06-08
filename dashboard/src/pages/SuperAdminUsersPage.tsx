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
import { workerPost } from '../lib/workerApi';
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
  Gift,
  X,
} from 'lucide-react';
import type { SuperAdminUser } from './super-admin/types';

// ── Filter types ─────────────────────────────────────────────────────────
type PlanFilter = 'all' | 'free' | 'pro' | 'enterprise';
type RoleFilter = 'all' | 'user' | 'admin' | 'super_admin';
type StatusFilter = 'all' | 'active' | 'suspended';
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

  // ── Gifting handler ────────────────────────────────────────────────────
  const [giftModalOpen, setGiftModalOpen] = useState(false);
  const [giftTargetUser, setGiftTargetUser] = useState<SuperAdminUser | null>(null);
  const [giftType, setGiftType] = useState<'agent_queries' | 'messages' | 'vision_queries'>('agent_queries');
  const [giftAmount, setGiftAmount] = useState<number>(50);
  const [giftCurrency, setGiftCurrency] = useState<'USD' | 'BTT'>('USD');
  const [giftPrice, setGiftPrice] = useState<string>('0.50');
  const [giftNotes, setGiftNotes] = useState<string>('');
  const [giftSubmitting, setGiftSubmitting] = useState(false);

  useEffect(() => {
    if (!giftAmount) {
      setGiftPrice('0');
      return;
    }
    let calculated = 0;
    if (giftType === 'agent_queries') {
      if (giftCurrency === 'USD') {
        calculated = giftAmount * 1.0;
        setGiftPrice(calculated.toFixed(2));
      } else {
        calculated = giftAmount * 130;
        setGiftPrice(Math.round(calculated).toString());
      }
    } else if (giftType === 'vision_queries') {
      if (giftCurrency === 'USD') {
        calculated = giftAmount * 0.10;
        setGiftPrice(calculated.toFixed(2));
      } else {
        calculated = giftAmount * 13;
        setGiftPrice(Math.round(calculated).toString());
      }
    } else {
      if (giftCurrency === 'USD') {
        calculated = giftAmount <= 500 ? giftAmount * 0.01 : giftAmount * 0.008;
        setGiftPrice(calculated.toFixed(2));
      } else {
        calculated = giftAmount <= 500 ? giftAmount * 1.3 : giftAmount * 1.04;
        setGiftPrice(Math.round(calculated).toString());
      }
    }
  }, [giftAmount, giftCurrency, giftType]);

  const openGiftModal = (user: SuperAdminUser, type: 'agent_queries' | 'messages' | 'vision_queries' = 'agent_queries') => {
    setGiftTargetUser(user);
    setGiftType(type);
    setGiftAmount(type === 'agent_queries' || type === 'vision_queries' ? 50 : 200);
    setGiftCurrency('USD');
    setGiftNotes(type === 'agent_queries' ? 'Gifted bonus queries' : type === 'vision_queries' ? 'Gifted vision queries' : 'Gifted message quota');
    setGiftModalOpen(true);
  };

  const handleGiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!giftTargetUser) return;
    setGiftSubmitting(true);
    try {
      const finalPrice = parseFloat(giftPrice) || 0;
      const currentMonth = new Date().toISOString().slice(0, 7);

      if (giftType === 'agent_queries') {
        // 1. Fetch user's current agent limit/extra details
        const { data: userRecord, error: userErr } = await supabase
          .from('users')
          .select('agent_extra_queries, agent_usage_month')
          .eq('id', giftTargetUser.id)
          .single();

        if (userErr || !userRecord) {
          throw new Error("User record not found in database: " + (userErr?.message || ''));
        }

        let nextExtraQueries = userRecord.agent_extra_queries ?? 0;
        
        // If the month has changed, reset extra queries to the gifted amount
        if (userRecord.agent_usage_month !== currentMonth) {
          nextExtraQueries = giftAmount;
        } else {
          nextExtraQueries += giftAmount;
        }

        // 2. Update user table
        const { error: updateErr } = await supabase
          .from('users')
          .update({
            agent_extra_queries: nextExtraQueries,
            agent_usage_month: currentMonth
          })
          .eq('id', giftTargetUser.id);

        if (updateErr) throw updateErr;

        // 3. Log to purchases table for user store visibility
        const { error: purchaseErr } = await supabase
          .from('purchases')
          .insert({
            user_id: giftTargetUser.id,
            channels_count: 0,
            message_addon: `Gift: +${giftAmount} AI Queries`,
            currency: giftCurrency,
            total_amount: finalPrice,
            payment_method: 'gift',
            status: 'approved',
            admin_notes: giftNotes || 'Gifted by administrator'
          });

        if (purchaseErr) {
          console.error("Purchase log insertion failed:", purchaseErr);
        }

        // 4. Log to admin audit logs
        await supabase.from('admin_audit_log').insert({
          admin_id: currentUser?.id,
          target_id: giftTargetUser.id,
          action: 'gift_agent_queries',
          details: { amount: giftAmount, price: finalPrice, currency: giftCurrency, notes: giftNotes }
        });

        toast.success(`Successfully gifted +${giftAmount} AI Queries to ${giftTargetUser.email}!`);
      } else if (giftType === 'vision_queries') {
        // Gifting vision queries
        const { data: userRecord, error: userErr } = await supabase
          .from('users')
          .select('vision_extra_queries, vision_usage_month')
          .eq('id', giftTargetUser.id)
          .single();

        if (userErr || !userRecord) {
          throw new Error("User record not found in database: " + (userErr?.message || ''));
        }

        let nextExtraQueries = userRecord.vision_extra_queries ?? 0;
        
        if (userRecord.vision_usage_month !== currentMonth) {
          nextExtraQueries = giftAmount;
        } else {
          nextExtraQueries += giftAmount;
        }

        const { error: updateErr } = await supabase
          .from('users')
          .update({
            vision_extra_queries: nextExtraQueries,
            vision_usage_month: currentMonth
          })
          .eq('id', giftTargetUser.id);

        if (updateErr) throw updateErr;

        const { error: purchaseErr } = await supabase
          .from('purchases')
          .insert({
            user_id: giftTargetUser.id,
            channels_count: 0,
            message_addon: `Gift: +${giftAmount} Vision Queries`,
            currency: giftCurrency,
            total_amount: finalPrice,
            payment_method: 'gift',
            status: 'approved',
            admin_notes: giftNotes || 'Gifted by administrator'
          });

        if (purchaseErr) {
          console.error("Purchase log insertion failed:", purchaseErr);
        }

        await supabase.from('admin_audit_log').insert({
          admin_id: currentUser?.id,
          target_id: giftTargetUser.id,
          action: 'gift_vision_queries',
          details: { amount: giftAmount, price: finalPrice, currency: giftCurrency, notes: giftNotes }
        });

        toast.success(`Successfully gifted +${giftAmount} Vision Queries to ${giftTargetUser.email}!`);
      } else {
        // Gifting regular messages
        // 1. Fetch user's current extra message limit
        const { data: userRecord, error: userErr } = await supabase
          .from('users')
          .select('extra_message_limit')
          .eq('id', giftTargetUser.id)
          .single();

        if (userErr || !userRecord) {
          throw new Error("User record not found in database: " + (userErr?.message || ''));
        }

        const nextExtraMessages = (userRecord.extra_message_limit ?? 0) + giftAmount;

        // 2. Update user table
        const { error: updateErr } = await supabase
          .from('users')
          .update({
            extra_message_limit: nextExtraMessages
          })
          .eq('id', giftTargetUser.id);

        if (updateErr) throw updateErr;

        // 3. Log to purchases table for user store visibility
        const { error: purchaseErr } = await supabase
          .from('purchases')
          .insert({
            user_id: giftTargetUser.id,
            channels_count: 0,
            message_addon: `Gift: +${giftAmount} Messages`,
            currency: giftCurrency,
            total_amount: finalPrice,
            payment_method: 'gift',
            status: 'approved',
            admin_notes: giftNotes || 'Gifted by administrator'
          });

        if (purchaseErr) {
          console.error("Purchase log insertion failed:", purchaseErr);
        }

        // 4. Log to admin audit logs
        await supabase.from('admin_audit_log').insert({
          admin_id: currentUser?.id,
          target_id: giftTargetUser.id,
          action: 'gift_messages',
          details: { amount: giftAmount, price: finalPrice, currency: giftCurrency, notes: giftNotes }
        });

        toast.success(`Successfully gifted +${giftAmount} Messages to ${giftTargetUser.email}!`);
      }

      setGiftModalOpen(false);
      loadUsers(); // Refresh users list
    } catch (err: any) {
      toast.error("Gifting failed: " + err.message);
    } finally {
      setGiftSubmitting(false);
    }
  };

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
    if (statusFilter === 'active' && u.is_suspended) return false;
    if (statusFilter === 'suspended' && !u.is_suspended) return false;

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
  const totalActive = users.filter(u => !u.is_suspended).length;
  const totalSuspended = users.filter(u => u.is_suspended).length;
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
            <Users size={26} style={{ color: 'var(--accent-primary)' }} />
            Users
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            {users.length} total • {totalActive} active • {totalSuspended} suspended
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
                onImpersonate={handleImpersonate}
                onGiftQueries={openGiftModal}
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

      {/* 🎁 Gift Queries Modal */}
      {giftModalOpen && giftTargetUser && (
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
            zIndex: 9999,
            padding: '16px'
          }}
          onClick={() => setGiftModalOpen(false)}
        >
          <form 
            onSubmit={handleGiftSubmit}
            className="card animate-scaleUp" 
            style={{
              maxWidth: '480px', 
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
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                <Gift size={20} style={{ color: giftType === 'agent_queries' ? 'var(--accent-primary, #6366f1)' : giftType === 'vision_queries' ? '#10b981' : '#3b82f6' }} />
                Gift Extra {giftType === 'agent_queries' ? 'AI Queries' : giftType === 'vision_queries' ? 'Vision Queries' : 'Messages'}
              </h3>
              <button 
                type="button"
                className="btn-ghost btn-icon" 
                onClick={() => setGiftModalOpen(false)}
                style={{ padding: '4px', borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Gift Type Switcher */}
            <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', marginBottom: '16px', gap: '4px' }}>
              <button
                type="button"
                onClick={() => {
                  setGiftType('agent_queries');
                  setGiftAmount(50);
                  setGiftNotes('Gifted bonus queries');
                }}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: giftType === 'agent_queries' ? 'var(--accent-primary, #6366f1)' : 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                AI Queries
              </button>
              <button
                type="button"
                onClick={() => {
                  setGiftType('vision_queries');
                  setGiftAmount(50);
                  setGiftNotes('Gifted vision queries');
                }}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: giftType === 'vision_queries' ? '#10b981' : 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                Vision Queries
              </button>
              <button
                type="button"
                onClick={() => {
                  setGiftType('messages');
                  setGiftAmount(200);
                  setGiftNotes('Gifted message quota');
                }}
                style={{
                  flex: 1,
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: giftType === 'messages' ? '#3b82f6' : 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '600',
                  transition: 'all 0.2s'
                }}
              >
                Monthly Messages
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px', lineHeight: 1.4 }}>
              Add extra {giftType === 'agent_queries' ? 'AI Agent queries' : giftType === 'vision_queries' ? 'Vision/Image queries' : 'Monthly messages'} for <strong>{giftTargetUser.display_name || giftTargetUser.email}</strong>. The price will be calculated automatically but you can modify it as needed.
            </p>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                  {giftType === 'agent_queries' ? 'Queries Amount' : giftType === 'vision_queries' ? 'Vision Queries Amount' : 'Messages Amount'}
                </label>
                <input 
                  type="number"
                  min="1"
                  required
                  className="form-input"
                  value={giftAmount}
                  onChange={e => setGiftAmount(Math.max(1, parseInt(e.target.value) || 0))}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: '90px' }}>
                <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>Currency</label>
                <select 
                  className="form-input"
                  value={giftCurrency}
                  onChange={e => setGiftCurrency(e.target.value as 'USD' | 'BTT')}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                >
                  <option value="USD">USD ($)</option>
                  <option value="BTT">BTT</option>
                </select>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Total Price (Calculated automatically, but editable)
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 'bold', fontSize: '14px', color: 'var(--text-secondary)' }}>
                  {giftCurrency === 'BTT' ? 'BTT' : '$'}
                </span>
                <input 
                  type="text"
                  required
                  className="form-input"
                  value={giftPrice}
                  onChange={e => setGiftPrice(e.target.value)}
                  style={{ paddingLeft: giftCurrency === 'BTT' ? '45px' : '28px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
                Admin Notes / Log Reason
              </label>
              <textarea
                className="form-input"
                placeholder="e.g. Loyalty gift, refund compensation"
                rows={2}
                value={giftNotes}
                onChange={e => setGiftNotes(e.target.value)}
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', padding: '10px', resize: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => setGiftModalOpen(false)}
                disabled={giftSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={giftSubmitting}
                style={{ 
                  background: 'var(--accent-gradient, linear-gradient(135deg, #6366f1, #8b5cf6))', 
                  border: 'none',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {giftSubmitting ? 'Processing...' : 'Confirm Gift 🎁'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
