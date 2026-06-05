import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
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
  Shield
} from 'lucide-react';

export default function Sidebar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();

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
        <h2>FBChatAuto</h2>
      </div>

      <nav className="sidebar-nav">
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
          </>
        )}

        <span className="sidebar-section-label">Settings</span>

        <NavLink to="/pages" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Globe className="nav-icon" />
          Facebook Pages
        </NavLink>
        
        <NavLink to="/fb-app" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Shield className="nav-icon" />
          Facebook App
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">
              {user?.user_metadata?.full_name || 'User'}
            </div>
            <div className="user-email">{user?.email}</div>
          </div>
          <button className="btn-ghost btn-icon" onClick={handleSignOut} title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
