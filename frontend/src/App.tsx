import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { SecurityProvider } from './context/SecurityContext';
import { AIProvider } from './context/AIContext';
import { AuthView } from './views/AuthView';
import { AdminAuthView } from './views/AdminAuthView';
import { ReposView } from './views/ReposView';
import { DashboardView } from './views/DashboardView';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation('common');

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--color-surface, #1e1e2e)',
          color: 'var(--color-outline, #a6adc8)',
          fontFamily: 'var(--font-sans, system-ui)'
        }}
      >
        {t('loadingPlatform')}
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const CollaboratorAuthRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--color-surface, #1e1e2e)',
          color: 'var(--color-outline, #a6adc8)',
          fontFamily: 'var(--font-sans, system-ui)',
        }}
      >
        {t('loadingPlatform')}
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/repos" replace />;
  }

  return <AuthView onLoginSuccess={() => navigate('/repos')} />;
};

const AdminAuthRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useTranslation('common');
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'var(--color-surface, #1e1e2e)',
          color: 'var(--color-outline, #a6adc8)',
          fontFamily: 'var(--font-sans, system-ui)',
        }}
      >
        {t('loadingPlatform')}
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/repos" replace />;
  }

  return <AdminAuthView onLoginSuccess={() => navigate('/repos')} />;
};

const OrgRepoRedirect: React.FC = () => {
  const { org, repoName } = useParams<{ org: string; repoName: string }>();
  return <Navigate to={`/org/${encodeURIComponent(org || '')}/repo/${encodeURIComponent(repoName || '')}/editor`} replace />;
};

const RepoRedirect: React.FC = () => {
  const { repoName } = useParams<{ repoName: string }>();
  return <Navigate to={`/repo/${encodeURIComponent(repoName || '')}/editor`} replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WorkspaceProvider>
          <SecurityProvider>
            <AIProvider>
              <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Routes>
                  {/* Rotas de Autenticação Separadas */}
                  <Route path="/login" element={<CollaboratorAuthRoute />} />
                  <Route path="/admin" element={<AdminAuthRoute />} />
                  <Route path="/login/admin" element={<AdminAuthRoute />} />
                  <Route path="/auth" element={<Navigate to="/login" replace />} />

                  {/* Seleção de Repositórios */}
                  <Route
                    path="/repos"
                    element={
                      <ProtectedRoute>
                        <ReposView />
                      </ProtectedRoute>
                    }
                  />

                  {/* Rotas COM Organização: /org/:org/repo/:repoName */}
                  <Route
                    path="/org/:org/repo/:repoName"
                    element={
                      <ProtectedRoute>
                        <OrgRepoRedirect />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/org/:org/repo/:repoName/:subview"
                    element={
                      <ProtectedRoute>
                        <DashboardView />
                      </ProtectedRoute>
                    }
                  />

                  {/* Rotas SEM Organização (ou repositórios locais/pessoais): /repo/:repoName */}
                  <Route
                    path="/repo/:repoName"
                    element={
                      <ProtectedRoute>
                        <RepoRedirect />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/repo/:repoName/:subview"
                    element={
                      <ProtectedRoute>
                        <DashboardView />
                      </ProtectedRoute>
                    }
                  />

                  {/* Rota raiz e Fallback */}
                  <Route path="/" element={<Navigate to="/repos" replace />} />
                  <Route path="*" element={<Navigate to="/repos" replace />} />
                </Routes>
              </div>
            </AIProvider>
          </SecurityProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
