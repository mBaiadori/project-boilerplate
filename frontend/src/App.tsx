import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WorkspaceProvider, useWorkspace } from './context/WorkspaceContext';
import { AIProvider } from './context/AIContext';
import { AuthView } from './views/AuthView';
import { ReposView } from './views/ReposView';
import { DashboardView } from './views/DashboardView';

type Screen = 'auth' | 'repos' | 'dashboard';

const AppContent: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const { activeRepo, selectRepo } = useWorkspace();
  const [currentScreen, setCurrentScreen] = useState<Screen>('auth');

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      setCurrentScreen('auth');
    } else if (activeRepo) {
      setCurrentScreen('dashboard');
    } else {
      setCurrentScreen('repos');
    }
  }, [isAuthenticated, activeRepo, isLoading]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--color-surface)', color: 'var(--color-outline)' }}>
        Carregando Governance Platform...
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {currentScreen === 'auth' && (
        <AuthView onLoginSuccess={() => setCurrentScreen('repos')} />
      )}

      {currentScreen === 'repos' && (
        <ReposView
          onSelectRepo={async (repo) => {
            await selectRepo(repo);
            setCurrentScreen('dashboard');
          }}
        />
      )}

      {currentScreen === 'dashboard' && (
        <DashboardView
          onBackToRepos={() => {
            setCurrentScreen('repos');
          }}
        />
      )}
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <WorkspaceProvider>
        <AIProvider>
          <AppContent />
        </AIProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
};

export default App;
