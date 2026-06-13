// ─── ContextMenu Component ─────────────────────────────────────────────────
// Renders a small absolute-positioned panel when user right-clicks a node.
// Provides: Duplicate, Edit (select), Delete.
// ───────────────────────────────────────────────────────────────────────────
import { Copy, Trash2, Settings } from 'lucide-react';
import type { ContextMenuState } from './types';

interface ContextMenuProps {
  menu: ContextMenuState;
  onDuplicate: (nodeId: string) => void;
  onEdit: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onClose: () => void;
}

export default function ContextMenu({
  menu,
  onDuplicate,
  onEdit,
  onDelete,
  onClose,
}: ContextMenuProps) {
  const { nodeId, x, y } = menu;

  function wrap(fn: () => void) {
    return () => {
      fn();
      onClose();
    };
  }

  return (
    <>
      {/* Transparent backdrop to close on outside click */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 998,
          background: 'transparent',
        }}
        onClick={onClose}
      />

      {/* Menu panel */}
      <div
        style={{
          position: 'fixed',
          left: x,
          top: y,
          zIndex: 999,
          minWidth: '168px',
          background: 'rgba(18, 20, 26, 0.97)',
          backdropFilter: 'blur(14px)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.7)',
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
        }}
        onClick={e => e.stopPropagation()}
      >
        <ContextMenuButton
          icon={<Settings size={13} />}
          label="Edit / Inspect"
          onClick={wrap(() => onEdit(nodeId))}
          color="var(--text-primary)"
        />
        <ContextMenuButton
          icon={<Copy size={13} />}
          label="Duplicate Block"
          onClick={wrap(() => onDuplicate(nodeId))}
          color="#60a5fa"
        />
        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)', margin: '3px 0' }} />
        <ContextMenuButton
          icon={<Trash2 size={13} />}
          label="Delete Block"
          onClick={wrap(() => onDelete(nodeId))}
          color="#f87171"
        />
      </div>
    </>
  );
}

// ─── Sub-component: individual menu button ─────────────────────────────────
interface CtxBtnProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: string;
}

function ContextMenuButton({ icon, label, onClick, color }: CtxBtnProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '9px',
        width: '100%',
        padding: '7px 10px',
        background: 'transparent',
        border: 'none',
        borderRadius: '7px',
        color,
        fontSize: '12px',
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.12s ease',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {label}
    </button>
  );
}
