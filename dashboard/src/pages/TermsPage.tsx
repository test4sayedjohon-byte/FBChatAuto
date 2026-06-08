import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function TermsPage() {
  useDocumentTitle('Terms & Conditions — AutometaBot', 'Read the terms and conditions for AutometaBot subscription and usage.', 'https://autometabot.com/terms');
  return (
    <div className="card" style={{ maxWidth: '800px', margin: '40px auto', padding: '40px' }}>
      <h1 style={{ marginBottom: '24px' }}>Terms & Conditions</h1>
      
      <div style={{ lineHeight: '1.6', color: 'var(--text-secondary)' }}>
        <h3 style={{ color: 'var(--text-primary)', marginTop: '24px' }}>1. Introduction</h3>
        <p>Welcome to AutometaBot. By accessing our platform, you agree to these Terms & Conditions. Please read them carefully.</p>

        <h3 style={{ color: 'var(--text-primary)', marginTop: '24px' }}>2. Subscription and Billing</h3>
        <p>AutometaBot operates on a prepaid subscription model. Purchases are for the specified billing cycle.</p>
        <ul>
          <li>All payments are non-refundable unless specified otherwise.</li>
          <li>Manual payments must be verified by our team. Approval may take up to 24 hours.</li>
        </ul>

        <h3 style={{ color: 'var(--text-primary)', marginTop: '24px' }}>3. Service Limits (Dual Limits)</h3>
        <p>AutometaBot implements a dual-limit system to ensure fair usage of AI resources:</p>
        <ul>
          <li><strong>Message Limits:</strong> The total number of automated responses your bot can send per month.</li>
          <li><strong>Token Limits:</strong> The total volume of text processed by the AI. Long conversations or large knowledge bases consume more tokens per message.</li>
        </ul>
        <p>Your automation will pause if EITHER limit is reached. You can upgrade your limits at any time from the dashboard.</p>

        <h3 style={{ color: 'var(--text-primary)', marginTop: '24px' }}>4. Acceptable Use</h3>
        <p>You agree not to use AutometaBot to spam, harass, or violate Meta's terms of service. Accounts found violating these terms will be suspended without refund.</p>

        <h3 style={{ color: 'var(--text-primary)', marginTop: '24px' }}>5. Changes to Terms</h3>
        <p>We reserve the right to modify these terms at any time. Continued use of the platform constitutes acceptance of the new terms.</p>
      </div>
    </div>
  );
}
