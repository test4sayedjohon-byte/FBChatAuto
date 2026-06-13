import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';

interface UndoAction {
  id: string;
  message: string;
  onExecute: () => Promise<void>;
  onCancel?: () => void;
  duration?: number;
}

interface UndoContextType {
  triggerUndoable: (message: string, onExecute: () => Promise<void>, onCancel?: () => void, duration?: number) => void;
}

const UndoContext = createContext<UndoContextType | null>(null);

export const useUndo = () => {
  const context = useContext(UndoContext);
  if (!context) {
    throw new Error('useUndo must be used within an UndoProvider');
  }
  return context;
};

export function UndoProvider({ children }: { children: ReactNode }) {
  const [pendingUndo, setPendingUndo] = useState<UndoAction | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitUndoable = useCallback(async (action: UndoAction) => {
    setPendingUndo(null);
    try {
      await action.onExecute();
    } catch (err) {
      console.error('Failed to execute undoable action', err);
    }
  }, []);

  const triggerUndoable = useCallback((
    message: string,
    onExecute: () => Promise<void>,
    onCancel?: () => void,
    duration = 5000
  ) => {
    // If there's already a pending action, execute it immediately
    if (pendingUndo && timerRef.current) {
      clearTimeout(timerRef.current);
      commitUndoable(pendingUndo);
    }

    const id = Math.random().toString(36).substring(7);
    const newAction = { id, message, onExecute, onCancel, duration };

    setPendingUndo(newAction);
  }, [pendingUndo, commitUndoable]);

  const cancelUndoable = useCallback(() => {
    if (pendingUndo) {
      if (pendingUndo.onCancel) pendingUndo.onCancel();
      setPendingUndo(null);
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [pendingUndo]);

  useEffect(() => {
    if (pendingUndo) {
      timerRef.current = setTimeout(() => {
        commitUndoable(pendingUndo);
      }, pendingUndo.duration);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pendingUndo, commitUndoable]);

  return (
    <UndoContext.Provider value={{ triggerUndoable }}>
      {children}
      {pendingUndo && (
        <UndoToast
          key={pendingUndo.id}
          message={pendingUndo.message}
          onUndo={cancelUndoable}
          duration={pendingUndo.duration}
        />
      )}
    </UndoContext.Provider>
  );
}

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  duration?: number;
}

function UndoToast({ message, onUndo, duration = 5000 }: UndoToastProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining === 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration]);

  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#151719',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      color: 'white',
      padding: '12px 16px',
      borderRadius: '8px',
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
      zIndex: 9999,
      minWidth: '320px',
      justifyContent: 'space-between',
      overflow: 'hidden',
      animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
    }}>
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        height: '3px',
        backgroundColor: '#60a5fa',
        width: `${progress}%`,
        transition: 'width 50ms linear'
      }} />
      <span style={{ fontSize: '14px', fontWeight: 500 }}>{message}</span>
      <button
        onClick={() => {
          onUndo();
        }}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: '#60a5fa',
          padding: '6px 14px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
          transition: 'all 0.15s ease'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        }}
      >
        Undo
      </button>
    </div>
  );
}
