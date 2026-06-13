import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { 
  ShoppingBag, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Globe, 
  ArrowUpRight,
  Plus,
  Gift,
  Zap
} from 'lucide-react';
import PricingModal from '../components/PricingModal';
import { calculateBillingCycle } from '../lib/billing';

const FacebookIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const InstagramIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const WhatsAppIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.731-1.456L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.394 9.806-9.799.002-2.596-1.004-5.038-2.836-6.872a9.69 9.69 0 0 0-6.868-2.846c-5.41 0-9.81 4.403-9.813 9.81-.001 1.547.411 3.056 1.196 4.39l-.993 3.626 3.72-.976c1.328.724 2.775 1.106 4.293 1.106zm10.998-7.51c-.29-.145-1.716-.847-1.978-.942-.262-.096-.453-.145-.644.145-.191.29-.74.942-.907 1.133-.166.19-.333.215-.624.07-2.904-1.447-4.78-2.187-5.76-3.864-.262-.449.262-.417.75-1.393.083-.166.042-.31-.02-.455-.062-.145-.453-1.09-.62-1.492-.162-.392-.326-.339-.453-.346-.118-.006-.253-.008-.389-.008-.136 0-.356.05-.542.253-.187.203-.712.696-.712 1.699 0 1.003.729 1.973.83 2.112.102.139 1.434 2.19 3.476 3.07.485.209.864.334 1.157.427.488.156.933.134 1.285.08.393-.06 1.716-.7 1.958-1.378.243-.678.243-1.258.17-1.378-.073-.12-.262-.192-.553-.337z"/>
  </svg>
);

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
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [pageConnections, setPageConnections] = useState<any[]>([]);
  const [billingCycle, setBillingCycle] = useState<any>(null);

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
      const pHistory = purchaseData || [];
      setPurchases(pHistory);

      // Load active connected channels
      const { data: channelsData, error: channelsErr } = await supabase
        .from('page_connections')
        .select('*')
        .eq('user_id', user.id);

      if (!channelsErr && channelsData) {
        setPageConnections(channelsData);
      }

      // Calculate billing cycle
      const cycle = calculateBillingCycle(user.created_at, pHistory);
      setBillingCycle(cycle);

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
  const monthlyCreditsLimit = profile?.monthly_credits_limit ?? 1000;
  const extraCreditsBalance = profile?.extra_credits_balance ?? 0;
  const creditsUsedThisMonth = profile?.credits_used_this_month ?? 0;
  const totalAllowedCredits = monthlyCreditsLimit === -1 ? -1 : (monthlyCreditsLimit + extraCreditsBalance);
  const creditsRemaining = totalAllowedCredits === -1 ? -1 : Math.max(0, totalAllowedCredits - creditsUsedThisMonth);

  return (
    <div className="page-container animate-fadeIn" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <header className="page-header flex-mobile-col flex-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
        <div>
          <h1>Billing & Store</h1>
          <p>Upgrade your platform capacities, add channels, and view your purchase history.</p>
        </div>
        <button 
          className="btn btn-primary" 
          style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
          onClick={() => setShowPricingModal(true)}
        >
          <ShoppingBag size={18} /> Upgrade Customizer
        </button>
      </header>

      {/* Current Quotas Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        {/* Allowed Channels Card */}
        <div className="card" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Globe size={18} style={{ color: 'var(--accent-primary)' }} />
              Meta Channels Quota ({pageConnections.length} / {allowedChannels})
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Slots assigned to your connected business pages.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {loading ? (
              <div style={{ padding: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading slots...</div>
            ) : (
              <>
                {pageConnections.map((conn) => {
                  const isWA = !!conn.whatsapp_phone_number_id;
                  const isIG = !!conn.instagram_account_id;
                  let platformName = 'Facebook';
                  let iconBg = 'rgba(24, 119, 242, 0.1)';
                  let iconColor = '#1877F2';
                  let platformIcon = <FacebookIcon />;

                  if (isWA) {
                    platformName = 'WhatsApp';
                    iconBg = 'rgba(37, 211, 102, 0.1)';
                    iconColor = '#25D366';
                    platformIcon = <WhatsAppIcon />;
                  } else if (isIG) {
                    platformName = 'Instagram';
                    iconBg = 'rgba(225, 48, 108, 0.1)';
                    iconColor = '#E1306C';
                    platformIcon = <InstagramIcon />;
                  }

                  return (
                    <div key={conn.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-light)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {platformIcon}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                            {conn.page_name || 'Unnamed Channel'}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{platformName} Connection</div>
                        </div>
                      </div>
                      <span className={`badge ${conn.is_active ? 'badge-success' : 'badge-error'}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                        {conn.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                  );
                })}

                {/* Placeholders for available slots */}
                {Array.from({ length: Math.max(0, allowedChannels - pageConnections.length) }).map((_, idx) => (
                  <div 
                    key={`empty-store-${idx}`}
                    onClick={() => navigate('/pages', { state: { autoConnect: true } })}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      gap: '8px', 
                      padding: '10px 14px', 
                      border: '1.5px dashed var(--border-primary)', 
                      borderRadius: '8px',
                      background: 'rgba(255, 255, 255, 0.01)',
                      color: 'var(--text-secondary)',
                      fontSize: '0.8rem',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    className="empty-slot-hover"
                  >
                    <Plus size={14} /> Available Channel Slot — Connect Channel
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* AI Credits Balance Card */}
        <div className="card" style={{ padding: '24px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', display: 'flex', flexDirection: 'column', gap: '16px', gridColumn: 'span 2' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} style={{ color: '#eab308', fill: '#eab308' }} />
              Unified AI Credits Balance
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Consolidated balance used for comment moderation, chatbot replies, AI agents, and image generation.</p>
          </div>

          {loading ? (
            <div style={{ padding: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Loading credit stats...</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px', alignItems: 'start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '16px' }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: '900', color: 'var(--text-primary)', lineHeight: 1 }}>
                    {totalAllowedCredits === -1 ? '∞' : creditsRemaining.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', fontWeight: '500' }}>
                    credits left
                  </span>
                </div>

                {/* Breakdown Details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-light)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Monthly allowance</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                      {monthlyCreditsLimit === -1 ? 'Unlimited' : `${monthlyCreditsLimit.toLocaleString()} credits`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Extra balance (gifted/purchased)</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>+{extraCreditsBalance.toLocaleString()} credits</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Used this cycle</span>
                    <span style={{ color: 'var(--error)', fontWeight: '600' }}>-{creditsUsedThisMonth.toLocaleString()} credits</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed var(--border-primary)', paddingTop: '8px', marginTop: '4px' }}>
                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Total remaining balance</span>
                    <span style={{ color: '#22c55e', fontWeight: '800' }}>{creditsRemaining.toLocaleString()} credits</span>
                  </div>
                  {billingCycle && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span>Billing period</span>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '600', textAlign: 'right' }}>
                        {billingCycle.startDate.toLocaleDateString()} – {billingCycle.endDate.toLocaleDateString()}
                        <div style={{ fontSize: '0.7rem', color: 'var(--accent-primary)', marginTop: '2px', fontWeight: '500' }}>
                          ({billingCycle.daysRemaining} days left)
                        </div>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Credit consumption rates */}
              <div style={{ background: 'var(--bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-primary)' }}>Credit Cost Rates</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                    <span>AI Comment / Chat Reply (Text)</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>1 credit</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                    <span>AI Comment Analysis (Sentiment/Safety)</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>1 credit</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                    <span>AI Chat Agent Query (Dashboard)</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>10 credits</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                    <span>AI Vision / Image Reply (Chat)</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>15 credits</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px' }}>
                    <span>AI Image Generation</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>30 credits</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '2px' }}>
                    <span>Keyword rules & static replies</span>
                    <span style={{ color: '#10b981', fontWeight: '700' }}>FREE</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upgrade Callout Card */}
      <div className="upgrade-callout-card">
        <div style={{ maxWidth: '600px' }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '1.3rem', fontWeight: '700', color: 'var(--text-primary)' }}>Need more limits or channels?</h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.5' }}>
            Customize your additional add-on packages dynamically. You can buy individual channels (3000 BTT / $30 each including 300 free monthly messages) or purchase messages-only bundles if you already have enough channels.
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
          <div className="table-responsive" style={{ background: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border-primary)', overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, minWidth: '750px' }}>
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
                  <tr key={p.id} style={p.payment_method === 'gift' ? { background: 'rgba(139, 92, 246, 0.03)' } : undefined}>
                    <td style={{ fontSize: '0.85rem', fontWeight: '500' }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ fontWeight: 'bold' }}>
                      {p.payment_method === 'gift' ? '-' : (p.channels_count > 0 ? `+${p.channels_count}` : '0')}
                    </td>
                    <td>
                      {p.payment_method === 'gift' ? (
                        <span className="badge" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#a855f7', border: '1px solid rgba(139, 92, 246, 0.25)', textTransform: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Gift size={12} /> {p.message_addon}
                        </span>
                      ) : (
                        <span className="badge badge-secondary" style={{ textTransform: 'capitalize' }}>
                          {p.message_addon}
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 'bold', color: p.payment_method === 'gift' && p.total_amount === 0 ? '#10b981' : 'var(--accent-primary)' }}>
                      {p.total_amount === 0 ? (p.payment_method === 'gift' ? 'Free (Gift)' : 'Free') : `${p.currency === 'BTT' ? 'BTT ' : '$'}${p.total_amount}`}
                    </td>
                    <td style={{ fontSize: '0.8rem', textTransform: 'capitalize', color: 'var(--text-secondary)', fontWeight: p.payment_method === 'gift' ? 600 : 'normal' }}>
                      {p.payment_method === 'gift' ? '🎁 Admin Gift' : p.payment_method.replace('_', ' ')}
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
