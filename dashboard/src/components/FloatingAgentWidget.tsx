import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  User, 
  Loader2, 
  Send, 
  Trash2, 
  X, 
  Move, 
  Plus, 
  Pencil, 
  FileText, 
  Folder as FolderIcon, 
  ChevronRight, 
  ChevronDown, 
  Save, 
  Maximize2, 
  Minimize2, 
  Menu, 
  ArrowLeft 
} from 'lucide-react';
import { workerPost } from '../lib/workerApi';
import { toast } from '../hooks/useToast';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import aiIcon from '../assets/ai.svg';

interface ChatMessage {
  role: string;
  content: string;
  timestamp?: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  channelId: string;
  contextType: string;
  createdAt: number;
}

export default function FloatingAgentWidget() {
  const { user, profile, refreshCreditBalance } = useAuth();
  if (!user) return null; // Only show for logged in users

  // --- Widget Visibility State ---
  const [isOpen, setIsOpen] = useState(() => {
    return localStorage.getItem('agent_widget_open') === 'true';
  });

  // --- IDE Expand State ---
  const [isIdeExpanded, setIsIdeExpanded] = useState(() => {
    return localStorage.getItem('agent_ide_expanded') === 'true';
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // --- Sessions History State ---
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('agent_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse agent_sessions', e);
      }
    }
    // Default initial session
    const initialSession: ChatSession = {
      id: 'session-' + Date.now(),
      title: 'New Chat Session',
      messages: [],
      channelId: 'global',
      contextType: 'global',
      createdAt: Date.now()
    };
    return [initialSession];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const saved = localStorage.getItem('agent_active_session_id');
    if (saved) return saved;
    return sessions[0]?.id || '';
  });

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [];
  const selectedChannel = activeSession ? activeSession.channelId : 'global';
  const selectedContext = activeSession ? activeSession.contextType : 'global';

  // --- Widget Inputs State ---
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [reasoningMode, setReasoningMode] = useState<'thinking' | 'fast'>(() => {
    return (localStorage.getItem('agent_widget_reasoning_mode') as 'thinking' | 'fast') || 'fast';
  });

  // --- IDE Active Tab State ---
  const [activeEditorTab, setActiveEditorTab] = useState<'system_prompt' | 'quick_answers' | 'knowledge_base'>('system_prompt');
  const [flashTab, setFlashTab] = useState<'system_prompt' | 'quick_answers' | 'knowledge_base' | null>(null);

  // --- Editor View: System Prompt State ---
  const [systemPromptText, setSystemPromptText] = useState('');
  const [isPromptLoading, setIsPromptLoading] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // --- Editor View: Quick Answers State ---
  const [quickAnswers, setQuickAnswers] = useState<any[]>([]);
  const [isAnswersLoading, setIsAnswersLoading] = useState(false);
  const [qaEditingId, setQaEditingId] = useState<string | null>(null);
  const [qaFieldName, setQaFieldName] = useState('');
  const [qaFieldValue, setQaFieldValue] = useState('');
  const [qaCategory, setQaCategory] = useState('general');
  const [qaIsAdding, setQaIsAdding] = useState(false);

  // --- Editor View: Knowledge Base State ---
  const [folders, setFolders] = useState<any[]>([]);
  const [folderAssignments, setFolderAssignments] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isDocsLoading, setIsDocsLoading] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [activeDoc, setActiveDoc] = useState<any | null>(null);
  const [activeDocContent, setActiveDocContent] = useState('');
  const [activeDocTitle, setActiveDocTitle] = useState('');
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  // Document Creation inside Editor
  const [isCreatingDoc, setIsCreatingDoc] = useState(false);
  const [newDocFolderId, setNewDocFolderId] = useState('');
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocContent, setNewDocContent] = useState('');



  // --- Position State (Draggable) ---
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const saved = localStorage.getItem('agent_widget_position');
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
        x: w - 72, // 16px padding + 56px button width
        y: h - 72  // 16px padding
      };
    }
    const randomOffset = Math.floor(Math.random() * 80) - 40;
    return { 
      x: Math.floor(w * 0.6) + randomOffset, 
      y: Math.floor(h * 0.35) + randomOffset 
    };
  });

  const widgetRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  // --- Handle Window Sizing & Drag Boundaries ---
  const getCloseButtonOffset = () => {
    if (isMobile) {
      return 271; // 300 (mobile chat width) - 29 (padding/half-width)
    }
    if (isIdeExpanded && isSidebarOpen && !isMobile) {
      return 511; // 180 (sidebar) + 360 (chat) - 29 (padding/half-width)
    }
    return 351; // 380 (chat/total) - 29 (padding/half-width)
  };

  const getWindowLeft = () => {
    return position.x + 28 - getCloseButtonOffset();
  };

  const getWindowTop = () => {
    return position.y + 3;
  };

  const getWidgetWidth = () => {
    if (isMobile) return isOpen ? 300 : 56;
    if (!isOpen) return 56;
    if (isIdeExpanded) {
      let w = 380;
      if (isSidebarOpen) w += 180;
      w += 360; // Editor panel
      return w;
    }
    return 380;
  };

  const getWidgetHeight = () => {
    if (isMobile) return isOpen ? 400 : 56;
    if (!isOpen) return 56;
    return isIdeExpanded ? 580 : 520;
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-system-agent', handleOpen);
    return () => window.removeEventListener('open-system-agent', handleOpen);
  }, []);

  // Sync session changes to localStorage
  useEffect(() => {
    localStorage.setItem('agent_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('agent_active_session_id', activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    localStorage.setItem('agent_widget_open', String(isOpen));
  }, [isOpen]);

  // Keep window in bounds when layout properties (width/height) change
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
      localStorage.setItem('agent_widget_position', JSON.stringify({ x: newX, y: newY }));
    }
  }, [isIdeExpanded, isSidebarOpen, isOpen]);

  useEffect(() => {
    localStorage.setItem('agent_ide_expanded', String(isIdeExpanded));
  }, [isIdeExpanded]);

  // Boundaries checking on resizing or window movements
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
  }, [isOpen, isMobile, isIdeExpanded, isSidebarOpen, window.innerWidth, window.innerHeight]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Fetch Channels
  useEffect(() => {
    if (user) {
      supabase
        .from('page_connections')
        .select('page_id, page_name')
        .eq('user_id', user.id)
        .then(({ data, error }) => {
          if (!error && data) setChannels(data);
        });
    }
  }, [user]);

  // --- Fetch System Prompt ---
  const loadSystemPrompt = () => {
    if (user && selectedChannel && selectedChannel !== 'global') {
      setIsPromptLoading(true);
      supabase
        .from('page_connections')
        .select('custom_system_prompt')
        .eq('page_id', selectedChannel)
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) console.error('Error loading system prompt:', error);
          if (data) {
            setSystemPromptText(data.custom_system_prompt || '');
          } else {
            setSystemPromptText('');
          }
          setIsPromptLoading(false);
        });
    } else {
      setSystemPromptText('');
    }
  };

  useEffect(() => {
    loadSystemPrompt();
  }, [selectedChannel, user]);

  // --- Fetch Quick Answers ---
  const loadQuickAnswers = () => {
    if (!user) return;
    setIsAnswersLoading(true);
    supabase
      .from('knowledge_fields')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Error loading quick answers:', error);
        if (data) setQuickAnswers(data);
        setIsAnswersLoading(false);
      });
  };

  useEffect(() => {
    loadQuickAnswers();
  }, [user]);

  // --- Fetch Knowledge Base ---
  const loadDocsData = () => {
    if (!user) return;
    setIsDocsLoading(true);
    Promise.all([
      supabase.from('document_folders').select('*').eq('user_id', user.id),
      supabase.from('folder_page_assignments').select('*').eq('user_id', user.id),
      supabase.from('documents').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    ]).then(([foldersRes, assignmentsRes, docsRes]) => {
      if (foldersRes.data) setFolders(foldersRes.data);
      if (assignmentsRes.data) setFolderAssignments(assignmentsRes.data);
      if (docsRes.data) setDocuments(docsRes.data);
      setIsDocsLoading(false);
    });
  };

  useEffect(() => {
    loadDocsData();
  }, [user]);

  // --- Event Trigger Real-time Sync & Tab Flash ---
  useEffect(() => {
    const handleReload = () => {
      loadSystemPrompt();
      loadQuickAnswers();
      loadDocsData();
      refreshCreditBalance();

      // Trigger flash transition
      if (selectedContext === 'system_prompt') {
        setActiveEditorTab('system_prompt');
        setFlashTab('system_prompt');
      } else if (selectedContext === 'quick_answers') {
        setActiveEditorTab('quick_answers');
        setFlashTab('quick_answers');
      } else if (selectedContext === 'knowledge_base') {
        setActiveEditorTab('knowledge_base');
        setFlashTab('knowledge_base');
      }
      setTimeout(() => setFlashTab(null), 1500);
    };

    window.addEventListener('agent-data-updated', handleReload);
    return () => window.removeEventListener('agent-data-updated', handleReload);
  }, [selectedContext, selectedChannel, user]);

  // Auto-resize chat textarea based on input text
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = '34px';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 110; // ~5 lines max height
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

    // Auto-update session title if first message
    let newTitle = activeSession.title;
    if (messages.length === 0) {
      newTitle = userMessage.content.substring(0, 24) + (userMessage.content.length > 24 ? '...' : '');
    }

    setSessions(prev => prev.map(s => s.id === activeSessionId ? {
      ...s,
      title: newTitle,
      messages: updatedMessages
    } : s));

    setInput('');
    setIsLoading(true);

    try {
      const data = await workerPost('/api/agent/chat', { 
        messages: updatedMessages,
        channelId: selectedChannel,
        contextType: selectedContext,
        reasoningMode
      });
      
      if (data.message) {
        setSessions(prev => prev.map(s => s.id === activeSessionId ? {
          ...s,
          messages: [...updatedMessages, { role: 'assistant', content: data.message.content, timestamp: Date.now() }]
        } : s));
        refreshCreditBalance();
      }
      if (data.databaseUpdated) {
        window.dispatchEvent(new Event('agent-data-updated'));
        toast.success('System settings automatically synced.');
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

  const [isReverting, setIsReverting] = useState(false);

  const handleRevertToMessage = async (msg: ChatMessage, index: number) => {
    if (isReverting) return;
    
    const confirmRevert = window.confirm(
      "Are you sure you want to revert the system prompt, quick answers, and documents to how they were at this point in the chat? This will also delete all subsequent messages in this chat session."
    );
    if (!confirmRevert) return;
    
    setIsReverting(true);
    const timestamp = msg.timestamp || (activeSession.createdAt + index * 1000);
    
    try {
      const data = await workerPost('/api/agent/revert', {
        timestamp,
        pageId: selectedChannel
      });
      
      if (data.success) {
        // Rollback local messages array
        const rolledBackMessages = messages.slice(0, index + 1);
        
        setSessions(prev => prev.map(s => s.id === activeSessionId ? {
          ...s,
          messages: rolledBackMessages
        } : s));
        
        // Dispatch reload event
        window.dispatchEvent(new Event('agent-data-updated'));
        toast.success("Successfully rolled back settings and chat history to this checkpoint.");
      } else {
        throw new Error(data.error || "Failed to rollback.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error rolling back changes.");
    } finally {
      setIsReverting(false);
    }
  };

  const handleChannelChange = (val: string) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, channelId: val } : s));
  };

  const handleContextChange = (val: string) => {
    setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, contextType: val } : s));
  };

  const startNewSession = () => {
    const newSession: ChatSession = {
      id: 'session-' + Date.now(),
      title: 'New Chat Session',
      messages: [],
      channelId: 'global',
      contextType: 'global',
      createdAt: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  };

  const handleDeleteSession = (idToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = sessions.filter(s => s.id !== idToDelete);
    if (remaining.length === 0) {
      const initialSession: ChatSession = {
        id: 'session-' + Date.now(),
        title: 'New Chat Session',
        messages: [],
        channelId: 'global',
        contextType: 'global',
        createdAt: Date.now()
      };
      setSessions([initialSession]);
      setActiveSessionId(initialSession.id);
    } else {
      setSessions(remaining);
      if (activeSessionId === idToDelete) {
        setActiveSessionId(remaining[0].id);
      }
    }
  };

  // --- Drag Action Logic ---
  const handleTouchStart = (e: React.TouchEvent, type: 'head' | 'window') => {
    // Don't drag if clicking buttons, inputs, or dropdowns
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
        localStorage.setItem('agent_widget_position', JSON.stringify({ x: finalX, y: finalY }));
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

    // Don't drag if clicking buttons, inputs, or dropdowns
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
        
        localStorage.setItem('agent_widget_position', JSON.stringify({ x: finalX, y: finalY }));
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
  };

  // --- Folder & Document Helpers ---
  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const openDocument = (doc: any) => {
    setActiveDoc(doc);
    setActiveDocTitle(doc.title || '');
    setActiveDocContent(doc.original_content || '');
  };

  // --- Source Editor Directly Save Handlers ---
  const handleSavePrompt = async () => {
    if (!user || selectedChannel === 'global') return;
    setIsSavingPrompt(true);
    try {
      const { error } = await supabase
        .from('page_connections')
        .update({ custom_system_prompt: systemPromptText })
        .eq('page_id', selectedChannel)
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('System prompt updated successfully!');
      window.dispatchEvent(new Event('agent-data-updated'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to save prompt');
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleSaveQA = async (id: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_fields')
        .update({
          field_name: qaFieldName,
          field_value: qaFieldValue,
          category: qaCategory
        })
        .eq('id', id);
      if (error) throw error;
      toast.success(`Quick Answer "${qaFieldName}" updated.`);
      setQaEditingId(null);
      loadQuickAnswers();
      window.dispatchEvent(new Event('agent-data-updated'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  const handleDeleteQA = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Quick Answer?')) return;
    const qa = quickAnswers.find(q => q.id === id);
    const qaNameForToast = qa?.field_name || '';
    try {
      const { error } = await supabase
        .from('knowledge_fields')
        .delete()
        .eq('id', id);
      if (error) throw error;
      toast.success(`Quick Answer "${qaNameForToast}" deleted.`);
      loadQuickAnswers();
      window.dispatchEvent(new Event('agent-data-updated'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
    }
  };

  const handleAddQA = async () => {
    if (!qaFieldName.trim() || !qaFieldValue.trim()) {
      toast.error('Field name and value are required.');
      return;
    }
    try {
      const { error } = await supabase
        .from('knowledge_fields')
        .insert({
          user_id: user.id,
          page_id: selectedChannel === 'global' ? null : selectedChannel,
          field_name: qaFieldName,
          field_value: qaFieldValue,
          category: qaCategory,
          is_active: true
        });
      if (error) throw error;
      toast.success(`Quick Answer "${qaFieldName}" added.`);
      setQaIsAdding(false);
      setQaFieldName('');
      setQaFieldValue('');
      loadQuickAnswers();
      window.dispatchEvent(new Event('agent-data-updated'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to add');
    }
  };

  const handleSaveDoc = async () => {
    if (!activeDoc) return;
    setIsSavingDoc(true);
    try {
      const { error } = await supabase
        .from('documents')
        .update({
          title: activeDocTitle,
          original_content: activeDocContent
        })
        .eq('id', activeDoc.id);
      if (error) throw error;
      
      // Trigger embedding processing
      try {
        await workerPost('/api/documents/process', {
          documentId: activeDoc.id,
          userId: user.id
        });
      } catch (embErr) {
        console.error('Embedding error:', embErr);
      }

      toast.success(`Document "${activeDocTitle}" updated & re-embedded.`);
      setActiveDoc(null);
      loadDocsData();
      window.dispatchEvent(new Event('agent-data-updated'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to save document');
    } finally {
      setIsSavingDoc(false);
    }
  };

  const handleCreateDoc = async () => {
    if (!newDocTitle.trim() || !newDocContent.trim() || !newDocFolderId) {
      toast.error('Title, content, and folder are required.');
      return;
    }
    setIsSavingDoc(true);
    try {
      const { data, error } = await supabase
        .from('documents')
        .insert({
          user_id: user.id,
          folder_id: newDocFolderId,
          title: newDocTitle,
          source_type: 'text',
          original_content: newDocContent
        })
        .select()
        .single();
      if (error) throw error;

      if (data) {
        try {
          await workerPost('/api/documents/process', {
            documentId: data.id,
            userId: user.id
          });
        } catch (embErr) {
          console.error('Embedding error:', embErr);
        }
      }

      toast.success(`Document "${newDocTitle}" created & embedded.`);
      setIsCreatingDoc(false);
      setNewDocTitle('');
      setNewDocContent('');
      loadDocsData();
      window.dispatchEvent(new Event('agent-data-updated'));
    } catch (err: any) {
      toast.error(err.message || 'Failed to create document');
    } finally {
      setIsSavingDoc(false);
    }
  };

  // --- Filtering Data for IDE Views ---
  const filteredAnswers = quickAnswers.filter(qa => {
    if (selectedChannel === 'global') return true;
    return qa.page_id === selectedChannel;
  });

  const visibleFolders = folders.filter(f => {
    if (selectedChannel === 'global') return true;
    return folderAssignments.some(a => a.folder_id === f.id && a.page_id === selectedChannel);
  });

  const getChannelLabel = (val: string) => {
    if (val === 'global') return 'Global';
    const found = channels.find(c => c.page_id === val);
    return found ? found.page_name : val;
  };

  const getContextLabel = (val: string) => {
    switch(val) {
      case 'system_prompt': return 'System Prompt';
      case 'quick_answers': return 'Quick Answers';
      case 'knowledge_base': return 'Knowledge Base';
      default: return 'Global (All)';
    }
  };

  return (
    <>
      <style>{`
        .agent-widget-head {
          position: fixed;
          bottom: 24px;
          right: 24px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: linear-gradient(to bottom, #1a3379, #0f172a, #000000);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 9998;
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.3s, box-shadow 0.3s;
          color: white;
          overflow: visible;
        }
        .agent-widget-head:hover {
          transform: scale(1.1) translateY(-2px);
        }
        .widget-head-glow {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          animation: loaderCircle 5s linear infinite;
          pointer-events: none;
        }
        .agent-widget-head img {
          filter: brightness(0) invert(1);
          transition: filter 0.3s;
        }

        @keyframes loaderCircle {
          0% {
            transform: rotate(90deg);
            box-shadow:
              0 6px 12px 0 #38bdf8 inset,
              0 12px 18px 0 #005dff inset,
              0 36px 36px 0 #1e40af inset,
              0 0 3px 1.2px rgba(56, 189, 248, 0.3),
              0 0 6px 1.8px rgba(0, 93, 255, 0.2);
          }
          50% {
            transform: rotate(270deg);
            box-shadow:
              0 6px 12px 0 #60a5fa inset,
              0 12px 6px 0 #0284c7 inset,
              0 24px 36px 0 #005dff inset,
              0 0 3px 1.2px rgba(56, 189, 248, 0.3),
              0 0 6px 1.8px rgba(0, 93, 255, 0.2);
          }
          100% {
            transform: rotate(450deg);
            box-shadow:
              0 6px 12px 0 #4dc8fd inset,
              0 12px 18px 0 #005dff inset,
              0 36px 36px 0 #1e40af inset,
              0 0 3px 1.2px rgba(56, 189, 248, 0.3),
              0 0 6px 1.8px rgba(0, 93, 255, 0.2);
          }
        }

        @media (prefers-color-scheme: dark) {
          .agent-widget-head {
            background: linear-gradient(to bottom, #f3f4f6, #e5e7eb, #d1d5db);
          }
          .widget-head-glow {
            animation: loaderCircleDark 5s linear infinite;
          }
          .agent-widget-head img {
            filter: brightness(0) invert(0) opacity(0.8);
          }
        }

        @keyframes loaderCircleDark {
          0% {
            transform: rotate(90deg);
            box-shadow:
              0 6px 12px 0 #4b5563 inset,
              0 12px 18px 0 #6b7280 inset,
              0 36px 36px 0 #9ca3af inset,
              0 0 3px 1.2px rgba(107, 114, 128, 0.3),
              0 0 6px 1.8px rgba(156, 163, 175, 0.2);
          }
          50% {
            transform: rotate(270deg);
            box-shadow:
              0 6px 12px 0 #4b5563 inset,
              0 12px 18px 0 #6b7280 inset,
              0 36px 36px 0 #9ca3af inset,
              0 0 3px 1.2px rgba(107, 114, 128, 0.3),
              0 0 6px 1.8px rgba(156, 163, 175, 0.2);
          }
          100% {
            transform: rotate(450deg);
            box-shadow:
              0 6px 12px 0 #4b5563 inset,
              0 12px 18px 0 #6b7280 inset,
              0 36px 36px 0 #9ca3af inset,
              0 0 3px 1.2px rgba(107, 114, 128, 0.3),
              0 0 6px 1.8px rgba(156, 163, 175, 0.2);
          }
        }

        .agent-chat-window {
          position: fixed;
          width: 380px;
          height: 520px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: rgba(26, 29, 31, 0.88);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 9999;
          transition: width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), height 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        }
        .agent-chat-window.expanded {
          width: 900px;
          height: 580px;
        }

        /* Editor Scrollbars */
        .editor-tab-content::-webkit-scrollbar {
          width: 6px;
        }
        .editor-tab-content::-webkit-scrollbar-track {
          background: transparent;
        }
        .editor-tab-content::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .editor-tab-content::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        /* Tab flashing */
        .tab-flash-prompt {
          animation: flashG 1.5s ease-out;
        }
        .tab-flash-answers {
          animation: flashG 1.5s ease-out;
        }
        .tab-flash-docs {
          animation: flashG 1.5s ease-out;
        }
        @keyframes flashG {
          0% { background-color: rgba(16, 185, 129, 0.25); }
          100% { background-color: transparent; }
        }

        .message-row .message-actions {
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .message-row:hover .message-actions {
          opacity: 0.8;
        }

        @media (max-width: 768px) {
          .agent-chat-window {
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
        className="agent-widget-head" 
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
        title="Open System Agent Chat"
      >
        <div className="widget-head-glow" />
        <img src={aiIcon} alt="AI" style={{ width: '28px', height: '28px', zIndex: 2, position: 'relative' }} />
      </div>

      {/* Main Draggable IDE Chat Window */}
      <div
        ref={widgetRef}
        className={`agent-chat-window ${isIdeExpanded && !isMobile ? 'expanded' : ''}`}
        style={{
          left: `${getWindowLeft()}px`,
          top: `${getWindowTop()}px`,
          bottom: 'auto',
          right: 'auto',
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? 'scale(1)' : 'scale(0.85)',
          pointerEvents: isOpen ? 'auto' : 'none',
          visibility: isOpen ? 'visible' : 'hidden',
          transition: 'opacity 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), height 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
        }}
      >
          <div style={{ display: 'flex', height: '100%', width: '100%', overflow: 'hidden' }}>
            
            {/* COLUMN 1: Session History Sidebar (180px) */}
            {isIdeExpanded && isSidebarOpen && !isMobile && (
              <div style={{ 
                width: '180px', 
                borderRight: '1px solid var(--border-subtle)', 
                background: 'rgba(0,0,0,0.18)', 
                display: 'flex', 
                flexDirection: 'column',
                height: '100%'
              }}>
                {/* Sidebar Header */}
                <div style={{ 
                  padding: '12px 14px', 
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Chats</span>
                  <button 
                    onClick={startNewSession} 
                    className="btn-primary" 
                    style={{ padding: '2px 8px', fontSize: '11px', height: '22px', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
                    title="New Chat Session"
                  >
                    <Plus size={10} style={{ marginRight: '2px' }} /> New
                  </button>
                </div>

                {/* Sidebar List */}
                <div className="editor-tab-content" style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
                  {sessions.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setActiveSessionId(s.id)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12.5px',
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: s.id === activeSessionId ? 'rgba(255,255,255,0.06)' : 'transparent',
                        color: s.id === activeSessionId ? 'var(--text-primary)' : 'var(--text-secondary)',
                        border: s.id === activeSessionId ? '1px solid rgba(255,255,255,0.04)' : '1px solid transparent',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginRight: '6px' }}>
                        {s.title}
                      </span>
                      <button 
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', opacity: s.id === activeSessionId ? 0.7 : 0, cursor: 'pointer', padding: 0 }}
                        className="session-del-btn"
                        title="Delete Session"
                      >
                        <Trash2 size={11} hover-color="var(--error)" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* COLUMN 2: Main Chat Column (360px default, 100% on mobile) */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: isMobile ? '0' : '320px' }}>
              {/* Header */}
              <div
                onMouseDown={(e) => handleDragStart(e, 'window')}
                onTouchStart={(e) => handleTouchStart(e, 'window')}
                style={{
                  padding: '12px 16px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'grab',
                  userSelect: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    System Agent
                    <Move size={11} style={{ opacity: 0.4 }} />
                  </span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {/* Toggle Sessions Sidebar (Desktop only) */}
                  {isIdeExpanded && !isMobile && (
                    <button 
                      onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                      style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      title={isSidebarOpen ? "Hide sidebar" : "Show sidebar"}
                    >
                      <Menu size={13} />
                    </button>
                  )}

                  {/* Toggle IDE view (Desktop only) */}
                  {!isMobile && (
                    <button 
                      onClick={() => setIsIdeExpanded(!isIdeExpanded)}
                      style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                      title={isIdeExpanded ? "Collapse IDE View" : "Expand to IDE View"}
                    >
                      {isIdeExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                    </button>
                  )}

                  <button 
                    onClick={() => setIsOpen(false)} 
                    style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
                    title="Minimize"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Context Selector Controls */}
              <div style={{
                padding: '8px 12px',
                background: 'var(--surface-secondary)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11.5px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: '95px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Channel:</span>
                  <select
                    value={selectedChannel}
                    onChange={(e) => handleChannelChange(e.target.value)}
                    className="form-input"
                    style={{ padding: '2px 6px', fontSize: '11px', height: '26px', flex: 1, background: 'var(--surface-primary)', border: '1px solid var(--border-subtle)' }}
                  >
                    <option value="global">Global</option>
                    {channels.map((c) => (
                      <option key={c.page_id} value={c.page_id}>
                        {c.page_name || c.page_id}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: '90px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Scope:</span>
                  <select
                    value={selectedContext}
                    onChange={(e) => handleContextChange(e.target.value)}
                    className="form-input"
                    style={{ padding: '2px 6px', fontSize: '11px', height: '26px', flex: 1, background: 'var(--surface-primary)', border: '1px solid var(--border-subtle)' }}
                  >
                    <option value="global">Global</option>
                    <option value="system_prompt">Sys Prompt</option>
                    <option value="quick_answers">Quick Ans</option>
                    <option value="knowledge_base">Knowledge</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: '95px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Mode:</span>
                  <select
                    value={reasoningMode}
                    onChange={(e) => {
                      const val = e.target.value as 'thinking' | 'fast';
                      setReasoningMode(val);
                      localStorage.setItem('agent_widget_reasoning_mode', val);
                    }}
                    className="form-input"
                    style={{ padding: '2px 6px', fontSize: '11px', height: '26px', flex: 1, background: 'var(--surface-primary)', border: '1px solid var(--border-subtle)' }}
                  >
                    <option value="fast">⚡ Fast</option>
                    <option value="thinking">🧠 Think</option>
                  </select>
                </div>
              </div>

              {/* Messages viewport */}
              <div className="editor-tab-content" style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '30px', padding: '0 10px' }}>
                    <Bot size={40} style={{ opacity: 0.15, margin: '0 auto 10px' }} />
                    <h3 style={{ fontSize: '14px', color: 'var(--text-primary)', marginBottom: '3px' }}>System Agent Chat</h3>
                    <p style={{ fontSize: '12px', lineHeight: '1.4' }}>Ask me to add knowledge answers, change system prompts, or write knowledge base files.</p>
                    <div style={{ 
                      marginTop: '14px', 
                      padding: '8px 10px', 
                      borderRadius: '8px', 
                      background: 'rgba(255,255,255,0.03)', 
                      border: '1px solid rgba(255,255,255,0.05)',
                      fontSize: '11.5px',
                      textAlign: 'left'
                    }}>
                      <strong>Active Target:</strong><br />
                      • Channel: {getChannelLabel(selectedChannel)}<br />
                      • Scope: {getContextLabel(selectedContext)}
                    </div>
                  </div>
                ) : (
                  messages.map((m, i) => (
                    <div key={i} className="message-row" style={{
                      display: 'flex',
                      gap: '8px',
                      alignItems: 'center',
                      flexDirection: m.role === 'user' ? 'row-reverse' : 'row'
                    }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: m.role === 'user' ? 'var(--surface-tertiary)' : 'var(--accent-primary)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        {m.role === 'user' ? <User size={13} /> : <Bot size={13} color="white" />}
                      </div>
                      <div style={{
                        background: m.role === 'user' ? 'var(--surface-tertiary)' : 'rgba(255, 255, 255, 0.04)',
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
                        border: '1px solid rgba(255,255,255,0.02)'
                      }}>
                        {m.content}
                      </div>

                      {/* Undo / Revert action — only for user messages */}
                      {m.role === 'user' && <div className="message-actions">
                        <button
                          onClick={() => handleRevertToMessage(m, i)}
                          disabled={isReverting}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-secondary)',
                            cursor: isReverting ? 'not-allowed' : 'pointer',
                            padding: '4px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(255, 255, 255, 0.03)'
                          }}
                          title="Rollback settings & chat history to this checkpoint"
                        >
                          {isReverting ? (
                            <Loader2 size={11} className="animate-spin" />
                          ) : (
                            <ArrowLeft size={11} style={{ transform: 'rotate(90deg)' }} />
                          )}
                          <span style={{ fontSize: '10.5px' }}>Undo</span>
                        </button>
                      </div>}
                    </div>
                  ))
                )}
                {isLoading && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: 'var(--accent-primary)',
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

              {/* Chat Input form */}
              <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-secondary)' }}>
                {profile && (() => {
                  const total = (profile.monthly_credits_limit ?? 0) + (profile.extra_credits_balance ?? 0);
                  const remaining = Math.max(0, total - (profile.credits_used_this_month ?? 0));
                  const isOutOfCredits = remaining === 0;
                  return (
                    <>
                      <div style={{ 
                        fontSize: '11px', 
                        color: 'var(--text-secondary)', 
                        marginBottom: '6px', 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        opacity: 0.8
                      }}>
                        <span>AI Credits</span>
                        <span style={{ 
                          fontWeight: 600, 
                          color: remaining === 0 ? 'var(--error, #ef4444)' : 'var(--text-primary)' 
                        }}>
                          {remaining} left (5 credits/query)
                        </span>
                      </div>
                      <form onSubmit={handleSend} style={{ display: 'flex', gap: '6px', alignItems: 'flex-end' }}>
                        <textarea
                          ref={textareaRef}
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={isOutOfCredits ? 'Out of credits. Please purchase more.' : `Ask me in ${getContextLabel(selectedContext)}...`}
                          className="form-textarea"
                          style={{ 
                            flex: 1, 
                            padding: '7px 12px', 
                            fontSize: '12.5px', 
                            borderRadius: '8px', 
                            height: '34px', 
                            minHeight: '34px', 
                            maxHeight: '110px', 
                            resize: 'none', 
                            outline: 'none',
                            background: isOutOfCredits ? 'var(--bg-tertiary, rgba(255,255,255,0.02))' : 'var(--surface-primary)',
                            border: '1px solid var(--border-subtle)',
                            color: isOutOfCredits ? 'var(--text-muted, #666)' : 'var(--text-primary)',
                          }}
                          disabled={isLoading || isOutOfCredits}
                        />
                        <button 
                          type="submit" 
                          className="btn-primary" 
                          disabled={!input.trim() || isLoading || isOutOfCredits}
                          style={{ width: '34px', height: '34px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '8px', border: 'none', cursor: isOutOfCredits ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                        >
                          <Send size={13} />
                        </button>
                      </form>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* COLUMN 3: IDE Editor Column (360px, Desktop only when expanded) */}
            {isIdeExpanded && !isMobile && (
              <div style={{ 
                width: '360px', 
                borderLeft: '1px solid var(--border-subtle)', 
                background: 'rgba(0,0,0,0.12)', 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100%' 
              }}>
                {/* Editor Tabs Header */}
                <div style={{ 
                  display: 'flex', 
                  borderBottom: '1px solid var(--border-subtle)', 
                  background: 'rgba(0,0,0,0.2)' 
                }}>
                  <button
                    onClick={() => { setActiveEditorTab('system_prompt'); setActiveDoc(null); setIsCreatingDoc(false); }}
                    className={`editor-tab-btn ${flashTab === 'system_prompt' ? 'tab-flash-prompt' : ''}`}
                    style={{
                      flex: 1,
                      padding: '10px 4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      border: 'none',
                      background: activeEditorTab === 'system_prompt' ? 'rgba(255,255,255,0.06)' : 'transparent',
                      color: activeEditorTab === 'system_prompt' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      borderBottom: activeEditorTab === 'system_prompt' ? '2px solid var(--accent-primary)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    Prompt
                  </button>
                  <button
                    onClick={() => { setActiveEditorTab('quick_answers'); setActiveDoc(null); setIsCreatingDoc(false); }}
                    className={`editor-tab-btn ${flashTab === 'quick_answers' ? 'tab-flash-answers' : ''}`}
                    style={{
                      flex: 1,
                      padding: '10px 4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      border: 'none',
                      background: activeEditorTab === 'quick_answers' ? 'rgba(255,255,255,0.06)' : 'transparent',
                      color: activeEditorTab === 'quick_answers' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      borderBottom: activeEditorTab === 'quick_answers' ? '2px solid var(--accent-primary)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    Answers
                  </button>
                  <button
                    onClick={() => { setActiveEditorTab('knowledge_base'); }}
                    className={`editor-tab-btn ${flashTab === 'knowledge_base' ? 'tab-flash-docs' : ''}`}
                    style={{
                      flex: 1,
                      padding: '10px 4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      border: 'none',
                      background: activeEditorTab === 'knowledge_base' ? 'rgba(255,255,255,0.06)' : 'transparent',
                      color: activeEditorTab === 'knowledge_base' ? 'var(--text-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      borderBottom: activeEditorTab === 'knowledge_base' ? '2px solid var(--accent-primary)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    Docs
                  </button>
                </div>

                {/* Tab Contents */}
                <div className="editor-tab-content" style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                  
                  {/* TAB 1: System Prompt Editor */}
                  {activeEditorTab === 'system_prompt' && (
                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '10px' }}>
                      {selectedChannel === 'global' ? (
                        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center', marginTop: '60px', padding: '0 20px' }}>
                          Select a channel connection dropdown in chat to view & edit its prompt.
                        </div>
                      ) : isPromptLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '60px' }}>
                          <Loader2 className="animate-spin" size={20} color="var(--text-secondary)" />
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                            Active Prompt file for: <strong>{getChannelLabel(selectedChannel)}</strong>
                          </div>
                          <textarea
                            value={systemPromptText}
                            onChange={(e) => setSystemPromptText(e.target.value)}
                            placeholder="Write instructions (e.g. Always respond in French...)"
                            className="form-textarea"
                            style={{ 
                              flex: 1, 
                              minHeight: '340px', 
                              fontFamily: 'monospace', 
                              fontSize: '11.5px', 
                              lineHeight: '1.45', 
                              background: '#141618', 
                              border: '1px solid var(--border-subtle)',
                              padding: '12px',
                              borderRadius: '8px'
                            }}
                          />
                          <button
                            onClick={handleSavePrompt}
                            disabled={isSavingPrompt}
                            className="btn-primary"
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12px', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', border: 'none' }}
                          >
                            {isSavingPrompt ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            {isSavingPrompt ? 'Saving prompt...' : 'Save System Prompt'}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* TAB 2: Quick Answers Manager */}
                  {activeEditorTab === 'quick_answers' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                          Showing: <strong>{selectedChannel === 'global' ? 'All Channels' : getChannelLabel(selectedChannel)}</strong>
                        </span>
                        {!qaIsAdding && (
                          <button
                            onClick={() => {
                              setQaIsAdding(true);
                              setQaEditingId(null);
                              setQaFieldName('');
                              setQaFieldValue('');
                              setQaCategory('general');
                            }}
                            className="btn-primary"
                            style={{ padding: '2px 6px', fontSize: '10px', height: '20px', borderRadius: '3px', border: 'none', cursor: 'pointer' }}
                          >
                            + Add Field
                          </button>
                        )}
                      </div>

                      {/* Add field Form */}
                      {qaIsAdding && (
                        <div style={{ padding: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-subtle)', borderRadius: '6px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>New Quick Answer</span>
                          <input 
                            placeholder="Field Name (e.g. Price)" 
                            value={qaFieldName} 
                            onChange={e => setQaFieldName(e.target.value)}
                            className="form-input" 
                            style={{ fontSize: '11.5px', padding: '4px 8px', height: '26px' }}
                          />
                          <textarea 
                            placeholder="Field Value (e.g. $149)" 
                            value={qaFieldValue} 
                            onChange={e => setQaFieldValue(e.target.value)}
                            className="form-textarea" 
                            style={{ fontSize: '11.5px', padding: '6px 8px', minHeight: '50px' }}
                          />
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={handleAddQA} className="btn-primary" style={{ padding: '4px 8px', fontSize: '11px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>Save</button>
                            <button onClick={() => setQaIsAdding(false)} className="btn-secondary" style={{ padding: '4px 8px', fontSize: '11px', border: 'none', cursor: 'pointer', borderRadius: '4px' }}>Cancel</button>
                          </div>
                        </div>
                      )}

                      {/* Answers List */}
                      {isAnswersLoading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                          <Loader2 className="animate-spin" size={18} color="var(--text-secondary)" />
                        </div>
                      ) : filteredAnswers.length === 0 ? (
                        <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '40px' }}>
                          No Quick Answers found for this scope.
                        </div>
                      ) : (
                        filteredAnswers.map((qa) => (
                          <div key={qa.id} style={{ 
                            padding: '8px 10px', 
                            background: 'rgba(255,255,255,0.02)', 
                            border: '1px solid rgba(255,255,255,0.04)', 
                            borderRadius: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}>
                            {qaEditingId === qa.id ? (
                              // Edit Form
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <input 
                                  value={qaFieldName} 
                                  onChange={e => setQaFieldName(e.target.value)} 
                                  className="form-input" 
                                  style={{ fontSize: '11.5px', padding: '4px 8px', height: '26px' }}
                                />
                                <textarea 
                                  value={qaFieldValue} 
                                  onChange={e => setQaFieldValue(e.target.value)} 
                                  className="form-textarea" 
                                  style={{ fontSize: '11.5px', padding: '6px 8px', minHeight: '50px' }}
                                />
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button onClick={() => handleSaveQA(qa.id)} className="btn-primary" style={{ padding: '2px 6px', fontSize: '10px', border: 'none', cursor: 'pointer', borderRadius: '3px' }}>Save</button>
                                  <button onClick={() => setQaEditingId(null)} className="btn-secondary" style={{ padding: '2px 6px', fontSize: '10px', border: 'none', cursor: 'pointer', borderRadius: '3px' }}>Cancel</button>
                                </div>
                              </div>
                            ) : (
                              // Display Item
                              <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)' }}>{qa.field_name}</span>
                                  <div style={{ display: 'flex', gap: '4px' }}>
                                    <button 
                                      onClick={() => {
                                        setQaEditingId(qa.id);
                                        setQaFieldName(qa.field_name);
                                        setQaFieldValue(qa.field_value);
                                        setQaCategory(qa.category || 'general');
                                      }}
                                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 2 }}
                                    >
                                      <Pencil size={11} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteQA(qa.id)}
                                      style={{ background: 'transparent', border: 'none', color: 'var(--error, #ef4444)', cursor: 'pointer', padding: 2 }}
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                                <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                                  {qa.field_value}
                                </span>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* TAB 3: Knowledge Base RAG Docs */}
                  {activeEditorTab === 'knowledge_base' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', height: '100%' }}>
                      
                      {/* Subview 1: Edit active doc */}
                      {activeDoc ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', height: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button onClick={() => setActiveDoc(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                              <ArrowLeft size={14} /> <span style={{ fontSize: '11px', marginLeft: '2px' }}>Back</span>
                            </button>
                          </div>
                          <input 
                            value={activeDocTitle} 
                            onChange={e => setActiveDocTitle(e.target.value)}
                            className="form-input" 
                            style={{ fontSize: '12px', padding: '6px', height: '30px' }}
                            placeholder="Title"
                          />
                          <textarea 
                            value={activeDocContent} 
                            onChange={e => setActiveDocContent(e.target.value)}
                            className="form-textarea" 
                            style={{ flex: 1, minHeight: '260px', fontFamily: 'monospace', fontSize: '11px', padding: '10px' }}
                            placeholder="Paste text document content..."
                          />
                          <button onClick={handleSaveDoc} disabled={isSavingDoc} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', fontSize: '12px', border: 'none', cursor: 'pointer', borderRadius: '6px' }}>
                            {isSavingDoc ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                            {isSavingDoc ? 'Embedding...' : 'Save & Re-embed'}
                          </button>
                        </div>
                      ) : isCreatingDoc ? (
                        // Subview 2: Create document
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button onClick={() => setIsCreatingDoc(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                              <ArrowLeft size={14} /> <span style={{ fontSize: '11px', marginLeft: '2px' }}>Back</span>
                            </button>
                          </div>
                          <span style={{ fontSize: '11.5px', fontWeight: 'bold' }}>New RAG Document</span>
                          <select
                            value={newDocFolderId}
                            onChange={e => setNewDocFolderId(e.target.value)}
                            className="form-input"
                            style={{ fontSize: '11.5px', padding: '4px', height: '28px' }}
                          >
                            <option value="">Select Target Folder...</option>
                            {visibleFolders.map(f => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                          <input 
                            placeholder="Document Title" 
                            value={newDocTitle}
                            onChange={e => setNewDocTitle(e.target.value)}
                            className="form-input" 
                            style={{ fontSize: '12px', padding: '6px', height: '28px' }}
                          />
                          <textarea 
                            placeholder="Document content details..." 
                            value={newDocContent}
                            onChange={e => setNewDocContent(e.target.value)}
                            className="form-textarea" 
                            style={{ fontSize: '11px', minHeight: '180px', padding: '8px' }}
                          />
                          <button onClick={handleCreateDoc} disabled={isSavingDoc} className="btn-primary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '8px', fontSize: '12px', border: 'none', cursor: 'pointer', borderRadius: '6px' }}>
                            {isSavingDoc ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                            {isSavingDoc ? 'Embedding...' : 'Create & Embed'}
                          </button>
                        </div>
                      ) : (
                        // Subview 3: Folder tree list
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>Data Sources / Folders</span>
                            {visibleFolders.length > 0 && (
                              <button
                                onClick={() => {
                                  setIsCreatingDoc(true);
                                  setNewDocFolderId(visibleFolders[0].id);
                                }}
                                className="btn-primary"
                                style={{ padding: '2px 6px', fontSize: '10px', height: '20px', borderRadius: '3px', border: 'none', cursor: 'pointer' }}
                              >
                                + Add Doc
                              </button>
                            )}
                          </div>

                          {isDocsLoading ? (
                            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '40px' }}>
                              <Loader2 className="animate-spin" size={18} color="var(--text-secondary)" />
                            </div>
                          ) : visibleFolders.length === 0 ? (
                            <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '40px' }}>
                              No Folder assignments found. Configure Data Sources inside dashboard first.
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {visibleFolders.map((folder) => {
                                const folderDocs = documents.filter(d => d.folder_id === folder.id);
                                const isExpanded = !!expandedFolders[folder.id];
                                return (
                                  <div key={folder.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                    {/* Folder header toggle */}
                                    <div 
                                      onClick={() => toggleFolder(folder.id)}
                                      style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '6px', 
                                        padding: '6px 8px', 
                                        background: 'rgba(255,255,255,0.03)', 
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '12px',
                                        fontWeight: 600,
                                        color: 'var(--text-primary)'
                                      }}
                                    >
                                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                      <FolderIcon size={14} style={{ color: 'var(--accent-primary, #6366f1)' }} />
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
                                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', marginLeft: 'auto' }}>({folderDocs.length})</span>
                                    </div>

                                    {/* Documents in folder */}
                                    {isExpanded && (
                                      <div style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}>
                                        {folderDocs.length === 0 ? (
                                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '4px' }}>Empty folder</div>
                                        ) : (
                                          folderDocs.map((doc) => (
                                            <div 
                                              key={doc.id}
                                              onClick={() => openDocument(doc)}
                                              style={{ 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                gap: '6px', 
                                                padding: '5px 8px', 
                                                borderRadius: '3px',
                                                cursor: 'pointer',
                                                fontSize: '11.5px',
                                                color: 'var(--text-secondary)',
                                                background: 'transparent',
                                                transition: 'all 0.15s'
                                              }}
                                              className="doc-list-item"
                                            >
                                              <FileText size={12} />
                                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</span>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        </div>
      </>
  );
}
