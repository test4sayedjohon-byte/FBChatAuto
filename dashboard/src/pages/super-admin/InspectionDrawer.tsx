import { useState, useEffect, type FormEvent } from 'react';
import {
  Users,
  Globe,
  FileText,
  BookOpen,
  X,
  Plus,
  Pencil,
  RefreshCw,
  Trash2,
  BarChart3,
  Percent
} from 'lucide-react';
import type { SuperAdminUser, InspectData, PageFormState, FieldFormState, DocFormState } from './types';
import { getPresetChatModels } from '../../lib/models';

interface InspectionDrawerProps {
  inspectingUser: SuperAdminUser;
  inspectData: InspectData;
  loadingInspect: boolean;
  activeTab: 'pages' | 'documents' | 'fields' | 'limits';
  onSetActiveTab: (tab: 'pages' | 'documents' | 'fields' | 'limits') => void;
  onClose: () => void;

  // Usage / Limits
  usageFilter: 'this_month' | 'last_month' | 'this_year' | 'all_time';
  onSetUsageFilter: (filter: 'this_month' | 'last_month' | 'this_year' | 'all_time') => void;
  loadingUsage: boolean;
  monthlyLimitInput: number;
  onSetMonthlyLimitInput: (val: number) => void;
  strictEnforcementInput: boolean;
  onSetStrictEnforcementInput: (val: boolean) => void;
  monthlyMessageLimitInput: number;
  onSetMonthlyMessageLimitInput: (val: number) => void;
  allowedChannelsInput: number;
  onSetAllowedChannelsInput: (val: number) => void;
  savingQuota: boolean;
  onSaveQuota: (e: FormEvent) => void;

  // Pages
  allProviders: any[];
  showPageForm: boolean;
  editingPage: any | null;
  pageFormState: PageFormState;
  onSetPageFormState: (state: PageFormState) => void;
  onSetShowPageForm: (show: boolean) => void;
  onOpenAddPage: () => void;
  onOpenEditPage: (p: any) => void;
  onTogglePage: (pageConnId: string, currentActive: boolean) => void;
  onDisconnectPage: (pageConnId: string) => void;
  onPageSubmit: (e: FormEvent) => void;

  // Fields
  showFieldForm: boolean;
  editingField: any | null;
  fieldFormState: FieldFormState;
  onSetFieldFormState: (state: FieldFormState) => void;
  onSetShowFieldForm: (show: boolean) => void;
  onOpenAddField: () => void;
  onOpenEditField: (f: any) => void;
  onDeleteField: (fieldId: string) => void;
  onFieldSubmit: (e: FormEvent) => void;

  // Documents
  showDocForm: boolean;
  editingDoc: any | null;
  docFormState: DocFormState;
  onSetDocFormState: (state: DocFormState) => void;
  onSetShowDocForm: (show: boolean) => void;
  onOpenAddDoc: () => void;
  onOpenEditDoc: (d: any) => void;
  onDeleteDoc: (docId: string) => void;
  onDocSubmit: (e: FormEvent) => void;
  processingDocId: string | null;
  onTriggerDocProcessing: (docId: string) => void;
  onToggleDocPageSelection: (pageId: string) => void;

  savingSubForm: boolean;
}

export default function InspectionDrawer({
  inspectingUser,
  inspectData,
  loadingInspect,
  activeTab,
  onSetActiveTab,
  onClose,
  usageFilter,
  onSetUsageFilter,
  loadingUsage,
  monthlyLimitInput,
  onSetMonthlyLimitInput,
  strictEnforcementInput,
  onSetStrictEnforcementInput,
  monthlyMessageLimitInput,
  onSetMonthlyMessageLimitInput,
  allowedChannelsInput,
  onSetAllowedChannelsInput,
  savingQuota,
  onSaveQuota,
  allProviders,
  showPageForm,
  editingPage,
  pageFormState,
  onSetPageFormState,
  onSetShowPageForm,
  onOpenAddPage,
  onOpenEditPage,
  onTogglePage,
  onDisconnectPage,
  onPageSubmit,
  showFieldForm,
  editingField,
  fieldFormState,
  onSetFieldFormState,
  onSetShowFieldForm,
  onOpenAddField,
  onOpenEditField,
  onDeleteField,
  onFieldSubmit,
  showDocForm,
  editingDoc,
  docFormState,
  onSetDocFormState,
  onSetShowDocForm,
  onOpenAddDoc,
  onOpenEditDoc,
  onDeleteDoc,
  onDocSubmit,
  processingDocId,
  onTriggerDocProcessing,
  onToggleDocPageSelection,
  savingSubForm,
}: InspectionDrawerProps) {
  const [customModelEnabled, setCustomModelEnabled] = useState(false);

  useEffect(() => {
    if (showPageForm && pageFormState.ai_model) {
      const selectedProv = allProviders.find((p: any) => p.id === pageFormState.ai_provider_id) || allProviders.find((p: any) => p.is_global && p.is_active_chat) || allProviders.find((p: any) => p.is_global);
      const providerName = selectedProv?.provider_name || 'custom';
      const presets = getPresetChatModels(providerName);
      const inPresets = presets.some(m => m.id === pageFormState.ai_model);
      setCustomModelEnabled(!inPresets);
    } else {
      setCustomModelEnabled(false);
    }
  }, [showPageForm, pageFormState.ai_provider_id, pageFormState.ai_model, allProviders]);

  const tabStyle = (tab: string) => ({
    flex: '1 0 auto',
    minWidth: 'max-content',
    padding: '14px 20px',
    background: 'none',
    border: 'none',
    color: activeTab === tab ? 'var(--accent-primary)' : 'var(--text-secondary)',
    borderBottom: activeTab === tab ? '2px solid var(--accent-primary)' : 'none',
    fontWeight: activeTab === tab ? '600' as const : '400' as const,
    cursor: 'pointer' as const,
    display: 'flex' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: '6px',
  });

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .bot-config-grid {
            grid-template-columns: 1fr !important;
          }
          .analytics-breakdown-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .config-form-flex {
            flex-direction: column !important;
          }
          .config-form-flex > div {
            flex: 1 1 100% !important;
          }
        }
      `}</style>
      {/* Inspect User Drawer Overlay */}
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
            <button className="btn-ghost btn-icon" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div style={{ display: 'flex', overflowX: 'auto', borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-tertiary)', WebkitOverflowScrolling: 'touch' }}>
            <button onClick={() => onSetActiveTab('pages')} style={tabStyle('pages')}>
              <Globe size={15} /> Pages & Bots ({inspectData.pages.length})
            </button>
            <button onClick={() => onSetActiveTab('documents')} style={tabStyle('documents')}>
              <FileText size={15} /> RAG Docs ({inspectData.documents.length})
            </button>
            <button onClick={() => onSetActiveTab('fields')} style={tabStyle('fields')}>
              <BookOpen size={15} /> Knowledge Base ({inspectData.fields.length})
            </button>
            <button onClick={() => onSetActiveTab('limits')} style={tabStyle('limits')}>
              <BarChart3 size={15} /> AI Usage & Limits
            </button>
          </div>

          {/* Resource Actions Header */}
          <div style={{ padding: '16px 24px', background: 'rgba(255, 255, 255, 0.01)', borderBottom: '1px solid var(--border-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
              User Resource Control Center
            </span>
            {activeTab === 'pages' && (
              <button className="btn btn-primary btn-sm" onClick={onOpenAddPage}>
                <Plus size={14} /> Link FB Page
              </button>
            )}
            {activeTab === 'fields' && (
              <button className="btn btn-primary btn-sm" onClick={onOpenAddField}>
                <Plus size={14} /> Add Knowledge Fact
              </button>
            )}
            {activeTab === 'documents' && (
              <button className="btn btn-primary btn-sm" onClick={onOpenAddDoc}>
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
                        <p>Link a Facebook Page for this user to enable message automation.</p>
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
                                onClick={() => onOpenEditPage(p)}
                                title="Edit Page Bot Config"
                              >
                                <Pencil size={13} /> Edit Config
                              </button>
                              <button 
                                className="btn btn-secondary btn-sm" 
                                onClick={() => onTogglePage(p.id, p.is_active)}
                              >
                                {p.is_active ? 'Pause' : 'Resume'}
                              </button>
                              <button 
                                className="btn btn-danger btn-sm btn-icon" 
                                onClick={() => onDisconnectPage(p.id)}
                                title="Disconnect Page"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Bot Config Box */}
                          <div className="bot-config-grid" style={{ background: 'rgba(0,0,0,0.2)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-light)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.85rem' }}>
                            <div>
                              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Bot Name</span>
                              <span style={{ fontWeight: '500' }}>{p.bot_name || 'None'}</span>
                            </div>
                            <div>
                              <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.75rem' }}>Provider & Model</span>
                              <span style={{ fontWeight: '500' }}>
                                {allProviders.find((prov: any) => prov.id === p.ai_provider_id)?.display_name || 'Default Account / Active Provider'} ({p.ai_model || 'None'}) (t={p.temperature ?? 0.5})
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
                        <p>Upload text files/knowledge sheets to enrich this user's AI response vectors.</p>
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
                                onClick={() => onOpenEditDoc(d)}
                                title="Edit Title/Content"
                              >
                                <Pencil size={13} />
                              </button>
                              <button 
                                className="btn btn-secondary btn-sm"
                                onClick={() => onTriggerDocProcessing(d.id)}
                                disabled={processingDocId === d.id}
                                title="Re-run chunks and embeddings extraction"
                                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <RefreshCw size={13} className={processingDocId === d.id ? 'animate-spin' : ''} />
                                {processingDocId === d.id ? 'Embedding...' : 'Re-Embed'}
                              </button>
                              <button 
                                className="btn-ghost btn-icon text-danger" 
                                onClick={() => onDeleteDoc(d.id)}
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
                              <button className="btn-ghost btn-icon" onClick={() => onOpenEditField(f)} title="Edit Field">
                                <Pencil size={14} style={{ color: 'var(--text-secondary)' }} />
                              </button>
                              <button className="btn-ghost btn-icon text-danger" onClick={() => onDeleteField(f.id)} title="Delete Field" style={{ color: '#ef4444' }}>
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
                      <form onSubmit={onSaveQuota} style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
                        <div className="config-form-flex" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '16px' }}>
                          <div className="form-group" style={{ flex: '1 1 200px' }}>
                            <label className="form-label" style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Token Limit</label>
                            <input 
                              className="form-input" 
                              type="number" 
                              min={0} 
                              value={monthlyLimitInput} 
                              onChange={e => onSetMonthlyLimitInput(Number(e.target.value))} 
                              required 
                            />
                            <p className="form-hint" style={{ fontSize: '11px' }}>Define maximum prompt + completion tokens allowed per month.</p>
                          </div>

                          <div className="form-group" style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '12px' }}>
                              <input 
                                type="checkbox" 
                                checked={strictEnforcementInput} 
                                onChange={e => onSetStrictEnforcementInput(e.target.checked)}
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
                              onChange={e => onSetMonthlyMessageLimitInput(Number(e.target.value))} 
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
                              onChange={e => onSetAllowedChannelsInput(Number(e.target.value))} 
                              required 
                            />
                            <p className="form-hint" style={{ fontSize: '11px' }}>Number of channels the user can connect. Set 0 to disable all.</p>
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
                            onChange={e => onSetUsageFilter(e.target.value as any)}
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

                      <div className="analytics-breakdown-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        
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
            <button className="btn btn-secondary" onClick={onClose}>
              Close Panel
            </button>
          </div>
        </div>
      </div>

      {/* --- ADD/EDIT PAGE MODAL DIALOG --- */}
      {showPageForm && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>{editingPage ? 'Edit Page Connection & Bot Config' : 'Link Facebook Page Connection'}</h2>
              <button className="btn-ghost btn-icon" onClick={() => onSetShowPageForm(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={onPageSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div className="form-group">
                  <label className="form-label">Facebook Page ID</label>
                  <input 
                    className="form-input"
                    value={pageFormState.page_id}
                    onChange={e => onSetPageFormState({ ...pageFormState, page_id: e.target.value })}
                    required
                    placeholder="e.g. 10294829038290"
                    disabled={!!editingPage}
                  />
                  <span className="form-hint">The numerical string ID of the Facebook page.</span>
                </div>

                <div className="form-group">
                  <label className="form-label">Page Name</label>
                  <input 
                    className="form-input"
                    value={pageFormState.page_name}
                    onChange={e => onSetPageFormState({ ...pageFormState, page_name: e.target.value })}
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
                    onChange={e => onSetPageFormState({ ...pageFormState, access_token: e.target.value })}
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
                    onChange={e => onSetPageFormState({ ...pageFormState, bot_name: e.target.value })}
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
                      const selectedProv = allProviders.find((p: any) => p.id === providerId);
                      const defaultProv = allProviders.find((p: any) => p.is_global && p.is_active_chat) || allProviders.find((p: any) => p.is_global);
                      onSetPageFormState({ 
                        ...pageFormState, 
                        ai_provider_id: providerId,
                        ai_model: selectedProv ? (selectedProv.model_chat || '') : (defaultProv?.model_chat || '')
                      });
                    }}
                  >
                    <option value="">Default Account / Active Provider</option>
                    {allProviders.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.display_name} ({p.provider_name} - {p.model_chat || 'no chat model'})
                      </option>
                    ))}
                  </select>
                  <span className="form-hint">Choose which specific AI Provider configuration handles this page's messages.</span>
                </div>

                {(() => {
                  const selectedProv = allProviders.find((p: any) => p.id === pageFormState.ai_provider_id) || allProviders.find((p: any) => p.is_global && p.is_active_chat) || allProviders.find((p: any) => p.is_global);
                  const providerName = selectedProv?.provider_name || 'custom';
                  const presets = getPresetChatModels(providerName);
                  const freePresets = presets.filter(m => m.isFree);

                  return (
                    <div className="form-group">
                      <label className="form-label">AI Model Override</label>
                      {presets.length > 0 ? (
                        <>
                          <select 
                            className="form-select" 
                            value={customModelEnabled ? 'custom' : pageFormState.ai_model} 
                            onChange={e => {
                              if (e.target.value === 'custom') {
                                setCustomModelEnabled(true);
                                onSetPageFormState({ ...pageFormState, ai_model: '' });
                              } else {
                                setCustomModelEnabled(false);
                                onSetPageFormState({ ...pageFormState, ai_model: e.target.value });
                              }
                            }}
                          >
                            {freePresets.length > 0 && (
                              <optgroup label="Free Models (Quick Access)">
                                {freePresets.map(m => (
                                  <option key={`free-override-${m.id}`} value={m.id}>
                                    🎁 [FREE] {m.name} ({m.context}{m.capabilities ? ` - ${m.capabilities}` : ''})
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            <optgroup label="All Models">
                              {presets.map(m => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.context}{m.capabilities ? ` - ${m.capabilities}` : ''}){m.isFree ? ' [FREE]' : ''}
                                </option>
                              ))}
                            </optgroup>
                            <option value="custom">Custom (Type model name manually)...</option>
                          </select>
                          {customModelEnabled && (
                            <input 
                              className="form-input" 
                              style={{ marginTop: '8px' }}
                              placeholder="Enter custom model ID" 
                              value={pageFormState.ai_model} 
                              onChange={e => onSetPageFormState({ ...pageFormState, ai_model: e.target.value })} 
                            />
                          )}
                        </>
                      ) : (
                        <input 
                          className="form-input" 
                          placeholder="e.g. gemini-1.5-flash" 
                          value={pageFormState.ai_model} 
                          onChange={e => onSetPageFormState({ ...pageFormState, ai_model: e.target.value })} 
                        />
                      )}
                      <span className="form-hint">Model identifier used for chat completions (defaults to the provider's default model).</span>
                    </div>
                  );
                })()}

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
                    onChange={e => onSetPageFormState({ ...pageFormState, temperature: parseFloat(e.target.value) })}
                    style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Custom System Prompt (Markdown instructions)</label>
                  <textarea 
                    className="form-textarea"
                    value={pageFormState.custom_system_prompt}
                    onChange={e => onSetPageFormState({ ...pageFormState, custom_system_prompt: e.target.value })}
                    rows={6}
                    placeholder="Describe the bot's behavior, instructions, context guidelines..."
                  />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox"
                    checked={pageFormState.is_active}
                    onChange={e => onSetPageFormState({ ...pageFormState, is_active: e.target.checked })}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  Enable Bot Automation
                </label>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => onSetShowPageForm(false)}>
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
      {showFieldForm && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal">
            <div className="modal-header">
              <h2>{editingField ? 'Edit Knowledge Fact' : 'Add Knowledge Fact'}</h2>
              <button className="btn-ghost btn-icon" onClick={() => onSetShowFieldForm(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={onFieldSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div className="form-group">
                  <label className="form-label">Fact/Field Name (e.g. Return Policy)</label>
                  <input 
                    className="form-input"
                    value={fieldFormState.field_name}
                    onChange={e => onSetFieldFormState({ ...fieldFormState, field_name: e.target.value })}
                    required
                    placeholder="e.g. Refund Policy"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Fact Details/Value</label>
                  <textarea 
                    className="form-textarea"
                    value={fieldFormState.field_value}
                    onChange={e => onSetFieldFormState({ ...fieldFormState, field_value: e.target.value })}
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
                    onChange={e => onSetFieldFormState({ ...fieldFormState, category: e.target.value })}
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
                    onChange={e => onSetFieldFormState({ ...fieldFormState, page_id: e.target.value })}
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
                    onChange={e => onSetFieldFormState({ ...fieldFormState, is_active: e.target.checked })}
                    style={{ accentColor: 'var(--accent-primary)' }}
                  />
                  Active & Injected in Prompt
                </label>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => onSetShowFieldForm(false)}>
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
      {showDocForm && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal" style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h2>{editingDoc ? 'Edit Document & RAG Content' : 'Upload Document for RAG'}</h2>
              <button className="btn-ghost btn-icon" onClick={() => onSetShowDocForm(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={onDocSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                <div className="form-group">
                  <label className="form-label">Document Title</label>
                  <input 
                    className="form-input"
                    value={docFormState.title}
                    onChange={e => onSetDocFormState({ ...docFormState, title: e.target.value })}
                    required
                    placeholder="e.g. Complete Product Catalog 2026"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Full Text Content</label>
                  <textarea 
                    className="form-textarea"
                    value={docFormState.original_content}
                    onChange={e => onSetDocFormState({ ...docFormState, original_content: e.target.value })}
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
                              onChange={() => onToggleDocPageSelection(p.page_id)}
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
                <button type="button" className="btn btn-secondary" onClick={() => onSetShowDocForm(false)}>
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
    </>
  );
}
