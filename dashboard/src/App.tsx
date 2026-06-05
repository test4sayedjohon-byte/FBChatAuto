import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import KnowledgePage from './pages/KnowledgePage';
import DocumentsPage from './pages/DocumentsPage';
import ProvidersPage from './pages/ProvidersPage';
import PagesPage from './pages/PagesPage';
import SandboxPage from './pages/SandboxPage';
import InboxPage from './pages/InboxPage';
import SuperAdminStatsPage from './pages/SuperAdminStatsPage';
import SuperAdminUsersPage from './pages/SuperAdminUsersPage';
import FacebookAppSettingsPage from './pages/FacebookAppSettingsPage';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

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

  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/providers" element={<ProvidersPage />} />
            <Route path="/pages" element={<PagesPage />} />
            <Route path="/fb-app" element={<FacebookAppSettingsPage />} />
            <Route path="/sandbox" element={<SandboxPage />} />
            <Route path="/super-stats" element={<SuperAdminStatsPage />} />
            <Route path="/super-users" element={<SuperAdminUsersPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
