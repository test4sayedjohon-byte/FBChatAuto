import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { toast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { 
  Users, Search, Filter, MessageSquare, Edit3, Trash2, 
  BrainCircuit, X, RefreshCw, Plus, Copy 
} from 'lucide-react';

function renderMarkdown(text: string | null) {
  if (!text) return null;

  const lines = text.split('\n');

  return lines.map((line, idx) => {
    let content = line.trim();
    if (!content) {
      return <div key={idx} style={{ height: '8px' }} />;
    }

    const isBullet = content.startsWith('* ') || content.startsWith('- ') || content.startsWith('• ');
    if (isBullet) {
      content = content.substring(2);
    }

    const parseInline = (str: string) => {
      const boldParts = str.split('**');
      return boldParts.map((bPart, bIdx) => {
        const isBold = bIdx % 2 === 1;
        
        const italicParts = bPart.split('*');
        const renderedItalics = italicParts.map((iPart, iIdx) => {
          const isItalic = iIdx % 2 === 1;
          if (isItalic) {
            return <em key={iIdx}>{iPart}</em>;
          }
          return iPart;
        });

        if (isBold) {
          return <strong key={bIdx}>{renderedItalics}</strong>;
        }
        return renderedItalics;
      });
    };

    if (content.startsWith('#')) {
      const level = content.match(/^#+/)?.[0].length || 1;
      const headerText = content.replace(/^#+\s*/, '');
      const headerStyle = {
        margin: '12px 0 6px 0',
        fontWeight: 600,
        fontSize: level === 1 ? '1.3rem' : level === 2 ? '1.15rem' : '1rem'
      };
      if (level === 1) return <h3 key={idx} style={headerStyle}>{parseInline(headerText)}</h3>;
      if (level === 2) return <h4 key={idx} style={headerStyle}>{parseInline(headerText)}</h4>;
      return <h5 key={idx} style={headerStyle}>{parseInline(headerText)}</h5>;
    }

    if (isBullet) {
      return (
        <ul key={idx} style={{ margin: '4px 0 4px 12px', paddingLeft: '8px', listStyleType: 'disc' }}>
          <li style={{ color: 'inherit' }}>{parseInline(content)}</li>
        </ul>
      );
    }

    if (content.includes(' * ')) {
      const parts = content.split(' * ');
      return (
        <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '4px 0' }}>
          {parts.map((part, pIdx) => (
            <div key={pIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
              <span style={{ opacity: 0.5 }}>•</span>
              <div>{parseInline(part.trim())}</div>
            </div>
          ))}
        </div>
      );
    }

    return (
      <p key={idx} style={{ margin: '0 0 8px 0', minHeight: '1em', lineHeight: '1.5' }}>
        {parseInline(content)}
      </p>
    );
  });
}

interface Contact {
  id: string;
  sender_id: string;
  sender_name: string | null;
  sender_avatar: string | null;
  page_id: string;
  metadata: Record<string, any>;
  bot_paused: boolean;
  last_message_at: string;
  summary?: string | null;
  intent_level?: string;
  lead_score?: number | null;
  profile_metadata?: Record<string, any>;
}

export default function ContactsPage() {
  useDocumentTitle('Leads & Contacts — AutometaBot');
  const { user } = useAuth();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [pages, setPages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPageId, setFilterPageId] = useState('all');
  const [filterIntent, setFilterIntent] = useState('all');
  const [sortByScore, setSortByScore] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const [pageInputVal, setPageInputVal] = useState('1');

  // Edit Modal State
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [editMetaFields, setEditMetaFields] = useState<Array<{ key: string; val: string }>>([]);
  const [savingEdit, setSavingEdit] = useState(false);

  // Cell Preview Modal State
  const [activeCellModal, setActiveCellModal] = useState<{ key: string; val: string } | null>(null);

  // Mobile Summary Modal Content State
  const [mobileSummaryModalContent, setMobileSummaryModalContent] = useState<string | null>(null);

  // Selected Contact for detailed Summary Modal
  const [selectedContactForSummary, setSelectedContactForSummary] = useState<Contact | null>(null);

  const LEAD_STATUSES = [
    { value: 'New', label: 'New', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.08)', border: 'rgba(59, 130, 246, 0.2)' },
    { value: 'Contacted', label: 'Contacted', color: '#f97316', bg: 'rgba(249, 115, 22, 0.08)', border: 'rgba(249, 115, 22, 0.2)' },
    { value: 'Interested', label: 'Interested', color: '#eab308', bg: 'rgba(234, 179, 8, 0.08)', border: 'rgba(234, 179, 8, 0.2)' },
    { value: 'Not Interested', label: 'Not Interested', color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.08)', border: 'rgba(156, 163, 175, 0.2)' },
    { value: 'Done / Closed', label: 'Done / Closed', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.08)', border: 'rgba(34, 197, 94, 0.2)' }
  ];

  // Dynamically extract all captured variable keys across all contacts to build our Excel-like sheet columns
  const dynamicKeys = useMemo(() => {
    const keysSet = new Set<string>();
    contacts.forEach(c => {
      Object.keys(c.metadata).forEach(k => {
        if (k !== 'ai_context_enabled' && k !== 'lead_status') {
          keysSet.add(k);
        }
      });
    });
    const keysArray = Array.from(keysSet);
    keysArray.sort((a, b) => {
      if (a === 'email') return -1;
      if (b === 'email') return 1;
      if (a === 'phone') return -1;
      if (b === 'phone') return 1;
      return a.localeCompare(b);
    });
    return keysArray;
  }, [contacts]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  async function handleUpdateStatus(contact: Contact, status: string) {
    const newMetadata = { ...contact.metadata };
    newMetadata.lead_status = status;

    // Optimistic Update
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, metadata: newMetadata } : c));

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ metadata: newMetadata })
        .eq('id', contact.id);

      if (error) throw error;
      toast.success(`Lead status marked as: ${status}`);
    } catch (err: any) {
      toast.error('Failed to update lead status: ' + err.message);
      // Revert
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, metadata: contact.metadata } : c));
    }
  }

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    setCurrentPage(1);
    setPageInputVal('1');
  }, [searchQuery, filterPageId, filterIntent, sortByScore]);

  async function loadData() {
    try {
      setLoading(true);
      // 1. Load pages mapping
      const { data: pagesData } = await supabase
        .from('page_connections')
        .select('page_id, page_name')
        .eq('user_id', user?.id);

      const pMap: Record<string, string> = {};
      if (pagesData) {
        pagesData.forEach(p => pMap[p.page_id] = p.page_name || p.page_id);
      }
      setPages(pMap);

      // 2. Load all customer profiles
      const { data: profilesData } = await supabase
        .from('customer_profiles')
        .select('page_id, sender_id, summary, intent_level, lead_score, metadata')
        .eq('user_id', user?.id);

      const profileMap: Record<string, any> = {};
      if (profilesData) {
        profilesData.forEach(p => {
          profileMap[p.page_id + '_' + p.sender_id] = p;
        });
      }

      // 3. Load all chat sessions
      const { data: sessionsData, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user?.id)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Filter to sessions that have at least some metadata (captured flow variables) OR AI profiles
      const mapped = (sessionsData ?? []).map(s => {
        const key = s.page_id + '_' + s.sender_id;
        const profile = profileMap[key] || {};
        return {
          id: s.id,
          sender_id: s.sender_id,
          sender_name: s.sender_name,
          sender_avatar: s.sender_avatar,
          page_id: s.page_id,
          metadata: typeof s.metadata === 'string' ? JSON.parse(s.metadata) : (s.metadata ?? {}),
          bot_paused: s.bot_paused,
          last_message_at: s.last_message_at,
          summary: profile.summary || null,
          intent_level: profile.intent_level || 'unknown',
          lead_score: profile.lead_score || null,
          profile_metadata: profile.metadata || {}
        };
      });

      setContacts(mapped);
    } catch (err: any) {
      toast.error('Failed to load contacts: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  // Toggle AI access to metadata
  async function handleToggleAiAccess(contact: Contact) {
    const newMetadata = { ...contact.metadata };
    const currentEnabled = newMetadata.ai_context_enabled !== false;
    newMetadata.ai_context_enabled = !currentEnabled;

    // Optimistic Update
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, metadata: newMetadata } : c));

    try {
      const { error } = await supabase
        .from('chat_sessions')
        .update({ metadata: newMetadata })
        .eq('id', contact.id);

      if (error) throw error;
      toast.success(newMetadata.ai_context_enabled ? 'AI assistant can now access this contact\'s details.' : 'AI assistant blocked from accessing this contact\'s details.');
    } catch (err: any) {
      toast.error('Failed to update AI access: ' + err.message);
      // Revert on error
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, metadata: contact.metadata } : c));
    }
  }

  // Open Edit Modal
  function handleOpenEdit(contact: Contact) {
    setEditingContact(contact);
    const fields = Object.entries(contact.metadata)
      .filter(([k]) => k !== 'ai_context_enabled')
      .map(([k, v]) => ({ key: k, val: String(v ?? '') }));
    setEditMetaFields(fields);
  }

  // Handle Edit field changes
  function handleEditFieldChange(index: number, key: string, val: string) {
    setEditMetaFields(prev => {
      const next = [...prev];
      next[index] = { key, val };
      return next;
    });
  }

  // Add field in edit modal
  function handleAddEditField() {
    setEditMetaFields(prev => [...prev, { key: '', val: '' }]);
  }

  // Remove field in edit modal
  function handleRemoveEditField(index: number) {
    setEditMetaFields(prev => prev.filter((_, idx) => idx !== index));
  }

  // Save Edit Changes
  async function handleSaveEdit() {
    if (!editingContact) return;
    setSavingEdit(true);

    try {
      const updatedMeta: Record<string, any> = {};
      
      // Preserve the ai_context_enabled state
      if (editingContact.metadata.ai_context_enabled !== undefined) {
        updatedMeta.ai_context_enabled = editingContact.metadata.ai_context_enabled;
      }

      // Merge edited fields
      for (const field of editMetaFields) {
        const cleanedKey = field.key.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');
        if (cleanedKey) {
          updatedMeta[cleanedKey] = field.val.trim();
        }
      }

      const { error } = await supabase
        .from('chat_sessions')
        .update({ metadata: updatedMeta })
        .eq('id', editingContact.id);

      if (error) throw error;

      toast.success('Contact details updated successfully!');
      setContacts(prev => prev.map(c => c.id === editingContact.id ? { ...c, metadata: updatedMeta } : c));
      setEditingContact(null);
    } catch (err: any) {
      toast.error('Failed to update contact: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  // Delete all metadata variables
  async function handleDeleteContactDetails(contact: Contact) {
    if (!confirm(`Are you sure you want to clear all captured leads data for "${contact.sender_name || 'Anonymous User'}"?`)) return;

    try {
      const emptyMeta = { ai_context_enabled: true };
      const { error } = await supabase
        .from('chat_sessions')
        .update({ metadata: emptyMeta })
        .eq('id', contact.id);

      if (error) throw error;
      toast.success('Leads data cleared successfully.');
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, metadata: emptyMeta } : c));
    } catch (err: any) {
      toast.error('Failed to clear contact details: ' + err.message);
    }
  }

  // Filtered contacts list
  const filteredContacts = useMemo(() => {
    const list = contacts.filter(c => {
      // Show contacts that have captured keys OR AI profile info
      const capturedKeys = Object.keys(c.metadata).filter(k => k !== 'ai_context_enabled');
      const hasProfileInfo = !!c.summary || !!c.intent_level || c.lead_score !== null;
      if (capturedKeys.length === 0 && !hasProfileInfo) return false;

      const pageMatches = filterPageId === 'all' || c.page_id === filterPageId;
      
      const text = `${c.sender_name ?? ''} ${c.metadata.email ?? ''} ${c.metadata.phone ?? ''}`.toLowerCase();
      const searchMatches = !searchQuery || text.includes(searchQuery.toLowerCase());

      // Intent level filtering
      let intentMatches = true;
      const intent = c.intent_level || 'unknown';
      const score = c.lead_score || 0;
      if (filterIntent === 'high') {
        intentMatches = intent === 'high' || score >= 8;
      } else if (filterIntent === 'medium') {
        intentMatches = intent === 'medium' || (score >= 4 && score <= 7);
      } else if (filterIntent === 'low') {
        intentMatches = intent === 'low' || (score >= 1 && score <= 3);
      }

      return pageMatches && searchMatches && intentMatches;
    });

    if (sortByScore) {
      list.sort((a, b) => {
        const scoreA = a.lead_score ?? 0;
        const scoreB = b.lead_score ?? 0;
        return scoreB - scoreA;
      });
    }
    return list;
  }, [contacts, searchQuery, filterPageId, filterIntent, sortByScore]);

  const totalPages = Math.ceil(filteredContacts.length / pageSize);
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredContacts.slice(start, start + pageSize);
  }, [filteredContacts, currentPage, pageSize]);

  return (
    <div style={{ padding: '0 8px 32px' }}>
      {/* Page Header */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users size={28} className="text-primary" /> Leads & Contacts
          </h1>
          <p className="page-desc" style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Inspect, filter, edit and manage customer profile variables captured during chat automation flows.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={loadData} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <RefreshCw size={14} /> Refresh Data
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px', marginBottom: '24px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search by name, email, phone..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 38px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontSize: '14px',
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Filter size={14} style={{ color: 'var(--text-secondary)' }} />
          <select
            value={filterPageId}
            onChange={e => setFilterPageId(e.target.value)}
            style={{
              padding: '10px 14px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <option value="all">All Pages / Channels</option>
            {Object.entries(pages).map(([pid, name]) => (
              <option key={pid} value={pid}>{name}</option>
            ))}
          </select>

          <select
            value={filterIntent}
            onChange={e => setFilterIntent(e.target.value)}
            style={{
              padding: '10px 14px',
              background: 'var(--bg-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-md)',
              color: '#fff',
              fontSize: '13px',
              cursor: 'pointer'
            }}
          >
            <option value="all">All AI Intents</option>
            <option value="high">High Intent (Score &ge; 8)</option>
            <option value="medium">Medium Intent (Score 4-7)</option>
            <option value="low">Low Intent (Score 1-3)</option>
          </select>

          <button
            type="button"
            onClick={() => setSortByScore(!sortByScore)}
            className={`btn ${sortByScore ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              padding: '10px 14px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <BrainCircuit size={14} /> {sortByScore ? 'Sorted by AI Score' : 'Sort by AI Score'}
          </button>
        </div>
      </div>

      {/* Contacts Grid/Table */}
      {loading ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <RefreshCw className="spin" size={24} style={{ margin: '0 auto 12px' }} />
          <p>Loading captured contacts directory...</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="card" style={{ padding: '64px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.2 }}>👥</div>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#fff' }}>No Captured Leads Found</h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '8px auto 0', fontSize: '13px', lineHeight: '1.6' }}>
            Leads and customer details appear here automatically as soon as users interact with your **Capture Input** blocks in visual flow builds.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border-primary)' }}>
          <style>{`
            .excel-cell:hover {
              background: rgba(255,255,255,0.08) !important;
              border-color: var(--accent-primary) !important;
            }
            .excel-cell:hover .cell-copy-icon {
              opacity: 1 !important;
              color: var(--accent-primary);
            }
            .summary-cell-wrapper:hover .summary-tooltip {
              display: block !important;
            }
            @media (max-width: 768px) {
              .summary-tooltip {
                display: none !important;
              }
              .summary-cell-wrapper button {
                display: inline-block !important;
              }
            }
          `}</style>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-primary)', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <th style={{ padding: '16px 20px', borderRight: '1px solid var(--border-primary)' }}>Status</th>
                  <th style={{ padding: '16px 20px', borderRight: '1px solid var(--border-primary)' }}>Contact Name</th>
                  <th style={{ padding: '16px 20px', borderRight: '1px solid var(--border-primary)' }}>Channel</th>
                  <th style={{ padding: '16px 20px', borderRight: '1px solid var(--border-primary)' }}>AI Fed</th>
                  <th style={{ padding: '16px 20px', borderRight: '1px solid var(--border-primary)' }}>AI Intent</th>
                  <th style={{ padding: '16px 20px', borderRight: '1px solid var(--border-primary)' }}>AI Score</th>
                  <th style={{ padding: '16px 20px', borderRight: '1px solid var(--border-primary)' }}>Summary</th>
                  {dynamicKeys.map(k => (
                    <th key={k} style={{ padding: '16px 20px', textTransform: 'capitalize', borderRight: '1px solid var(--border-primary)' }}>{k.replace(/_/g, ' ')}</th>
                  ))}
                  <th style={{ padding: '16px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedContacts.map(c => {
                  const isAiEnabled = c.metadata.ai_context_enabled !== false;

                  return (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-primary)', transition: 'background 0.15s' }}>
                      {/* Lead status selection dropdown */}
                      <td style={{ padding: '10px 14px', borderRight: '1px solid var(--border-primary)' }}>
                        {(() => {
                          const currentStatus = c.metadata.lead_status || 'New';
                          const statusConfig = LEAD_STATUSES.find(s => s.value === currentStatus) || LEAD_STATUSES[0];
                          return (
                            <select
                              value={currentStatus}
                              onChange={(e) => handleUpdateStatus(c, e.target.value)}
                              style={{
                                padding: '4px 8px',
                                background: statusConfig.bg,
                                border: `1px solid ${statusConfig.border}`,
                                borderRadius: '16px',
                                color: statusConfig.color,
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                outline: 'none'
                              }}
                            >
                              {LEAD_STATUSES.map(opt => (
                                <option key={opt.value} value={opt.value} style={{ background: '#111315', color: opt.color }}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          );
                        })()}
                      </td>

                      {/* Avatar & Name */}
                      <td style={{ padding: '10px 14px', borderRight: '1px solid var(--border-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '1px solid var(--border-primary)', flexShrink: 0 }}>
                            {c.sender_avatar ? (
                              <img src={c.sender_avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <Users size={14} color="white" />
                            )}
                          </div>
                          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }}>
                            <div style={{ fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {c.sender_name || 'Anonymous User'}
                              </span>
                              {(() => {
                                const score = c.lead_score ?? (
                                  c.intent_level === 'high' || c.intent_level === 'hot' ? 8 : 
                                  c.intent_level === 'low' || c.intent_level === 'cold' ? 2 : 5
                                );
                                const isHigh = score >= 8;
                                const isLow = score <= 3;
                                return (
                                  <span style={{
                                    fontSize: '9px',
                                    background: isHigh ? 'rgba(239, 68, 68, 0.2)' : isLow ? 'rgba(59, 130, 246, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                                    color: isHigh ? '#f87171' : isLow ? '#60a5fa' : '#facc15',
                                    padding: '1px 4px',
                                    borderRadius: '3px',
                                    fontWeight: 'bold',
                                    flexShrink: 0
                                  }} title={`Lead Score: ${score}/10`}>
                                    {score}
                                  </span>
                                );
                              })()}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>ID: {c.sender_id}</div>
                          </div>
                        </div>
                      </td>

                      {/* Page */}
                      <td style={{ padding: '10px 14px', color: 'var(--text-primary)', borderRight: '1px solid var(--border-primary)', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {pages[c.page_id] || c.page_id}
                      </td>

                      {/* AI access toggle */}
                      <td style={{ padding: '10px 14px', borderRight: '1px solid var(--border-primary)' }}>
                        <button
                          onClick={() => handleToggleAiAccess(c)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: isAiEnabled ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                            border: `1px solid ${isAiEnabled ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                            borderRadius: '20px',
                            padding: '3px 8px',
                            color: isAiEnabled ? '#4ade80' : '#f87171',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                        >
                          <BrainCircuit size={10} />
                          {isAiEnabled ? 'Fed' : 'Blocked'}
                        </button>
                      </td>

                      {/* AI Intent */}
                      <td style={{ padding: '10px 14px', borderRight: '1px solid var(--border-primary)' }}>
                        <span style={{
                          background: c.intent_level === 'high' || c.intent_level === 'hot' ? 'rgba(239, 68, 68, 0.12)' : c.intent_level === 'medium' || c.intent_level === 'warm' ? 'rgba(234, 179, 8, 0.12)' : c.intent_level === 'low' || c.intent_level === 'cold' ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255,255,255,0.05)',
                          color: c.intent_level === 'high' || c.intent_level === 'hot' ? '#f87171' : c.intent_level === 'medium' || c.intent_level === 'warm' ? '#facc15' : c.intent_level === 'low' || c.intent_level === 'cold' ? '#60a5fa' : '#9ca3af',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '11px',
                          fontWeight: 600,
                          textTransform: 'uppercase'
                        }}>
                          {c.intent_level || 'UNKNOWN'}
                        </span>
                      </td>

                      {/* AI Lead Score */}
                      <td style={{ padding: '10px 14px', borderRight: '1px solid var(--border-primary)', fontWeight: 600 }}>
                        {(() => {
                          const score = c.lead_score ?? (
                            c.intent_level === 'high' || c.intent_level === 'hot' ? 8 : 
                            c.intent_level === 'low' || c.intent_level === 'cold' ? 2 : 5
                          );
                          return (
                            <span style={{
                              color: score >= 8 ? '#f87171' : score >= 4 ? '#facc15' : '#60a5fa'
                            }}>
                              {score}/10
                            </span>
                          );
                        })()}
                      </td>

                      {/* Customer Summary */}
                      <td style={{ padding: '10px 14px', borderRight: '1px solid var(--border-primary)' }}>
                        {c.summary ? (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                            <span 
                              style={{ 
                                whiteSpace: 'nowrap', 
                                overflow: 'hidden', 
                                textOverflow: 'ellipsis', 
                                maxWidth: '120px',
                                color: 'var(--text-secondary)',
                                fontSize: '12px'
                              }}
                              title={c.summary.replace(/\n/g, ' ')}
                            >
                              {c.summary.replace(/\n/g, ' ')}
                            </span>
                            <button
                              onClick={() => setSelectedContactForSummary(c)}
                              style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                borderRadius: '4px',
                                padding: '2px 6px',
                                color: '#60a5fa',
                                fontSize: '11px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.15s',
                                fontWeight: 600,
                                flexShrink: 0
                              }}
                              className="btn-info"
                            >
                              <BrainCircuit size={12} /> View
                            </button>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>—</span>
                        )}
                      </td>

                      {/* Dynamic Columns */}
                      {dynamicKeys.map(k => {
                        const val = c.metadata[k];
                        return (
                          <td key={k} style={{ padding: '10px 14px', borderRight: '1px solid var(--border-primary)' }}>
                            {(() => {
                              const textVal = val !== undefined && val !== null ? String(val) : '';
                              if (!textVal) return <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>—</span>;

                              const isLong = textVal.length > 25 || textVal.includes('\n');
                              const displayVal = isLong ? `${textVal.substring(0, 22).replace(/\n/g, ' ')}...` : textVal;

                              return (
                                <div 
                                  onClick={() => {
                                    if (isLong) {
                                      setActiveCellModal({ key: k, val: textVal });
                                    } else {
                                      copyToClipboard(textVal);
                                    }
                                  }}
                                  style={{
                                    cursor: 'pointer',
                                    padding: '4px 6px',
                                    borderRadius: '4px',
                                    background: 'rgba(255,255,255,0.01)',
                                    border: '1px solid rgba(255,255,255,0.03)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    maxWidth: '180px',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    transition: 'all 0.15s'
                                  }}
                                  className="excel-cell"
                                  title={isLong ? "Click to view full detail & copy" : "Click to copy"}
                                >
                                  <span style={{ color: '#fff', fontSize: '12px' }}>{displayVal}</span>
                                  <Copy size={10} style={{ opacity: 0.3, flexShrink: 0 }} className="cell-copy-icon" />
                                </div>
                              );
                            })()}
                          </td>
                        );
                      })}

                      {/* Action buttons */}
                      <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn-ghost btn-icon"
                            onClick={() => navigate(`/inbox?session=${c.id}`)}
                            title="Open Conversation in Inbox"
                          >
                            <MessageSquare size={14} />
                          </button>
                          <button
                            className="btn-ghost btn-icon"
                            onClick={() => handleOpenEdit(c)}
                            title="Edit captured contact details"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            className="btn-ghost btn-icon"
                            onClick={() => handleDeleteContactDetails(c)}
                            style={{ color: 'var(--error)' }}
                            title="Clear captured data"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '16px 20px',
              borderTop: '1px solid var(--border-primary)',
              background: 'rgba(255,255,255,0.01)',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                Showing <span style={{ fontWeight: 600, color: '#fff' }}>{Math.min((currentPage - 1) * pageSize + 1, filteredContacts.length)}</span> to <span style={{ fontWeight: 600, color: '#fff' }}>{Math.min(currentPage * pageSize, filteredContacts.length)}</span> of <span style={{ fontWeight: 600, color: '#fff' }}>{filteredContacts.length}</span> leads
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                {/* Jump to page */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Go to page:</span>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={pageInputVal}
                    onChange={(e) => setPageInputVal(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = parseInt(pageInputVal, 10);
                        if (!isNaN(val) && val >= 1 && val <= totalPages) {
                          setCurrentPage(val);
                        }
                      }
                    }}
                    style={{
                      width: '45px',
                      padding: '4px 6px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '4px',
                      color: '#fff',
                      fontSize: '12px',
                      textAlign: 'center',
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={() => {
                      const val = parseInt(pageInputVal, 10);
                      if (!isNaN(val) && val >= 1 && val <= totalPages) {
                        setCurrentPage(val);
                      }
                    }}
                    style={{
                      padding: '4px 8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '4px',
                      color: 'var(--text-primary)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Go
                  </button>
                </div>

                {/* Page Navigation */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => {
                      setCurrentPage(prev => Math.max(prev - 1, 1));
                      setPageInputVal(String(currentPage - 1));
                    }}
                    style={{
                      padding: '6px 12px',
                      background: currentPage === 1 ? 'rgba(255,255,255,0.02)' : 'var(--bg-secondary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '6px',
                      color: currentPage === 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                      fontSize: '12px',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Previous
                  </button>
                  
                  {/* Page Numbers */}
                  {(() => {
                    const pageButtons = [];
                    const startPage = Math.max(1, currentPage - 1);
                    const endPage = Math.min(totalPages, currentPage + 1);
                    
                    if (startPage > 1) {
                      pageButtons.push(
                        <button
                          key={1}
                          onClick={() => {
                            setCurrentPage(1);
                            setPageInputVal('1');
                          }}
                          style={{
                            padding: '6px 10px',
                            background: currentPage === 1 ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                            border: currentPage === 1 ? 'none' : '1px solid var(--border-primary)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          1
                        </button>
                      );
                      if (startPage > 2) {
                        pageButtons.push(<span key="el-start" style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>...</span>);
                      }
                    }
                    
                    for (let i = startPage; i <= endPage; i++) {
                      pageButtons.push(
                        <button
                          key={i}
                          onClick={() => {
                            setCurrentPage(i);
                            setPageInputVal(String(i));
                          }}
                          style={{
                            padding: '6px 10px',
                            background: currentPage === i ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                            border: currentPage === i ? 'none' : '1px solid var(--border-primary)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          {i}
                        </button>
                      );
                    }
                    
                    if (endPage < totalPages) {
                      if (endPage < totalPages - 1) {
                        pageButtons.push(<span key="el-end" style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>...</span>);
                      }
                      pageButtons.push(
                        <button
                          key={totalPages}
                          onClick={() => {
                            setCurrentPage(totalPages);
                            setPageInputVal(String(totalPages));
                          }}
                          style={{
                            padding: '6px 10px',
                            background: currentPage === totalPages ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                            border: currentPage === totalPages ? 'none' : '1px solid var(--border-primary)',
                            borderRadius: '6px',
                            color: '#fff',
                            fontSize: '12px',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          {totalPages}
                        </button>
                      );
                    }
                    return pageButtons;
                  })()}

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => {
                      setCurrentPage(prev => Math.min(prev + 1, totalPages));
                      setPageInputVal(String(currentPage + 1));
                    }}
                    style={{
                      padding: '6px 12px',
                      background: currentPage === totalPages ? 'rgba(255,255,255,0.02)' : 'var(--bg-secondary)',
                      border: '1px solid var(--border-primary)',
                      borderRadius: '6px',
                      color: currentPage === totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
                      fontSize: '12px',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Details Modal */}
      {editingContact && (
        <div className="modal-overlay" onClick={() => setEditingContact(null)} style={{ zIndex: 100 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>Edit Captured Details</h2>
              <button className="btn-ghost btn-icon" onClick={() => setEditingContact(null)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                Manage custom variables captured for **{editingContact.sender_name || 'Anonymous User'}**. These variables are fed to the AI assistant.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto', paddingRight: '4px' }}>
                {editMetaFields.map((field, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="key (e.g. email)"
                      value={field.key}
                      onChange={e => handleEditFieldChange(idx, e.target.value, field.val)}
                      style={{
                        flex: 1,
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontSize: '13px',
                      }}
                    />
                    <input
                      type="text"
                      placeholder="value"
                      value={field.val}
                      onChange={e => handleEditFieldChange(idx, field.key, e.target.value)}
                      style={{
                        flex: 2,
                        padding: '8px 10px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: 'var(--radius-md)',
                        color: '#fff',
                        fontSize: '13px',
                      }}
                    />
                    <button
                      className="btn-ghost btn-icon"
                      onClick={() => handleRemoveEditField(idx)}
                      style={{ color: 'var(--error)', flexShrink: 0 }}
                      title="Remove field"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}

                {editMetaFields.length === 0 && (
                  <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-primary)', borderRadius: '6px' }}>
                    No custom variables set. Click **Add Parameter** below to define one.
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                <button
                  className="btn btn-secondary"
                  onClick={handleAddEditField}
                  style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={12} /> Add Parameter
                </button>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn btn-secondary" onClick={() => setEditingContact(null)} disabled={savingEdit}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" onClick={handleSaveEdit} disabled={savingEdit} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {savingEdit && <RefreshCw size={12} className="spin" />}
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Cell Value Modal */}
      {activeCellModal && (
        <div className="modal-overlay" onClick={() => setActiveCellModal(null)} style={{ zIndex: 100 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h2>Parameter: {activeCellModal.key}</h2>
              <button className="btn-ghost btn-icon" onClick={() => setActiveCellModal(null)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                background: 'var(--bg-secondary)',
                padding: '12px',
                borderRadius: '6px',
                border: '1px solid var(--border-primary)',
                color: '#fff',
                fontSize: '13px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: '200px',
                overflowY: 'auto'
              }}>
                {activeCellModal.val}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={() => setActiveCellModal(null)}>Close</button>
                <button className="btn btn-primary" onClick={() => { copyToClipboard(activeCellModal.val); setActiveCellModal(null); }}>
                  Copy Value
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Summary Modal */}
      {mobileSummaryModalContent && (
        <div className="modal-overlay" onClick={() => setMobileSummaryModalContent(null)} style={{ zIndex: 100 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h2>Customer Summary</h2>
              <button className="btn-ghost btn-icon" onClick={() => setMobileSummaryModalContent(null)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ maxHeight: '300px', overflowY: 'auto', lineHeight: '1.5', fontSize: '13px' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                {mobileSummaryModalContent}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Premium Customer Profile Summary Modal */}
      {selectedContactForSummary && (
        <div className="modal-overlay" onClick={() => setSelectedContactForSummary(null)} style={{ zIndex: 100 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px', background: '#1e2227', border: '1px solid var(--border-primary)', borderRadius: '12px', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '20px', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                  {selectedContactForSummary.sender_avatar ? (
                    <img src={selectedContactForSummary.sender_avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Users size={20} color="white" />
                  )}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#fff' }}>
                    {selectedContactForSummary.sender_name || 'Anonymous User'}
                  </h2>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Channel ID: {selectedContactForSummary.sender_id}
                  </div>
                </div>
              </div>
              <button className="btn-ghost btn-icon" onClick={() => setSelectedContactForSummary(null)}><X size={18} /></button>
            </div>
            
            <div className="modal-body" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Intent score block */}
              {(() => {
                const score = selectedContactForSummary.lead_score ?? (
                  selectedContactForSummary.intent_level === 'high' || selectedContactForSummary.intent_level === 'hot' ? 8 : 
                  selectedContactForSummary.intent_level === 'low' || selectedContactForSummary.intent_level === 'cold' ? 2 : 5
                );
                const isHigh = score >= 8;
                const isLow = score <= 3;
                const intentLabel = selectedContactForSummary.intent_level || (score >= 8 ? 'high' : score >= 4 ? 'medium' : 'low');
                
                return (
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    background: 'rgba(255, 255, 255, 0.02)', 
                    border: '1px solid var(--border-primary)', 
                    padding: '16px', 
                    borderRadius: '8px',
                    gap: '12px'
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Intent Level</div>
                      <div style={{ 
                        fontSize: '18px', 
                        fontWeight: 'bold', 
                        color: isHigh ? '#f87171' : isLow ? '#60a5fa' : '#facc15',
                        textTransform: 'uppercase',
                        marginTop: '4px'
                      }}>
                        {intentLabel} Intent
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lead Score</div>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>
                        <span style={{ color: isHigh ? '#f87171' : isLow ? '#60a5fa' : '#facc15' }}>{score}</span>
                        <span style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 500 }}>/10</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Short Description */}
              {selectedContactForSummary.profile_metadata?.short_description && (
                <div style={{ fontStyle: 'italic', color: '#fff', fontWeight: '500', fontSize: '14px', borderLeft: '3px solid var(--accent-primary)', paddingLeft: '10px' }}>
                  "{selectedContactForSummary.profile_metadata.short_description}"
                </div>
              )}

              {/* Main Markdown Summary */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                  Detailed AI Summary
                </h3>
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.01)', 
                  border: '1px solid var(--border-primary)', 
                  padding: '16px', 
                  borderRadius: '8px', 
                  color: '#e2e8f0', 
                  lineHeight: '1.6', 
                  fontSize: '13px' 
                }}>
                  {renderMarkdown(selectedContactForSummary.summary || null)}
                </div>
              </div>

              {/* Inquiries */}
              {selectedContactForSummary.profile_metadata?.key_inquiries && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Key Inquiries</h4>
                  <div style={{ color: '#fff', fontSize: '13px', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                    {selectedContactForSummary.profile_metadata.key_inquiries}
                  </div>
                </div>
              )}

              {/* Captured Parameters */}
              {(() => {
                const metadata = selectedContactForSummary.metadata ?? {};
                const otherMeta = Object.entries(metadata)
                  .filter(([k]) => k !== 'ai_context_enabled' && k !== 'lead_status');

                if (otherMeta.length === 0) return null;

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
                      Captured Flow Variables
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {otherMeta.map(([key, val]) => (
                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: '1px solid var(--border-primary)' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                          <span style={{ color: '#fff', fontSize: '12px', fontWeight: 500 }}>{String(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
            
            <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'rgba(255,255,255,0.01)' }}>
              <button className="btn btn-secondary" onClick={() => setSelectedContactForSummary(null)}>
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
