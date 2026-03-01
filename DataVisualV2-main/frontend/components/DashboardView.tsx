import React, { useMemo, useState, useRef } from 'react';
import { Dashboard, DashboardWidget, Dataset, AIAnalysisResult, User, UserRole } from '../types';
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, XAxis, YAxis, Tooltip, CartesianGrid, Cell, Legend } from 'recharts';
import { Maximize2, MoreHorizontal, Sparkles, TrendingUp, AlertTriangle, Link as LinkIcon, Lightbulb, X, Plus, Trash2, Layout, BarChart3, PieChart as PieIcon, Table as TableIcon, Hash, Pencil, Check, Move, ArrowRightLeft, ArrowUp, ArrowDown, GripHorizontal, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Share2, Users } from 'lucide-react';
import { analyzeDataset } from '../services/geminiService';
import { api } from '../services/api';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Download, FileText, Image as ImageIcon, Database as DataIcon } from 'lucide-react';

interface DashboardViewProps {
  dashboards: Dashboard[];
  datasets: Dataset[];
  onCreateDashboard: (name: string, description: string) => void;
  onUpdateDashboard: (dashboard: Dashboard) => void;
  onDeleteDashboard: (id: string) => void;
  currentUser: User;
}
import { useDatasetContext } from '../context/DatasetContext';
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

// --- Sub-components ---

const ShareModal: React.FC<{
  dashboard: Dashboard;
  currentUser: User;
  onClose: () => void;
  onSuccess: (updated: Dashboard) => void;
}> = ({ dashboard, currentUser, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [accessLevel, setAccessLevel] = useState<'view' | 'edit'>('view');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleShare = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;
    setLoading(true);
    setError('');
    try {
      const updated = await api.dashboards.share(currentUser.id, dashboard.id, trimmedEmail, accessLevel);
      onSuccess(updated);
      setEmail('');
    } catch (e: any) {
      setError(e.message || 'Failed to share');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl flex flex-col p-6 overflow-hidden">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Share2 size={20} className="text-blue-500" />
            Share Dashboard
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-2">User Email</label>
            <input
              type="email"
              placeholder="colleague@company.com"
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Access Level</label>
            <select
              className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              value={accessLevel}
              onChange={e => setAccessLevel(e.target.value as any)}
            >
              <option value="view">Can View</option>
              <option value="edit">Can Edit</option>
            </select>
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="pt-4 flex space-x-3">
            <button onClick={onClose} className="flex-1 py-2 rounded border border-slate-700 text-slate-400 hover:text-white">Cancel</button>
            <button
              onClick={handleShare}
              disabled={loading || !email.trim()}
              className="flex-1 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? 'Sharing...' : 'Share'}
            </button>
          </div>

          {dashboard.sharedWith && dashboard.sharedWith.length > 0 && (
            <div className="mt-6 border-t border-slate-800 pt-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-3">Currently Shared With</h4>
              <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                {dashboard.sharedWith.map(s => (
                  <div key={s.userId} className="flex justify-between items-center bg-slate-800/50 p-2 rounded">
                    <span className="text-sm text-slate-300 truncate">{s.userId === currentUser.id ? 'You' : s.userId}</span>
                    <span className="text-[10px] bg-slate-700 text-slate-400 px-2 py-0.5 rounded uppercase">{s.accessLevel}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: string | number; change?: number }> = ({ title, value, change }) => (
  <div className="h-full flex flex-col justify-between">
    <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">{title}</h3>
    <div className="flex items-end space-x-2 mt-2">
      <span className="text-3xl font-bold text-white">{value}</span>
      {change && (
        <span className={`text-sm font-medium mb-1 ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
          {change > 0 ? '+' : ''}{change}%
        </span>
      )}
    </div>
  </div>
);

const WidgetRenderer: React.FC<{ widget: DashboardWidget; data: any[] }> = ({ widget, data }) => {
  const chartData = useMemo(() => {
    if (widget.type === 'metric') return data;

    // Group by xAxis if needed, otherwise return raw
    if (!widget.config.xAxis) return data;

    const grouped: Record<string, any> = {};
    data.forEach(row => {
      const key = row[widget.config.xAxis!];
      if (!grouped[key]) grouped[key] = { [widget.config.xAxis!]: key, [widget.config.dataKey!]: 0 };
      grouped[key][widget.config.dataKey!] += (Number(row[widget.config.dataKey!]) || 0);
    });
    return Object.values(grouped);
  }, [widget, data]);

  const totalValue = useMemo(() => {
    if (widget.type !== 'metric') return 0;
    // If no dataKey, assume it's a row count
    if (!widget.config.dataKey) return data.length;
    return data.reduce((sum, row) => sum + (Number(row[widget.config.dataKey!]) || 0), 0);
  }, [widget, data]);

  if (widget.type === 'metric') {
    return <MetricCard title={widget.title} value={totalValue.toLocaleString()} change={2.5} />;
  }

  if (widget.type === 'bar') {
    return (
      <div className="w-full h-full min-h-[100px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey={widget.config.xAxis} stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
              itemStyle={{ color: '#f8fafc' }}
            />
            <Bar dataKey={widget.config.dataKey!} fill={widget.config.color || '#3b82f6'} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (widget.type === 'line') {
    return (
      <div className="w-full h-full min-h-[100px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis dataKey={widget.config.xAxis} stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
              itemStyle={{ color: '#f8fafc' }}
            />
            <Line
              type="monotone"
              dataKey={widget.config.dataKey!}
              stroke={widget.config.color || '#3b82f6'}
              strokeWidth={3}
              dot={{ fill: '#1e293b', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (widget.type === 'pie') {
    return (
      <div className="w-full h-full min-h-[100px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey={widget.config.dataKey!}
              nameKey={widget.config.xAxis}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f8fafc' }}
              itemStyle={{ color: '#f8fafc' }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return <div className="text-gray-500">Widget type not supported</div>;
};

// --- Modals ---

const CreateDashboardModal: React.FC<{ onClose: () => void; onSave: (name: string, desc: string) => void }> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-96 shadow-2xl">
        <h3 className="text-xl font-bold text-white mb-4">New Dashboard</h3>
        <input
          autoFocus
          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Dashboard Name"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <textarea
          className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white mb-6 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          placeholder="Description"
          rows={3}
          value={desc}
          onChange={e => setDesc(e.target.value)}
        />
        <div className="flex justify-end space-x-3">
          <button onClick={onClose} className="text-slate-400 hover:text-white px-4 py-2">Cancel</button>
          <button
            disabled={!name.trim()}
            onClick={() => onSave(name, desc)}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
};

const ExpandedWidgetModal: React.FC<{
  widget: DashboardWidget;
  data: any[];
  onClose: () => void;
}> = ({ widget, data, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4 md:p-8">
      <div className="bg-slate-900 border border-slate-700 w-full h-full max-w-7xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in relative">
        <div className="absolute top-4 right-4 z-10">
          <button onClick={onClose} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-colors border border-slate-600">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 md:p-10 h-full flex flex-col">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-white">{widget.title}</h2>
            <p className="text-slate-400 mt-1">Full screen view</p>
          </div>
          <div className="flex-1 min-h-0 bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
            <WidgetRenderer widget={widget} data={data} />
          </div>
        </div>
      </div>
    </div>
  );
};

const WidgetBuilderModal: React.FC<{
  datasets: Dataset[];
  currentUser: User;
  initialWidget?: DashboardWidget;
  onClose: () => void;
  onSave: (widget: DashboardWidget) => void
}> = ({ datasets: allDatasets, currentUser, initialWidget, onClose, onSave }) => {
  // Filter datasets: only show ones the user's role can view
  const datasets = useMemo(() => {
    if (currentUser.role === UserRole.ADMIN) return allDatasets;
    return allDatasets.filter(ds => {
      const policy = ds.accessPolicies?.find(p => p.role === currentUser.role);
      return !policy || policy.canView; // default allow if no policy exists
    });
  }, [allDatasets, currentUser]);

  // Get restricted columns for the user's role on a given dataset
  const getRestrictedColumns = (ds: Dataset | undefined): string[] => {
    if (!ds || currentUser.role === UserRole.ADMIN) return [];
    const policy = ds.accessPolicies?.find(p => p.role === currentUser.role);
    return policy?.restrictedColumns || [];
  };
  const { activeDatasetId } = useDatasetContext();
  const [title, setTitle] = useState(initialWidget?.title || 'New Widget');
  const [type, setType] = useState<DashboardWidget['type']>(initialWidget?.type || 'bar');

  // Default to active dataset if available
  const defaultDsId = useMemo(() => {
    if (initialWidget?.datasetId) return initialWidget.datasetId;
    if (activeDatasetId && datasets.some(d => d.id === activeDatasetId)) return activeDatasetId;
    return datasets[0]?.id || '';
  }, [initialWidget, activeDatasetId, datasets]);

  const [datasetId, setDatasetId] = useState(defaultDsId);
  const [xAxis, setXAxis] = useState(initialWidget?.config.xAxis || '');
  const [dataKey, setDataKey] = useState(initialWidget?.config.dataKey || '');
  const [width, setWidth] = useState(initialWidget?.w || 4);
  const [height, setHeight] = useState(initialWidget?.h || 2);
  const [color, setColor] = useState(initialWidget?.config.color || '#3b82f6');

  const selectedDataset = datasets.find(d => d.id === datasetId);
  const restrictedCols = getRestrictedColumns(selectedDataset);
  const visibleColumns = useMemo(() => {
    if (!selectedDataset) return [];
    return selectedDataset.columns.filter(c => !restrictedCols.includes(c.name));
  }, [selectedDataset, restrictedCols]);

  const handleSave = () => {
    if (!selectedDataset) return;
    const widget: DashboardWidget = {
      id: initialWidget?.id || `w_${Date.now()}`,
      title,
      type,
      datasetId,
      config: {
        xAxis: ['bar', 'line', 'pie'].includes(type) ? xAxis : undefined,
        dataKey: ['bar', 'line', 'pie', 'metric'].includes(type) ? dataKey : undefined,
        color
      },
      w: width,
      h: type === 'metric' ? 1 : height
    };
    onSave(widget);
  };

  const chartTypes = [
    { id: 'bar', label: 'Bar Chart', icon: BarChart3 },
    { id: 'line', label: 'Line Chart', icon: TrendingUp },
    { id: 'pie', label: 'Pie Chart', icon: PieIcon },
    { id: 'metric', label: 'Metric', icon: Hash },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col md:flex-row overflow-hidden h-[85vh]">

        {/* Configuration Sidebar */}
        <div className="w-full md:w-1/3 bg-slate-950 border-r border-slate-800 p-6 flex flex-col overflow-y-auto">
          <h3 className="text-xl font-bold text-white mb-6">{initialWidget ? 'Edit Widget' : 'Add Widget'}</h3>

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Dataset</label>
              <select
                value={datasetId}
                onChange={e => { setDatasetId(e.target.value); setXAxis(''); setDataKey(''); }}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {datasets.map(ds => <option key={ds.id} value={ds.id}>{ds.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Chart Type</label>
              <div className="grid grid-cols-2 gap-2">
                {chartTypes.map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setType(t.id as any); if (t.id === 'metric') setHeight(1); }}
                    className={`flex flex-col items-center justify-center p-3 rounded border transition-all ${type === t.id
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}
                  >
                    <t.icon size={20} className="mb-1" />
                    <span className="text-xs">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Widget Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {selectedDataset && (
              <>
                {['bar', 'line', 'pie'].includes(type) && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Dimension (X-Axis)</label>
                    <select
                      value={xAxis}
                      onChange={e => setXAxis(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select Column</option>
                      {visibleColumns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                )}

                {['bar', 'line', 'pie', 'metric'].includes(type) && (
                  <div>
                    <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Metric (Y-Axis)</label>
                    <select
                      value={dataKey}
                      onChange={e => setDataKey(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select Numeric Column</option>
                      {visibleColumns.filter(c => c.type === 'number').map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}

            <div>
              <div className="flex justify-between mb-2">
                <label className="block text-xs font-medium text-slate-500 uppercase">Size</label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Width (1-12)</label>
                  <input
                    type="number" min="1" max="12"
                    value={width}
                    onChange={e => setWidth(Math.min(12, Math.max(1, parseInt(e.target.value) || 4)))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Height (1-4)</label>
                  <input
                    type="number" min="1" max="4"
                    value={height}
                    onChange={e => setHeight(Math.min(4, Math.max(1, parseInt(e.target.value) || 2)))}
                    className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white"
                  />
                </div>
              </div>
            </div>

            {['bar', 'line'].includes(type) && (
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Color</label>
                <div className="flex space-x-2">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full ${color === c ? 'ring-2 ring-white' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto pt-6 flex space-x-3">
            <button onClick={onClose} className="flex-1 py-2 rounded border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800">
              Cancel
            </button>
            <button onClick={handleSave} className="flex-1 py-2 rounded bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-900/20">
              {initialWidget ? 'Save Changes' : 'Add Widget'}
            </button>
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 bg-slate-900 p-8 flex flex-col overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Preview</h3>
          <div className="flex-1 flex items-center justify-center bg-slate-950/50 rounded-xl border border-slate-800 border-dashed p-4 min-h-[400px]">
            {selectedDataset && (xAxis || type === 'metric') && dataKey ? (
              <div className="w-full" style={{ maxWidth: `${(width / 12) * 100}%` }}>
                <div className={`bg-slate-800 border border-slate-700/50 rounded-xl p-5 shadow-sm flex flex-col transition-all duration-300 ${height === 1 ? 'h-32' : height === 2 ? 'h-64' : height === 3 ? 'h-96' : 'h-[32rem]'
                  }`}>
                  <h3 className="font-semibold text-slate-200 mb-4">{title}</h3>
                  <div className="flex-1 min-h-0">
                    <WidgetRenderer
                      widget={{
                        id: 'preview',
                        title,
                        type,
                        datasetId,
                        config: { xAxis, dataKey, color },
                        w: width,
                        h: height
                      }}
                      data={selectedDataset.data}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-slate-600 flex flex-col items-center">
                <Layout size={48} className="mb-4 opacity-20" />
                <p>Configure options to see preview</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const AnalysisModal: React.FC<{ result: AIAnalysisResult; onClose: () => void }> = ({ result, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="px-8 py-6 border-b border-slate-800 flex justify-between items-start bg-slate-900">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <Sparkles className="text-purple-500" size={24} />
              <h2 className="text-2xl font-bold text-white">AI Deep Analysis</h2>
            </div>
            <p className="text-slate-400">Powered by Gemini 2.0 Flash</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {/* Summary */}
          <div className="bg-gradient-to-br from-purple-900/20 to-blue-900/20 p-6 rounded-xl border border-purple-500/20">
            <h3 className="text-lg font-semibold text-white mb-3">Executive Summary</h3>
            <p className="text-slate-300 leading-relaxed">{result.summary}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Trends */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
              <h3 className="flex items-center text-lg font-semibold text-blue-400 mb-4">
                <TrendingUp className="mr-2" size={20} />
                Key Trends
              </h3>
              <ul className="space-y-4">
                {result.trends.map((trend, i) => (
                  <li key={i} className="group">
                    <div className="font-medium text-slate-200 mb-1 group-hover:text-blue-300 transition-colors">{trend.title}</div>
                    <div className="text-sm text-slate-400">{trend.description}</div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Anomalies */}
            <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
              <h3 className="flex items-center text-lg font-semibold text-orange-400 mb-4">
                <AlertTriangle className="mr-2" size={20} />
                Anomalies Detected
              </h3>
              <ul className="space-y-4">
                {result.anomalies.map((anomaly, i) => (
                  <li key={i} className="relative pl-4 border-l-2 border-slate-600">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-slate-200">{anomaly.title}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${anomaly.severity === 'high' ? 'bg-red-500/20 text-red-400' :
                        anomaly.severity === 'medium' ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>{anomaly.severity}</span>
                    </div>
                    <div className="text-sm text-slate-400">{anomaly.description}</div>
                  </li>
                ))}
                {result.anomalies.length === 0 && <li className="text-slate-500 italic">No significant anomalies detected.</li>}
              </ul>
            </div>
          </div>

          {/* Correlations */}
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
            <h3 className="flex items-center text-lg font-semibold text-green-400 mb-4">
              <LinkIcon className="mr-2" size={20} />
              Correlations
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {result.correlations.map((corr, i) => (
                <div key={i} className="bg-slate-900 p-4 rounded-lg border border-slate-700">
                  <div className="flex items-center space-x-2 text-sm text-slate-300 font-mono mb-2">
                    <span className="bg-slate-800 px-2 py-1 rounded">{corr.factor1}</span>
                    <span className="text-slate-600">↔</span>
                    <span className="bg-slate-800 px-2 py-1 rounded">{corr.factor2}</span>
                  </div>
                  <p className="text-sm text-slate-400">{corr.description}</p>
                </div>
              ))}
              {result.correlations.length === 0 && <p className="text-slate-500 italic">No strong correlations found.</p>}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-slate-800/50 p-6 rounded-xl border border-slate-700/50">
            <h3 className="flex items-center text-lg font-semibold text-yellow-400 mb-4">
              <Lightbulb className="mr-2" size={20} />
              Recommended Actions
            </h3>
            <ul className="space-y-3">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start text-slate-300 text-sm">
                  <span className="mr-3 text-yellow-500 mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Component ---

const DashboardView: React.FC<DashboardViewProps> = ({
  dashboards,
  datasets,
  currentUser,
  onCreateDashboard,
  onUpdateDashboard,
  onDeleteDashboard
}) => {
  const [activeDashboardId, setActiveDashboardId] = useState(dashboards[0]?.id);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);

  // Edit Mode State
  const [isEditMode, setIsEditMode] = useState(false);
  const [draggedWidgetIndex, setDraggedWidgetIndex] = useState<number | null>(null);
  const [expandedWidgetId, setExpandedWidgetId] = useState<string | null>(null);
  const [editingWidget, setEditingWidget] = useState<DashboardWidget | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const handleExportPDF = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0f172a' // match slate-900
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${currentDashboard?.name || 'dashboard'}.pdf`);
    } catch (e) {
      console.error('PDF Export Error:', e);
    }
    setIsExporting(false);
  };

  const handleExportPNG = async () => {
    if (!dashboardRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0f172a'
      });
      const link = document.createElement('a');
      link.download = `${currentDashboard?.name || 'dashboard'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('PNG Export Error:', e);
    }
    setIsExporting(false);
  };

  const handleExportCSV = async () => {
    if (!currentDashboard || currentDashboard.widgets.length === 0) return;
    setIsExporting(true);
    try {
      // For dashboard export, we'll export all data from the first widget's dataset
      // or a combined view. For now, let's export the first widget's data.
      const firstWidget = currentDashboard.widgets[0];
      const dataset = datasets.find(d => d.id === firstWidget.datasetId);
      if (!dataset) return;

      const token = localStorage.getItem('darwin_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch('/api/export/csv', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          data: dataset.data,
          filename: `${currentDashboard.name}_data`
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentDashboard.name}_data.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e) {
      console.error('CSV Export Error:', e);
    }
    setIsExporting(false);
  };

  // Ensure active dashboard exists (handle deletion case)
  const currentDashboard = dashboards.find(d => d.id === activeDashboardId) || dashboards[0];

  // Update active ID if current one was deleted or doesn't exist
  React.useEffect(() => {
    if (!dashboards.find(d => d.id === activeDashboardId) && dashboards.length > 0) {
      setActiveDashboardId(dashboards[0].id);
    }
  }, [dashboards, activeDashboardId]);

  const handleDeepAnalysis = async () => {
    if (!currentDashboard) return;
    setLoadingAnalysis(true);
    // Find dataset used in the first widget as a proxy for the context
    const mainDatasetId = currentDashboard.widgets[0]?.datasetId;
    const dataset = datasets.find(d => d.id === mainDatasetId);

    if (dataset) {
      const result = await analyzeDataset(dataset);
      setAnalysisResult(result);
    }
    setLoadingAnalysis(false);
  };

  const { activeDatasetId } = useDatasetContext();


  const handleCreateWidget = () => {
    // Default to active dataset if available, else first in list
    const defaultDsId = activeDatasetId && datasets.some(d => d.id === activeDatasetId)
      ? activeDatasetId
      : datasets[0]?.id || '';

    // Auto-detect columns for the selected dataset
    const selectedDs = datasets.find(d => d.id === defaultDsId);
    let defaultX = '';
    let defaultY = '';

    if (selectedDs && selectedDs.columns.length > 0) {
      defaultX = selectedDs.columns.find(c => c.type === 'string' || c.type === 'date')?.name || selectedDs.columns[0].name;
      defaultY = selectedDs.columns.find(c => c.type === 'number')?.name || selectedDs.columns[0].name;
    }

    const newWidget: DashboardWidget = {
      id: `w_${Date.now()}`,
      title: 'New Widget',
      type: 'bar', // Default
      datasetId: defaultDsId,
      config: {
        xAxis: defaultX,
        dataKey: defaultY,
        color: '#8b5cf6'
      },
      w: 6,
      h: 2
    };

    if (currentDashboard) {
      // ... existing ADD logic ...
      const updated = {
        ...currentDashboard,
        widgets: [...currentDashboard.widgets, newWidget]
      };
      onUpdateDashboard(updated);
      setActiveDashboardId(updated.id); // Refresh view
    }
  };

  const handleSaveWidget = (widget: DashboardWidget) => {
    if (!currentDashboard) return;

    let newWidgets;
    const existingIndex = currentDashboard.widgets.findIndex(w => w.id === widget.id);

    if (existingIndex >= 0) {
      // Update existing
      newWidgets = [...currentDashboard.widgets];
      newWidgets[existingIndex] = widget;
    } else {
      // Add new
      newWidgets = [...currentDashboard.widgets, widget];
    }

    const updatedDashboard = {
      ...currentDashboard,
      widgets: newWidgets
    };
    onUpdateDashboard(updatedDashboard);
    setShowWidgetModal(false);
    setEditingWidget(null);
  };

  const handleDeleteWidget = (widgetId: string) => {
    if (!currentDashboard) return;
    const updatedDashboard = {
      ...currentDashboard,
      widgets: currentDashboard.widgets.filter(w => w.id !== widgetId)
    };
    onUpdateDashboard(updatedDashboard);
  };

  const handleResizeWidget = (widgetId: string, deltaW: number, deltaH: number) => {
    if (!currentDashboard) return;
    const updatedDashboard = {
      ...currentDashboard,
      widgets: currentDashboard.widgets.map(w => {
        if (w.id === widgetId) {
          const newW = Math.max(1, Math.min(12, w.w + deltaW));
          const newH = Math.max(1, Math.min(4, w.h + deltaH));
          return { ...w, w: newW, h: newH };
        }
        return w;
      })
    };
    onUpdateDashboard(updatedDashboard);
  };

  const handleDragStart = (index: number) => {
    setDraggedWidgetIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDrop = (targetIndex: number) => {
    if (draggedWidgetIndex === null || draggedWidgetIndex === targetIndex || !currentDashboard) return;

    const newWidgets = [...currentDashboard.widgets];
    const draggedWidget = newWidgets[draggedWidgetIndex];

    // Remove dragged widget
    newWidgets.splice(draggedWidgetIndex, 1);
    // Insert at target index
    newWidgets.splice(targetIndex, 0, draggedWidget);

    const updatedDashboard = {
      ...currentDashboard,
      widgets: newWidgets
    };

    onUpdateDashboard(updatedDashboard);
    setDraggedWidgetIndex(null);
  };

  const expandedWidget = useMemo(() => {
    if (!expandedWidgetId || !currentDashboard) return null;
    const widget = currentDashboard.widgets.find(w => w.id === expandedWidgetId);
    if (!widget) return null;
    const dataset = datasets.find(d => d.id === widget.datasetId);
    return { widget, dataset };
  }, [expandedWidgetId, currentDashboard, datasets]);

  const getHeightClass = (h: number) => {
    switch (h) {
      case 1: return 'h-32';
      case 2: return 'h-64';
      case 3: return 'h-96';
      case 4: return 'h-[32rem]';
      default: return 'h-64';
    }
  };

  return (
    <div className="flex h-full overflow-hidden bg-slate-900">

      {/* Dashboard Sidebar */}
      <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Dashboards</span>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
            title="Create New Dashboard"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 flex flex-col gap-6">
          {/* My Dashboards Section */}
          <div className="px-2">
            <div className="px-3 mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">My Dashboards</span>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
                {dashboards.filter(d => !d.ownerId || d.ownerId === currentUser.id).length}
              </span>
            </div>
            <div className="space-y-1">
              {[...dashboards]
                .filter(d => !d.ownerId || d.ownerId === currentUser.id)
                .sort((a, b) => b.id.localeCompare(a.id))
                .map(d => (
                  <div
                    key={d.id}
                    onClick={() => setActiveDashboardId(d.id)}
                    className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 ${currentDashboard?.id === d.id
                      ? 'bg-blue-600/10 text-blue-400 shadow-sm'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                      }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <Layout size={16} className={currentDashboard?.id === d.id ? 'text-blue-500' : 'text-slate-500'} />
                      <span className="truncate text-sm font-medium">{d.name}</span>
                    </div>
                    {dashboards.length > 1 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm(`Are you sure you want to delete "${d.name}"?`)) onDeleteDashboard(d.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all"
                        title="Delete Dashboard"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Shared With Me Section */}
          <div className="px-2">
            <div className="px-3 mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={12} className="text-blue-500" />
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-widest">Shared With Me</span>
              </div>
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">
                {dashboards.filter(d => d.ownerId && d.ownerId !== currentUser.id && d.sharedWith?.some(s => s.userId === currentUser.id)).length}
              </span>
            </div>
            <div className="space-y-1">
              {dashboards.filter(d => d.ownerId && d.ownerId !== currentUser.id && d.sharedWith?.some(s => s.userId === currentUser.id)).length > 0 ? (
                [...dashboards]
                  .filter(d => d.ownerId && d.ownerId !== currentUser.id && d.sharedWith?.some(s => s.userId === currentUser.id))
                  .sort((a, b) => b.id.localeCompare(a.id))
                  .map(d => (
                    <div
                      key={d.id}
                      onClick={() => setActiveDashboardId(d.id)}
                      className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 ${currentDashboard?.id === d.id
                        ? 'bg-blue-600/10 text-blue-400 shadow-sm border border-blue-600/20'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200 border border-transparent'
                        }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <Share2 size={16} className={currentDashboard?.id === d.id ? 'text-blue-500' : 'text-slate-500'} />
                        <span className="truncate text-sm font-medium">{d.name}</span>
                      </div>
                      <div className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-bold transition-opacity ${currentDashboard?.id === d.id ? 'bg-blue-600/20 text-blue-300' : 'bg-slate-800 text-slate-500 opacity-0 group-hover:opacity-100'
                        }`}>
                        {d.sharedWith?.find(s => s.userId === currentUser.id)?.accessLevel || 'view'}
                      </div>
                    </div>
                  ))
              ) : (
                <div className="px-3 py-6 text-center bg-slate-900/30 rounded-lg border border-dashed border-slate-800 mx-1">
                  <p className="text-[10px] text-slate-600 italic">No shared dashboards</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Modals */}
        {analysisResult && <AnalysisModal result={analysisResult} onClose={() => setAnalysisResult(null)} />}
        {showCreateModal && <CreateDashboardModal onClose={() => setShowCreateModal(false)} onSave={(n, d) => { onCreateDashboard(n, d); setShowCreateModal(false); }} />}
        {showShareModal && currentDashboard && (
          <ShareModal
            dashboard={currentDashboard}
            currentUser={currentUser}
            onClose={() => setShowShareModal(false)}
            onSuccess={(updated) => { onUpdateDashboard(updated); setShowShareModal(false); }}
          />
        )}
        {(showWidgetModal || editingWidget) && (
          <WidgetBuilderModal
            datasets={datasets}
            currentUser={currentUser}
            initialWidget={editingWidget || undefined}
            onClose={() => { setShowWidgetModal(false); setEditingWidget(null); }}
            onSave={handleSaveWidget}
          />
        )}
        {expandedWidget && expandedWidget.dataset && (
          <ExpandedWidgetModal
            widget={expandedWidget.widget}
            data={expandedWidget.dataset.data}
            onClose={() => setExpandedWidgetId(null)}
          />
        )}

        {/* Dashboard Content */}
        {currentDashboard ? (
          <div ref={dashboardRef} className="flex-1 overflow-y-auto p-8 space-y-8 bg-slate-900">
            {/* Header */}
            <div className="flex justify-between items-end border-b border-slate-800 pb-6">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">{currentDashboard.name}</h1>
                <p className="text-slate-400">{currentDashboard.description}</p>
              </div>
              <div className="flex space-x-3">
                {currentDashboard && (
                  (currentDashboard.ownerId === currentUser.id || currentDashboard.sharedWith?.find(s => s.userId === currentUser.id)?.accessLevel === 'edit')
                ) && (
                    <button
                      onClick={() => setIsEditMode(!isEditMode)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors border ${isEditMode
                        ? 'bg-green-600 hover:bg-green-500 text-white border-green-500'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                        }`}
                    >
                      {isEditMode ? <Check size={18} /> : <Pencil size={18} />}
                      <span>{isEditMode ? 'Done Editing' : 'Edit Layout'}</span>
                    </button>
                  )}

                {!isEditMode && (
                  <>
                    <div className="relative group">
                      <button
                        className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-slate-700"
                        disabled={isExporting}
                      >
                        <Download size={18} className={isExporting ? 'animate-bounce' : ''} />
                        <span>{isExporting ? 'Exporting...' : 'Export'}</span>
                        <ChevronDown size={16} />
                      </button>
                      <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30">
                        <button onClick={handleExportPDF} className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-300 flex items-center space-x-2 rounded-t-lg">
                          <FileText size={16} /> <span>Download PDF</span>
                        </button>
                        <button onClick={handleExportPNG} className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-300 flex items-center space-x-2">
                          <ImageIcon size={16} /> <span>Export Image</span>
                        </button>
                        <button onClick={handleExportCSV} className="w-full text-left px-4 py-2 hover:bg-slate-700 text-slate-300 flex items-center space-x-2 rounded-b-lg">
                          <DataIcon size={16} /> <span>Export CSV Data</span>
                        </button>
                      </div>
                    </div>

                    {currentDashboard.ownerId === currentUser.id && (
                      <button
                        onClick={() => setShowShareModal(true)}
                        className="flex items-center space-x-2 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 px-4 py-2 rounded-lg font-medium transition-colors border border-blue-600/30"
                      >
                        <Share2 size={18} />
                        <span>Share</span>
                      </button>
                    )}

                    {(currentDashboard.ownerId === currentUser.id || currentDashboard.sharedWith?.find(s => s.userId === currentUser.id)?.accessLevel === 'edit') && (
                      <button
                        onClick={() => setShowWidgetModal(true)}
                        className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors border border-slate-700"
                      >
                        <Plus size={18} />
                        <span>Add Widget</span>
                      </button>
                    )}
                    <button
                      onClick={handleDeepAnalysis}
                      disabled={loadingAnalysis || currentDashboard.widgets.length === 0}
                      className={`flex items-center space-x-2 text-white px-5 py-2.5 rounded-lg font-medium transition-all shadow-lg ${loadingAnalysis ? 'bg-slate-700 opacity-70 cursor-wait' : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:scale-105 shadow-purple-900/30 disabled:opacity-50 disabled:grayscale'}`}
                    >
                      <Sparkles size={18} className={loadingAnalysis ? 'animate-spin' : ''} />
                      <span>{loadingAnalysis ? 'Analyzing...' : 'Deep Analysis'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Grid Layout */}
            {currentDashboard.widgets.length > 0 ? (
              <div className="grid grid-cols-12 gap-6">
                {currentDashboard.widgets.map((widget, index) => {
                  const dataset = datasets.find(d => d.id === widget.datasetId);

                  // Access control: check if user can view this dataset and if widget uses restricted columns
                  const widgetPolicy = dataset?.accessPolicies?.find(p => p.role === currentUser.role);
                  const widgetRestricted = widgetPolicy?.restrictedColumns || [];
                  const isDatasetRestricted = widgetPolicy && !widgetPolicy.canView;
                  const usesRestrictedCol = widgetRestricted.includes(widget.config.dataKey || '') || widgetRestricted.includes(widget.config.xAxis || '');

                  // Filter restricted columns from data
                  const filteredData = dataset && !isDatasetRestricted
                    ? dataset.data.map(row => {
                      if (currentUser.role === UserRole.ADMIN || widgetRestricted.length === 0) return row;
                      const filtered = { ...row };
                      widgetRestricted.forEach(col => delete filtered[col]);
                      return filtered;
                    })
                    : [];

                  // Drag Handlers
                  const onDragStart = (e: React.DragEvent) => {
                    if (!isEditMode) return;
                    handleDragStart(index);
                    e.dataTransfer.effectAllowed = "move";
                  };

                  const onDrop = (e: React.DragEvent) => {
                    if (!isEditMode) return;
                    handleDrop(index);
                  };

                  return (
                    <div
                      key={widget.id}
                      draggable={isEditMode}
                      onDragStart={onDragStart}
                      onDragOver={handleDragOver}
                      onDrop={onDrop}
                      className={`
                        relative rounded-xl shadow-sm col-span-12 md:col-span-${widget.w} 
                        ${getHeightClass(widget.h)}
                        ${isEditMode ? 'border-2 border-dashed border-slate-500 bg-slate-800/80 cursor-move' : 'bg-slate-800 border border-slate-700/50'}
                        transition-all duration-200
                        ${draggedWidgetIndex === index ? 'opacity-50' : 'opacity-100'}
                      `}
                    >
                      {isEditMode && (
                        <div className="absolute inset-0 z-20 pointer-events-none border-2 border-transparent hover:border-blue-500/50 rounded-xl transition-colors">
                          {/* Controls Overlay (Pointer Events Enabled) */}
                          <div className="absolute top-2 left-2 pointer-events-auto bg-slate-900/90 rounded p-1 shadow-lg text-slate-400">
                            <GripHorizontal size={20} />
                          </div>

                          <div className="absolute top-2 right-2 pointer-events-auto flex space-x-1">
                            <button
                              onClick={() => setEditingWidget(widget)}
                              className="bg-blue-500/20 hover:bg-blue-500 text-blue-500 hover:text-white p-1.5 rounded transition-colors"
                            >
                              <Pencil size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteWidget(widget.id)}
                              className="bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white p-1.5 rounded transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          <div className="absolute bottom-2 right-2 pointer-events-auto flex items-center space-x-2 bg-slate-900/90 rounded-lg p-1.5 border border-slate-700 shadow-xl backdrop-blur-md">
                            <div className="flex flex-col items-center border-r border-slate-700 pr-2 mr-1">
                              <span className="text-[9px] text-slate-500 uppercase font-bold">Width</span>
                              <div className="flex items-center space-x-1">
                                <button onClick={() => handleResizeWidget(widget.id, -1, 0)} className="hover:text-white text-slate-400"><ChevronLeft size={16} /></button>
                                <span className="text-xs font-mono w-4 text-center">{widget.w}</span>
                                <button onClick={() => handleResizeWidget(widget.id, 1, 0)} className="hover:text-white text-slate-400"><ChevronRight size={16} /></button>
                              </div>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-[9px] text-slate-500 uppercase font-bold">Height</span>
                              <div className="flex items-center space-x-1">
                                <button onClick={() => handleResizeWidget(widget.id, 0, -1)} className="hover:text-white text-slate-400"><ChevronUp size={16} /></button>
                                <span className="text-xs font-mono w-4 text-center">{widget.h}</span>
                                <button onClick={() => handleResizeWidget(widget.id, 0, 1)} className="hover:text-white text-slate-400"><ChevronDown size={16} /></button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {!dataset || isDatasetRestricted ? (
                        <div className="flex items-center justify-center h-full text-red-400">
                          {isDatasetRestricted ? 'Access restricted' : 'Dataset missing'}
                        </div>
                      ) : usesRestrictedCol ? (
                        <div className="flex items-center justify-center h-full text-orange-400 text-sm">
                          <AlertTriangle size={16} className="mr-2" /> This widget uses a restricted column
                        </div>
                      ) : (
                        <div className={`p-5 h-full flex flex-col ${isEditMode ? 'opacity-60 blur-[1px]' : ''}`}>
                          {!['metric'].includes(widget.type) && (
                            <div className="flex justify-between items-center mb-4 flex-shrink-0">
                              <h3 className="font-semibold text-slate-200">{widget.title}</h3>
                              <Maximize2
                                size={16}
                                className="text-slate-500 hover:text-slate-300 cursor-pointer transition-colors"
                                onClick={() => setExpandedWidgetId(widget.id)}
                              />
                            </div>
                          )}
                          <div className="flex-1 min-h-0 w-full">
                            <WidgetRenderer widget={widget} data={filteredData} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-slate-500 border-2 border-dashed border-slate-800 rounded-xl">
                <Layout size={48} className="mb-4 opacity-50" />
                <p className="text-lg font-medium">This dashboard is empty</p>
                <button
                  onClick={() => setShowWidgetModal(true)}
                  className="mt-4 text-blue-500 hover:underline"
                >
                  Add your first widget
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-white">
            <p>No dashboards available. Create one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;