import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  Cpu,
  Globe,
  LogOut,
  MessageSquare,
  Bot,
  Users,
  Shield,
  ChevronUp,
  DollarSign
} from 'lucide-react';

export default function Sidebar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingPurchases, setPendingPurchases] = useState(0);

  useEffect(() => {
    if (profile?.is_super_admin) {
      loadPendingPurchases();
      
      // Optional: Set up real-time subscription for purchases
      const sub = supabase.channel('purchases_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, () => {
          loadPendingPurchases();
        })
        .subscribe();
        
      return () => { sub.unsubscribe(); };
    }
  }, [profile]);

  async function loadPendingPurchases() {
    const { count } = await supabase
      .from('purchases')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (count !== null) setPendingPurchases(count);
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <MessageSquare size={18} color="white" />
        </div>
        <h2>AutometaBot</h2>
      </div>

      <nav className="sidebar-nav">
        {!profile?.is_super_admin && (
          <>
            <span className="sidebar-section-label">Main</span>

            <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <LayoutDashboard className="nav-icon" />
              Dashboard
            </NavLink>
            
            <NavLink to="/inbox" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <MessageSquare className="nav-icon" />
              Inbox
            </NavLink>

            <NavLink to="/sandbox" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Bot className="nav-icon" />
              Chat Sandbox
            </NavLink>

            <NavLink to="/knowledge" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <BookOpen className="nav-icon" />
              Knowledge Base
            </NavLink>

            <NavLink to="/documents" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <FileText className="nav-icon" />
              Documents
            </NavLink>
          </>
        )}

        {profile?.is_super_admin && (
          <>
            <span className="sidebar-section-label">Super Admin</span>
            <NavLink to="/super-stats" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <LayoutDashboard className="nav-icon" />
              Global Stats
            </NavLink>
            <NavLink to="/super-users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Users className="nav-icon" />
              Users & Tenants
            </NavLink>
            <NavLink to="/providers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Cpu className="nav-icon" />
              AI Providers
            </NavLink>
            <NavLink to="/super-purchases" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div style={{display:'flex', alignItems:'center'}}>
                <DollarSign className="nav-icon" />
                Purchases
              </div>
              {pendingPurchases > 0 && (
                <span style={{background: 'var(--error)', color: 'white', fontSize: '10px', padding: '2px 6px', borderRadius: '10px', fontWeight: 'bold'}}>
                  {pendingPurchases}
                </span>
              )}
            </NavLink>
          </>
        )}

        {!profile?.is_super_admin && (
          <>
            <span className="sidebar-section-label">Settings</span>

            <NavLink to="/pages" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Globe className="nav-icon" />
              Meta Channels
            </NavLink>

            <NavLink to="/store" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <DollarSign className="nav-icon" />
              Upgrade Store
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer" style={{ position: 'relative' }}>
        {menuOpen && (
          <div style={{
            position: 'absolute',
            bottom: '76px',
            left: '12px',
            right: '12px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            padding: '4px'
          }}>

            <NavLink 
              to="/fb-app" 
              onClick={() => setMenuOpen(false)}
              className="nav-item"
              style={{
                padding: '8px 12px',
                fontSize: '0.8rem',
                margin: 0
              }}
            >
              <Shield size={14} className="nav-icon" />
              Meta App Settings
            </NavLink>
            <button 
              onClick={() => { setMenuOpen(false); handleSignOut(); }}
              className="nav-item"
              style={{
                padding: '8px 12px',
                fontSize: '0.8rem',
                color: 'var(--error)',
                margin: 0
              }}
            >
              <LogOut size={14} className="nav-icon" />
              Sign Out
            </button>
          </div>
        )}
        <div className="user-profile">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">
              {user?.user_metadata?.full_name || 'User'}
            </div>
            <div className="user-email">{user?.email}</div>
          </div>
          <button className={`btn-ghost btn-icon ${menuOpen ? 'active' : ''}`} onClick={() => setMenuOpen(!menuOpen)} title="Account Settings">
            <ChevronUp size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
