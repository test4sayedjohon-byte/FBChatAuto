
import { CheckCircle, FileText, Trash2, X, Loader2 } from 'lucide-react';

interface BulkActionsBarProps {
  selectedCount: number;
  onApprove: () => void;
  onDelete: () => void;
  onDraft: () => void;
  onClear: () => void;
  loading?: boolean;
}

export function BulkActionsBar({
  selectedCount,
  onApprove,
  onDelete,
  onDraft,
  onClear,
  loading = false
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(10, 10, 10, 0.85)',
      backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.6), 0 0 20px var(--accent-primary-glow)',
      borderRadius: '16px',
      padding: '12px 24px',
      display: 'flex',
      alignItems: 'center',
      gap: '24px',
      zIndex: 1500,
      width: '90%',
      maxWidth: '520px',
      animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      {/* Count Info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{
          background: 'var(--accent-primary)',
          color: '#fff',
          fontWeight: 800,
          fontSize: '0.85rem',
          height: '24px',
          minWidth: '24px',
          padding: '0 6px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {selectedCount}
        </div>
        <span style={{ fontSize: '0.85rem', fontWeight: 650, color: 'var(--text-primary)' }}>
          Selected
        </span>
      </div>

      {/* Vertical Separator */}
      <div style={{ width: '1px', height: '24px', background: 'rgba(255, 255, 255, 0.08)' }} />

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, justifyContent: 'center' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <Loader2 size={16} className="animate-spin" />
            Executing actions...
          </div>
        ) : (
          <>
            <button
              onClick={onApprove}
              title="Approve posts"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(52, 211, 153, 0.08)',
                border: '1px solid rgba(52, 211, 153, 0.2)',
                borderRadius: '8px',
                color: '#34d399',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <CheckCircle size={14} />
              Approve
            </button>

            <button
              onClick={onDraft}
              title="Convert to drafts"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: '8px',
                color: '#f59e0b',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <FileText size={14} />
              Draft
            </button>

            <button
              onClick={onDelete}
              title="Delete selected posts"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                color: '#ef4444',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s'
              }}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </>
        )}
      </div>

      {/* Clear/Close Selection */}
      <button
        onClick={onClear}
        disabled={loading}
        title="Clear selection"
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          opacity: 0.6
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
