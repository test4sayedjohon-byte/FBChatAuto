import React, { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  typeToConfirm?: string;
  loading?: boolean;
}

const variantColors: Record<string, { bg: string; hover: string; text: string }> = {
  danger: { bg: '#ef4444', hover: '#dc2626', text: '#ffffff' },
  warning: { bg: '#f59e0b', hover: '#d97706', text: '#000000' },
  info: { bg: '#6366f1', hover: '#4f46e5', text: '#ffffff' },
};

const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  typeToConfirm,
  loading = false,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typedValue, setTypedValue] = useState('');
  const [confirmHovered, setConfirmHovered] = useState(false);
  const [cancelHovered, setCancelHovered] = useState(false);

  const colors = variantColors[variant];
  const isConfirmDisabled =
    loading || (typeToConfirm !== undefined && typedValue !== typeToConfirm);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Reset typed value when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setTypedValue('');
    }
  }, [isOpen]);

  // Handle backdrop click (clicking on the dialog element itself, not its content)
  const handleDialogClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current && !loading) {
      onClose();
    }
  };

  // Handle native cancel event (Escape key)
  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!loading) {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClick={handleDialogClick}
      onCancel={handleCancel}
      style={{
        position: 'fixed',
        border: 'none',
        borderRadius: 'var(--radius-lg, 16px)',
        padding: 0,
        maxWidth: 440,
        width: '90vw',
        background: 'var(--bg-secondary, #1a1d21)',
        color: 'var(--text-primary, #f3f4f6)',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
        overflow: 'hidden',
      }}
    >
      {/* Backdrop style injected via ::backdrop pseudo-element workaround */}
      <style>{`
        dialog::backdrop {
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
      `}</style>

      <div style={{ padding: '24px' }}>
        {/* Title */}
        <h2
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 600,
            color: 'var(--text-primary, #f3f4f6)',
            lineHeight: 1.4,
          }}
        >
          {title}
        </h2>

        {/* Description */}
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 14,
            color: 'var(--text-secondary, #9ca3af)',
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>

        {/* Type to confirm input */}
        {typeToConfirm !== undefined && (
          <div style={{ marginTop: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 13,
                color: 'var(--text-secondary, #9ca3af)',
                marginBottom: 6,
              }}
            >
              Type{' '}
              <span
                style={{
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  color: 'var(--text-primary, #f3f4f6)',
                  backgroundColor: 'var(--bg-tertiary, #232729)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 13,
                }}
              >
                {typeToConfirm}
              </span>{' '}
              to confirm
            </label>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={`Type ${typeToConfirm} to confirm`}
              disabled={loading}
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%',
                padding: '8px 12px',
                fontSize: 14,
                fontFamily: 'monospace',
                backgroundColor: 'var(--bg-primary, #111315)',
                color: 'var(--text-primary, #f3f4f6)',
                border: '1px solid var(--border-primary, rgba(255,255,255,0.06))',
                borderRadius: 'var(--radius-md, 12px)',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = colors.bg;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor =
                  'var(--border-primary, rgba(255,255,255,0.06))';
              }}
            />
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            marginTop: 20,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            onMouseEnter={() => setCancelHovered(true)}
            onMouseLeave={() => setCancelHovered(false)}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 'var(--radius-md, 12px)',
              border: '1px solid var(--border-primary, rgba(255,255,255,0.06))',
              backgroundColor: cancelHovered
                ? 'var(--bg-tertiary, #232729)'
                : 'transparent',
              color: 'var(--text-secondary, #9ca3af)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.15s ease',
            }}
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirmDisabled}
            onMouseEnter={() => setConfirmHovered(true)}
            onMouseLeave={() => setConfirmHovered(false)}
            style={{
              padding: '8px 16px',
              fontSize: 14,
              fontWeight: 500,
              borderRadius: 'var(--radius-md, 12px)',
              border: 'none',
              backgroundColor: isConfirmDisabled
                ? `${colors.bg}66`
                : confirmHovered
                  ? colors.hover
                  : colors.bg,
              color: isConfirmDisabled ? `${colors.text}99` : colors.text,
              cursor: isConfirmDisabled ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              transition: 'background-color 0.15s ease, opacity 0.15s ease',
            }}
          >
            {loading && (
              <Loader2
                size={14}
                style={{
                  animation: 'confirmation-dialog-spin 1s linear infinite',
                }}
              />
            )}
            {confirmText}
          </button>
        </div>
      </div>

      {/* Spinner keyframes */}
      <style>{`
        @keyframes confirmation-dialog-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </dialog>
  );
};

export default ConfirmationDialog;
