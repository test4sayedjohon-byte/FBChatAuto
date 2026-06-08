import { useState, useCallback, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

let toastId = 0;
let addToastExternal: ((message: string, type: ToastType) => void) | null = null;

/**
 * Global toast function — can be called from anywhere (even outside React).
 * Usage: toast.success('Done!'), toast.error('Failed'), toast.info('Hey')
 */
export const toast = {
  success: (message: string) => addToastExternal?.(message, 'success'),
  error: (message: string) => addToastExternal?.(message, 'error'),
  info: (message: string) => addToastExternal?.(message, 'info'),
  warning: (message: string) => addToastExternal?.(message, 'warning'),
};

/**
 * Toast container hook — mount once in your app root.
 */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Register the external function so toast.success() etc. work globally
  useEffect(() => {
    addToastExternal = addToast;
    return () => { addToastExternal = null; };
  }, [addToast]);

  return { toasts, removeToast };
}
