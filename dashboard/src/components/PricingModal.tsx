import { useState } from 'react';
import { X, Loader2, DollarSign, Send, Landmark, Smartphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

interface PricingModalProps {
  onClose: () => void;
  initialChannels?: number;
}

export default function PricingModal({ onClose, initialChannels = 1 }: PricingModalProps) {
  const { user } = useAuth();
  const [step, setStep] = useState<'plan' | 'checkout' | 'success'>('plan');
  const [channelsToBuy, setChannelsToBuy] = useState(initialChannels);
  const [messageAddon, setMessageAddon] = useState<'default' | '+500' | '+1000' | 'unlimited'>('default');
  const [currency, setCurrency] = useState<'USD' | 'BDT'>('USD');
  
  // Checkout state
  const [paymentMethod, setPaymentMethod] = useState<'manual' | 'direct_bkash' | 'direct_card' | 'direct_bank'>('manual');
  const [manualDetails, setManualDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const baseRate = currency === 'BDT' ? 3000 : 30;
  const addonRates = {
    'default': 0,
    '+500': currency === 'BDT' ? 500 : 5,
    '+1000': currency === 'BDT' ? 800 : 8,
    'unlimited': currency === 'BDT' ? 3000 : 30
  };
  
  const totalAmount = (channelsToBuy * baseRate) + addonRates[messageAddon];

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    
    setSubmitting(true);
    
    try {
      const { error } = await supabase.from('purchases').insert({
        user_id: user.id,
        channels_count: channelsToBuy,
        message_addon: messageAddon,
        currency: currency,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        manual_payment_details: paymentMethod === 'manual' ? manualDetails : null,
        status: 'pending'
      });

      if (error) throw error;
      setStep('success');
    } catch (error: any) {
      alert('Error submitting purchase: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{maxWidth: '600px', background: 'var(--bg-primary)'}} onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{step === 'plan' ? 'Purchase Additional Channels' : step === 'checkout' ? 'Complete Your Purchase' : 'Purchase Successful'}</h2>
            <p style={{fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px'}}>
              {step === 'plan' ? 'Select the additional channels and limits you need.' : step === 'checkout' ? 'Choose a payment method.' : 'Your request is pending approval.'}
            </p>
          </div>
          <button className="btn-ghost btn-icon" onClick={onClose}><X size={18}/></button>
        </div>
        
        {step === 'plan' && (
          <div className="modal-body">
            <div style={{display: 'flex', justifyContent: 'flex-end', marginBottom: '16px'}}>
              <div style={{background: 'var(--bg-secondary)', padding: '4px', borderRadius: '8px', display: 'flex', gap: '4px'}}>
                <button 
                  onClick={() => setCurrency('USD')} 
                  style={{padding: '4px 12px', borderRadius: '4px', border: 'none', background: currency === 'USD' ? 'var(--accent-primary)' : 'transparent', color: currency === 'USD' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold'}}
                >USD ($)</button>
                <button 
                  onClick={() => setCurrency('BDT')} 
                  style={{padding: '4px 12px', borderRadius: '4px', border: 'none', background: currency === 'BDT' ? 'var(--accent-primary)' : 'transparent', color: currency === 'BDT' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold'}}
                >BDT (৳)</button>
              </div>
            </div>

            <div className="form-group" style={{background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px'}}>
              <label className="form-label" style={{display: 'flex', justifyContent: 'space-between'}}>
                <span>Additional Channels</span>
                <span style={{color: 'var(--accent-primary)', fontWeight: 'bold'}}>{channelsToBuy === 0 ? '0 (None)' : `+${channelsToBuy}`}</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="10" 
                value={channelsToBuy} 
                onChange={e => setChannelsToBuy(parseInt(e.target.value))}
                style={{width: '100%', accentColor: 'var(--accent-primary)'}} 
              />
              <p className="form-hint" style={{marginTop: '8px'}}>Base price: {currency === 'BDT' ? '3000 ৳' : '$30'} / channel</p>
            </div>

            <div className="form-group" style={{marginTop: '20px'}}>
              <label className="form-label">Monthly AI Message Limit</label>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
                {['default', '+500', '+1000', 'unlimited'].map((addon) => (
                  <div 
                    key={addon}
                    onClick={() => setMessageAddon(addon as any)}
                    style={{padding: '12px', borderRadius: '8px', border: `2px solid ${messageAddon === addon ? 'var(--accent-primary)' : 'var(--border-light)'}`, cursor: 'pointer', background: messageAddon === addon ? 'rgba(249,115,22,0.05)' : 'var(--bg-secondary)'}}
                  >
                    <div style={{fontWeight: 'bold', fontSize: '0.9rem'}}>
                      {addon === 'default' 
                        ? (channelsToBuy > 0 ? `+ ${channelsToBuy * 300} Messages` : 'No Additional Messages') 
                        : addon === 'unlimited' ? 'Unlimited Messages' : `+ ${addon} Messages`}
                    </div>
                    <div style={{fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px'}}>
                      {addon === 'default' ? 'Included free' : `+ ${currency === 'BDT' ? `${addonRates[addon as keyof typeof addonRates]} ৳` : `$${addonRates[addon as keyof typeof addonRates]}`} / month`}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{marginTop: '24px', padding: '16px', background: 'rgba(249,115,22,0.1)', borderRadius: '12px', border: '1px solid rgba(249,115,22,0.2)'}}>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <span style={{fontWeight: 'bold', fontSize: '1.1rem'}}>Total Monthly Cost</span>
                <span style={{fontWeight: 'bold', fontSize: '1.5rem', color: 'var(--accent-primary)'}}>
                  {currency === 'BDT' ? '৳ ' : '$'}{totalAmount}
                </span>
              </div>
            </div>
            
            <div className="modal-footer" style={{marginTop: '24px', padding: 0, border: 'none'}}>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button 
                className="btn btn-primary" 
                onClick={() => setStep('checkout')}
                disabled={totalAmount === 0}
                title={totalAmount === 0 ? 'Please select at least 1 channel or a message addon.' : ''}
              >
                Proceed to Checkout
              </button>
            </div>
          </div>
        )}

        {step === 'checkout' && (
          <form onSubmit={handleCheckout} className="modal-body">
            <div style={{background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', padding: '16px', borderRadius: '8px', marginBottom: '20px'}}>
              <div style={{fontSize: '0.9rem', color: 'var(--text-secondary)'}}>Amount to Pay:</div>
              <div style={{fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--accent-primary)'}}>{currency === 'BDT' ? '৳ ' : '$'}{totalAmount}</div>
            </div>

            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px'}}>
                <button type="button" onClick={() => setPaymentMethod('manual')} className={`btn ${paymentMethod === 'manual' ? 'btn-primary' : 'btn-secondary'}`} style={{display:'flex', gap:'8px', justifyContent:'center'}}>
                  <Smartphone size={16} /> Manual Transfer
                </button>
                <button type="button" onClick={() => setPaymentMethod('direct_bkash')} className={`btn ${paymentMethod === 'direct_bkash' ? 'btn-primary' : 'btn-secondary'}`} style={{display:'flex', gap:'8px', justifyContent:'center'}}>
                  <DollarSign size={16} /> bKash (Auto)
                </button>
                <button type="button" onClick={() => setPaymentMethod('direct_card')} className={`btn ${paymentMethod === 'direct_card' ? 'btn-primary' : 'btn-secondary'}`} style={{display:'flex', gap:'8px', justifyContent:'center'}}>
                  <Landmark size={16} /> Credit Card
                </button>
                <button type="button" onClick={() => setPaymentMethod('direct_bank')} className={`btn ${paymentMethod === 'direct_bank' ? 'btn-primary' : 'btn-secondary'}`} style={{display:'flex', gap:'8px', justifyContent:'center'}}>
                  <Landmark size={16} /> Bank Transfer
                </button>
              </div>
            </div>

            {paymentMethod === 'manual' && (
              <div className="form-group" style={{marginTop: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px'}}>
                <p style={{fontSize: '0.9rem', marginBottom: '12px'}}>
                  Please transfer <strong>{currency === 'BDT' ? '৳ ' : '$'}{totalAmount}</strong> manually and contact us on WhatsApp or Telegram with your payment details.
                </p>
                <div style={{display: 'flex', gap: '12px', marginBottom: '16px'}}>
                  <a href="https://wa.me/123456789" target="_blank" rel="noreferrer" className="btn btn-secondary" style={{flex: 1, display: 'flex', justifyContent: 'center', background: '#25D366', color: '#fff', border: 'none'}}>
                    <Send size={16} style={{marginRight: '8px'}} /> WhatsApp
                  </a>
                  <a href="https://t.me/yourusername" target="_blank" rel="noreferrer" className="btn btn-secondary" style={{flex: 1, display: 'flex', justifyContent: 'center', background: '#0088cc', color: '#fff', border: 'none'}}>
                    <Send size={16} style={{marginRight: '8px'}} /> Telegram
                  </a>
                </div>
                
                <label className="form-label">Payment Verification Details</label>
                <textarea 
                  className="form-textarea" 
                  placeholder="Enter sender phone number, transaction ID, bank account name, or last 4 digits of your card..."
                  value={manualDetails}
                  onChange={e => setManualDetails(e.target.value)}
                  required
                  style={{minHeight: '80px'}}
                />
              </div>
            )}
            
            {paymentMethod !== 'manual' && (
              <div style={{marginTop: '20px', padding: '16px', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center'}}>
                <p style={{color: 'var(--text-secondary)'}}>Automated payment gateway API integration is pending.</p>
                <p style={{fontSize: '0.85rem', marginTop: '8px'}}>This will redirect you to the secure payment page.</p>
              </div>
            )}

            <div className="modal-footer" style={{marginTop: '24px', padding: 0, border: 'none'}}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep('plan')}>Back</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? <Loader2 size={16} style={{animation: 'spin 1s linear infinite'}} /> : 'Submit Payment'}
              </button>
            </div>
          </form>
        )}

        {step === 'success' && (
          <div className="modal-body" style={{textAlign: 'center', padding: '40px 20px'}}>
            <div style={{width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(34, 197, 94, 0.1)', color: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px'}}>
              <Send size={32} />
            </div>
            <h3>Purchase Request Received!</h3>
            <p style={{color: 'var(--text-secondary)', marginTop: '12px', marginBottom: '24px'}}>
              Your request has been successfully recorded. If you made a manual payment, our team will review and approve your limits shortly.
            </p>
            <button className="btn btn-primary" onClick={onClose}>Close Dashboard</button>
          </div>
        )}
      </div>
    </div>
  );
}
