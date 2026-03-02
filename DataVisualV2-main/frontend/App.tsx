import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import Editor from './components/SQLEditor';
import DataCatalog from './components/DataCatalog';
import KnowledgeBase from './components/KnowledgeBase';
import AuthView from './components/AuthView';
import UserManagement from './components/UserManagement';
import SchemaView from './components/SchemaView';
import { ViewState, Dataset, Dashboard, User } from './types';
import { api, getToken, removeToken } from './services/api';
import { DatasetProvider } from './context/DatasetContext';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [loading, setLoading] = useState(true);

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);

  // Fetch Data on Load
  const fetchData = () => {
    if (!user) return;
    api.datasets.getAll().then(setDatasets);
    api.dashboards.getAll(user.id).then(data => {
      setDashboards(data);
    });
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Check for existing session via JWT token
  useEffect(() => {
    const token = getToken();
    if (token) {
      // Validate token by calling /api/auth/me
      api.auth.me()
        .then((userData) => {
          setUser(userData);
        })
        .catch(() => {
          // Token invalid/expired — clear everything
          removeToken();
          localStorage.removeItem('darwin_session');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      // No token — try localStorage session fallback (mock mode)
      const session = localStorage.getItem('darwin_session');
      if (session) {
        try {
          setUser(JSON.parse(session));
        } catch (e) {
          localStorage.removeItem('darwin_session');
        }
      }
      setLoading(false);
    }
  }, []);

  const handleLogin = (loggedInUser: User) => {
    setUser(loggedInUser);
  };

  const handleLogout = () => {
    removeToken();
    localStorage.removeItem('darwin_session');
    setUser(null);
    setCurrentView('dashboard');
  };

  const handleUpdateDataset = async (updatedDataset: Dataset) => {
    try {
      const saved = await api.datasets.update(updatedDataset);
      setDatasets(prev => prev.map(d => d.id === saved.id ? saved : d));
    } catch (e) {
      console.error("Failed to update dataset", e);
    }
  };

  const handleCreateDashboard = async (name: string, description: string) => {
    if (!user) return;
    const newDash: Partial<Dashboard> = {
      id: `dash_${Date.now()}`,
      name,
      description,
      widgets: []
    };
    try {
      const saved = await api.dashboards.create(user.id, newDash);
      setDashboards(prev => [...prev, saved]);
    } catch (e) { console.error(e); }
  };

  const handleUpdateDashboard = async (updatedDashboard: Dashboard) => {
    if (!user) return;
    try {
      const saved = await api.dashboards.update(user.id, updatedDashboard);
      setDashboards(prev => prev.map(d => d.id === saved.id ? saved : d));
    } catch (e) { console.error(e); }
  };

  const handleDeleteDashboard = async (id: string) => {
    if (!user) return;
    try {
      await api.dashboards.delete(user.id, id);
      setDashboards(prev => prev.filter(d => d.id !== id));
    } catch (e) { console.error(e); }
  };

  const renderContent = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <DashboardView
            dashboards={dashboards}
            datasets={datasets}
            currentUser={user!}
            onCreateDashboard={handleCreateDashboard}
            onUpdateDashboard={handleUpdateDashboard}
            onDeleteDashboard={handleDeleteDashboard}
          />
        );
      case 'sql':
        return <Editor datasets={datasets} />;
      case 'catalog':
        return <DataCatalog datasets={datasets} currentUser={user} onUpdateDataset={handleUpdateDataset} onRefreshDatasets={fetchData} />;
      case 'knowledge':
        return <KnowledgeBase datasets={datasets} />;
      case 'users':
        return <UserManagement />;
      case 'schema':
        return <SchemaView datasets={datasets} onUpdateDataset={handleUpdateDataset} onAddDataset={(ds) => setDatasets(prev => [...prev, ds])} />;
      case 'settings':
        return (
          <div className="flex items-center justify-center h-full text-slate-500 bg-slate-900">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-300 mb-2">Settings</h2>
              <div className="p-6 bg-slate-800 rounded-lg border border-slate-700 max-w-md mx-auto text-left">
                <div className="flex items-center gap-4 mb-4 border-b border-slate-700 pb-4">
                  <img src={user?.avatar} alt={user?.name} className="w-12 h-12 rounded-full bg-slate-700" />
                  <div>
                    <h3 className="text-white font-medium">{user?.name}</h3>
                    <p className="text-sm text-slate-400 flex items-center gap-2">
                      {user?.email}
                    </p>
                    <p className="text-xs text-blue-400 capitalize mt-1 border border-blue-500/30 bg-blue-500/10 inline-block px-2 py-0.5 rounded">{user?.role}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-400">User ID: <span className="font-mono text-xs bg-slate-900 px-1 py-0.5 rounded">{user?.id}</span></p>
              </div>
            </div>
          </div>
        );
      default:
        return <div>Not found</div>;
    }
  };

  // Show loading state while checking token validity
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen w-full bg-slate-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView onLogin={handleLogin} />;
  }

  return (
    <DatasetProvider>
      <div className="flex h-screen w-full bg-slate-900 overflow-hidden">
        <Sidebar
          currentUser={user}
          currentView={currentView}
          onChangeView={setCurrentView}
          onLogout={handleLogout}
          className="w-64 flex-shrink-0"
        />
        <main className="flex-1 h-full overflow-hidden relative">
          {renderContent()}
        </main>
      </div>
    </DatasetProvider>
  );
};

export default App;