import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';
import { AIProvider } from './context/AIContext';
import { AuthView } from './views/AuthView';
import { ReposView } from './views/ReposView';
import { DashboardView } from './views/DashboardView';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

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
        Carregando Governance Platform...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const AuthRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
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
          fontFamily: 'var(--font-sans, system-ui)'
        }}
      >
        Carregando Governance Platform...
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/repos" replace />;
  }

  return <AuthView onLoginSuccess={() => navigate('/repos')} />;
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
          <AIProvider>
            <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Routes>
                {/* Rotas de Autenticação */}
                <Route path="/login" element={<AuthRoute />} />
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

                {/* Redirecionamento de /repo/:repoName para o Editor padrão */}
                <Route
                  path="/repo/:repoName"
                  element={
                    <ProtectedRoute>
                      <RepoRedirect />
                    </ProtectedRoute>
                  }
                />

                {/* Dashboard com subviews: editor, dictionary, wiki, templates, prs, settings */}
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
        </WorkspaceProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
