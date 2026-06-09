import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  Loader2, 
  Send, 
  X, 
  Move, 
  Sparkles,
  Calendar,
  Bot
} from 'lucide-react';
import { workerPost } from '../lib/workerApi';
import { toast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';

interface ChatMessage {
  role: string;
  content: string;
  timestamp?: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}

export default function ContentCopilotWidget() {
  const { user } = useAuth();
  if (!user) return null; // Only show for logged in users

  // --- Widget Visibility State ---
  const [isOpen, setIsOpen] = useState(() => {
    return localStorage.getItem('copilot_widget_open') === 'true';
  });

  // --- Sessions History State ---
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('copilot_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse copilot_sessions', e);
      }
    }
    // Default initial session
    const initialSession: ChatSession = {
      id: 'copilot-session-' + Date.now(),
      title: 'Content Assistant',
      messages: [
        {
          role: 'assistant',
          content: "Hi! I am your Content & Moderation Copilot. ✍️📅\n\nI am fully equipped to schedule posts, manage auto-comments, and set up moderation rules for you.\n\nTry asking me:\n• 'Schedule a post about Summer Sale for tomorrow at 3 PM'\n• 'Hide negative comments on Johon and reply to check DM'\n• 'List my connected channels'\n• 'Show my upcoming scheduled posts'",
          timestamp: Date.now()
        }
      ],
      createdAt: Date.now()
    };
    return [initialSession];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const saved = localStorage.getItem('copilot_active_session_id');
    if (saved) return saved;
    return sessions[0]?.id || '';
  });

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [];

  // --- Widget Inputs State ---
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- Position State (Draggable) ---
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const saved = localStorage.getItem('copilot_widget_position');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    const w = window.innerWidth || 1024;
    const h = window.innerHeight || 768;
    const isM = w <= 768;
    if (isM) {
      return {
        x: w - 72,
        y: h - 144  // Stacked above the default System Agent if on same page
      };
    }
    return { 
      x: w - 96, 
      y: h - 160 
    };
  });

  const widgetRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  const getCloseButtonOffset = () => {
    if (isMobile) return 271;
    return 351; // 380 (chat window width) - 29 (padding/half-width)
  };

  const getWindowLeft = () => {
    return position.x + 28 - getCloseButtonOffset();
  };

  const getWindowTop = () => {
    return position.y + 3;
  };

  const getWidgetWidth = () => {
    if (isMobile) return isOpen ? 300 : 56;
    return isOpen ? 380 : 56;
  };

  const getWidgetHeight = () => {
    if (isMobile) return isOpen ? 400 : 56;
    return isOpen ? 520 : 56;
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync session changes to localStorage
  useEffect(() => {
    localStorage.setItem('copilot_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('copilot_active_session_id', activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    localStorage.setItem('copilot_widget_open', String(isOpen));
  }, [isOpen]);

  // Keep window in bounds when layout properties change
  useEffect(() => {
    if (!isOpen) return;
    
    const currentW = getWidgetWidth();
    const currentH = getWidgetHeight();
    const offset = getCloseButtonOffset();
    const windowLeft = position.x + 28 - offset;
    const windowTop = position.y + 3;
    
    let adjustedLeft = Math.max(10, Math.min(windowLeft, window.innerWidth - currentW - 10));
    let adjustedTop = Math.max(10, Math.min(windowTop, window.innerHeight - currentH - 10));
    
    if (adjustedLeft !== windowLeft || adjustedTop !== windowTop) {
      const newX = adjustedLeft + offset - 28;
      const newY = adjustedTop - 3;
      setPosition({ x: newX, y: newY });
      localStorage.setItem('copilot_widget_position', JSON.stringify({ x: newX, y: newY }));
    }
  }, [isOpen]);

  // Boundaries checking
  useEffect(() => {
    const buttonSize = 56;
    if (isOpen) {
      if (!isMobile) {
        const w = getWidgetWidth();
        const h = getWidgetHeight();
        const x = Math.max(10, Math.min(position.x, window.innerWidth - w - 10));
        const y = Math.max(10, Math.min(position.y, window.innerHeight - h - 10));
        if (x !== position.x || y !== position.y) {
          setPosition({ x, y });
        }
      }
    } else {
      const x = Math.max(10, Math.min(position.x, window.innerWidth - buttonSize - 10));
      const y = Math.max(10, Math.min(position.y, window.innerHeight - buttonSize - 10));
      if (x !== position.x || y !== position.y) {
        setPosition({ x, y });
      }
    }
  }, [isOpen, isMobile, window.innerWidth, window.innerHeight]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Auto-resize chat textarea based on input text
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '34px';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 110;
      if (scrollHeight > 34) {
        textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      }
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // --- Chat Handlers ---
  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user', content: input.trim(), timestamp: Date.now() };
    const updatedMessages = [...messages, userMessage];

    setSessions(prev => prev.map(s => s.id === activeSessionId ? {
      ...s,
      messages: updatedMessages
    } : s));

    setInput('');
    setIsLoading(true);

    try {
      const data = await workerPost('/api/agent/chat', { 
        messages: updatedMessages,
        channelId: 'global',
        contextType: 'global',
        agentType: 'content_copilot'
      });
      
      if (data.message) {
        setSessions(prev => prev.map(s => s.id === activeSessionId ? {
          ...s,
          messages: [...updatedMessages, { role: 'assistant', content: data.message.content, timestamp: Date.now() }]
        } : s));
        
        if (data.databaseUpdated) {
          // Send event to tell the dashboard to load fresh calendar/rules data!
          window.dispatchEvent(new Event('agent-data-updated'));
          toast.success('Calendar and automation rules synced.');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to get response');
      setSessions(prev => prev.map(s => s.id === activeSessionId ? {
        ...s,
        messages: [...updatedMessages, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.', timestamp: Date.now() }]
      } : s));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent, type: 'head' | 'window') => {
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('select') ||
      (e.target as HTMLElement).closest('input') ||
      (e.target as HTMLElement).closest('textarea')
    ) {
      return;
    }

    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const initialX = position.x;
    const initialY = position.y;
    let hasDragged = false;

    const currentW = getWidgetWidth();
    const currentH = getWidgetHeight();
    let finalX = initialX;
    let finalY = initialY;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length === 0) return;
      const currentTouch = moveEvent.touches[0];
      const deltaX = currentTouch.clientX - startX;
      const deltaY = currentTouch.clientY - startY;

      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasDragged = true;
      }

      if (moveEvent.cancelable) {
        moveEvent.preventDefault();
      }

      if (type === 'window') {
        const offset = getCloseButtonOffset();
        const initialWindowLeft = initialX + 28 - offset;
        const initialWindowTop = initialY + 3;
        
        const targetLeft = initialWindowLeft + deltaX;
        const targetTop = initialWindowTop + deltaY;
        
        const constrainedLeft = Math.max(10, Math.min(targetLeft, window.innerWidth - currentW - 10));
        const constrainedTop = Math.max(10, Math.min(targetTop, window.innerHeight - currentH - 10));
        
        finalX = constrainedLeft + offset - 28;
        finalY = constrainedTop - 3;
      } else {
        finalX = Math.max(10, Math.min(initialX + deltaX, window.innerWidth - currentW - 10));
        finalY = Math.max(10, Math.min(initialY + deltaY, window.innerHeight - currentH - 10));
      }
      setPosition({ x: finalX, y: finalY });
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);

      if (type === 'head' && !hasDragged) {
        setIsOpen(true);
      } else {
        localStorage.setItem('copilot_widget_position', JSON.stringify({ x: finalX, y: finalY }));
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleDragStart = (e: React.MouseEvent, type: 'head' | 'window') => {
    if (isMobile) {
      if (type === 'head') setIsOpen(true);
      return;
    }

    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('select') ||
      (e.target as HTMLElement).closest('input') ||
      (e.target as HTMLElement).closest('textarea')
    ) {
      return;
    }

    const startX = e.clientX;
    const startY = e.clientY;
    const initialX = position.x;
    const initialY = position.y;
    let hasDragged = false;
    const currentW = getWidgetWidth();
    const currentH = getWidgetHeight();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
        hasDragged = true;
      }

      if (type === 'window') {
        const offset = getCloseButtonOffset();
        const initialWindowLeft = initialX + 28 - offset;
        const initialWindowTop = initialY + 3;
        
        const targetLeft = initialWindowLeft + deltaX;
        const targetTop = initialWindowTop + deltaY;
        
        const constrainedLeft = Math.max(10, Math.min(targetLeft, window.innerWidth - currentW - 10));
        const constrainedTop = Math.max(10, Math.min(targetTop, window.innerHeight - currentH - 10));
        
        const newX = constrainedLeft + offset - 28;
        const newY = constrainedTop - 3;
        setPosition({ x: newX, y: newY });
      } else {
        const newX = Math.max(10, Math.min(initialX + deltaX, window.innerWidth - currentW - 10));
        const newY = Math.max(10, Math.min(initialY + deltaY, window.innerHeight - currentH - 10));
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      if (type === 'head' && !hasDragged) {
        setIsOpen(true);
      } else {
        const deltaX = upEvent.clientX - startX;
        const deltaY = upEvent.clientY - startY;
        let finalX = initialX + deltaX;
        let finalY = initialY + deltaY;
        
        if (type === 'window') {
          const offset = getCloseButtonOffset();
          const initialWindowLeft = initialX + 28 - offset;
          const initialWindowTop = initialY + 3;
          
          const targetLeft = initialWindowLeft + deltaX;
          const targetTop = initialWindowTop + deltaY;
          
          const constrainedLeft = Math.max(10, Math.min(targetLeft, window.innerWidth - currentW - 10));
          const constrainedTop = Math.max(10, Math.min(targetTop, window.innerHeight - currentH - 10));
          
          finalX = constrainedLeft + offset - 28;
          finalY = constrainedTop - 3;
        } else {
          finalX = Math.max(10, Math.min(finalX, window.innerWidth - currentW - 10));
          finalY = Math.max(10, Math.min(finalY, window.innerHeight - currentH - 10));
        }
        
        localStorage.setItem('copilot_widget_position', JSON.stringify({ x: finalX, y: finalY }));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
  };

  const clearChat = () => {
    if (!confirm('Are you sure you want to clear chat history?')) return;
    const initialSession: ChatSession = {
      id: 'copilot-session-' + Date.now(),
      title: 'Content Assistant',
      messages: [
        {
          role: 'assistant',
          content: "Hi! I am your Content & Moderation Copilot. ✍️📅\n\nI am fully equipped to schedule posts, manage auto-comments, and set up moderation rules for you.\n\nTry asking me:\n• 'Schedule a post about Summer Sale for tomorrow at 3 PM'\n• 'Hide negative comments on Johon and reply to check DM'\n• 'List my connected channels'\n• 'Show my upcoming scheduled posts'",
          timestamp: Date.now()
        }
      ],
      createdAt: Date.now()
    };
    setSessions([initialSession]);
    setActiveSessionId(initialSession.id);
  };

  return (
    <>
      <style>{`
        .copilot-widget-head {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(to bottom, #7c3aed, #4f46e5, #000000);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 9998;
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.3s, box-shadow 0.3s;
          color: white;
          overflow: visible;
          box-shadow: 0 0 20px rgba(124, 58, 237, 0.4);
        }
        .copilot-widget-head:hover {
          transform: scale(1.1) translateY(-2px);
          box-shadow: 0 0 30px rgba(124, 58, 237, 0.6);
        }
        .copilot-head-glow {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          animation: loaderCircleCopilot 5s linear infinite;
          pointer-events: none;
        }
        .copilot-widget-head svg {
          color: white;
          transition: transform 0.3s;
        }

        @keyframes loaderCircleCopilot {
          0% {
            transform: rotate(90deg);
            box-shadow:
              0 6px 12px 0 #a78bfa inset,
              0 12px 18px 0 #7c3aed inset,
              0 36px 36px 0 #4f46e5 inset,
              0 0 3px 1.2px rgba(167, 139, 250, 0.3),
              0 0 6px 1.8px rgba(124, 58, 237, 0.2);
          }
          50% {
            transform: rotate(270deg);
            box-shadow:
              0 6px 12px 0 #c084fc inset,
              0 12px 6px 0 #9333ea inset,
              0 24px 36px 0 #7c3aed inset,
              0 0 3px 1.2px rgba(167, 139, 250, 0.3),
              0 0 6px 1.8px rgba(124, 58, 237, 0.2);
          }
          100% {
            transform: rotate(450deg);
            box-shadow:
              0 6px 12px 0 #a78bfa inset,
              0 12px 18px 0 #7c3aed inset,
              0 36px 36px 0 #4f46e5 inset,
              0 0 3px 1.2px rgba(167, 139, 250, 0.3),
              0 0 6px 1.8px rgba(124, 58, 237, 0.2);
          }
        }

        .copilot-chat-window {
          position: fixed;
          width: 380px;
          height: 520px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(18, 12, 30, 0.9);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 9999;
          transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @media (max-width: 768px) {
          .copilot-chat-window {
            width: 300px !important;
            height: 400px !important;
            max-width: calc(100vw - 20px) !important;
            max-height: calc(100vh - 20px) !important;
            border-radius: 16px !important;
            position: fixed !important;
          }
        }
      `}</style>

      {/* Floating Chat Head Icon */}
      <div 
        className="copilot-widget-head" 
        onMouseDown={(e) => handleDragStart(e, 'head')}
        onTouchStart={(e) => handleTouchStart(e, 'head')}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          bottom: 'auto',
          right: 'auto',
          opacity: isOpen ? 0 : 1,
          transform: isOpen ? 'scale(0.5)' : 'scale(1)',
          pointerEvents: isOpen ? 'none' : 'auto',
          visibility: isOpen ? 'hidden' : 'visible',
          transition: 'opacity 0.25s ease, transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), visibility 0.25s'
        }}
        title="Open Content Copilot"
      >
        <div className="copilot-head-glow" />
        <Calendar size={26} style={{ zIndex: 2, position: 'relative' }} />
      </div>

      {/* Main Draggable Chat Window */}
      <div
        ref={widgetRef}
        className="copilot-chat-window"
        style={{
          left: `${getWindowLeft()}px`,
          top: `${getWindowTop()}px`,
          bottom: 'auto',
          right: 'auto',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'scale(1)' : 'scale(0.85)',
          pointerEvents: isOpen ? 'auto' : 'none',
          visibility: isOpen ? 'visible' : 'hidden',
          transition: 'opacity 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
          
          {/* Header */}
          <div
            onMouseDown={(e) => handleDragStart(e, 'window')}
            onTouchStart={(e) => handleTouchStart(e, 'window')}
            style={{
              padding: '14px 18px',
              background: 'rgba(0, 0, 0, 0.35)',
              borderBottom: '1px solid rgba(124, 58, 237, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'grab',
              userSelect: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', borderRadius: '50%', background: '#7c3aed' }}>
                <Sparkles size={11} color="white" />
              </div>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                Content Copilot
                <Move size={11} style={{ opacity: 0.4 }} />
              </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button 
                onClick={clearChat} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '4px', fontSize: '11px', display: 'flex', alignItems: 'center' }}
                title="Clear Chat History"
              >
                Clear
              </button>
              <button 
                onClick={() => setIsOpen(false)} 
                style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                title="Minimize"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Messages Viewport */}
          <div 
            style={{ 
              flex: 1, 
              overflowY: 'auto', 
              padding: '16px', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px' 
            }}
          >
            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
                flexDirection: m.role === 'user' ? 'row-reverse' : 'row'
              }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: m.role === 'user' ? 'var(--surface-tertiary)' : '#7c3aed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  {m.role === 'user' ? <User size={13} /> : <Bot size={13} color="white" />}
                </div>
                <div style={{
                  background: m.role === 'user' ? 'var(--surface-tertiary)' : 'rgba(124, 58, 237, 0.08)',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  borderTopRightRadius: m.role === 'user' ? '2px' : '10px',
                  borderTopLeftRadius: m.role === 'user' ? '10px' : '2px',
                  maxWidth: '75%',
                  wordBreak: 'break-word',
                  lineHeight: '1.45',
                  fontSize: '12.5px',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text-primary)',
                  border: m.role === 'user' ? '1px solid rgba(255,255,255,0.02)' : '1px solid rgba(124,58,237,0.15)'
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: '#7c3aed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Bot size={13} color="white" />
                </div>
                <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center' }}>
                  <Loader2 className="animate-spin" size={16} color="var(--text-secondary)" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Form Input */}
          <div style={{ padding: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(0, 0, 0, 0.2)' }}>
            <form onSubmit={handleSend} style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Content Copilot to schedule or moderate..."
                style={{ 
                  flex: 1, 
                  padding: '7px 12px', 
                  fontSize: '12.5px', 
                  borderRadius: '8px', 
                  height: '34px', 
                  minHeight: '34px', 
                  maxHeight: '110px', 
                  resize: 'none', 
                  overflowY: 'auto', 
                  lineHeight: '1.4',
                  background: 'var(--bg-input)',
                  border: '1px solid rgba(124, 58, 237, 0.2)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxShadow: 'none'
                }}
                disabled={isLoading}
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isLoading}
                style={{ 
                  width: '34px', 
                  height: '34px', 
                  padding: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  borderRadius: '8px', 
                  border: 'none', 
                  cursor: 'pointer', 
                  flexShrink: 0,
                  background: '#7c3aed',
                  color: 'white',
                  boxShadow: '0 0 10px rgba(124,58,237,0.3)'
                }}
              >
                <Send size={13} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
