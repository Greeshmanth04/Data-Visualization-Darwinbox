import React, { useState, useEffect, useMemo } from 'react';
import { Dataset, AIAnalysisResult, UserRole, AccessPolicy, User } from '../types';
import { Search, Database, Table, Calendar, Type, Hash, Shield, Sparkles, X, Check, Lock, Unlock, Eye, EyeOff, AlertTriangle, Upload, Trash2, Plus, ChevronDown, CheckCircle2 } from 'lucide-react';
import { analyzeDataset } from '../services/geminiService';
import { api } from '../services/api';
import { useDatasetContext } from '../context/DatasetContext';
interface DataCatalogProps {
  datasets: Dataset[];
  currentUser: User | null;
  onUpdateDataset?: (dataset: Dataset) => void;
  onRefreshDatasets?: () => void;
}

const AccessControlModal: React.FC<{
  dataset: Dataset;
  onClose: () => void;
  onSave: (policies: AccessPolicy[]) => void
}> = ({ dataset, onClose, onSave }) => {
  // Initialize with existing policies or defaults
  const [policies, setPolicies] = useState<AccessPolicy[]>(
    dataset.accessPolicies || [
      { role: UserRole.ADMIN, canView: true, canEdit: true, restrictedColumns: [] },
      { role: UserRole.ANALYST, canView: true, canEdit: false, restrictedColumns: [] },
      { role: UserRole.VIEWER, canView: true, canEdit: false, restrictedColumns: [] },
    ]
  );

  const handleToggleView = (roleIndex: number) => {
    const newPolicies = [...policies];
    newPolicies[roleIndex].canView = !newPolicies[roleIndex].canView;
    setPolicies(newPolicies);
  };

  const handleToggleEdit = (roleIndex: number) => {
    const newPolicies = [...policies];
    newPolicies[roleIndex].canEdit = !newPolicies[roleIndex].canEdit;
    setPolicies(newPolicies);
  };

  const handleToggleColumnRestriction = (roleIndex: number, colName: string) => {
    const newPolicies = [...policies];
    const restricted = newPolicies[roleIndex].restrictedColumns;
    if (restricted.includes(colName)) {
      newPolicies[roleIndex].restrictedColumns = restricted.filter(c => c !== colName);
    } else {
      newPolicies[roleIndex].restrictedColumns = [...restricted, colName];
    }
    setPolicies(newPolicies);
  };

  const [expandedRole, setExpandedRole] = useState<UserRole | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Shield className="text-blue-500" size={20} />
              Access Control
            </h2>
            <p className="text-slate-400 text-sm mt-1">Manage permissions for <span className="text-blue-400">{dataset.name}</span></p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Role</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase text-center">View</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase text-center">Edit</th>
                <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Column Security</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {policies.map((policy, idx) => (
                <tr key={policy.role} className="hover:bg-slate-800/30">
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-2">
                      <span className={`w-2 h-2 rounded-full ${policy.role === UserRole.ADMIN ? 'bg-purple-500' : policy.role === UserRole.ANALYST ? 'bg-blue-500' : 'bg-green-500'}`}></span>
                      <span className="font-medium text-slate-200">{policy.role}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button
                      onClick={() => handleToggleView(idx)}
                      className={`p-1.5 rounded transition-colors ${policy.canView ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-600'}`}
                    >
                      {policy.canView ? <Check size={16} /> : <X size={16} />}
                    </button>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <button
                      onClick={() => handleToggleEdit(idx)}
                      className={`p-1.5 rounded transition-colors ${policy.canEdit ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-800 text-slate-600'}`}
                    >
                      {policy.canEdit ? <Check size={16} /> : <X size={16} />}
                    </button>
                  </td>
                  <td className="py-4 px-4">
                    <div className="relative">
                      <button
                        onClick={() => setExpandedRole(expandedRole === policy.role ? null : policy.role)}
                        className="flex items-center justify-between w-full bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-xs text-slate-300 border border-slate-700 transition-colors"
                      >
                        <span>
                          {policy.restrictedColumns.length === 0
                            ? 'All Columns Visible'
                            : `${policy.restrictedColumns.length} Hidden Columns`}
                        </span>
                        {policy.restrictedColumns.length > 0 ? <EyeOff size={12} className="text-red-400 ml-2" /> : <Eye size={12} className="text-green-400 ml-2" />}
                      </button>

                      {/* Dropdown for Columns */}
                      {expandedRole === policy.role && (
                        <div className="absolute z-10 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl p-2 left-0 top-full">
                          <div className="text-[10px] uppercase text-slate-500 font-bold mb-2 px-2">Uncheck to Hide</div>
                          <div className="max-h-48 overflow-y-auto space-y-1">
                            {dataset.columns.map(col => {
                              const isHidden = policy.restrictedColumns.includes(col.name);
                              return (
                                <div key={col.name}
                                  onClick={() => handleToggleColumnRestriction(idx, col.name)}
                                  className="flex items-center space-x-2 px-2 py-1.5 hover:bg-slate-700 rounded cursor-pointer"
                                >
                                  <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isHidden ? 'border-slate-500 bg-transparent' : 'border-blue-500 bg-blue-500'}`}>
                                    {!isHidden && <Check size={10} className="text-white" />}
                                  </div>
                                  <span className={`text-sm ${isHidden ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{col.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm font-medium">
            Cancel
          </button>
          <button onClick={() => onSave(policies)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 text-sm font-medium transition-colors">
            Save Permissions
          </button>
        </div>
      </div>
    </div>
  );
};

const DataSourceModal: React.FC<{
  onClose: () => void;
  onSuccess: (dataset: Dataset) => void;
}> = ({ onClose, onSuccess }) => {
  const [step, setStep] = useState<'type' | 'config' | 'dbSelect' | 'preview'>('type');
  const [sourceType, setSourceType] = useState<'mongodb' | 'mysql' | 'postgres' | 'custom-sql' | null>(null);
  const [config, setConfig] = useState<any>({});
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datasetName, setDatasetName] = useState('');

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (sourceType === 'mongodb') {
        const res = await api.datasets.listMongoDBDatabases(config.uri);
        setDatabases(res.databases);
        setStep('dbSelect');
      } else if (sourceType === 'mysql' || sourceType === 'postgres') {
        const res = await api.datasets.connectSQL({ ...config, type: sourceType });
        setTables(res.tables);
        setStep('preview');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDatabase = async (dbName: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.datasets.listMongoDBCollections(config.uri, dbName);
      setConfig({ ...config, database: dbName });
      setCollections(res.collections);
      setStep('preview');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreview = async () => {
    setIsLoading(true);
    setError(null);
    try {
      let data: any[] = [];
      if (sourceType === 'custom-sql') {
        const res = await api.datasets.querySQL({ ...config, type: config.dbType });
        data = res.data;
      } else if (sourceType === 'mongodb') {
        const res = await api.datasets.previewMongoDB(config.uri, config.database, config.collection);
        data = res.data;
      } else {
        const query = `SELECT * FROM ${config.table} LIMIT 10`;
        const res = await api.datasets.querySQL({ ...config, type: sourceType, query });
        data = res.data;
      }
      setPreviewData(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // Auto-detect columns
      const firstRow = previewData[0] || {};
      const columns: any[] = Object.keys(firstRow).map(key => {
        const value = firstRow[key];
        let type: 'string' | 'number' | 'boolean' | 'date' = 'string';
        if (typeof value === 'number') type = 'number';
        else if (typeof value === 'boolean') type = 'boolean';
        return { name: key, type, description: key };
      });

      const newDataset = await api.datasets.createExternal({
        name: datasetName || `${sourceType} Dataset`,
        description: `External data source from ${sourceType}`,
        sourceType: sourceType as any,
        connectionConfig: config,
        sourceMetadata: config.table || config.collection || config.query,
        columns,
        data: previewData
      });
      onSuccess(newDataset);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
        <div className="px-6 py-5 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Database className="text-blue-500" size={20} />
            Add Data Source
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-8 overflow-y-auto max-h-[70vh]">
          {step === 'type' && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { id: 'mongodb', name: 'MongoDB', icon: <Database /> },
                { id: 'mysql', name: 'MySQL', icon: <Database /> },
                { id: 'postgres', name: 'PostgreSQL', icon: <Database /> },
                { id: 'custom-sql', name: 'Custom SQL Query', icon: <Plus /> },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSourceType(t.id as any); setStep('config'); }}
                  className="flex flex-col items-center justify-center p-6 border border-slate-800 rounded-xl hover:bg-blue-600/10 hover:border-blue-500 transition-all group"
                >
                  <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-500/20 group-hover:text-blue-400 transition-colors">
                    {t.icon}
                  </div>
                  <span className="text-slate-200 font-medium">{t.name}</span>
                </button>
              ))}
            </div>
          )}

          {step === 'config' && (
            <div className="space-y-4">
              <button onClick={() => setStep('type')} className="text-blue-400 text-sm flex items-center gap-1 mb-2">
                <ChevronDown size={14} className="rotate-90" /> Back
              </button>

              {sourceType === 'mongodb' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">MongoDB Connection URI</label>
                  <input
                    type="text"
                    placeholder="mongodb+srv://..."
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none"
                    value={config.uri || ''}
                    onChange={e => setConfig({ ...config, uri: e.target.value })}
                  />
                </div>
              ) : (sourceType === 'mysql' || sourceType === 'postgres') ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-400 mb-1">Host</label>
                    <input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" value={config.host || ''} onChange={e => setConfig({ ...config, host: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Port</label>
                    <input type="number" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" value={config.port || (sourceType === 'mysql' ? 3306 : 5432)} onChange={e => setConfig({ ...config, port: parseInt(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Database</label>
                    <input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" value={config.database || ''} onChange={e => setConfig({ ...config, database: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Username</label>
                    <input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" value={config.user || ''} onChange={e => setConfig({ ...config, user: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Password</label>
                    <input type="password" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" value={config.password || ''} onChange={e => setConfig({ ...config, password: e.target.value })} />
                  </div>
                </div>
              ) : sourceType === 'custom-sql' ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Database Type</label>
                      <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" onChange={e => setConfig({ ...config, dbType: e.target.value })}>
                        <option value="mysql">MySQL</option>
                        <option value="postgres">PostgreSQL</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-400 mb-1">Host</label>
                      <input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" onChange={e => setConfig({ ...config, host: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">SQL Query</label>
                    <textarea rows={5} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white font-mono text-sm" placeholder="SELECT * FROM table ..." value={config.query || ''} onChange={e => setConfig({ ...config, query: e.target.value })} />
                  </div>
                </div>
              ) : null}

              {error && <div className="text-red-400 text-sm flex items-center gap-2"><AlertTriangle size={14} /> {error}</div>}

              <button
                onClick={sourceType === 'custom-sql' ? handlePreview : handleConnect}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {sourceType === 'custom-sql' ? 'Preview Results' : 'Connect & Fetch Metadata'}
              </button>
            </div>
          )}

          {step === 'dbSelect' && (
            <div className="space-y-4">
              <button onClick={() => setStep('config')} className="text-blue-400 text-sm flex items-center gap-1 mb-2">
                <ChevronDown size={14} className="rotate-90" /> Back
              </button>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">Select Database</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-2">
                  {databases.map(db => (
                    <button key={db} onClick={() => handleSelectDatabase(db)} className="text-left px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 hover:border-blue-500 hover:bg-blue-500/10 transition-all text-sm truncate">
                      {db}
                    </button>
                  ))}
                  {databases.length === 0 && <div className="col-span-2 text-slate-500 text-sm py-4 text-center">No databases found</div>}
                </div>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <button onClick={() => setStep(sourceType === 'mongodb' ? 'dbSelect' : 'config')} className="text-blue-400 text-sm flex items-center gap-1 mb-2">
                <ChevronDown size={14} className="rotate-90" /> Back
              </button>

              {sourceType === 'mongodb' ? (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-sm font-medium text-slate-400">Select Collection</label>
                    <span className="text-xs text-blue-400">Database: {config.database}</span>
                  </div>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" value={config.collection || ''} onChange={e => setConfig({ ...config, collection: e.target.value })}>
                    <option value="">Choose a collection...</option>
                    {collections.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              ) : (sourceType === 'mysql' || sourceType === 'postgres') ? (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Select Table</label>
                  <select className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" value={config.table || ''} onChange={e => setConfig({ ...config, table: e.target.value })}>
                    <option value="">Choose a table...</option>
                    {tables.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              ) : null}

              {(config.collection || config.table || sourceType === 'custom-sql') && (
                <button
                  onClick={handlePreview}
                  disabled={isLoading}
                  className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 font-medium py-2 rounded-lg transition-colors border border-blue-500/30 flex items-center justify-center gap-2"
                >
                  {isLoading && <div className="w-4 h-4 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />}
                  Fetch Preview Data (All Documents)
                </button>
              )}

              {previewData.length > 0 && (
                <div className="space-y-4">
                  <div className="border border-slate-800 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800 text-slate-400">
                        <tr>{Object.keys(previewData[0]).map(k => <th key={k} className="px-3 py-2">{k}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {previewData.slice(0, 10).map((r, i) => (
                          <tr key={i} className="text-slate-300">
                            {Object.values(r).map((v: any, j) => <td key={j} className="px-3 py-2 truncate max-w-[100px]">{String(v)}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewData.length > 10 && <div className="px-3 py-1 bg-slate-800/50 text-[10px] text-slate-500">Showing first 10 of {previewData.length} documents</div>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-1">Dataset Name</label>
                    <input type="text" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white" placeholder="My Enterprise Dataset" value={datasetName} onChange={e => setDatasetName(e.target.value)} />
                  </div>
                  <button onClick={handleSave} disabled={isLoading || !datasetName} className="w-full bg-green-600 hover:bg-green-500 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                    {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Save Dataset
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DataCatalog: React.FC<DataCatalogProps> = ({ datasets, currentUser, onUpdateDataset, onRefreshDatasets }) => {
  const { activeDatasetId, setActiveDatasetId } = useDatasetContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(datasets[0] || null);
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showDataSourceModal, setShowDataSourceModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Helper to safely render values (handles objects/arrays from MongoDB)
  const renderValue = (val: any) => {
    if (val === null || val === undefined) return "";
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch (e) {
        return "[Complex Object]";
      }
    }
    return String(val);
  };

  // Sync selectedDataset when datasets prop updates
  useEffect(() => {
    if (selectedDataset) {
      const updated = datasets.find(d => d.id === selectedDataset.id);
      if (updated) setSelectedDataset(updated);
    }
  }, [datasets]);

  // Reset analysis when dataset changes
  useEffect(() => {
    setAnalysis(null);
  }, [selectedDataset?.id]);

  const filteredDatasets = datasets.filter(d =>
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAnalyze = async () => {
    if (!selectedDataset) return;
    setIsAnalyzing(true);
    const result = await analyzeDataset(selectedDataset);
    setAnalysis(result);
    setIsAnalyzing(false);
  }

  const handleSavePermissions = (newPolicies: AccessPolicy[]) => {
    if (!selectedDataset || !onUpdateDataset) return;

    const updatedDataset = {
      ...selectedDataset,
      accessPolicies: newPolicies
    };

    onUpdateDataset(updatedDataset);
    setShowAccessModal(false);
  };

  const getIconForType = (type: string) => {
    switch (type) {
      case 'number': return <Hash size={14} className="text-green-500" />;
      case 'date': return <Calendar size={14} className="text-orange-500" />;
      default: return <Type size={14} className="text-blue-500" />;
    }
  };

  // --- Access Control Logic ---
  const currentUserPolicy = useMemo(() => {
    if (!selectedDataset || !currentUser) return null;
    return selectedDataset.accessPolicies?.find(p => p.role === currentUser.role);
  }, [selectedDataset, currentUser]);

  const canViewDataset = currentUserPolicy ? currentUserPolicy.canView : true; // Default true if policy missing
  const restrictedColumns = currentUserPolicy ? currentUserPolicy.restrictedColumns : [];
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const visibleColumns = useMemo(() => {
    if (!selectedDataset) return [];
    return selectedDataset.columns.filter(c => !restrictedColumns.includes(c.name));
  }, [selectedDataset, restrictedColumns]);

  return (
    <div className="flex h-full bg-slate-900 text-slate-200 relative">
      {/* Access Control Modal */}
      {showAccessModal && selectedDataset && isAdmin && (
        <AccessControlModal
          dataset={selectedDataset}
          onClose={() => setShowAccessModal(false)}
          onSave={handleSavePermissions}
        />
      )}

      {showDataSourceModal && (
        <DataSourceModal
          onClose={() => setShowDataSourceModal(false)}
          onSuccess={(ds) => {
            setShowDataSourceModal(false);
            onRefreshDatasets?.();
          }}
        />
      )}

      {/* Sidebar List */}
      <div className="w-1/3 border-r border-slate-800 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Data Catalog</h2>

            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium flex items-center space-x-1 shadow-lg shadow-blue-900/20 transition-colors"
                >
                  <Plus size={14} />
                  <span>Add Data Source</span>
                  <ChevronDown size={14} className={`transition-transform ${showAddMenu ? 'rotate-180' : ''}`} />
                </button>

                {showAddMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden animate-fade-in">
                    <label className="flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700 cursor-pointer">
                      <Upload size={14} className="text-blue-400" />
                      <span>Upload CSV/JSON</span>
                      <input
                        type="file"
                        accept=".csv,.json,.xlsx,.xls"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setShowAddMenu(false);
                          try {
                            await api.datasets.upload(file);
                            onRefreshDatasets?.();
                          } catch (err: any) {
                            alert("Upload failed: " + err.message);
                          }
                        }}
                      />
                    </label>
                    <button
                      onClick={() => { setShowDataSourceModal(true); setShowAddMenu(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                    >
                      <Database size={14} className="text-green-400" />
                      <span>Connect Database</span>
                    </button>
                    <button
                      onClick={() => { setShowDataSourceModal(true); setShowAddMenu(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-slate-300 hover:bg-slate-700"
                    >
                      <Plus size={14} className="text-purple-400" />
                      <span>Custom SQL Query</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search datasets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredDatasets.map(ds => (
            <div
              key={ds.id}
              onClick={() => {
                setSelectedDataset(ds);
                setActiveDatasetId(ds.id);
              }}
              className={`p-4 border-b border-slate-800 cursor-pointer transition-colors group ${activeDatasetId === ds.id ? 'bg-blue-900/20 border-l-2 border-l-blue-500' : 'hover:bg-slate-800/50 border-l-2 border-l-transparent'}`}
            >
              <div className="flex justify-between items-start mb-1">
                <h3 className={`font-medium text-sm truncate pr-2 ${activeDatasetId === ds.id ? 'text-blue-400' : 'text-slate-200'}`}>{ds.name}</h3>
                {isAdmin && !['sales_2024', 'users_prod'].includes(ds.id) && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`Delete dataset "${ds.name}"?`)) {
                        try {
                          await api.datasets.delete(ds.id);
                          onRefreshDatasets?.();
                        } catch (err) {
                          alert("Failed to delete: " + err.message);
                        }
                      }
                    }}
                    className="text-slate-500 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
                    title="Delete Dataset"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500 line-clamp-2 mb-2">{ds.description}</p>
              <div className="flex items-center space-x-3 mt-2">
                <div className="flex items-center space-x-1 text-[10px] text-slate-500">
                  <Table size={12} />
                  <span>{ds.data.length} Rows</span>
                </div>
                {ds.source && (
                  <div className="flex items-center space-x-1 text-[10px] text-slate-500">
                    <Database size={12} />
                    <span>{ds.source}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div >


      {/* Detail View */}
      < div className="flex-1 overflow-y-auto bg-slate-950 p-8" >
        {
          selectedDataset ? (
            canViewDataset ? (
              <div className="max-w-4xl mx-auto">
                <div className="flex items-start justify-between mb-8">
                  <div>
                    <div className="flex items-center space-x-3 mb-2">
                      <Table size={24} className="text-blue-500" />
                      <h1 className="text-3xl font-bold text-white">{selectedDataset.name}</h1>
                    </div>
                    <p className="text-slate-400 text-lg">{selectedDataset.description}</p>
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="flex items-center space-x-2 text-white bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded-lg transition-colors shadow-lg shadow-purple-900/20 disabled:opacity-50"
                    >
                      <Sparkles size={16} className={isAnalyzing ? 'animate-spin' : ''} />
                      <span>{isAnalyzing ? 'Scanning...' : 'AI Profile'}</span>
                    </button>
                    {isAdmin && (
                      <button
                        onClick={() => setShowAccessModal(true)}
                        className="flex items-center space-x-2 text-slate-400 hover:text-white border border-slate-700 hover:bg-slate-800 px-4 py-2 rounded-lg transition-colors"
                      >
                        <Shield size={16} />
                        <span>Access Controls</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* AI Analysis Result Section (Inline) */}
                {analysis && (
                  <div className="mb-8 bg-slate-900 border border-purple-500/30 rounded-xl overflow-hidden animate-fade-in relative">
                    <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-purple-400 font-semibold flex items-center">
                          <Sparkles size={16} className="mr-2" />
                          Dataset Intelligence Profile
                        </h3>
                        <button onClick={() => setAnalysis(null)} className="text-slate-500 hover:text-white">
                          <X size={18} />
                        </button>
                      </div>

                      <p className="text-slate-300 text-sm mb-6 leading-relaxed">{analysis.summary}</p>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                          <div className="text-xs font-semibold text-blue-400 uppercase mb-2">Dominant Trends</div>
                          <ul className="text-sm text-slate-400 space-y-2">
                            {analysis.trends.slice(0, 3).map((t, i) => (
                              <li key={i}>• {t.title}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                          <div className="text-xs font-semibold text-orange-400 uppercase mb-2">Detected Anomalies</div>
                          <ul className="text-sm text-slate-400 space-y-2">
                            {analysis.anomalies.slice(0, 3).map((a, i) => (
                              <li key={i}>• {a.title} ({a.severity})</li>
                            ))}
                            {analysis.anomalies.length === 0 && <li>None detected</li>}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Schema Table */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden mb-8">
                  <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                    <h3 className="font-semibold text-slate-200">Schema Definition</h3>
                    {restrictedColumns.length > 0 && (
                      <span className="text-xs text-orange-400 flex items-center">
                        <EyeOff size={12} className="mr-1" />
                        {restrictedColumns.length} columns hidden by policy
                      </span>
                    )}
                  </div>
                  <table className="w-full text-left">
                    <thead className="bg-slate-950">
                      <tr>
                        <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Column Name</th>
                        <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Type</th>
                        <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {visibleColumns.length > 0 ? (
                        visibleColumns.map(col => (
                          <tr key={col.name} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-6 py-4 font-mono text-sm text-blue-300">{col.name}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center space-x-2 text-sm text-slate-400">
                                {getIconForType(col.type)}
                                <span>{col.type}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-sm text-slate-400">{col.description}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                            No visible columns.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Sample Data Preview */}
                <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-800 bg-slate-900">
                    <h3 className="font-semibold text-slate-200">Data Preview (Top 5 Rows)</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left whitespace-nowrap">
                      <thead className="bg-slate-950">
                        <tr>
                          {visibleColumns.map(col => (
                            <th key={col.name} className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{col.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {visibleColumns.length > 0 ? (
                          selectedDataset.data.slice(0, 5).map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/30">
                              {visibleColumns.map(col => (
                                <td key={col.name} className="px-6 py-3 text-sm text-slate-300">
                                  {renderValue(row[col.name])}
                                </td>
                              ))}
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={visibleColumns.length || 1} className="px-6 py-8 text-center text-slate-500">
                              No data available.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 animate-fade-in">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                  <Lock size={32} className="text-red-500" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
                <p className="max-w-md text-center">
                  You do not have permission to view the <span className="text-white font-medium">{selectedDataset.name}</span> dataset.
                  Please contact your administrator if you believe this is an error.
                </p>
              </div>
            )
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              Select a dataset to view details
            </div>
          )}
      </div >
    </div >
  );
};

export default DataCatalog;