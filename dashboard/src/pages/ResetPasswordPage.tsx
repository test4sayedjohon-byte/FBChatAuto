import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Key } from 'lucide-react';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useDocumentTitle('Reset Password — AutometaBot', 'Set a new password for your AutometaBot account.', 'https://autometabot.com/reset-password');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setErrorMsg(error.message);
      } else {
        setSuccessMsg('Your password has been successfully reset.');
        setTimeout(() => {
          navigate('/login');
        }, 2500);
      }
    } catch {
      setErrorMsg('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '32px', background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', borderRadius: '16px', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(249, 115, 22, 0.1)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Key size={24} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', margin: '0 0 8px', color: 'var(--text-primary)' }}>Set New Password</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Please enter and confirm your new password below.</p>
        </div>

        {successMsg ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ color: 'var(--success)', fontSize: '1rem', fontWeight: 'bold', marginBottom: '8px' }}>
              {successMsg}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Redirecting you to the login page...</p>
          </div>
        ) : (
          <form onSubmit={handleReset}>
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">New Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="form-input" 
                  style={{ paddingRight: '40px', width: '100%' }} 
                  placeholder="Enter new password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
                <button 
                  type="button" 
                  onClick={() => setShowPassword(!showPassword)} 
                  style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '40px', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label">Confirm New Password</label>
              <input 
                type={showPassword ? 'text' : 'password'} 
                className="form-input" 
                style={{ width: '100%' }} 
                placeholder="Confirm new password" 
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {errorMsg && (
              <div className="form-error" style={{ marginBottom: '16px', textAlign: 'center' }}>
                {errorMsg}
              </div>
            )}

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              disabled={loading}
            >
              {loading && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />}
              Reset Password
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
