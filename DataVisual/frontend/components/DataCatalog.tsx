import React, { useState, useEffect, useMemo } from 'react';
import { Dataset, UserRole, AccessPolicy, User, RowPolicy } from '../types';
import { Search, Database, Table, Calendar, Type, Hash, Shield, X, Check, Lock, Eye, EyeOff, AlertTriangle, Upload, Trash2, Plus, ChevronDown, CheckCircle2, Zap, Clock, LayoutDashboard, RefreshCw, Layers, Edit2, Save } from 'lucide-react';
import { api } from '../services/api';
import { useDatasetContext } from '../context/DatasetContext';

interface DataCatalogProps {
  datasets: Dataset[];
  currentUser: User | null;
  onUpdateDataset?: (dataset: Dataset) => Promise<void> | void;
  onRefreshDatasets?: () => void;
  onRefreshDashboards?: () => void;
  onAddDataset?: (dataset: Dataset) => void;
}

const AccessControlModal: React.FC<{
  dataset: Dataset;
  onClose: () => void;
  onSave: (accessPolicies: AccessPolicy[], rowPolicies: RowPolicy[]) => void
}> = ({ dataset, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState<'columns' | 'rows'>('columns');

  // Column Access Policies
  const [policies, setPolicies] = useState<AccessPolicy[]>(
    dataset.accessPolicies || [
      { role: UserRole.ADMIN, canView: true, canEdit: true, restrictedColumns: [] },
      { role: UserRole.ANALYST, canView: true, canEdit: false, restrictedColumns: [] },
      { role: UserRole.VIEWER, canView: true, canEdit: false, restrictedColumns: [] },
    ]
  );

  // Row Access Policies
  const [rowPolicies, setRowPolicies] = useState<RowPolicy[]>(dataset.rowPolicies ? [...dataset.rowPolicies] : []);
  const emptyPolicy = (): RowPolicy => ({ role: UserRole.ANALYST, column: '', operator: 'eq', value: '', combine: 'AND' });

  const handleToggleView = (roleIndex: number) => {
    const newPolicies = [...policies];
    newPolicies[roleIndex].canView = !newPolicies[roleIndex].canView;
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

  const OPERATORS: { value: RowPolicy['operator']; label: string }[] = [
    { value: 'eq', label: '= equals' },
    { value: 'neq', label: '≠ not equals' },
    { value: 'contains', label: '∋ contains' },
    { value: 'gt', label: '> greater than' },
    { value: 'lt', label: '< less than' },
    { value: 'gte', label: '≥ greater or equal' },
    { value: 'lte', label: '≤ less or equal' },
  ];

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

        {/* Tabs */}
        <div className="px-6 py-3 border-b border-slate-800 flex gap-4 bg-slate-900/50">
          <button
            onClick={() => setActiveTab('columns')}
            className={`text-sm font-medium pb-2 border-b-2 transition-all ${activeTab === 'columns' ? 'text-blue-400 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
          >
            Column Security
          </button>
          <button
            onClick={() => setActiveTab('rows')}
            className={`text-sm font-medium pb-2 border-b-2 transition-all ${activeTab === 'rows' ? 'text-blue-400 border-blue-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
          >
            Row Policies
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'columns' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Role</th>
                  <th className="py-3 px-4 text-xs font-semibold text-slate-500 uppercase text-center">View</th>
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
                                    <span className={`text-sm ${isHidden ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{col.displayName || col.name}</span>
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
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 px-4 py-3 bg-blue-900/20 border border-blue-500/30 rounded-xl text-blue-200 text-xs">
                <Shield className="shrink-0 mt-0.5 text-blue-400" size={14} />
                <p><strong>ADMIN</strong> always sees all rows. Policies only apply to <strong>ANALYST</strong> and <strong>VIEWER</strong> roles. Multiple policies for the same role are combined using AND/OR logic.</p>
              </div>

              {rowPolicies.length === 0 ? (
                <div className="py-8 text-center text-slate-600 border border-dashed border-slate-800 rounded-xl">
                  <p className="text-sm">No row policies defined. All roles see all rows.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {rowPolicies.map((p, i) => (
                    <div key={i} className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Role</label>
                          <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" value={p.role}
                            onChange={e => { const c = [...rowPolicies]; c[i] = { ...c[i], role: e.target.value as UserRole }; setRowPolicies(c); }}>
                            {[UserRole.ANALYST, UserRole.VIEWER].map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                        {i > 0 && (
                          <div>
                            <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Combine</label>
                            <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" value={p.combine || 'AND'}
                              onChange={e => { const c = [...rowPolicies]; c[i] = { ...c[i], combine: e.target.value as 'AND' | 'OR' }; setRowPolicies(c); }}>
                              <option value="AND">AND</option>
                              <option value="OR">OR</option>
                            </select>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Column</label>
                          <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" value={p.column}
                            onChange={e => { const c = [...rowPolicies]; c[i] = { ...c[i], column: e.target.value }; setRowPolicies(c); }}>
                            <option value="">— Pick column —</option>
                            {dataset.columns.map(c => <option key={c.name} value={c.name}>{c.displayName || c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Operator</label>
                          <select className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" value={p.operator}
                            onChange={e => { const c = [...rowPolicies]; c[i] = { ...c[i], operator: e.target.value as RowPolicy['operator'] }; setRowPolicies(c); }}>
                            {OPERATORS.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] uppercase text-slate-500 font-bold block mb-1">Value</label>
                          <input className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" type="text"
                            value={String(p.value)}
                            onChange={e => { const c = [...rowPolicies]; c[i] = { ...c[i], value: e.target.value }; setRowPolicies(c); }} />
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <button onClick={() => setRowPolicies(rp => rp.filter((_, idx) => idx !== i))}
                          className="text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition-colors">
                          <Trash2 size={12} /> Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={() => setRowPolicies(rp => [...rp, emptyPolicy()])}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-dashed border-slate-700 hover:border-blue-500/50 text-slate-500 hover:text-blue-400 text-sm transition-all bg-slate-800/20">
                <Plus size={14} /> Add Row Policy
              </button>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-900 border-t border-slate-800 flex justify-end space-x-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm font-medium">
            Cancel
          </button>
          <button onClick={() => onSave(policies, rowPolicies)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 text-sm font-medium transition-colors">
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
  const [sourceType, setSourceType] = useState<'mongodb' | 'mysql' | 'postgres' | null>(null);
  const [config, setConfig] = useState<any>({});
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [databases, setDatabases] = useState<string[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [datasetName, setDatasetName] = useState('');
  const [cacheResult, setCacheResult] = useState<any | null>(null);
  const [saveResult, setSaveResult] = useState<any | null>(null);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (sourceType === 'mongodb') {
        const res = await api.datasets.listMongoDBDatabases(config.uri);
        setDatabases(res.databases);
        setStep('dbSelect');
      } else if (sourceType === 'mysql' || sourceType === 'postgres') {
        const res = await api.datasets.connectSQL({ uri: config.uri, type: sourceType });
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
      if (sourceType === 'mongodb') {
        const res = await api.datasets.previewMongoDB(config.uri, config.database, config.collection);
        data = res.data;
      } else {
        const query = `SELECT * FROM ${config.table} LIMIT 10`;
        const res = await api.datasets.querySQL({ uri: config.uri, type: sourceType, query });
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
    if (!datasetName.trim()) { setError('Please enter a dataset name'); return; }
    setIsLoading(true);
    setError(null);
    try {
      const firstRow = previewData[0] || {};
      const columns: any[] = Object.keys(firstRow).map(key => {
        const value = firstRow[key];
        let type: 'string' | 'number' | 'boolean' | 'date' = 'string';
        if (typeof value === 'number') type = 'number';
        else if (typeof value === 'boolean') type = 'boolean';
        return { name: key, type, description: key };
      });
      const newDataset = await api.datasets.createExternal({
        name: datasetName,
        description: `External data source from ${sourceType}`,
        sourceType: sourceType as any,
        connectionConfig: config,
        sourceMetadata: config.table || config.collection || config.query,
        columns,
        data: previewData
      });
      setSaveResult(newDataset);
      onSuccess(newDataset);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCache = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload: any = { sourceType, uri: config.uri, limit: 1000, ttl: 3600 };
      if (sourceType === 'mongodb') {
        payload.database = config.database;
        payload.collection = config.collection;
      } else {
        payload.table = config.table;
      }
      const result = await api.cache.store(payload);
      setCacheResult(result);
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
                  <p className="text-xs text-slate-500 mt-2">Connecting to collections automatically targets default database parsing.</p>
                </div>
              ) : (sourceType === 'mysql' || sourceType === 'postgres') ? (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">Connection String URI</label>
                  <input
                    type="text"
                    placeholder={sourceType === 'mysql' ? "mysql://user:pass@host:port/db" : "postgres://user:pass@host:port/db?sslmode=require"}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white outline-none font-mono text-sm"
                    value={config.uri || ''}
                    onChange={e => setConfig({ ...config, uri: e.target.value })}
                  />
                  <p className="text-xs text-slate-500 mt-2">All credentials are <b>AES-256 encrypted</b> before server persistence.</p>
                </div>
              ) : null}

              {error && <div className="text-red-400 text-sm flex items-center gap-2"><AlertTriangle size={14} /> {error}</div>}

              <button
                onClick={handleConnect}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                Connect & Fetch Metadata
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

              {(config.collection || config.table) && (
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
                  {/* Data preview table */}
                  <div className="border border-slate-800 rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800 text-slate-400 sticky top-0">
                        <tr>{Object.keys(previewData[0]).map(k => <th key={k} className="px-3 py-2">{k}</th>)}</tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {previewData.slice(0, 10).map((r, i) => (
                          <tr key={i} className="text-slate-300">
                            {Object.values(r).map((v: any, j) => <td key={j} className="px-3 py-2 truncate max-w-[100px]">{String(v ?? '')}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewData.length > 10 && <div className="px-3 py-1 bg-slate-800/50 text-[10px] text-slate-500">Showing first 10 of {previewData.length} rows</div>}
                  </div>

                  {/* Storage choice */}
                  {!cacheResult && !saveResult && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-400 font-medium text-center">Choose how to store this data:</p>

                      {/* Option A: Save to MongoDB Dataset */}
                      <div className="border border-slate-700 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-slate-300 font-medium text-sm">
                          <Database size={15} className="text-blue-400" />
                          Save to MongoDB Dataset
                          <span className="ml-auto text-[10px] text-slate-500 font-normal">Permanent storage</span>
                        </div>
                        <input
                          type="text"
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Dataset name *"
                          value={datasetName}
                          onChange={e => setDatasetName(e.target.value)}
                        />
                        <button
                          onClick={handleSave}
                          disabled={isLoading || !datasetName.trim()}
                          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                          {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Database size={14} />}
                          Save to Dataset Collection
                        </button>
                      </div>

                      {/* OR divider */}
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-slate-800" />
                        <span className="text-[10px] text-slate-600">OR</span>
                        <div className="flex-1 h-px bg-slate-800" />
                      </div>

                      {/* Option B: Cache in Redis */}
                      <div className="border border-slate-700 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2 text-slate-300 font-medium text-sm">
                          <Zap size={15} className="text-emerald-400" />
                          Cache in Memory (Redis)
                          <span className="ml-auto text-[10px] text-slate-500 font-normal">1h TTL · Fast access</span>
                        </div>
                        <button
                          onClick={handleCache}
                          disabled={isLoading}
                          className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                          {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Zap size={14} />}
                          Cache &amp; Use (No MongoDB Storage)
                        </button>
                      </div>
                    </div>
                  )}

                  {/* MongoDB save success */}
                  {saveResult && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 space-y-2 animate-fade-in">
                      <div className="flex items-center gap-2 text-blue-400 font-semibold text-sm">
                        <CheckCircle2 size={16} /> Saved to Dataset Collection
                      </div>
                      <div className="text-xs text-slate-400">Dataset: <span className="text-blue-300">{saveResult.name}</span></div>
                      <button onClick={onClose} className="w-full mt-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 rounded-lg transition-colors text-sm">
                        Done — View in Datasets tab
                      </button>
                    </div>
                  )}

                  {/* Cache success */}
                  {cacheResult && (
                    <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-2 animate-fade-in">
                      <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">
                        <CheckCircle2 size={16} /> Cached — {cacheResult.rowCount} rows stored
                      </div>
                      <div className="text-xs text-slate-400 font-mono break-all">Key: <span className="text-green-300">{cacheResult.cacheKey}</span></div>
                      <div className="text-xs text-slate-500">TTL: {cacheResult.ttl}s · Source: {cacheResult.sourceName}</div>
                      <button onClick={onClose} className="w-full mt-2 bg-green-600 hover:bg-green-500 text-white font-medium py-2 rounded-lg transition-colors text-sm">
                        Done — View in Cached Datasets tab
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};



// ─── Cached Datasets Panel ───────────────────────────────────────────────────
const SOURCE_COLORS: Record<string, string> = {
  mongodb: 'bg-green-500/20 text-green-400 border-green-500/30',
  mysql: 'bg-blue-500/20  text-blue-400  border-blue-500/30',
  postgres: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  merged: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  join: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
};

const CachedDatasetsPanel: React.FC<{
  currentUser: User | null;
  searchTerm: string;
  onCreateDashboard: () => void;
}> = ({ currentUser, searchTerm, onCreateDashboard }) => {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewEntry, setPreviewEntry] = useState<any | null>(null);
  const [previewData, setPreviewData] = useState<{ rows: any[]; columns: any[] } | null>(null);

  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.cache.list();
      setEntries(list);
    } catch (e: any) {
      setError(e.message || 'Failed to load cache entries');
      setEntries([]);
    }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const filteredEntries = useMemo(() => {
    if (!searchTerm) return entries;
    const t = searchTerm.toLowerCase();
    return entries.filter(e =>
      e.sourceName.toLowerCase().includes(t) ||
      e.sourceType.toLowerCase().includes(t) ||
      e.key.toLowerCase().includes(t)
    );
  }, [entries, searchTerm]);

  const handleClear = async (key: string) => {
    if (!confirm('Evict this cached dataset?')) return;
    try { await api.cache.clear(key); load(); } catch (e: any) { alert(e.message); }
  };

  const handlePreview = async (entry: any) => {
    setPreviewEntry(entry);
    try {
      const payload = await api.cache.getData(entry.key);
      setPreviewData(payload);
    } catch (e: any) { alert('Failed to load preview: ' + e.message); }
  };

  const formatTTL = (secs: number) => {
    if (secs < 0) return 'Expired';
    if (secs < 60) return `${secs}s`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m`;
    return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  };

  return (
    <div className="flex flex-col h-full">

      {/* Preview Modal */}
      {previewEntry && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="font-bold text-white">{previewEntry.sourceName} — Preview</h3>
              <button onClick={() => { setPreviewEntry(null); setPreviewData(null); }} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-800 sticky top-0">
                  <tr>{previewData.columns.map((c: any) => <th key={c.name} className="px-4 py-2 text-slate-400 font-medium">{c.name}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {previewData.rows.slice(0, 50).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-800/30">
                      {previewData.columns.map((c: any) => (
                        <td key={c.name} className="px-4 py-2 text-slate-300 truncate max-w-[140px]">
                          {row[c.name] !== undefined && row[c.name] !== null ? String(row[c.name]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-3 border-t border-slate-800 text-xs text-slate-500">
              Showing up to 50 of {previewData.rows.length} rows
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <Layers size={15} className="text-emerald-400" />
          Cached Datasets
        </h3>
        <button onClick={load} disabled={loading} className="text-slate-400 hover:text-white transition-colors" title="Refresh">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
        {loading && (
          <div className="p-6 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
            <RefreshCw size={14} className="animate-spin" />
            Loading cache…
          </div>
        )}
        {!loading && error && (
          <div className="p-6 text-center text-red-400 text-sm bg-red-900/10 border-y border-red-900/20">
            <AlertTriangle size={20} className="mx-auto mb-2 opacity-50" />
            <p>{error}</p>
            <button onClick={load} className="mt-2 text-xs text-red-300 hover:underline">Retry</button>
          </div>
        )}
        {!loading && !error && filteredEntries.length === 0 && (
          <div className="p-8 text-center">
            <Zap size={28} className="mx-auto text-slate-700 mb-2" />
            <p className="text-slate-500 text-sm">{searchTerm ? 'No matches found.' : 'No cached datasets yet.'}</p>
            {!searchTerm && (
              <p className="text-slate-600 text-xs mt-1">Use "Add Data Source → Connect Database" and click <b>Cache & Use</b>.</p>
            )}
          </div>
        )}
        {filteredEntries.map(entry => (
          <div key={entry.key} className="p-4 hover:bg-slate-800/40 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-slate-200 text-sm font-medium truncate">{entry.sourceName}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] px-2 py-0.5 rounded border font-medium ${SOURCE_COLORS[entry.sourceType] || 'bg-slate-800 text-slate-400 border-slate-700'}`}>
                    {entry.sourceType}
                  </span>
                  <span className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Table size={10} />{entry.rowCount.toLocaleString()} rows
                  </span>
                  <span className="text-[10px] text-amber-500/80 flex items-center gap-1">
                    <Clock size={10} />{formatTTL(entry.ttl)}
                  </span>
                </div>
              </div>
              <button onClick={() => handleClear(entry.key)} className="text-slate-600 hover:text-red-400 transition-colors p-1" title="Evict cache">
                <Trash2 size={13} />
              </button>
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => handlePreview(entry)}
                className="w-full text-xs py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors flex items-center justify-center gap-1"
              >
                <Eye size={12} /> Preview
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const DataCatalog: React.FC<DataCatalogProps> = ({ datasets, currentUser, onUpdateDataset, onRefreshDatasets, onRefreshDashboards, onAddDataset }) => {

  const [activeTab, setActiveTab] = useState<'datasets' | 'cached'>('datasets');
  const { activeDatasetId, setActiveDatasetId } = useDatasetContext();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(datasets[0] || null);

  const [showAccessModal, setShowAccessModal] = useState(false);
  const [showDataSourceModal, setShowDataSourceModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Column Metadata Edits
  const [editingColumnName, setEditingColumnName] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editType, setEditType] = useState('');
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  // Helper to safely render values (handles objects/arrays from MongoDB)
  const renderValue = React.useCallback((val: any) => {
    if (val === null || val === undefined) return "";
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val);
      } catch (e) {
        return "[Complex Object]";
      }
    }
    return String(val);
  }, []);

  useEffect(() => {
    if (selectedDataset) {
      const updated = datasets.find(d => d.id === selectedDataset.id);
      if (updated) setSelectedDataset(updated);
    }
  }, [datasets]);

  const filteredDatasets = useMemo(() => {
    return datasets.filter(d =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [datasets, searchTerm]);



  const handleSavePermissions = async (accessPolicies: AccessPolicy[], rowPolicies: RowPolicy[]) => {
    if (!selectedDataset) return;
    try {
      // 1. Update general dataset metadata (including accessPolicies)
      await api.datasets.update({ ...selectedDataset, accessPolicies });

      // 2. Update dedicated row policies (ADMIN only)
      if (currentUser?.role === UserRole.ADMIN) {
        await api.datasets.updateRowPolicies(selectedDataset.id, rowPolicies);
      }

      onRefreshDatasets?.(); // Refresh the list to show updated policies
      setShowAccessModal(false);
    } catch (e) {
      console.error("Failed to save permissions", e);
    }
  };

  const handleStartEditColumn = (col: any) => {
    setEditingColumnName(col.name);
    setEditDisplayName(col.displayName || '');
    setEditDescription(col.description || '');
    setEditType(col.type || 'string');
  };

  const handleSaveMetadata = async () => {
    if (!selectedDataset || !editingColumnName || !onUpdateDataset) return;
    setIsSavingMetadata(true);
    try {
      const updatedColumns = selectedDataset.columns.map(c =>
        c.name === editingColumnName
          ? { ...c, displayName: editDisplayName.trim() || undefined, description: editDescription.trim() || undefined, type: editType }
          : c
      );
      await onUpdateDataset({ ...selectedDataset, columns: updatedColumns });
      setEditingColumnName(null);
    } catch (e) {
      console.error("Failed to save metadata", e);
    } finally {
      setIsSavingMetadata(false);
    }
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

        {/* Sidebar Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('datasets')}
            className={`flex-1 py-2 text-[10px] font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'datasets'
              ? 'text-blue-400 border-b-2 border-blue-500 bg-blue-500/5'
              : 'text-slate-500 hover:text-slate-300'
              }`}
          >
            <Database size={10} /> Datasets
          </button>
          <button
            onClick={() => setActiveTab('cached')}
            className={`flex-1 py-2 text-[10px] font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'cached'
              ? 'text-emerald-400 border-b-2 border-emerald-500 bg-emerald-500/5'
              : 'text-slate-500 hover:text-slate-300'
              }`}
          >
            <Layers size={10} /> Cached
          </button>
        </div>

        {activeTab === 'cached' ? (
          <div className="flex-1 overflow-y-auto">
            <CachedDatasetsPanel
              currentUser={currentUser}
              searchTerm={searchTerm}
              onCreateDashboard={() => onRefreshDashboards?.()}
            />
          </div>
        ) : (
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
                          } catch (err: any) {
                            alert("Failed to delete: " + (err?.message || 'Unknown error'));
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
        )}
      </div>

      {/* Detail View */}
      <div className="flex-1 overflow-y-auto bg-slate-950 p-8">
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
                        {isAdmin && <th className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider text-right">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {visibleColumns.length > 0 ? (
                        visibleColumns.map(col => {
                          const isEditing = editingColumnName === col.name;
                          return (
                            <tr key={col.name} className={`group transition-colors ${isEditing ? 'bg-blue-600/10' : 'hover:bg-slate-800/30'}`}>
                              <td className="px-6 py-4">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editDisplayName}
                                    onChange={e => setEditDisplayName(e.target.value)}
                                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-sm text-blue-300 w-full outline-none focus:border-blue-500"
                                    placeholder="Display Name"
                                  />
                                ) : (
                                  <div className="font-mono text-sm text-blue-300">
                                    {col.displayName || col.name}
                                    {col.displayName && <span className="text-slate-500 text-xs ml-2 opacity-50">({col.name})</span>}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                {isEditing ? (
                                  <select
                                    value={editType}
                                    onChange={e => setEditType(e.target.value)}
                                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-sm text-slate-300 w-full outline-none focus:border-blue-500"
                                  >
                                    {['string', 'number', 'boolean', 'date', 'object', 'array'].map(t => (
                                      <option key={t} value={t}>{t}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <div className="flex items-center space-x-2 text-sm text-slate-400">
                                    {getIconForType(col.type)}
                                    <span>{col.type}</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4">
                                {isEditing ? (
                                  <input
                                    type="text"
                                    value={editDescription}
                                    onChange={e => setEditDescription(e.target.value)}
                                    className="bg-slate-950 border border-slate-700 rounded-md px-2 py-1 text-sm text-slate-400 w-full outline-none focus:border-blue-500"
                                    placeholder="Description"
                                  />
                                ) : (
                                  <span className="text-sm text-slate-400">{col.description}</span>
                                )}
                              </td>
                              {isAdmin && (
                                <td className="px-6 py-4 text-right">
                                  {isEditing ? (
                                    <div className="flex items-center justify-end space-x-2">
                                      <button
                                        onClick={handleSaveMetadata}
                                        disabled={isSavingMetadata}
                                        className="p-1.5 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50"
                                      >
                                        <Save size={14} />
                                      </button>
                                      <button
                                        onClick={() => setEditingColumnName(null)}
                                        className="p-1.5 bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-700 transition-colors"
                                      >
                                        <X size={14} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => handleStartEditColumn(col)}
                                      className="p-1.5 text-slate-500 hover:text-blue-400 hover:bg-blue-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })
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
                            <th key={col.name} className="px-6 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider">{col.displayName || col.name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {visibleColumns.length > 0 && selectedDataset?.data?.length > 0 ? (
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
      </div>
    </div>
  );
};

export default DataCatalog;