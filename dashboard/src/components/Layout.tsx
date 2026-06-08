import { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu, MessageSquare, AlertTriangle, LogOut } from 'lucide-react';
import { supabase } from '../lib/supabase';
import FloatingAgentWidget from './FloatingAgentWidget';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [impersonating, setImpersonating] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = localStorage.getItem('autometabot_admin_session');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setImpersonating(parsed.targetEmail || 'Unknown User');
      } catch { setImpersonating(null); }
    }
  }, []);

  const handleExitImpersonation = useCallback(async () => {
    const stored = localStorage.getItem('autometabot_admin_session');
    if (!stored) return;

    try {
      const { accessToken, refreshToken } = JSON.parse(stored);
      localStorage.removeItem('autometabot_admin_session');

      // Restore the original admin session
      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      setImpersonating(null);
      navigate('/super-users');
      window.location.reload();
    } catch (err) {
      console.error('[Impersonation] Failed to restore admin session:', err);
      localStorage.removeItem('autometabot_admin_session');
      window.location.reload();
    }
  }, [navigate]);

  return (
    <div className="app-layout">
      {/* Impersonation Warning Banner */}
      {impersonating && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
          color: '#000',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          fontSize: '13px',
          fontWeight: 600,
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
        }}>
          <AlertTriangle size={16} />
          <span>
            You are viewing as <strong>{impersonating}</strong> — all actions will be performed as this user
          </span>
          <button
            onClick={handleExitImpersonation}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'rgba(0,0,0,0.15)',
              border: '1px solid rgba(0,0,0,0.2)',
              borderRadius: '6px',
              padding: '4px 12px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '12px',
              color: '#000',
            }}
          >
            <LogOut size={14} />
            Exit Impersonation
          </button>
        </div>
      )}

      {/* Mobile Header */}
      <header className="mobile-header" style={impersonating ? { marginTop: '36px' } : {}}>
        <button 
          className="btn-ghost btn-icon" 
          onClick={() => setSidebarOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={24} color="var(--text-primary)" />
        </button>
        <div className="mobile-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="sidebar-logo-icon" style={{ width: '28px', height: '28px' }}>
            <MessageSquare size={14} color="white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: '1rem', background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            AutometaBot
          </span>
        </div>
        <div style={{ width: '40px' }} /> {/* Spacer to balance flexbox layout */}
      </header>

      {/* Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="app-content animate-fadeIn" style={impersonating ? { paddingTop: 'calc(var(--spacing-xl) + 36px)' } : {}}>
        <Outlet />
      </main>
      <FloatingAgentWidget />
    </div>
  );
}
