import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Globe, 
  MessageSquare, 
  ArrowUpRight
} from 'lucide-react';
import PricingModal from '../components/PricingModal';

interface PurchaseRecord {
  id: string;
  channels_count: number;
  message_addon: string;
  currency: string;
  total_amount: number;
  payment_method: string;
  manual_payment_details: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

export default function StorePage() {
  const { user, profile } = useAuth();
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [connectedChannelsCount, setConnectedChannelsCount] = useState(0);

  // Fetch purchases and connected channels
  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Load user purchase history
      const { data: purchaseData, error: purchaseErr } = await supabase
        .from('purchases')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (purchaseErr) throw purchaseErr;
      setPurchases(purchaseData || []);

      // Load active connected channels (page connections)
      const { count, error: countErr } = await supabase
        .from('page_connections')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (!countErr && count !== null) {
        setConnectedChannelsCount(count);
      }
    } catch (err) {
      console.error('Failed to load store data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const allowedChannels = profile?.allowed_channels || 0;
  const messageLimit = profile?.monthly_message_limit ?? 0;

  return (
    <div className="page-container animate-fadeIn" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Billing & Store</h1>
          <p>Upgrade your platform capacities, add channels, and view your purchase history.</p>
        </div>
        <button 
          className="btn btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          onClick={() => setShowPricingModal(true)}
        >
          <ShoppingBag size={18} /> Upgrade Customizer
        </button>
      </header>

      {/* Current Quotas Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        marginBottom: '32px'
      }}>
        {/* Allowed Channels */}
        <div className="card" style={{ display: 'flex', gap: '16px', padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(249, 115, 22, 0.1)',
            color: 'var(--accent-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Globe size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Meta Channels Quota</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0', color: 'var(--text-primary)' }}>
              {connectedChannelsCount} / {allowedChannels}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Connected channels out of total allowed capacity.
            </div>
          </div>
        </div>

        {/* Message Limits */}
        <div className="card" style={{ display: 'flex', gap: '16px', padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'rgba(59, 130, 246, 0.1)',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <MessageSquare size={24} />
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Message Limit</div>
            <div style={{ fontSize: '1.8rem', fontWeight: '800', margin: '4px 0', color: 'var(--text-primary)' }}>
              {messageLimit === -1 ? 'Unlimited' : messageLimit.toLocaleString()}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Total monthly AI automation message budget.
            </div>
          </div>
        </div>
      </div>

      {/* Upgrade Callout Card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12) 0%, rgba(249, 115, 22, 0.03) 100%)',
        border: '1px solid rgba(249, 115, 22, 0.25)',
        padding: '32px',
        borderRadius: '16px',
        marginBottom: '40px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '24px'
      }}>
        <div style={{ maxWidth: '600px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-primary)' }}>Need more limits or channels?</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.5' }}>
            Customize your additional add-on packages dynamically. You can buy individual channels (3000 ৳ / $30 each including 300 free monthly messages) or purchase messages-only bundles if you already have enough channels.
          </p>
        </div>
        <button 
          className="btn btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '0.95rem' }}
          onClick={() => setShowPricingModal(true)}
        >
          Customize Upgrades <ArrowUpRight size={16} />
        </button>
      </div>

      {/* Purchase History */}
      <div>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '16px', color: 'var(--text-primary)' }}>Order & Purchase History</h3>

        {loading ? (
          <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading history...</div>
        ) : purchases.length === 0 ? (
          <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}>
            No purchase records found.
          </div>
        ) : (
          <div className="table-responsive" style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-primary)', overflow: 'hidden' }}>
            <table className="table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Channels Ordered</th>
                  <th>Message Limit Addon</th>
                  <th>Total Cost</th>
                  <th>Payment Type</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ fontWeight: 'bold' }}>
                      {p.channels_count > 0 ? `+${p.channels_count}` : '0'}
                    </td>
                    <td>
                      <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>
                        {p.message_addon}
                      </span>
                    </td>
                    <td style={{ fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                      {p.currency === 'BDT' ? '৳ ' : '$'}{p.total_amount}
                    </td>
                    <td style={{ fontSize: '0.8rem', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                      {p.payment_method.replace('_', ' ')}
                    </td>
                    <td>
                      <span className={`badge ${
                        p.status === 'approved' ? 'badge-success' :
                        p.status === 'rejected' ? 'badge-error' :
                        'badge-warning'
                      }`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}>
                        {p.status === 'approved' && <CheckCircle2 size={12} />}
                        {p.status === 'rejected' && <XCircle size={12} />}
                        {p.status === 'pending' && <Clock size={12} />}
                        {p.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.admin_notes || ''}>
                      {p.admin_notes || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showPricingModal && (
        <PricingModal 
          onClose={() => {
            setShowPricingModal(false);
            loadData(); // Reload stats/history if they submitted an order
          }} 
          initialChannels={0}
        />
      )}
    </div>
  );
}
