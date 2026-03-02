import React from 'react';
import { UserRole, ViewState, User } from '../types';
import { LayoutDashboard, Database, FileText, Settings, BookOpen, LogOut, Users, Workflow } from 'lucide-react';

interface SidebarProps {
  currentUser?: User | null;
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  onLogout: () => void;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ currentUser, currentView, onChangeView, onLogout, className }) => {
  const navItems = [
    { id: 'dashboard' as ViewState, label: 'Dashboards', icon: LayoutDashboard },
    { id: 'sql' as ViewState, label: 'Editor', icon: Database },
    { id: 'catalog' as ViewState, label: 'Data Catalog', icon: FileText },
    { id: 'schema' as ViewState, label: 'Schema', icon: Workflow },
    { id: 'knowledge' as ViewState, label: 'Knowledge Base', icon: BookOpen },
    { id: 'settings' as ViewState, label: 'Settings', icon: Settings },
  ];

  if (currentUser?.role === UserRole.ADMIN) {
    navItems.push({ id: 'users' as ViewState, label: 'User Management', icon: Users });
  }

  return (
    <div className={`flex flex-col h-full bg-slate-950 border-r border-slate-800 text-slate-400 ${className}`}>
      <div className="p-6 flex items-center space-x-3">
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-lg">D</span>
        </div>
        <span className="text-white font-bold text-xl tracking-tight">DarwinVisualize</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onChangeView(item.id)}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${currentView === item.id
              ? 'bg-primary-600/10 text-primary-500 border border-primary-600/20 shadow-sm shadow-blue-900/20'
              : 'hover:bg-slate-900 hover:text-slate-200'
              }`}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 text-slate-400 hover:text-red-400 transition-colors"
        >
          <LogOut size={20} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;