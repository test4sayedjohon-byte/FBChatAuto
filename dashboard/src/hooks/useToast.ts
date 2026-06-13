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

function cleanErrorMessage(msg: string): string {
  if (typeof msg !== 'string') return 'An unexpected error occurred.';

  const lowerMsg = msg.toLowerCase();
  
  if (
    lowerMsg.includes('429') || 
    lowerMsg.includes('rate-limit') || 
    lowerMsg.includes('rate limit') || 
    lowerMsg.includes('too many requests')
  ) {
    let retryAfter = '';
    const match = msg.match(/retry_after_seconds["']?\s*:\s*(\d+)/i) || 
                  msg.match(/Retry-After["']?\s*:\s*["']?(\d+)/i) ||
                  msg.match(/retry_after_seconds_raw["']?\s*:\s*(\d+)/i);
    if (match && match[1]) {
      retryAfter = ` (Please retry in ${match[1]} seconds)`;
    }
    return `AI service is temporarily busy due to rate limits. The fallback system is processing your request.${retryAfter}`;
  }

  if (msg.trim().startsWith('{') && msg.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.error?.message) {
        return cleanErrorMessage(parsed.error.message);
      }
      if (parsed.message) {
        return cleanErrorMessage(parsed.message);
      }
    } catch (e) {
      // ignore
    }
  }

  let cleaned = msg;
  cleaned = cleaned.replace(/^openrouter returned \d+:\s*/i, '');
  cleaned = cleaned.replace(/^error:\s*/i, '');
  cleaned = cleaned.replace(/^failed to get response:\s*/i, '');
  
  return cleaned;
}

/**
 * Toast container hook — mount once in your app root.
 */
export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++toastId;
    const finalMessage = type === 'error' ? cleanErrorMessage(message) : message;
    setToasts(prev => [{ id, message: finalMessage, type }, ...prev]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
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
