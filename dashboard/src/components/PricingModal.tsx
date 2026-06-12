import { useState } from 'react';
import { X, Loader2, DollarSign, Send, Landmark, Smartphone, MessageSquare, Eye, Bot, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from '../hooks/useToast';

interface PricingModalProps {
  onClose: () => void;
  initialChannels?: number;
}

// ─── Pricing constants ────────────────────────────────────────────────────────
const CHANNEL_USD = 30;
const CHANNEL_BTT = 3000;

// Linear: $5 per 500 messages
const MSG_USD_PER_500  = 5;
const MSG_BTT_PER_500  = 500;

// Linear: $3 per 50 vision queries
const VIS_USD_PER_50   = 3;
const VIS_BTT_PER_50   = 300;

// Linear: $30 per 50 agent queries
const AGT_USD_PER_50   = 30;
const AGT_BTT_PER_50   = 3000;

export default function PricingModal({ onClose, initialChannels = 1 }: PricingModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'plan' | 'checkout' | 'success'>('plan');
  const [channelsToBuy, setChannelsToBuy] = useState(initialChannels);
  const [messageQty, setMessageQty] = useState(0);
  const [visionQty, setVisionQty]   = useState(0);
  const [agentQty, setAgentQty]     = useState(0);
  const [currency, setCurrency]     = useState<'USD' | 'BTT'>('USD');

  // Checkout state
  const [paymentMethod, setPaymentMethod] = useState<'manual' | 'direct_bkash' | 'direct_card' | 'direct_bank'>('manual');
  const [manualDetails, setManualDetails] = useState('');
  const [submitting, setSubmitting]       = useState(false);

  // ─── Pure linear price helpers ─────────────────────────────────────────────
  const channelCost = channelsToBuy * (currency === 'BTT' ? CHANNEL_BTT : CHANNEL_USD);
  const messageCost = Math.round((messageQty / 500) * (currency === 'BTT' ? MSG_BTT_PER_500 : MSG_USD_PER_500));
  const visionCost  = Math.round((visionQty  / 50)  * (currency === 'BTT' ? VIS_BTT_PER_50  : VIS_USD_PER_50));
  const agentCost   = Math.round((agentQty   / 50)  * (currency === 'BTT' ? AGT_BTT_PER_50  : AGT_USD_PER_50));
  const totalAmount = channelCost + messageCost + visionCost + agentCost;

  const cur = (n: number) =>
    currency === 'BTT' ? `${n.toLocaleString()} BTT` : `$${n.toLocaleString()}`;

  // ─── Checkout submit ────────────────────────────────────────────────────────
  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    try {
      const descParts: string[] = [];
      if (messageQty > 0) descParts.push(`Messages: +${messageQty}`);
      if (visionQty  > 0) descParts.push(`Vision: +${visionQty}`);
      if (agentQty   > 0) descParts.push(`Agent: +${agentQty}`);
      const addonDescription = descParts.join(', ') || 'default';

      const { error } = await supabase.from('purchases').insert({
        user_id:                user.id,
        channels_count:         channelsToBuy,
        message_addon:          addonDescription,
        currency:               currency,
        total_amount:           totalAmount,
        payment_method:         paymentMethod,
        manual_payment_details: paymentMethod === 'manual' ? manualDetails : null,
        status:                 'pending',
      });

      if (error) throw error;
      setStep('success');
    } catch (error: any) {
      toast.error('Error submitting purchase: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Shared slider card ─────────────────────────────────────────────────────
  const SliderCard = ({
    icon, label, qty, setQty, min, max, step: stepSize,
    accentColor, valueFmt, priceFmt,
  }: {
    icon: React.ReactNode;
    label: string;
    qty: number;
    setQty: (n: number) => void;
    min: number; max: number; step: number;
    accentColor: string;
    valueFmt: string;
    priceFmt: string;
  }) => (
    <div style={{
      background: 'var(--bg-secondary)', padding: '16px',
      borderRadius: '12px', marginTop: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {icon} {label}
        </span>
        <span style={{ color: accentColor, fontWeight: 700, fontSize: '0.88rem' }}>{valueFmt}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={stepSize}
        value={qty}
        onChange={e => setQty(parseInt(e.target.value))}
        style={{ width: '100%', accentColor, cursor: 'pointer', marginBottom: '6px' }}
      />
      {/* Slider end labels */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
        <span>0 (Free)</span>
        <span>Max: {max.toLocaleString()}</span>
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
        {priceFmt}
      </p>
    </div>
  );

  // ─── Order summary rows (reused on checkout) ────────────────────────────────
  const summaryRows = [
    channelsToBuy > 0 && { label: `+${channelsToBuy} Channels`,                cost: channelCost },
    messageQty    > 0 && { label: `+${messageQty.toLocaleString()} Messages`,   cost: messageCost },
    visionQty     > 0 && { label: `+${visionQty.toLocaleString()} Vision`,      cost: visionCost  },
    agentQty      > 0 && { label: `+${agentQty.toLocaleString()} AI Agent`,     cost: agentCost   },
  ].filter(Boolean) as { label: string; cost: number }[];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: '600px', background: 'var(--bg-primary)' }} onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="modal-header">
          <div>
            <h2>
              {step === 'plan'     ? 'Purchase Additional Channels'
               : step === 'checkout' ? 'Complete Your Purchase'
               : 'Purchase Successful'}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              {step === 'plan'     ? 'Drag sliders to select the limits you need — price updates instantly.'
               : step === 'checkout' ? 'Review your order and choose a payment method.'
               : 'Your request is pending approval.'}
            </p>
          </div>
          <button className="btn-ghost btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        {/* ════════════════ PLAN STEP ════════════════ */}
        {step === 'plan' && (
          <div className="modal-body">

            {/* Currency toggle */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', display: 'flex', gap: '4px' }}>
                {(['USD', 'BTT'] as const).map(c => (
                  <button key={c} onClick={() => setCurrency(c)} style={{
                    padding: '4px 12px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                    fontSize: '0.8rem', fontWeight: 'bold',
                    background: currency === c ? 'var(--accent-primary)' : 'transparent',
                    color:      currency === c ? '#fff' : 'var(--text-secondary)',
                  }}>
                    {c === 'USD' ? 'USD ($)' : 'BTT'}
                  </button>
                ))}
              </div>
            </div>

            {/* Channels slider */}
            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  <Zap size={14} /> Additional Channels
                </span>
                <span style={{ color: 'var(--accent-primary)', fontWeight: 700, fontSize: '0.88rem' }}>
                  {channelsToBuy === 0 ? '0 — None' : `+${channelsToBuy} channel${channelsToBuy > 1 ? 's' : ''}`}
                </span>
              </div>
              <input
                type="range" min="0" max="10" step="1"
                value={channelsToBuy}
                onChange={e => setChannelsToBuy(parseInt(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-primary)', cursor: 'pointer', marginBottom: '6px' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                <span>0 (None)</span><span>Max: 10</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                {channelsToBuy === 0 ? 'None selected' : `${cur(currency === 'BTT' ? CHANNEL_BTT : CHANNEL_USD)} / channel — subtotal: ${cur(channelCost)}`}
              </p>
            </div>

            {/* Messages slider */}
            <SliderCard
              icon={<MessageSquare size={14} />}
              label="Monthly AI Messages"
              qty={messageQty} setQty={setMessageQty}
              min={0} max={30000} step={500}
              accentColor="var(--accent-primary)"
              valueFmt={messageQty === 0 ? '0 — Included Free' : `+${messageQty.toLocaleString()} messages`}
              priceFmt={messageQty === 0 ? 'Free with base plan' : `${cur(currency === 'BTT' ? MSG_BTT_PER_500 : MSG_USD_PER_500)} / 500 messages — subtotal: ${cur(messageCost)} / month`}
            />

            {/* Vision slider */}
            <SliderCard
              icon={<Eye size={14} />}
              label="Image Vision Queries"
              qty={visionQty} setQty={setVisionQty}
              min={0} max={2000} step={50}
              accentColor="#10b981"
              valueFmt={visionQty === 0 ? '0 — None' : `+${visionQty.toLocaleString()} queries`}
              priceFmt={visionQty === 0 ? 'Not selected' : `${cur(currency === 'BTT' ? VIS_BTT_PER_50 : VIS_USD_PER_50)} / 50 queries — subtotal: ${cur(visionCost)} / month`}
            />

            {/* Agent slider */}
            <SliderCard
              icon={<Bot size={14} />}
              label="Dashboard AI Agent Queries"
              qty={agentQty} setQty={setAgentQty}
              min={0} max={2000} step={50}
              accentColor="#a78bfa"
              valueFmt={agentQty === 0 ? '0 — None' : `+${agentQty.toLocaleString()} queries`}
              priceFmt={agentQty === 0 ? 'Not selected' : `${cur(currency === 'BTT' ? AGT_BTT_PER_50 : AGT_USD_PER_50)} / 50 queries — subtotal: ${cur(agentCost)} / month`}
            />

            {/* Enterprise / custom */}
            <div style={{
              marginTop: '14px', padding: '11px 14px',
              background: 'rgba(167,139,250,0.06)',
              border: '1px dashed rgba(167,139,250,0.25)',
              borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Need unlimited or a custom enterprise package?
              </span>
              <a
                href="https://wa.me/123456789"
                target="_blank" rel="noreferrer"
                style={{ fontSize: '0.82rem', color: '#a78bfa', fontWeight: 700, textDecoration: 'underline', whiteSpace: 'nowrap', marginLeft: '12px' }}
              >
                Contact Admin →
              </a>
            </div>

            {/* Total */}
            <div style={{
              marginTop: '16px', padding: '14px 18px',
              background: 'rgba(249,115,22,0.1)',
              borderRadius: '12px', border: '1px solid rgba(249,115,22,0.2)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontWeight: 700, fontSize: '1rem' }}>Total Monthly Cost</span>
              <span style={{ fontWeight: 800, fontSize: '1.45rem', color: 'var(--accent-primary)' }}>
                {totalAmount === 0 ? '—' : cur(totalAmount)}
              </span>
            </div>

            {/* Disabled hint when nothing selected */}
            {totalAmount === 0 && (
              <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                Move at least one slider to continue.
              </p>
            )}

            <div className="modal-footer" style={{ marginTop: '20px', padding: 0, border: 'none' }}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => setStep('checkout')}
                disabled={totalAmount === 0}
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}

        {/* ════════════════ CHECKOUT STEP ════════════════ */}
        {step === 'checkout' && (
          <form onSubmit={handleCheckout} className="modal-body">

            {/* Order summary */}
            <div style={{ background: 'var(--bg-secondary)', borderRadius: '10px', overflow: 'hidden', marginBottom: '20px' }}>
              <div style={{ padding: '10px 14px', background: 'rgba(249,115,22,0.12)', borderBottom: '1px solid rgba(249,115,22,0.15)' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent-primary)' }}>Order Summary</span>
              </div>
              {summaryRows.map(row => (
                <div key={row.label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)',
                  fontSize: '0.87rem',
                }}>
                  <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                  <span style={{ fontWeight: 600 }}>{cur(row.cost)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px' }}>
                <span style={{ fontWeight: 700 }}>Total / month</span>
                <span style={{ fontWeight: 800, color: 'var(--accent-primary)', fontSize: '1.1rem' }}>{cur(totalAmount)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {([
                  { id: 'manual',       icon: <Smartphone size={16} />, label: 'Manual Transfer' },
                  { id: 'direct_bkash', icon: <DollarSign  size={16} />, label: 'bKash (Auto)'     },
                  { id: 'direct_card',  icon: <Landmark    size={16} />, label: 'Credit Card'      },
                  { id: 'direct_bank',  icon: <Landmark    size={16} />, label: 'Bank Transfer'    },
                ] as const).map(m => (
                  <button
                    key={m.id} type="button"
                    onClick={() => setPaymentMethod(m.id)}
                    className={`btn ${paymentMethod === m.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}
                  >
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'manual' && (
              <div className="form-group" style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                <p style={{ fontSize: '0.9rem', marginBottom: '12px' }}>
                  Please transfer <strong>{cur(totalAmount)}</strong> manually then contact us with proof.
                </p>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <a href="https://wa.me/123456789" target="_blank" rel="noreferrer"
                    className="btn btn-secondary"
                    style={{ flex: 1, display: 'flex', justifyContent: 'center', background: '#25D366', color: '#fff', border: 'none' }}>
                    <Send size={16} style={{ marginRight: '8px' }} /> WhatsApp
                  </a>
                  <a href="https://t.me/yourusername" target="_blank" rel="noreferrer"
                    className="btn btn-secondary"
                    style={{ flex: 1, display: 'flex', justifyContent: 'center', background: '#0088cc', color: '#fff', border: 'none' }}>
                    <Send size={16} style={{ marginRight: '8px' }} /> Telegram
                  </a>
                </div>
                <label className="form-label">Payment Verification Details</label>
                <textarea
                  className="form-textarea"
                  placeholder="Transaction ID, sender phone, or any payment proof..."
                  value={manualDetails}
                  onChange={e => setManualDetails(e.target.value)}
                  required
                  style={{ minHeight: '80px' }}
                />
              </div>
            )}

            {paymentMethod !== 'manual' && (
              <div style={{ marginTop: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Automated payment gateway integration is coming soon.</p>
                <p style={{ fontSize: '0.85rem', marginTop: '8px', color: 'var(--text-muted)' }}>Please use Manual Transfer for now.</p>
              </div>
            )}

            <div className="modal-footer" style={{ marginTop: '24px', padding: 0, border: 'none' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('plan')}>Back</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting
                  ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  : 'Submit Payment'}
              </button>
            </div>
          </form>
        )}

        {/* ════════════════ SUCCESS STEP ════════════════ */}
        {step === 'success' && (
          <div className="modal-body" style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <Send size={32} />
            </div>
            <h3>Purchase Request Received!</h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '12px', marginBottom: '24px' }}>
              Your request has been recorded. Our team will review your payment and activate your limits shortly.
            </p>
            <button className="btn btn-primary" onClick={onClose}>Close</button>
          </div>
        )}

      </div>
    </div>
  );
}
