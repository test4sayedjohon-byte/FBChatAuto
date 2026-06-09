import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Clock, Search, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';

export default function SuperAdminPurchasesPage() {
  const { profile } = useAuth();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Custom Modal States
  const [showModal, setShowModal] = useState(false);
  const [targetId, setTargetId] = useState<string>('');
  const [targetStatus, setTargetStatus] = useState<'approved' | 'rejected'>('approved');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Filter Tab State
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'history'>('all');

  useEffect(() => {
    if (profile?.is_super_admin) {
      loadPurchases();
    }
  }, [profile]);

  async function loadPurchases() {
    setLoading(true);
    const { data, error } = await supabase
      .from('purchases')
      .select('*, users(email, display_name)')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error loading purchases:', error);
    } else if (data) {
      setPurchases(data);
    }
    setLoading(false);
  }

  async function initiateStatusUpdate(id: string, status: 'approved' | 'rejected') {
    setTargetId(id);
    setTargetStatus(status);
    setAdminNotes('');
    setShowModal(true);
  }

  async function handleStatusUpdateSubmit() {
    setSubmitting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
      const endpoint = `${apiUrl}/api/super-admin/purchases/${targetId}/${targetStatus}`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ adminNotes })
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to update purchase');
      }

      toast.success(`Purchase successfully ${targetStatus}`);
      setShowModal(false);
      loadPurchases();
    } catch (err: any) {
      toast.error('Error updating purchase: ' + err.message);
    }
    
    setSubmitting(false);
  }

  if (!profile?.is_super_admin) {
    return <div className="card" style={{padding:'48px',textAlign:'center'}}>Access Denied. Super Admins only.</div>;
  }

  const filteredPurchases = purchases.filter(p => 
    p.users?.email?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.id.includes(searchTerm) ||
    (p.manual_payment_details && p.manual_payment_details.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="animate-slideUp">
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <h1>Purchases & Subscriptions</h1>
          <p>Review manual payments and manage user subscription packages.</p>
        </div>
      </div>

      <div className="card" style={{marginBottom:'24px', padding:'16px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between'}}>
        <div style={{position:'relative', width:'100%', maxWidth:'400px'}}>
          <Search size={16} style={{position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', color:'var(--text-secondary)'}} />
          <input 
            className="form-input" 
            placeholder="Search by email, ID, or payment details..." 
            style={{paddingLeft:'36px'}}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{display: 'flex', gap: '8px', background: 'var(--bg-primary)', padding: '4px', borderRadius: '8px', border: '1px solid var(--border-light)'}}>
          <button 
            className="btn btn-sm" 
            style={{
              background: filterTab === 'all' ? 'var(--accent-primary)' : 'transparent',
              color: filterTab === 'all' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '6px',
              fontWeight: '600'
            }}
            onClick={() => setFilterTab('all')}
          >
            All
          </button>
          <button 
            className="btn btn-sm" 
            style={{
              background: filterTab === 'pending' ? 'var(--accent-primary)' : 'transparent',
              color: filterTab === 'pending' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '6px',
              fontWeight: '600'
            }}
            onClick={() => setFilterTab('pending')}
          >
            Pending
          </button>
          <button 
            className="btn btn-sm" 
            style={{
              background: filterTab === 'history' ? 'var(--accent-primary)' : 'transparent',
              color: filterTab === 'history' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              padding: '6px 16px',
              borderRadius: '6px',
              fontWeight: '600'
            }}
            onClick={() => setFilterTab('history')}
          >
            History
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{padding:'48px',textAlign:'center',color:'var(--text-secondary)'}}>Loading purchases...</div>
      ) : (
        <div>
          {/* Pending Section */}
          {(filterTab === 'all' || filterTab === 'pending') && (
            <div style={{ marginBottom: '40px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>Pending Requests</h3>
                <span style={{ background: 'var(--error)', color: 'white', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                  {filteredPurchases.filter(p => p.status === 'pending').length}
                </span>
              </div>

              {filteredPurchases.filter(p => p.status === 'pending').length === 0 ? (
                <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
                  No pending purchase requests.
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '20px'
                }}>
                  {filteredPurchases.filter(p => p.status === 'pending').map(p => (
                    <div 
                      key={p.id} 
                      className="card" 
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '20px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: '12px',
                        minHeight: '280px',
                        boxShadow: 'var(--shadow-sm)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '4px 8px' }}>
                          <Clock size={12} /> PENDING
                        </span>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                          <div style={{ fontWeight: '600' }}>{new Date(p.created_at).toLocaleDateString()}</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>ID: {p.id.substring(0, 8)}</div>
                        </div>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>{p.users?.display_name || 'Unknown'}</h4>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', wordBreak: 'break-all', marginTop: '2px' }}>{p.users?.email}</div>
                      </div>

                      <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Package Requested:</div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                          {p.channels_count} Channel{p.channels_count !== 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: '2px', fontWeight: '500' }}>
                          +{p.message_addon} messages
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Payment Method:</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'capitalize', marginTop: '2px' }}>
                            {p.payment_method.replace('_', ' ')}
                          </div>
                          {p.manual_payment_details && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.manual_payment_details}>
                              Ref: {p.manual_payment_details}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Paid:</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--accent-primary)', marginTop: '2px' }}>
                            {p.currency === 'BTT' ? 'BTT ' : '$'}{p.total_amount}
                          </div>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: 'auto' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn btn-sm" 
                            style={{ flex: 1, background: 'var(--success)', color: '#fff', border: 'none', padding: '8px 0', fontSize: '0.8rem', fontWeight: '600' }} 
                            onClick={() => initiateStatusUpdate(p.id, 'approved')}
                          >
                            Approve
                          </button>
                          <button 
                            className="btn btn-sm btn-danger" 
                            style={{ flex: 1, padding: '8px 0', fontSize: '0.8rem', fontWeight: '600' }} 
                            onClick={() => initiateStatusUpdate(p.id, 'rejected')}
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* History Section */}
          {(filterTab === 'all' || filterTab === 'history') && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-light)', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>History</h3>
                <span style={{ background: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 'bold' }}>
                  {filteredPurchases.filter(p => p.status !== 'pending').length}
                </span>
              </div>

              {filteredPurchases.filter(p => p.status !== 'pending').length === 0 ? (
                <div className="card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
                  No transaction history found.
                </div>
              ) : (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                  gap: '20px',
                  paddingBottom: '40px'
                }}>
                  {filteredPurchases.filter(p => p.status !== 'pending').map(p => (
                    <div 
                      key={p.id} 
                      className="card" 
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        padding: '20px',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-primary)',
                        borderRadius: '12px',
                        minHeight: '280px',
                        boxShadow: 'var(--shadow-sm)',
                        opacity: 0.85
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                        <span className={`badge ${p.status === 'approved' ? 'badge-success' : 'badge-error'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '4px 8px' }}>
                          {p.status === 'approved' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                          {p.status.toUpperCase()}
                        </span>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                          <div style={{ fontWeight: '600' }}>{new Date(p.created_at).toLocaleDateString()}</div>
                          <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>ID: {p.id.substring(0, 8)}</div>
                        </div>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)' }}>{p.users?.display_name || 'Unknown'}</h4>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', wordBreak: 'break-all', marginTop: '2px' }}>{p.users?.email}</div>
                      </div>

                      <div style={{ background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Package Requested:</div>
                        <div style={{ fontWeight: 'bold', fontSize: '0.85rem' }}>
                          {p.channels_count} Channel{p.channels_count !== 1 ? 's' : ''}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', marginTop: '2px', fontWeight: '500' }}>
                          +{p.message_addon} messages
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Payment Method:</div>
                          <div style={{ fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'capitalize', marginTop: '2px' }}>
                            {p.payment_method.replace('_', ' ')}
                          </div>
                          {p.manual_payment_details && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={p.manual_payment_details}>
                              Ref: {p.manual_payment_details}
                            </div>
                          )}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Paid:</div>
                          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--accent-primary)', marginTop: '2px' }}>
                            {p.currency === 'BTT' ? 'BTT ' : '$'}{p.total_amount}
                          </div>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border-light)', paddingTop: '16px', marginTop: 'auto' }}>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          <div style={{ fontWeight: '600', fontSize: '0.75rem', textTransform: 'uppercase', opacity: 0.6, marginBottom: '4px' }}>Admin Notes:</div>
                          <div style={{ fontStyle: 'italic', background: 'var(--bg-primary)', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                            {p.admin_notes || 'No admin notes recorded.'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Custom Approval Modal */}
      {showModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
          onClick={() => setShowModal(false)}
        >
          <div 
            className="card animate-scaleUp" 
            style={{
              maxWidth: '500px', 
              width: '100%', 
              background: 'var(--bg-primary)', 
              border: '1px solid var(--border-primary)',
              borderRadius: '16px',
              padding: '24px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', textTransform: 'capitalize' }}>
                {targetStatus === 'approved' ? 'Approve Purchase Request' : 'Reject Purchase Request'}
              </h3>
              <button 
                className="btn-ghost btn-icon" 
                onClick={() => setShowModal(false)}
                style={{ padding: '4px', borderRadius: '50%' }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              {targetStatus === 'approved' 
                ? 'Confirming this approval will immediately provision the requested channels and messages to the user.' 
                : 'Rejecting this purchase will decline the manual upgrade request.'}
            </p>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" htmlFor="adminNotes">Admin Notes (Optional)</label>
              <textarea
                id="adminNotes"
                className="form-input"
                placeholder="Add notes for the user (e.g. 'Payment verified on bKash', 'Incorrect transaction ID')"
                rows={3}
                style={{ resize: 'none', background: 'var(--bg-secondary)', border: '1px solid var(--border-light)', padding: '12px' }}
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setShowModal(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button 
                className={`btn ${targetStatus === 'approved' ? 'btn-primary' : 'btn-danger'}`}
                onClick={handleStatusUpdateSubmit}
                disabled={submitting}
                style={{ 
                  background: targetStatus === 'approved' ? 'var(--success)' : 'var(--error)', 
                  border: 'none',
                  color: '#fff'
                }}
              >
                {submitting ? 'Processing...' : targetStatus === 'approved' ? 'Approve Request' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
