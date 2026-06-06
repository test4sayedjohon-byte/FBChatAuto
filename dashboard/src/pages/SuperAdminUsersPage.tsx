import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';
import { 
  Users, 
  ShieldAlert, 
  Shield, 
  Search, 
  Eye, 
  Trash2, 
  BookOpen, 
  FileText, 
  Globe,
  X,
  Cpu,
  MessageSquare,
  Plus,
  Pencil,
  RefreshCw,
  BarChart3,
  Percent
} from 'lucide-react';

interface Tenant {
  id: string;
  email: string;
  display_name: string;
  plan: string;
  created_at: string;
  is_suspended: boolean;
  is_super_admin: boolean;
  assigned_chat_provider_id: string | null;
  assigned_embedding_provider_id: string | null;
  assigned_fallback_chat_provider_id: string | null;
  pageCount: number;
  documentCount: number;
  fieldCount: number;
  sessionCount: number;
  messageCount: number;
  monthly_token_limit: number;
  strict_token_enforcement: boolean;
  allowed_channels?: number;
  monthly_message_limit?: number;
}

export default function SuperAdminUsersPage() {
  const { profile, user: currentUser } = useAuth();
  const [users, setUsers] = useState<Tenant[]>([]);
  const [allProviders, setAllProviders] = useState<any[]>([]);
  const [globalProviders, setGlobalProviders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Inspection drawer state
  const [inspectingUser, setInspectingUser] = useState<Tenant | null>(null);
  const [inspectData, setInspectData] = useState<{
    pages: any[];
    documents: any[];
    fields: any[];
    usage: {
      totalMonthTokens: number;
      filteredTokens: number;
      modelBreakdown: { model: string; tokens: number }[];
      dateBreakdown: { date: string; tokens: number }[];
    };
  }>({ 
    pages: [], 
    documents: [], 
    fields: [], 
    usage: { totalMonthTokens: 0, filteredTokens: 0, modelBreakdown: [], dateBreakdown: [] } 
  });
  const [loadingInspect, setLoadingInspect] = useState(false);
  const [activeTab, setActiveTab] = useState<'pages' | 'documents' | 'fields' | 'limits'>('pages');

  const [usageFilter, setUsageFilter] = useState<'this_month' | 'last_month' | 'this_year' | 'all_time'>('this_month');
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Sub-forms overlays
  const [showPageForm, setShowPageForm] = useState(false);
  const [editingPage, setEditingPage] = useState<any | null>(null); // null = Add Mode
  const [pageFormState, setPageFormState] = useState({
    page_id: '',
    page_name: '',
    access_token: '',
    bot_name: '',
    custom_system_prompt: '',
    ai_model: '',
    temperature: 0.5,
    is_active: true,
    ai_provider_id: ''
  });

  // Quota and limit settings states
  const [monthlyLimitInput, setMonthlyLimitInput] = useState<number>(500000);
  const [strictEnforcementInput, setStrictEnforcementInput] = useState<boolean>(true);
  const [monthlyMessageLimitInput, setMonthlyMessageLimitInput] = useState<number>(0);
  const [allowedChannelsInput, setAllowedChannelsInput] = useState<number>(0);
  const [savingQuota, setSavingQuota] = useState(false);

  const [showFieldForm, setShowFieldForm] = useState(false);
  const [editingField, setEditingField] = useState<any | null>(null); // null = Add Mode
  const [fieldFormState, setFieldFormState] = useState({
    field_name: '',
    field_value: '',
    category: 'general',
    page_id: '',
    is_active: true
  });

  const [showDocForm, setShowDocForm] = useState(false);
  const [editingDoc, setEditingDoc] = useState<any | null>(null); // null = Add Mode
  const [docFormState, setDocFormState] = useState<{
    title: string;
    original_content: string;
    selectedPageIds: string[];
  }>({
    title: '',
    original_content: '',
    selectedPageIds: []
  });

  const [processingDocId, setProcessingDocId] = useState<string | null>(null);
  const [savingSubForm, setSavingSubForm] = useState(false);

  useEffect(() => {
    if (profile?.is_super_admin) {
      loadUsers();
    }
  }, [profile]);

  async function loadUsers() {
    try {
      const [
        usersRes,
        provsRes,
        pagesRes,
        docsRes,
        fieldsRes,
        sessionsRes
      ] = await Promise.all([
        supabase.from('users').select('*').order('created_at', { ascending: false }),
        supabase.from('ai_providers').select('*').order('display_name', { ascending: true }),
        supabase.from('page_connections').select('user_id'),
        supabase.from('documents').select('user_id'),
        supabase.from('knowledge_fields').select('user_id'),
        supabase.from('chat_sessions').select('user_id, message_count'),
      ]);

      if (usersRes.error) throw usersRes.error;
      
      if (provsRes.data) {
        setAllProviders(provsRes.data);
        setGlobalProviders(provsRes.data.filter((p: any) => p.is_global));
      }

      const countMap = (list: any[]) => {
        const m: Record<string, number> = {};
        for (const item of list) {
          if (item.user_id) {
            m[item.user_id] = (m[item.user_id] || 0) + 1;
          }
        }
        return m;
      };

      const messageSumMap = (list: any[]) => {
        const m: Record<string, number> = {};
        for (const item of list) {
          if (item.user_id) {
            m[item.user_id] = (m[item.user_id] || 0) + (item.message_count || 0);
          }
        }
        return m;
      };

      const pageCounts = countMap(pagesRes.data || []);
      const docCounts = countMap(docsRes.data || []);
      const fieldCounts = countMap(fieldsRes.data || []);
      const sessionCounts = countMap(sessionsRes.data || []);
      const messageCounts = messageSumMap(sessionsRes.data || []);

      const enriched = (usersRes.data || []).map((u: any) => ({
        ...u,
        pageCount: pageCounts[u.id] || 0,
        documentCount: docCounts[u.id] || 0,
        fieldCount: fieldCounts[u.id] || 0,
        sessionCount: sessionCounts[u.id] || 0,
        messageCount: messageCounts[u.id] || 0,
      }));

      setUsers(enriched as Tenant[]);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }

  async function assignProvider(userId: string, providerId: string, type: 'chat' | 'embedding' | 'fallback') {
    let field = 'assigned_chat_provider_id';
    if (type === 'embedding') field = 'assigned_embedding_provider_id';
    else if (type === 'fallback') field = 'assigned_fallback_chat_provider_id';

    const val = providerId === 'default' ? null : providerId;
    
    const { error } = await supabase.from('users').update({ [field]: val }).eq('id', userId);
    if (error) {
      alert('Error updating provider: ' + error.message);
    } else {
      setUsers(users.map(u => u.id === userId ? { ...u, [field]: val } : u));
    }
  }

  async function changePlan(userId: string, plan: string) {
    const { error } = await supabase.from('users').update({ plan }).eq('id', userId);
    if (error) {
      alert('Error updating plan: ' + error.message);
    } else {
      setUsers(users.map(u => u.id === userId ? { ...u, plan } : u));
    }
  }

  async function toggleSuspension(userId: string, currentStatus: boolean) {
    const nextStatus = !currentStatus;
    if (userId === currentUser?.id) {
      alert("You cannot suspend your own super admin account!");
      return;
    }
    const message = nextStatus 
      ? "Suspend this user? They will be locked out of the dashboard and their chatbots will immediately stop replying."
      : "Lift suspension for this user?";
    if (!confirm(message)) return;

    const { error } = await supabase.from('users').update({ is_suspended: nextStatus }).eq('id', userId);
    if (error) {
      alert('Error: ' + error.message);
    } else {
      setUsers(users.map(u => u.id === userId ? { ...u, is_suspended: nextStatus } : u));
    }
  }

  async function toggleSuperAdmin(userId: string, currentStatus: boolean) {
    const nextStatus = !currentStatus;
    if (userId === currentUser?.id) {
      alert("You cannot demote yourself from Super Admin!");
      return;
    }
    const message = nextStatus
      ? "Promote this user to Super Admin? They will have complete control over all settings, users, and global API keys."
      : "Remove Super Admin permissions from this user?";
    if (!confirm(message)) return;

    const { error } = await supabase.from('users').update({ is_super_admin: nextStatus }).eq('id', userId);
    if (error) {
      alert('Error: ' + error.message);
    } else {
      setUsers(users.map(u => u.id === userId ? { ...u, is_super_admin: nextStatus } : u));
    }
  }

  async function deleteUser(userId: string) {
    if (userId === currentUser?.id) {
      alert("You cannot delete your own account!");
      return;
    }
    if (!confirm("Are you absolutely sure you want to delete this user? This will delete all their connected pages, documents, knowledge base fields, and chat histories. This action cannot be undone.")) return;
    
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) {
      alert('Error deleting user: ' + error.message);
    } else {
      setUsers(users.filter(u => u.id !== userId));
      if (inspectingUser?.id === userId) {
        setInspectingUser(null);
      }
    }
  }

  async function fetchUsageStats(tenantId: string, filter: string) {
    setLoadingUsage(true);
    try {
      let query = supabase.from('chat_messages').select('created_at, token_count, metadata').eq('user_id', tenantId);

      const now = new Date();
      if (filter === 'this_month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        query = query.gte('created_at', start.toISOString());
      } else if (filter === 'last_month') {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
      } else if (filter === 'this_year') {
        const start = new Date(now.getFullYear(), 0, 1);
        query = query.gte('created_at', start.toISOString());
      }
      
      const { data: messagesRes } = await query;
      const usageList = messagesRes || [];
      
      const filteredTokens = usageList.reduce((acc, row) => acc + (row.token_count || 0), 0);
      const modelsMap: Record<string, number> = {};
      const datesMap: Record<string, number> = {};

      for (const msg of usageList) {
        const t = msg.token_count || 0;
        if (t === 0) continue;

        const modelName = msg.metadata?.model || msg.metadata?.provider || 'Unknown Model';
        modelsMap[modelName] = (modelsMap[modelName] || 0) + t;

        let dateStr = '';
        if (filter === 'this_month' || filter === 'last_month') {
           dateStr = new Date(msg.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        } else {
           dateStr = new Date(msg.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
        }
        datesMap[dateStr] = (datesMap[dateStr] || 0) + t;
      }

      const modelBreakdown = Object.entries(modelsMap).map(([model, tokens]) => ({ model, tokens }));
      const dateBreakdown = Object.entries(datesMap).map(([date, tokens]) => ({ date, tokens }));
      
      // Sort date breakdown chronologically
      dateBreakdown.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      modelBreakdown.sort((a, b) => b.tokens - a.tokens);

      setInspectData(prev => ({
        ...prev,
        usage: {
          ...prev.usage,
          filteredTokens,
          modelBreakdown,
          dateBreakdown
        }
      }));
    } catch (err) {
      console.error('Failed to fetch filtered usage stats:', err);
    } finally {
      setLoadingUsage(false);
    }
  }

  useEffect(() => {
    if (inspectingUser && activeTab === 'limits') {
      fetchUsageStats(inspectingUser.id, usageFilter);
    }
  }, [usageFilter, inspectingUser, activeTab]);

  // Inspect User resources
  async function inspectUser(tenant: Tenant) {
    setInspectingUser(tenant);
    setMonthlyLimitInput(tenant.monthly_token_limit ?? 500000);
    setStrictEnforcementInput(tenant.strict_token_enforcement ?? true);
    setMonthlyMessageLimitInput(tenant.monthly_message_limit ?? 0);
    setAllowedChannelsInput(tenant.allowed_channels ?? 0);
    setLoadingInspect(true);
    setActiveTab('pages');
    try {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const [pagesRes, docsRes, fieldsRes, messagesRes] = await Promise.all([
        supabase.from('page_connections').select('*').eq('user_id', tenant.id),
        supabase.from('documents').select('*').eq('user_id', tenant.id).order('created_at', { ascending: false }),
        supabase.from('knowledge_fields').select('*').eq('user_id', tenant.id).order('sort_order', { ascending: true }),
        supabase.from('chat_messages')
          .select('created_at, token_count, metadata')
          .eq('user_id', tenant.id)
          .gte('created_at', startOfMonth.toISOString()),
      ]);

      const docIds = (docsRes.data || []).map(d => d.id);
      let userAssignments: any[] = [];
      if (docIds.length > 0) {
        const { data: assignmentsData } = await supabase
          .from('document_page_assignments')
          .select('document_id, page_id')
          .in('document_id', docIds);
        userAssignments = assignmentsData || [];
      }

      const assignmentMap: Record<string, string[]> = {};
      for (const a of userAssignments) {
        if (!assignmentMap[a.document_id]) assignmentMap[a.document_id] = [];
        assignmentMap[a.document_id].push(a.page_id);
      }

      const enrichedDocs = (docsRes.data || []).map(d => ({
        ...d,
        assignedPageIds: assignmentMap[d.id] || []
      }));

      // Calculate token usage
      const usageList = messagesRes.data || [];
      const totalMonthTokens = usageList.reduce((acc, row) => acc + (row.token_count || 0), 0);

      setInspectData({
        pages: pagesRes.data || [],
        documents: enrichedDocs,
        fields: fieldsRes.data || [],
        usage: {
          totalMonthTokens,
          filteredTokens: 0,
          modelBreakdown: [],
          dateBreakdown: []
        }
      });
    } catch (err) {
      console.error('Failed to inspect tenant resources:', err);
    } finally {
      setLoadingInspect(false);
    }
  }

  async function handleSaveQuota(e: FormEvent) {
    e.preventDefault();
    if (!inspectingUser) return;
    setSavingQuota(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          monthly_token_limit: monthlyLimitInput,
          strict_token_enforcement: strictEnforcementInput,
          monthly_message_limit: monthlyMessageLimitInput,
          allowed_channels: allowedChannelsInput
        })
        .eq('id', inspectingUser.id);
      
      if (error) {
        alert('Error saving quota: ' + error.message);
      } else {
        // Update local users array
        setUsers(users.map(u => u.id === inspectingUser.id ? { 
          ...u, 
          monthly_token_limit: monthlyLimitInput,
          strict_token_enforcement: strictEnforcementInput,
          monthly_message_limit: monthlyMessageLimitInput,
          allowed_channels: allowedChannelsInput
        } : u));
        
        // Update inspected user reference
        setInspectingUser({
          ...inspectingUser,
          monthly_token_limit: monthlyLimitInput,
          strict_token_enforcement: strictEnforcementInput,
          monthly_message_limit: monthlyMessageLimitInput,
          allowed_channels: allowedChannelsInput
        });
        
        alert('AI Quota settings updated successfully!');
      }
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSavingQuota(false);
    }
  }

  // --- CRUD ACTIONS INSIDE INSPECT MODAL ---

  // Disconnect Page
  async function handleDisconnectPage(pageConnId: string) {
    if (!confirm("Disconnect this Facebook Page connection?")) return;
    const { error } = await supabase.from('page_connections').delete().eq('id', pageConnId);
    if (error) alert("Error disconnecting page: " + error.message);
    else {
      setInspectData(prev => ({ ...prev, pages: prev.pages.filter(p => p.id !== pageConnId) }));
      setUsers(prev => prev.map(u => u.id === inspectingUser?.id ? { ...u, pageCount: Math.max(0, u.pageCount - 1) } : u));
    }
  }

  // Toggle Page Active state
  async function handleTogglePage(pageConnId: string, currentActive: boolean) {
    const { error } = await supabase.from('page_connections').update({ is_active: !currentActive }).eq('id', pageConnId);
    if (error) alert("Error toggling page: " + error.message);
    else {
      setInspectData(prev => ({
        ...prev,
        pages: prev.pages.map(p => p.id === pageConnId ? { ...p, is_active: !currentActive } : p)
      }));
    }
  }

  // Page Form Open
  function openAddPage() {
    const defaultProvider = allProviders.find(p => p.is_global && p.is_active_chat) || allProviders.find(p => p.is_global);
    setEditingPage(null);
    setPageFormState({
      page_id: '',
      page_name: '',
      access_token: '',
      bot_name: 'AI Support Bot',
      custom_system_prompt: '',
      ai_model: defaultProvider?.model_chat || 'gemini-1.5-flash',
      temperature: 0.5,
      is_active: true,
      ai_provider_id: ''
    });
    setShowPageForm(true);
  }

  function openEditPage(p: any) {
    const defaultProvider = allProviders.find(prov => prov.is_global && prov.is_active_chat) || allProviders.find(prov => prov.is_global);
    setEditingPage(p);
    setPageFormState({
      page_id: p.page_id,
      page_name: p.page_name || '',
      access_token: '', // Keep blank unless updating
      bot_name: p.bot_name || '',
      custom_system_prompt: p.custom_system_prompt || '',
      ai_model: p.ai_model || defaultProvider?.model_chat || 'gemini-1.5-flash',
      temperature: p.temperature ?? 0.5,
      is_active: p.is_active,
      ai_provider_id: p.ai_provider_id || ''
    });
    setShowPageForm(true);
  }

  async function handlePageSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inspectingUser) return;
    setSavingSubForm(true);

    const payload: any = {
      page_id: pageFormState.page_id,
      page_name: pageFormState.page_name,
      bot_name: pageFormState.bot_name,
      custom_system_prompt: pageFormState.custom_system_prompt,
      ai_model: pageFormState.ai_model,
      temperature: pageFormState.temperature,
      is_active: pageFormState.is_active,
      ai_provider_id: pageFormState.ai_provider_id || null
    };

    if (pageFormState.access_token) {
      payload.access_token = pageFormState.access_token;
    }

    try {
      if (editingPage) {
        const { error } = await supabase
          .from('page_connections')
          .update(payload)
          .eq('id', editingPage.id);
        if (error) throw error;
      } else {
        if (!pageFormState.access_token) {
          alert('Access token is required for new connections.');
          setSavingSubForm(false);
          return;
        }
        const { error } = await supabase
          .from('page_connections')
          .insert({
            ...payload,
            user_id: inspectingUser.id,
            access_token: pageFormState.access_token
          });
        if (error) throw error;
        setUsers(prev => prev.map(u => u.id === inspectingUser.id ? { ...u, pageCount: u.pageCount + 1 } : u));
      }

      setShowPageForm(false);
      // reload inspection
      inspectUser(inspectingUser);
    } catch (err: any) {
      alert('Error saving page: ' + err.message);
    } finally {
      setSavingSubForm(false);
    }
  }

  // --- KNOWLEDGE BASE ACTIONS ---
  function openAddField() {
    setEditingField(null);
    setFieldFormState({
      field_name: '',
      field_value: '',
      category: 'general',
      page_id: '',
      is_active: true
    });
    setShowFieldForm(true);
  }

  function openEditField(f: any) {
    setEditingField(f);
    setFieldFormState({
      field_name: f.field_name,
      field_value: f.field_value,
      category: f.category || 'general',
      page_id: f.page_id || '',
      is_active: f.is_active
    });
    setShowFieldForm(true);
  }

  async function handleFieldSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inspectingUser) return;
    setSavingSubForm(true);

    const payload = {
      field_name: fieldFormState.field_name,
      field_value: fieldFormState.field_value,
      category: fieldFormState.category,
      page_id: fieldFormState.page_id || null,
      is_active: fieldFormState.is_active
    };

    try {
      if (editingField) {
        const { error } = await supabase
          .from('knowledge_fields')
          .update(payload)
          .eq('id', editingField.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('knowledge_fields')
          .insert({
            ...payload,
            user_id: inspectingUser.id
          });
        if (error) throw error;
        setUsers(prev => prev.map(u => u.id === inspectingUser.id ? { ...u, fieldCount: u.fieldCount + 1 } : u));
      }

      setShowFieldForm(false);
      inspectUser(inspectingUser);
    } catch (err: any) {
      alert('Error saving knowledge field: ' + err.message);
    } finally {
      setSavingSubForm(false);
    }
  }

  async function handleDeleteField(fieldId: string) {
    if (!confirm("Delete this knowledge base field?")) return;
    const { error } = await supabase.from('knowledge_fields').delete().eq('id', fieldId);
    if (error) alert("Error deleting field: " + error.message);
    else {
      setInspectData(prev => ({ ...prev, fields: prev.fields.filter(f => f.id !== fieldId) }));
      setUsers(prev => prev.map(u => u.id === inspectingUser?.id ? { ...u, fieldCount: Math.max(0, u.fieldCount - 1) } : u));
    }
  }

  // --- DOCUMENTS ACTIONS ---
  function openAddDoc() {
    setEditingDoc(null);
    setDocFormState({
      title: '',
      original_content: '',
      selectedPageIds: []
    });
    setShowDocForm(true);
  }

  function openEditDoc(d: any) {
    setEditingDoc(d);
    setDocFormState({
      title: d.title,
      original_content: d.original_content || '',
      selectedPageIds: d.assignedPageIds || []
    });
    setShowDocForm(true);
  }

  async function handleDocSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inspectingUser) return;
    setSavingSubForm(true);

    let docId = editingDoc?.id;

    try {
      if (editingDoc) {
        const { error } = await supabase
          .from('documents')
          .update({
            title: docFormState.title,
            original_content: docFormState.original_content,
            page_id: null
          })
          .eq('id', editingDoc.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('documents')
          .insert({
            user_id: inspectingUser.id,
            title: docFormState.title,
            original_content: docFormState.original_content,
            source_type: 'text',
            page_id: null
          })
          .select()
          .single();
        if (error) throw error;
        docId = data.id;
        setUsers(prev => prev.map(u => u.id === inspectingUser.id ? { ...u, documentCount: u.documentCount + 1 } : u));
      }

      // Sync assignments
      if (docId) {
        await supabase.from('document_page_assignments').delete().eq('document_id', docId);

        if (docFormState.selectedPageIds.length > 0) {
          const rows = docFormState.selectedPageIds.map(pid => ({
            document_id: docId,
            page_id: pid
          }));
          const { error: assignErr } = await supabase.from('document_page_assignments').insert(rows);
          if (assignErr) throw assignErr;
        }

        // Trigger processing
        await triggerDocProcessing(docId);
      }

      setShowDocForm(false);
      inspectUser(inspectingUser);
    } catch (err: any) {
      alert('Error saving document: ' + err.message);
    } finally {
      setSavingSubForm(false);
    }
  }

  async function handleDeleteDoc(docId: string) {
    if (!confirm("Are you sure you want to delete this document?")) return;
    const { error } = await supabase.from('documents').delete().eq('id', docId);
    if (error) alert("Error deleting document: " + error.message);
    else {
      setInspectData(prev => ({ ...prev, documents: prev.documents.filter(d => d.id !== docId) }));
      setUsers(prev => prev.map(u => u.id === inspectingUser?.id ? { ...u, documentCount: Math.max(0, u.documentCount - 1) } : u));
    }
  }

  async function triggerDocProcessing(docId: string) {
    if (!inspectingUser) return;
    setProcessingDocId(docId);
    try {
      const WORKER_URL = import.meta.env.VITE_WORKER_URL || 'https://metachat.junoverseai.com';
      const response = await fetch(`${WORKER_URL}/api/documents/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, userId: inspectingUser.id }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process document');
      }
    } catch (err: any) {
      alert('Document saved, but AI embedding failed: ' + err.message);
    } finally {
      setProcessingDocId(null);
    }
  }

  function toggleDocPageSelection(pageId: string) {
    setDocFormState(prev => ({
      ...prev,
      selectedPageIds: prev.selectedPageIds.includes(pageId)
        ? prev.selectedPageIds.filter(pid => pid !== pageId)
        : [...prev.selectedPageIds, pageId]
    }));
  }

  // Filtered users list
  const filteredUsers = users.filter(u => 
    u.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (profile && !profile.is_super_admin) {
    return (
      <div className="card" style={{padding:'48px',textAlign:'center',color:'var(--text-secondary)'}}>
        <ShieldAlert size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
        <h3>Access Denied</h3>
        <p>You must be a super admin to view this page.</p>
      </div>
    );
  }

  return (
    <div className="animate-slideUp" style={{ paddingBottom: '40px' }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={28} style={{ color: 'var(--accent-primary)' }} />
            Tenant Management
          </h1>
          <p>Super Admin interface for global user oversight and full impersonated administrative control.</p>
        </div>
        
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            className="form-input" 
            placeholder="Search name or email..." 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px', height: '40px' }}
          />
        </div>
      </div>

      {loading ? (
        <div className="card" style={{padding:'48px',textAlign:'center',color:'var(--text-secondary)'}}>Loading users...</div>
      ) : filteredUsers.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <Users className="empty-state-icon" />
            <h3>No users found</h3>
            <p>Try refining your search term.</p>
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '950px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <th style={{ padding: '16px' }}>User / Tenant</th>
                <th style={{ padding: '16px' }}>Plan</th>
                <th style={{ padding: '16px' }}>Status</th>
                <th style={{ padding: '16px' }}>Role</th>
                <th style={{ padding: '16px' }}>Resource Stats</th>
                <th style={{ padding: '16px' }}>Custom AI Models</th>
                <th style={{ padding: '16px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr 
                  key={u.id} 
                  style={{ 
                    borderBottom: '1px solid var(--border-light)',
                    background: u.is_suspended ? 'rgba(239, 68, 68, 0.02)' : 'transparent',
                    transition: 'background 0.2s'
                  }}
                >
                  <td style={{ padding: '16px' }}>
                    <div style={{ fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {u.display_name}
                      {u.is_super_admin && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', background: 'rgba(249, 115, 22, 0.15)', color: 'var(--accent-primary)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                          <Shield size={10} /> ADMIN
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{u.email}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Joined {new Date(u.created_at).toLocaleDateString()}
                    </div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <select
                      className="form-select"
                      style={{ 
                        padding: '6px 10px', 
                        fontSize: '13px', 
                        background: 'var(--bg-secondary)', 
                        color: 'var(--text-primary)', 
                        borderRadius: '6px', 
                        border: '1px solid var(--border-light)',
                        width: '120px'
                      }}
                      value={u.plan}
                      onChange={(e) => changePlan(u.id, e.target.value)}
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <button
                      onClick={() => toggleSuspension(u.id, u.is_suspended)}
                      disabled={u.id === currentUser?.id}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        border: 'none',
                        cursor: u.id === currentUser?.id ? 'not-allowed' : 'pointer',
                        background: u.is_suspended ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
                        color: u.is_suspended ? '#ef4444' : '#22c55e',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      {u.is_suspended ? 'Suspended' : 'Active'}
                    </button>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: u.id === currentUser?.id ? 'not-allowed' : 'pointer', fontSize: '13px' }}>
                      <input 
                        type="checkbox" 
                        checked={u.is_super_admin}
                        disabled={u.id === currentUser?.id}
                        onChange={() => toggleSuperAdmin(u.id, u.is_super_admin)}
                        style={{ accentColor: 'var(--accent-primary)' }}
                      />
                      Admin
                    </label>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: '240px' }}>
                      <span title="Facebook Pages Connected" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Globe size={13} style={{ opacity: 0.7 }} /> {u.pageCount}
                      </span>
                      <span title="Documents Uploaded" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FileText size={13} style={{ opacity: 0.7 }} /> {u.documentCount}
                      </span>
                      <span title="Knowledge Fields" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <BookOpen size={13} style={{ opacity: 0.7 }} /> {u.fieldCount}
                      </span>
                      <span title="Total Chat Sessions" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Cpu size={13} style={{ opacity: 0.7 }} /> {u.sessionCount}
                      </span>
                      <span title="Messages Processed" style={{ display: 'flex', alignItems: 'center', gap: '4px', gridColumn: 'span 2' }}>
                        <MessageSquare size={13} style={{ opacity: 0.7 }} /> {u.messageCount} msgs
                      </span>
                    </div>
                  </td>

                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '170px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '9px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Primary Chat</span>
                        <select 
                          className="form-select" 
                          style={{ padding: '4px 6px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                          value={u.assigned_chat_provider_id || 'default'}
                          onChange={(e) => assignProvider(u.id, e.target.value, 'chat')}
                        >
                          <option value="default">Default Global Chat</option>
                          {globalProviders.map(p => (
                            <option key={p.id} value={p.id}>{p.display_name}</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '9px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fallback Chat</span>
                        <select 
                          className="form-select" 
                          style={{ padding: '4px 6px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                          value={u.assigned_fallback_chat_provider_id || 'default'}
                          onChange={(e) => assignProvider(u.id, e.target.value, 'fallback')}
                        >
                          <option value="default">No Fallback Chat</option>
                          {globalProviders.map(p => (
                            <option key={p.id} value={p.id}>{p.display_name}</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '9px', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Embeddings</span>
                        <select 
                          className="form-select" 
                          style={{ padding: '4px 6px', fontSize: '11px', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}
                          value={u.assigned_embedding_provider_id || 'default'}
                          onChange={(e) => assignProvider(u.id, e.target.value, 'embedding')}
                        >
                          <option value="default">Default Global Embed</option>
                          {globalProviders.map(p => (
                            <option key={p.id} value={p.id}>{p.display_name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => inspectUser(u)} 
                        title="Manage Tenant Resources"
                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Eye size={14} /> Manage
                      </button>
                      <button 
                        className="btn-ghost btn-icon text-danger" 
                        onClick={() => deleteUser(u.id)} 
                        disabled={u.id === currentUser?.id}
                        title="Delete User"
                        style={{ color: u.id === currentUser?.id ? 'var(--text-muted)' : '#ef4444', opacity: u.id === currentUser?.id ? 0.3 : 1 }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inspect Tenant Drawer Overlay */}
      {inspectingUser && (
        <div className="modal-overlay" style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch', padding: 0 }}>
          <div 
            className="animate-slideLeft" 
            style={{ 
              width: '100%', 
              maxWidth: '750px', 
              height: '100vh', 
              display: 'flex', 
              flexDirection: 'column',
              background: '#0a0a0a',
              borderLeft: '1px solid var(--border-secondary)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 1001,
              position: 'relative'
            }}
          >
            {/* Drawer Header */}
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  <Users size={20} style={{ color: 'var(--accent-primary)' }} />
                  Managing: {inspectingUser.display_name}
                </h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {inspectingUser.email} • ID: <code style={{ fontSize: '11px', color: 'var(--accent-primary)' }}>{inspectingUser.id}</code>
                </div>
              </div>
              <button className="btn-ghost btn-icon" onClick={() => setInspectingUser(null)}>
                <X size={20} />
              </button>
            </div>

            {/* Impersonated Navigation Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)' }}>
              <button 
                onClick={() => setActiveTab('pages')}
                style={{ 
                  flex: 1, 
                  padding: '14px', 
                  background: 'none', 
                  border: 'none', 
                  color: activeTab === 'pages' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'pages' ? '2px solid var(--accent-primary)' : 'none',
                  fontWeight: activeTab === 'pages' ? '600' : '400',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Globe size={15} /> Pages & Bots ({inspectData.pages.length})
              </button>
              <button 
                onClick={() => setActiveTab('documents')}
                style={{ 
                  flex: 1, 
                  padding: '14px', 
                  background: 'none', 
                  border: 'none', 
                  color: activeTab === 'documents' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'documents' ? '2px solid var(--accent-primary)' : 'none',
                  fontWeight: activeTab === 'documents' ? '600' : '400',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <FileText size={15} /> RAG Docs ({inspectData.documents.length})
              </button>
              <button 
                onClick={() => setActiveTab('fields')}
                style={{ 
                  flex: 1, 
                  padding: '14px', 
                  background: 'none', 
                  border: 'none', 
                  color: activeTab === 'fields' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'fields' ? '2px solid var(--accent-primary)' : 'none',
                  fontWeight: activeTab === 'fields' ? '600' : '400',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <BookOpen size={15} /> Knowledge Base ({inspectData.fields.length})
              </button>
              <button 
                onClick={() => setActiveTab('limits')}
                style={{ 
                  flex: 1, 
                  padding: '14px', 
                  background: 'none', 
                  border: 'none', 
                  color: activeTab === 'limits' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === 'limits' ? '2px solid var(--accent-primary)' : 'none',
                  fontWeight: activeTab === 'limits' ? '600' : '400',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <BarChart3 size={15} /> AI Usage & Limits
              </button>
            </div>

            {/* Resource Actions Header */}
            <div style={{ padding: '16px 24px', background: 'rgba(255, 255, 255, 0.01)', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
                Tenant Resource Control Center
              </span>
              {activeTab === 'pages' && (
                <button className="btn btn-primary btn-sm" onClick={openAddPage}>
                  <Plus size={14} /> Link FB Page
                </button>
              )}
              {activeTab === 'fields' && (
                <button className="btn btn-primary btn-sm" onClick={openAddField}>
                  <Plus size={14} /> Add Knowledge Fact
                </button>
              )}
              {activeTab === 'documents' && (
                <button className="btn btn-primary btn-sm" onClick={openAddDoc}>
                  <Plus size={14} /> Add Doc
                </button>
              )}
            </div>

            {/* Drawer Body Scroll */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {loadingInspect ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Loading resources...
                </div>
              ) : (
                <>
                  {/* PAGES & BOTS TAB */}
                  {activeTab === 'pages' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {inspectData.pages.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                          <Globe className="empty-state-icon" />
                          <h3>No Pages Connected</h3>
                          <p>Link a Facebook Page for this tenant to enable message automation.</p>
                        </div>
                      ) : (
                        inspectData.pages.map(p => (
                          <div 
                            key={p.id} 
                            style={{ 
                              background: 'var(--bg-secondary)', 
                              padding: '20px', 
                              borderRadius: '12px', 
                              border: '1px solid var(--border-primary)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <h3 style={{ fontSize: '1rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                                  {p.page_name || 'Unnamed Page'}
                                  <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: p.is_active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: p.is_active ? '#22c55e' : '#ef4444' }}>
                                    {p.is_active ? 'Automation Active' : 'Automation Paused'}
                                  </span>
                                </h3>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                  Facebook Page ID: <code style={{ color: 'var(--text-primary)' }}>{p.page_id}</code>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button 
                                  className="btn btn-secondary btn-sm" 
                                  onClick={() => openEditPage(p)}
                                  title="Edit Page Bot Config"
                                >
                                  <Pencil size={13} /> Edit Config
                                </button>
                                <button 
                                  className="btn btn-secondary btn-sm" 
                                  onClick={() => handleTogglePage(p.id, p.is_active)}
                                >
                                  {p.is_active ? 'Pause' : 'Resume'}
                                </button>
                                <button 
                                  className="btn btn-danger btn-sm btn-icon" 
                                  onClick={() => handleDisconnectPage(p.id)}
                                  title="Disconnect Page"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>

                            {/* Bot Config Box */}
                            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                              <div>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Bot Name</span>
                                <span style={{ fontWeight: '500' }}>{p.bot_name || 'None'}</span>
                              </div>
                              <div>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Provider & Model</span>
                                <span style={{ fontWeight: '500' }}>
                                  {allProviders.find(prov => prov.id === p.ai_provider_id)?.display_name || 'Default Tenant / Active Provider'} ({p.ai_model || 'None'}) (t={p.temperature ?? 0.5})
                                </span>
                              </div>
                              <div style={{ gridColumn: 'span 2' }}>
                                <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>System Prompt Summary</span>
                                <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', display: 'block', fontSize: '0.8rem' }}>
                                  {p.custom_system_prompt || '(Empty, using default)'}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* DOCUMENTS & RAG TAB */}
                  {activeTab === 'documents' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {inspectData.documents.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                          <FileText className="empty-state-icon" />
                          <h3>No RAG Documents</h3>
                          <p>Upload text files/knowledge sheets to enrich this tenant's AI response vectors.</p>
                        </div>
                      ) : (
                        inspectData.documents.map(d => (
                          <div 
                            key={d.id} 
                            className="list-item" 
                            style={{ 
                              background: 'var(--bg-secondary)', 
                              border: '1px solid var(--border-primary)', 
                              padding: '16px', 
                              borderRadius: '10px',
                              alignItems: 'stretch',
                              flexDirection: 'column',
                              gap: '12px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <div style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{d.title}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                  <span>Chunks: <strong>{d.chunk_count}</strong></span>
                                  <span>•</span>
                                  <span>Scope: 
                                    <span style={{ marginLeft: '4px', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', background: d.assignedPageIds?.length > 0 ? 'rgba(249, 115, 22, 0.15)' : 'rgba(34, 197, 94, 0.15)', color: d.assignedPageIds?.length > 0 ? 'var(--accent-primary)' : '#22c55e' }}>
                                      {d.assignedPageIds?.length > 0 ? `${d.assignedPageIds.length} Page(s)` : 'Global'}
                                    </span>
                                  </span>
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button 
                                  className="btn btn-secondary btn-sm btn-icon"
                                  onClick={() => openEditDoc(d)}
                                  title="Edit Title/Content"
                                >
                                  <Pencil size={13} />
                                </button>
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => triggerDocProcessing(d.id)}
                                  disabled={processingDocId === d.id}
                                  title="Re-run chunks and embeddings extraction"
                                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                >
                                  <RefreshCw size={13} className={processingDocId === d.id ? 'animate-spin' : ''} />
                                  {processingDocId === d.id ? 'Embedding...' : 'Re-Embed'}
                                </button>
                                <button 
                                  className="btn-ghost btn-icon text-danger" 
                                  onClick={() => handleDeleteDoc(d.id)}
                                  title="Delete Document"
                                  style={{ color: '#ef4444' }}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>

                            {d.original_content && (
                              <details style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                <summary style={{ cursor: 'pointer', color: 'var(--accent-primary)' }}>View text content Preview</summary>
                                <pre style={{ 
                                  marginTop: '8px', 
                                  background: 'rgba(0,0,0,0.3)', 
                                  padding: '12px', 
                                  borderRadius: '6px', 
                                  border: '1px solid var(--border-light)',
                                  whiteSpace: 'pre-wrap', 
                                  maxHeight: '200px', 
                                  overflowY: 'auto',
                                  fontFamily: 'monospace',
                                  lineHeight: '1.4'
                                }}>
                                  {d.original_content}
                                </pre>
                              </details>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* KNOWLEDGE BASE TAB */}
                  {activeTab === 'fields' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {inspectData.fields.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                          <BookOpen className="empty-state-icon" />
                          <h3>No Knowledge Facts</h3>
                          <p>Add key-value pairs (e.g. Business Hours, Policies) that the bot will prioritize.</p>
                        </div>
                      ) : (
                        inspectData.fields.map(f => (
                          <div 
                            key={f.id} 
                            style={{ 
                              background: 'var(--bg-secondary)', 
                              padding: '16px', 
                              borderRadius: '10px', 
                              border: '1px solid var(--border-primary)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '10px'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <span style={{ fontSize: '11px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '4px', textTransform: 'capitalize', fontWeight: 'bold' }}>
                                  {f.category}
                                </span>
                                <h4 style={{ fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-primary)', marginTop: '6px' }}>{f.field_name}</h4>
                              </div>

                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button className="btn-ghost btn-icon" onClick={() => openEditField(f)} title="Edit Field">
                                  <Pencil size={14} style={{ color: 'var(--text-secondary)' }} />
                                </button>
                                <button className="btn-ghost btn-icon text-danger" onClick={() => handleDeleteField(f.id)} title="Delete Field" style={{ color: '#ef4444' }}>
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>

                            <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', background: 'rgba(0,0,0,0.15)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-light)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {f.field_value}
                            </div>

                            {f.page_id && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Globe size={11} /> Page Filter Scoped: {f.page_id}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* AI USAGE & LIMITS TAB */}
                  {activeTab === 'limits' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      
                      {/* Quota Progress & Configuration Card */}
                      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', padding: '24px', borderRadius: '12px' }}>
                        <h3 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                          <Percent size={18} style={{ color: 'var(--accent-primary)' }} /> Monthly Usage & Quota Rules
                        </h3>
                        
                        {/* Progress Bar */}
                        <div style={{ marginBottom: '24px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Monthly Accumulated Usage</span>
                            <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
                              {inspectData.usage.totalMonthTokens.toLocaleString()} / {inspectingUser.monthly_token_limit?.toLocaleString() ?? '500,000'} tokens
                            </span>
                          </div>
                          
                          {/* Visual progress bar */}
                          <div style={{ height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                            <div 
                              style={{ 
                                width: `${Math.min(100, (inspectData.usage.totalMonthTokens / (inspectingUser.monthly_token_limit ?? 500000)) * 100)}%`, 
                                background: (inspectData.usage.totalMonthTokens >= (inspectingUser.monthly_token_limit ?? 500000)) 
                                  ? '#ef4444' 
                                  : (inspectData.usage.totalMonthTokens / (inspectingUser.monthly_token_limit ?? 500000) >= 0.8) 
                                    ? 'var(--accent-primary)' 
                                    : '#22c55e',
                                transition: 'width 0.3s ease'
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                            <span>Usage: {((inspectData.usage.totalMonthTokens / (inspectingUser.monthly_token_limit ?? 500000)) * 100).toFixed(1)}%</span>
                            {inspectData.usage.totalMonthTokens >= (inspectingUser.monthly_token_limit ?? 500000) && (
                              <span style={{ color: '#ef4444', fontWeight: 'bold' }}>BLOCKING: Limit Exceeded</span>
                            )}
                          </div>
                        </div>

                        {/* Configuration Form */}
                        <form onSubmit={handleSaveQuota} style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
                            <div className="form-group" style={{ flex: '1 1 200px' }}>
                              <label className="form-label" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Token Limit</label>
                              <input 
                                className="form-input" 
                                type="number" 
                                min={0} 
                                value={monthlyLimitInput} 
                                onChange={e => setMonthlyLimitInput(Number(e.target.value))} 
                                required 
                              />
                              <p className="form-hint" style={{ fontSize: '11px' }}>Define maximum prompt + completion tokens allowed per month.</p>
                            </div>

                            <div className="form-group" style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '12px' }}>
                                <input 
                                  type="checkbox" 
                                  checked={strictEnforcementInput} 
                                  onChange={e => setStrictEnforcementInput(e.target.checked)}
                                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-primary)' }}
                                />
                                <span>Strict Limit Block</span>
                              </label>
                              <p className="form-hint" style={{ fontSize: '11px', marginTop: '6px' }}>If checked, the chatbot stops responding automatically once limit is exceeded.</p>
                            </div>
                            
                            <div className="form-group" style={{ flex: '1 1 200px' }}>
                              <label className="form-label" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Message Limit</label>
                              <input 
                                className="form-input" 
                                type="number" 
                                min={-1} 
                                value={monthlyMessageLimitInput} 
                                onChange={e => setMonthlyMessageLimitInput(Number(e.target.value))} 
                                required 
                              />
                              <p className="form-hint" style={{ fontSize: '11px' }}>Maximum number of AI messages per month. Set -1 for unlimited.</p>
                            </div>

                            <div className="form-group" style={{ flex: '1 1 200px' }}>
                              <label className="form-label" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Allowed Channels</label>
                              <input 
                                className="form-input" 
                                type="number" 
                                min={0} 
                                value={allowedChannelsInput} 
                                onChange={e => setAllowedChannelsInput(Number(e.target.value))} 
                                required 
                              />
                              <p className="form-hint" style={{ fontSize: '11px' }}>Number of channels the tenant can connect. Set 0 to disable all.</p>
                            </div>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-primary" type="submit" disabled={savingQuota}>
                              {savingQuota ? 'Saving...' : 'Save Quota Settings'}
                            </button>
                          </div>
                        </form>
                      </div>

                      {/* Advanced Usage Filters & Analytics */}
                      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', padding: '24px', borderRadius: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                          <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', color: 'var(--text-primary)', margin: 0 }}>
                            <BarChart3 size={18} style={{ color: 'var(--accent-primary)' }} /> Token Usage Analytics
                          </h3>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Time Range:</label>
                            <select 
                              className="form-input" 
                              style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto' }}
                              value={usageFilter}
                              onChange={e => setUsageFilter(e.target.value as any)}
                            >
                              <option value="this_month">This Month</option>
                              <option value="last_month">Last Month</option>
                              <option value="this_year">This Year</option>
                              <option value="all_time">All Time (Lifetime)</option>
                            </select>
                            {loadingUsage && <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--accent-primary)' }} />}
                          </div>
                        </div>

                        {/* Summary of Filtered Tokens */}
                        <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Total Tokens for Selected Period:</span>
                          <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>{inspectData.usage.filteredTokens.toLocaleString()}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                          
                          {/* Model Usage Breakdown Card */}
                          <div>
                            <h4 style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                              Model-wise Breakdown
                            </h4>
                            {inspectData.usage.modelBreakdown.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                No completions recorded.
                              </div>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid var(--border-light)', textAlign: 'left' }}>
                                    <th style={{ padding: '8px 0', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Model Name / Provider</th>
                                    <th style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text-secondary)', fontWeight: 'bold' }}>Tokens Used</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {inspectData.usage.modelBreakdown.map((row, i) => (
                                    <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                      <td style={{ padding: '10px 0', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{row.model}</td>
                                      <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{row.tokens.toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>

                          {/* Date-wise Daily Usage Card */}
                          <div>
                            <h4 style={{ marginBottom: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                              Date-wise Usage
                            </h4>
                            {inspectData.usage.dateBreakdown.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                No activity recorded.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                                {inspectData.usage.dateBreakdown.map((row, i) => (
                                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                                    <span style={{ color: 'var(--text-primary)' }}>{row.date}</span>
                                    <span style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>{row.tokens.toLocaleString()} tokens</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                        </div>
                      </div>

                    </div>
                  )}
                </>
              )}
            </div>

            {/* Drawer Footer */}
            <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-primary)', background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setInspectingUser(null)}>
                Close Panel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT PAGE MODAL DIALOG --- */}
      {showPageForm && inspectingUser && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{editingPage ? 'Edit Page Connection & Bot Config' : 'Link Facebook Page Connection'}</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowPageForm(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handlePageSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div className="form-group">
                  <label className="form-label">Facebook Page ID</label>
                  <input 
                    className="form-input"
                    value={pageFormState.page_id}
                    onChange={e => setPageFormState({ ...pageFormState, page_id: e.target.value })}
                    required
                    placeholder="e.g. 10294829038290"
                    disabled={!!editingPage} // Can't edit the raw Facebook page ID after creation
                  />
                  <span className="form-hint">The numerical string ID of the Facebook page.</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Page Name</label>
                  <input 
                    className="form-input"
                    value={pageFormState.page_name}
                    onChange={e => setPageFormState({ ...pageFormState, page_name: e.target.value })}
                    required
                    placeholder="e.g. Acme Support Page"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Page Access Token {editingPage && <span style={{ color: 'var(--text-muted)' }}>(Leave blank to keep current)</span>}
                  </label>
                  <input 
                    className="form-input"
                    type="password"
                    value={pageFormState.access_token}
                    onChange={e => setPageFormState({ ...pageFormState, access_token: e.target.value })}
                    required={!editingPage}
                    placeholder="EAAG...."
                  />
                </div>

                <hr style={{ borderColor: 'var(--border-primary)', margin: '8px 0' }} />

                <h3 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                  Bot Persona & AI Settings
                </h3>

                <div className="form-group">
                  <label className="form-label">Bot Persona Name</label>
                  <input 
                    className="form-input"
                    value={pageFormState.bot_name}
                    onChange={e => setPageFormState({ ...pageFormState, bot_name: e.target.value })}
                    placeholder="e.g. Sarah from Support"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">AI Provider</label>
                  <select 
                    className="form-select"
                    value={pageFormState.ai_provider_id}
                    onChange={e => {
                      const providerId = e.target.value;
                      const selectedProv = allProviders.find(p => p.id === providerId);
                      const defaultProv = allProviders.find(p => p.is_global && p.is_active_chat) || allProviders.find(p => p.is_global);
                      setPageFormState({ 
                        ...pageFormState, 
                        ai_provider_id: providerId,
                        ai_model: selectedProv ? (selectedProv.model_chat || '') : (defaultProv?.model_chat || '')
                      });
                    }}
                  >
                    <option value="">Default Tenant / Active Provider</option>
                    {allProviders.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.display_name} ({p.provider_name} - {p.model_chat || 'no chat model'})
                      </option>
                    ))}
                  </select>
                  <span className="form-hint">Choose which specific AI Provider configuration handles this page's messages.</span>
                </div>

                <div className="form-group">
                  <label className="form-label">AI Model Override</label>
                  <input 
                    className="form-input"
                    value={pageFormState.ai_model}
                    onChange={e => setPageFormState({ ...pageFormState, ai_model: e.target.value })}
                    placeholder="e.g. gemini-1.5-flash"
                  />
                  <span className="form-hint">Model identifier used for chat completions (defaults to the provider's default model).</span>
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label className="form-label">AI Temperature (Creativity)</label>
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                      {pageFormState.temperature}
                    </span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={pageFormState.temperature}
                    onChange={e => setPageFormState({ ...pageFormState, temperature: parseFloat(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Custom System Prompt (Markdown instructions)</label>
                  <textarea 
                    className="form-textarea"
                    value={pageFormState.custom_system_prompt}
                    onChange={e => setPageFormState({ ...pageFormState, custom_system_prompt: e.target.value })}
                    rows={6}
                    placeholder="Describe the bot's behavior, instructions, context guidelines..."
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={pageFormState.is_active}
                    onChange={e => setPageFormState({ ...pageFormState, is_active: e.target.checked })}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  Enable Bot Automation
                </label>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowPageForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingSubForm}>
                  {savingSubForm ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT KNOWLEDGE FIELD DIALOG --- */}
      {showFieldForm && inspectingUser && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal">
            <div className="modal-header">
              <h2>{editingField ? 'Edit Knowledge Fact' : 'Add Knowledge Fact'}</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowFieldForm(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleFieldSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div className="form-group">
                  <label className="form-label">Fact/Field Name (e.g. Return Policy)</label>
                  <input 
                    className="form-input"
                    value={fieldFormState.field_name}
                    onChange={e => setFieldFormState({ ...fieldFormState, field_name: e.target.value })}
                    required
                    placeholder="e.g. Refund Policy"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Fact Details/Value</label>
                  <textarea 
                    className="form-textarea"
                    value={fieldFormState.field_value}
                    onChange={e => setFieldFormState({ ...fieldFormState, field_value: e.target.value })}
                    required
                    rows={4}
                    placeholder="e.g. We accept refunds within 30 days of purchase. Items must be unopened..."
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select 
                    className="form-select"
                    value={fieldFormState.category}
                    onChange={e => setFieldFormState({ ...fieldFormState, category: e.target.value })}
                  >
                    <option value="general">General Info</option>
                    <option value="pricing">Pricing & Billing</option>
                    <option value="products">Products & Services</option>
                    <option value="policies">Policies & Returns</option>
                    <option value="contact">Contact Details</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Page Scope Filter</label>
                  <select 
                    className="form-select"
                    value={fieldFormState.page_id}
                    onChange={e => setFieldFormState({ ...fieldFormState, page_id: e.target.value })}
                  >
                    <option value="">Global (Applies to all connected pages)</option>
                    {inspectData.pages.map(p => (
                      <option key={p.page_id} value={p.page_id}>
                        {p.page_name || p.page_id}
                      </option>
                    ))}
                  </select>
                  <span className="form-hint">Restrict this fact to a specific page, or make it global across all pages.</span>
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={fieldFormState.is_active}
                    onChange={e => setFieldFormState({ ...fieldFormState, is_active: e.target.checked })}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  Active & Injected in Prompt
                </label>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowFieldForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingSubForm}>
                  {savingSubForm ? 'Saving...' : 'Save Fact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD/EDIT DOCUMENT RAG DIALOG --- */}
      {showDocForm && inspectingUser && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h2>{editingDoc ? 'Edit Document & RAG Content' : 'Upload Document for RAG'}</h2>
              <button className="btn-ghost btn-icon" onClick={() => setShowDocForm(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleDocSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div className="form-group">
                  <label className="form-label">Document Title</label>
                  <input 
                    className="form-input"
                    value={docFormState.title}
                    onChange={e => setDocFormState({ ...docFormState, title: e.target.value })}
                    required
                    placeholder="e.g. Complete Product Catalog 2026"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Full Text Content</label>
                  <textarea 
                    className="form-textarea"
                    value={docFormState.original_content}
                    onChange={e => setDocFormState({ ...docFormState, original_content: e.target.value })}
                    required
                    rows={10}
                    placeholder="Paste catalog text, FAQs, policy manuals, or knowledge guides..."
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Page Scoping Assignments</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '150px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-primary)' }}>
                    {inspectData.pages.length === 0 ? (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        No pages connected yet. Document will be Global.
                      </span>
                    ) : (
                      <>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          If none checked, document is Global. Otherwise, visible only to checked pages:
                        </span>
                        {inspectData.pages.map(p => (
                          <label key={p.page_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                            <input 
                              type="checkbox"
                              checked={docFormState.selectedPageIds.includes(p.page_id)}
                              onChange={() => toggleDocPageSelection(p.page_id)}
                              style={{ accentColor: 'var(--accent-primary)' }}
                            />
                            {p.page_name || p.page_id}
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowDocForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingSubForm}>
                  {savingSubForm ? 'Saving & Processing...' : 'Save & Extract Embeddings'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
