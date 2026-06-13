import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Globe,
  FileText,
  BookOpen,
  MessageSquare,
  MessagesSquare,
  MoreVertical,
  UserCheck,
  Ban,
  Eye,
  Pause,
  Play,
} from 'lucide-react';
import type { SuperAdminUser } from './types';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface UserCardProps {
  user: SuperAdminUser;
  currentUserId?: string;
  onManage: (user: SuperAdminUser) => void;
  onToggleSuspension: (userId: string, currentStatus: boolean) => void;
  onTogglePause: (userId: string, currentStatus: boolean) => void;
  onImpersonate: (user: SuperAdminUser) => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const getInitials = (name: string): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
};

const avatarGradient = (role: SuperAdminUser['role']): string => {
  switch (role) {
    case 'super_admin':
      return 'linear-gradient(135deg, #a855f7, #7c3aed)';
    case 'admin':
      return 'linear-gradient(135deg, #3b82f6, #6366f1)';
    default:
      return 'linear-gradient(135deg, #6b7280, #4b5563)';
  }
};

const roleBadge = (role: SuperAdminUser['role']): { label: string; bg: string; color: string } => {
  switch (role) {
    case 'super_admin':
      return { label: 'Super Admin', bg: 'rgba(168,85,247,0.15)', color: '#c084fc' };
    case 'admin':
      return { label: 'Admin', bg: 'rgba(99,102,241,0.15)', color: '#818cf8' };
    default:
      return { label: 'User', bg: 'rgba(107,114,128,0.15)', color: '#9ca3af' };
  }
};

const planBadge = (plan: string): React.CSSProperties => {
  const lower = plan.toLowerCase();
  if (lower === 'enterprise') {
    return {
      background: 'linear-gradient(135deg, rgba(139,92,246,0.20), rgba(168,85,247,0.20))',
      color: '#c084fc',
      border: '1px solid rgba(139,92,246,0.25)',
    };
  }
  if (lower === 'pro') {
    return {
      background: 'linear-gradient(135deg, rgba(245,158,11,0.18), rgba(217,119,6,0.18))',
      color: '#fbbf24',
      border: '1px solid rgba(245,158,11,0.25)',
    };
  }
  return {
    background: 'rgba(107,114,128,0.12)',
    color: '#9ca3af',
    border: '1px solid rgba(107,114,128,0.15)',
  };
};

/* ------------------------------------------------------------------ */
/*  Keyframes injected once                                            */
/* ------------------------------------------------------------------ */

const KEYFRAMES_ID = '__usercard_keyframes__';

const ensureKeyframes = () => {
  if (typeof document === 'undefined') return;
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes uc-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;
  document.head.appendChild(style);
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const UserCard: React.FC<UserCardProps> = ({
  user,
  currentUserId,
  onManage,
  onToggleSuspension,
  onTogglePause,
  onImpersonate,
}) => {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Inject keyframes on mount
  useEffect(ensureKeyframes, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const isSelf = currentUserId === user.id;
  const suspended = user.is_suspended;
  const role = roleBadge(user.role);

  const handleManage = useCallback(() => onManage(user), [onManage, user]);
  const handleImpersonate = useCallback(() => {
    setMenuOpen(false);
    onImpersonate(user);
  }, [onImpersonate, user]);
  const handleToggleSuspend = useCallback(() => {
    setMenuOpen(false);
    onToggleSuspension(user.id, user.is_suspended);
  }, [onToggleSuspension, user.id, user.is_suspended]);

  /* ---- Metrics ---- */
  const metrics: { icon: React.ReactNode; label: string; value: number }[] = [
    { icon: <Globe size={13} />, label: 'Pages', value: user.pageCount },
    { icon: <FileText size={13} />, label: 'Docs', value: user.documentCount },
    { icon: <BookOpen size={13} />, label: 'KB', value: user.fieldCount },
    { icon: <MessageSquare size={13} />, label: 'Sessions', value: user.sessionCount },
    { icon: <MessagesSquare size={13} />, label: 'Messages', value: user.messageCount },
  ];

  /* ---- Styles ---- */
  const cardStyle: React.CSSProperties = {
    position: 'relative',
    background: 'var(--bg-secondary, #1a1d21)',
    border: `1px solid ${suspended ? 'rgba(239,68,68,0.35)' : user.is_paused ? 'rgba(156,163,175,0.35)' : 'var(--border-primary, rgba(255,255,255,0.06))'}`,
    borderRadius: 'var(--radius-md, 12px)',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    transition: 'transform 0.25s cubic-bezier(.4,0,.2,1), box-shadow 0.25s cubic-bezier(.4,0,.2,1), border-color 0.25s ease',
    transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
    boxShadow: hovered
      ? '0 8px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(99,102,241,0.10)'
      : 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.3))',
    opacity: (suspended || user.is_paused) ? 0.72 : 1,
    cursor: 'default',
    overflow: 'visible',
  };

  const avatarStyle: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: avatarGradient(user.role),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '0.5px',
    flexShrink: 0,
    boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
  };

  const badgeBase: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 6,
    letterSpacing: '0.3px',
    lineHeight: '18px',
    whiteSpace: 'nowrap',
  };

  const statusDot: React.CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: suspended ? 'var(--error, #ef4444)' : user.is_paused ? '#9ca3af' : '#22c55e',
    boxShadow: suspended
      ? '0 0 6px rgba(239,68,68,0.5)'
      : user.is_paused
        ? '0 0 6px rgba(156,163,175,0.5)'
        : '0 0 6px rgba(34,197,94,0.5)',
    animation: suspended ? 'uc-pulse 2s ease-in-out infinite' : 'none',
    flexShrink: 0,
  };

  return (
    <div
      style={cardStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ---- Header ---- */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={avatarStyle}>{getInitials(user.display_name)}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text-primary, #f3f4f6)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {user.display_name || 'Unnamed'}
              </span>
              <div style={statusDot} title={suspended ? 'Suspended' : user.is_paused ? 'Paused' : 'Active'} />
            </div>
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTogglePause(user.id, user.is_paused);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: user.is_paused ? 'var(--accent-primary, #6366f1)' : 'var(--text-secondary, #9ca3af)',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
              title={user.is_paused ? 'Resume Activity' : 'Pause Activity'}
            >
              {user.is_paused ? <Play size={14} /> : <Pause size={14} />}
            </button>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: 'var(--text-secondary, #9ca3af)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {user.email}
          </p>

          {/* Badges */}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <span style={{ ...badgeBase, background: role.bg, color: role.color }}>
              {role.label}
            </span>
            <span style={{ ...badgeBase, ...planBadge(user.plan) }}>
              {user.plan || 'Free'}
            </span>
            {user.is_paused && (
              <span
                style={{
                  ...badgeBase,
                  background: 'rgba(156,163,175,0.12)',
                  color: '#9ca3af',
                  border: '1px solid rgba(156,163,175,0.20)',
                }}
              >
                Paused
              </span>
            )}
            {suspended && (
              <span
                style={{
                  ...badgeBase,
                  background: 'rgba(239,68,68,0.12)',
                  color: '#f87171',
                  border: '1px solid rgba(239,68,68,0.20)',
                }}
              >
                Suspended
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ---- Metrics row ---- */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          background: 'var(--bg-tertiary, #232729)',
          borderRadius: 8,
          padding: '8px 10px',
        }}
      >
        {metrics.map((m) => (
          <div
            key={m.label}
            title={m.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              flex: 1,
            }}
          >
            <span style={{ color: 'var(--text-secondary, #9ca3af)', display: 'flex' }}>
              {m.icon}
            </span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--text-primary, #f3f4f6)',
                lineHeight: 1,
              }}
            >
              {m.value}
            </span>
            <span
              style={{
                fontSize: 10,
                color: 'var(--text-secondary, #9ca3af)',
                lineHeight: 1,
              }}
            >
              {m.label}
            </span>
          </div>
        ))}
      </div>

      {/* ---- Actions ---- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto' }}>
        <button
          onClick={handleManage}
          style={{
            flex: 1,
            padding: '8px 0',
            background: 'var(--accent-gradient, linear-gradient(135deg, #6366f1, #8b5cf6))',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'opacity 0.2s, transform 0.15s',
            letterSpacing: '0.2px',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget.style.opacity = '0.88');
            (e.currentTarget.style.transform = 'scale(0.98)');
          }}
          onMouseLeave={(e) => {
            (e.currentTarget.style.opacity = '1');
            (e.currentTarget.style.transform = 'scale(1)');
          }}
        >
          Manage →
        </button>

        {/* Overflow menu */}
        <div style={{ position: 'relative' }}>
          <button
            ref={triggerRef}
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: menuOpen
                ? 'var(--bg-tertiary, #232729)'
                : 'transparent',
              border: `1px solid ${menuOpen ? 'rgba(255,255,255,0.10)' : 'var(--border-primary, rgba(255,255,255,0.06))'}`,
              borderRadius: 8,
              color: 'var(--text-secondary, #9ca3af)',
              cursor: 'pointer',
              transition: 'background 0.2s, border-color 0.2s',
            }}
            onMouseEnter={(e) => {
              if (!menuOpen) e.currentTarget.style.background = 'var(--bg-tertiary, #232729)';
            }}
            onMouseLeave={(e) => {
              if (!menuOpen) e.currentTarget.style.background = 'transparent';
            }}
          >
            <MoreVertical size={16} />
          </button>

          {menuOpen && (
            <div
              ref={menuRef}
              style={{
                position: 'absolute',
                right: 0,
                bottom: '110%',
                minWidth: 160,
                background: 'var(--bg-secondary, #1a1d21)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 10,
                boxShadow: '0 12px 36px rgba(0,0,0,0.55)',
                padding: '4px',
                zIndex: 50,
                animation: 'none',
              }}
            >
              {user.role !== 'super_admin' && (
                <button
                  onClick={handleImpersonate}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 7,
                    color: 'var(--text-secondary, #9ca3af)',
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'background 0.15s, color 0.15s',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--bg-tertiary, #232729)';
                    e.currentTarget.style.color = 'var(--text-primary, #f3f4f6)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary, #9ca3af)';
                  }}
                >
                  <Eye size={14} />
                  Impersonate
                </button>
              )}


              <button
                onClick={handleToggleSuspend}
                disabled={isSelf}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 7,
                  color: isSelf
                    ? 'rgba(156,163,175,0.35)'
                    : suspended
                      ? '#22c55e'
                      : '#f87171',
                  fontSize: 13,
                  cursor: isSelf ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                  textAlign: 'left',
                  opacity: isSelf ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!isSelf) e.currentTarget.style.background = 'var(--bg-tertiary, #232729)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {suspended ? <UserCheck size={14} /> : <Ban size={14} />}
                {suspended ? 'Unsuspend' : 'Suspend'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserCard;
