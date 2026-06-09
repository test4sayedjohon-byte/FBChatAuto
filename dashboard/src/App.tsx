import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/ToastContainer';
import LoginPage from './pages/LoginPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import DashboardPage from './pages/DashboardPage';
import KnowledgePage from './pages/KnowledgePage';
import DocumentsPage from './pages/DocumentsPage';
import ProvidersPage from './pages/ProvidersPage';
import PagesPage from './pages/PagesPage';
import SandboxPage from './pages/SandboxPage';
import InboxPage from './pages/InboxPage';
import SuperAdminStatsPage from './pages/SuperAdminStatsPage';
import SuperAdminUsersPage from './pages/SuperAdminUsersPage';
import UserWorkspacePage from './pages/UserWorkspacePage';
import SuperAdminPurchasesPage from './pages/SuperAdminPurchasesPage';
import FacebookAppSettingsPage from './pages/FacebookAppSettingsPage';
import UsagePage from './pages/UsagePage';
import StorePage from './pages/StorePage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ContentPlannerPage from './pages/ContentPlannerPage';
import AutoModerationPage from './pages/AutoModerationPage';
import IntegrationsPage from './pages/IntegrationsPage';
import AnalyticsPage from './pages/AnalyticsPage';

import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, profile } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: 'var(--text-secondary)' }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.is_suspended) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#111315', color: '#fff', textAlign: 'center', padding: '24px' }}>
        <div style={{ fontSize: '64px', marginBottom: '20px' }}>🚫</div>
        <h2 style={{ fontSize: '28px', color: 'var(--error)', marginBottom: '12px', fontWeight: 'bold' }}>Account Suspended</h2>
        <p style={{ color: 'var(--text-secondary)', maxWidth: '480px', fontSize: '16px', lineHeight: '1.6' }}>
          Your account has been suspended by the platform administrator.
          If you believe this is a mistake, please contact support.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}



/**
 * Route guard for admin pages — accessible by both admin and super_admin.
 */
function AdminRoute({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return <>{children}</>;
}

function DashboardRouter() {
  const { isAdmin } = useAuth();
  if (isAdmin) {
    return <Navigate to="/super-stats" replace />;
  }
  return <DashboardPage />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastContainer />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<DashboardRouter />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/knowledge" element={<KnowledgePage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/providers" element={<ProvidersPage />} />
              <Route path="/pages" element={<PagesPage />} />
              <Route path="/fb-app" element={<FacebookAppSettingsPage />} />
              <Route path="/usage" element={<UsagePage />} />
              <Route path="/sandbox" element={<SandboxPage />} />
              <Route path="/planner" element={<ContentPlannerPage />} />
              <Route path="/moderation" element={<AutoModerationPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/agent" element={<Navigate to="/" replace />} />
              <Route path="/store" element={<StorePage />} />
              {/* Admin routes — accessible by admin AND super_admin */}
              <Route path="/super-stats" element={<AdminRoute><SuperAdminStatsPage /></AdminRoute>} />
              <Route path="/super-users" element={<AdminRoute><SuperAdminUsersPage /></AdminRoute>} />
              <Route path="/super-users/:userId" element={<AdminRoute><UserWorkspacePage /></AdminRoute>} />
              <Route path="/super-purchases" element={<AdminRoute><SuperAdminPurchasesPage /></AdminRoute>} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
