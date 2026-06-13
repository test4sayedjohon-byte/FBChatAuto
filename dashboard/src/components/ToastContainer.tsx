import { useToast } from '../hooks/useToast';
import { X } from 'lucide-react';

const TOAST_COLORS: Record<string, { bg: string; border: string; icon: string }> = {
  success: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)', icon: '✓' },
  error:   { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', icon: '✕' },
  info:    { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.3)', icon: 'ℹ' },
  warning: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', icon: '⚠' },
};

/**
 * Toast notification container — renders all active toasts.
 * Mount once at the app root level.
 */
export default function ToastContainer() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: '8px',
      maxWidth: '400px',
    }}>
      {toasts.map(t => {
        const colors = TOAST_COLORS[t.type] || TOAST_COLORS.info;
        return (
          <div
            key={t.id}
            style={{
              background: colors.bg,
              backdropFilter: 'blur(12px)',
              border: `1px solid ${colors.border}`,
              borderRadius: '10px',
              padding: '12px 16px',
              color: '#fff',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              animation: 'slideIn 0.3s ease-out',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            }}
          >
            <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>
              {colors.icon}
            </span>
            <span style={{ flex: 1, lineHeight: '1.4' }}>{t.message}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeToast(t.id);
              }}
              className="toast-close-btn"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                margin: '-8px -8px -8px -4px',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .toast-close-btn {
          color: rgba(255,255,255,0.5);
          transition: color 0.15s ease, transform 0.15s ease;
        }
        .toast-close-btn:hover {
          color: rgba(255,255,255,0.9);
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
}
