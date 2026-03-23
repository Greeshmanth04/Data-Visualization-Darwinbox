import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dataset, CrossDBRelationship, DatabaseConnection } from '../types';
import { Play, Sparkles, Database, Copy, ChevronDown, Loader2, Save, X } from 'lucide-react';
import { generateQueryFromNaturalLanguage } from '../services/geminiService';
import { useDatasetContext } from '../context/DatasetContext';
import { api } from '../services/api';
import alasql from 'alasql';

interface EditorProps {
  datasets: Dataset[];
}

type Row = Record<string, any>;

function sanitizeTableName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function runInMemorySQL(sql: string, data: Row[], datasetName: string): Row[] {
  const safeName = sanitizeTableName(datasetName);
  try {
    alasql.tables[safeName] = { data };
    const res = alasql(sql);
    delete alasql.tables[safeName];

    if (!Array.isArray(res)) {
      throw new Error('Query did not return a tabular result.');
    }
    return res;
  } catch (err: any) {
    delete alasql.tables[safeName];
    throw new Error(`SQL Error: ${err.message}`);
  }
}

const Editor: React.FC<EditorProps> = ({ datasets }) => {
  const { activeDatasetId, setActiveDatasetId } = useDatasetContext();

  const selectedDatasetId = useMemo(() => {
    if (activeDatasetId && datasets.some(d => d.id === activeDatasetId)) {
      return activeDatasetId;
    }
    return datasets[0]?.id || '';
  }, [activeDatasetId, datasets]);

  const [query, setQuery] = useState('');
  const [naturalPrompt, setNaturalPrompt] = useState('');
  const [results, setResults] = useState<any[] | null>(null);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [execTime, setExecTime] = useState<number | null>(null);

  const [liveConnections, setLiveConnections] = useState<DatabaseConnection[]>([]);

  useEffect(() => {
    api.connections.getAll().then(setLiveConnections).catch(() => { });
  }, []);

  const DB_COL: Record<string, string> = { mysql: '#10b981', postgres: '#3b82f6', mongodb: '#a855f7' };

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDesc, setSaveDesc] = useState('');
  const [savingDataset, setSavingDataset] = useState(false);


  const selectedDataset = datasets.find(d => d.id === selectedDatasetId);
  const isLiveDB = !!selectedDataset?.isLive && ['postgres', 'mysql'].includes(selectedDataset?.sourceType || '');
  const isMongo = !!selectedDataset?.isLive && selectedDataset?.sourceType === 'mongodb';

  useEffect(() => {
    if (selectedDataset) {
      if (isMongo) {
        const collectionName = (typeof selectedDataset.sourceMetadata === 'string'
          ? selectedDataset.sourceMetadata : null) || selectedDataset.name;
        setQuery(`db.${collectionName}.find({}).limit(10)`);
      } else if (isLiveDB) {
        const tableName = (typeof selectedDataset.sourceMetadata === 'string'
          ? selectedDataset.sourceMetadata : null) || selectedDataset.name;
        const quote = selectedDataset.sourceType === 'postgres' ? '"' : '`';
        setQuery(`SELECT * FROM ${quote}${tableName}${quote} LIMIT 10`);
      } else {
        // Static/in-memory datasets: use sanitized name matching what alasql registers
        const safeName = sanitizeTableName(selectedDataset.name);
        setQuery(`SELECT * FROM ${safeName} LIMIT 10`);
      }
      setResults(null);
      setError(null);
      setExecTime(null);
    }
  }, [selectedDatasetId, datasets, isMongo, isLiveDB, selectedDataset]);

  const executeQuery = useCallback(async () => {
    if (!selectedDataset) {
      setError('No dataset selected.');
      return;
    }

    setError(null);
    setResults(null);
    setLoadingQuery(true);
    const start = Date.now();

    try {
      if (isLiveDB) {
        // Route to backend — it handles decryption of connectionConfig server-side
        const res = await api.datasets.queryDataset(selectedDataset.id, query);
        setResults(res.data);
      } else if (isMongo) {
        // MongoDB: use the dataset's id to query via the backend
        const res = await api.datasets.queryDataset(selectedDataset.id, query);
        setResults(res.data);
      } else {
        if (!selectedDataset.data || selectedDataset.data.length === 0) {
          throw new Error('Dataset has no data to query.');
        }
        const rows = runInMemorySQL(query, selectedDataset.data, selectedDataset.name);
        setResults(rows);
      }
    } catch (e: any) {
      setError(e.message || 'Query execution failed.');
    } finally {
      setExecTime(Date.now() - start);
      setLoadingQuery(false);
    }
  }, [selectedDataset, query, isLiveDB, isMongo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        executeQuery();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [executeQuery]);

  const handleAIGeneration = async () => {
    if (!naturalPrompt.trim()) return;
    setLoadingAI(true);
    setError(null);
    try {
      const generatedQuery = await generateQueryFromNaturalLanguage(naturalPrompt, datasets, selectedDatasetId);
      setQuery(generatedQuery);
    } catch (e: any) {
      setError(e.message || 'Failed to generate query');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleCopyQuery = async () => {
    try {
      await navigator.clipboard.writeText(query);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = query;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 1500);
  };

  const handleSaveView = async () => {
    if (!saveName.trim() || !selectedDataset || !query.trim()) return;
    setSavingDataset(true);
    try {
      await api.datasets.createSqlView({
        name: saveName,
        description: saveDesc,
        sourceDatasetId: selectedDataset.id,
        query,
        staticData: results || []
      });
      setShowSaveModal(false);
      setSaveName('');
      setSaveDesc('');
      alert('View saved successfully as a new dataset!');
    } catch (e: any) {
      alert(e.message || 'Failed to save view');
    } finally {
      setSavingDataset(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 relative">
      {/* Toolbar */}
      <div className="h-16 border-b border-slate-800 flex items-center px-6 justify-between bg-slate-900 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <div className="group relative">
            <div className="flex items-center space-x-2 text-slate-400 cursor-pointer hover:text-white transition-colors">
              <Database size={18} />
              <select
                value={selectedDatasetId}
                onChange={e => setActiveDatasetId(e.target.value)}
                className="bg-transparent font-medium text-sm focus:outline-none appearance-none pr-4 cursor-pointer"
              >
                {datasets.map(ds => (
                  <option key={ds.id} value={ds.id} className="bg-slate-800 text-slate-200">
                    {ds.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-0 pointer-events-none" />
            </div>
          </div>

          {/* DB type badge */}
          {selectedDataset?.sourceType && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${isLiveDB ? 'bg-green-500/10 text-green-400 border-green-500/20' :
              isMongo ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                'bg-blue-500/10 text-blue-400 border-blue-500/20'
              }`}>
              {selectedDataset.sourceType.toUpperCase()}
            </span>
          )}

          <div className="h-6 w-px bg-slate-700 mx-2" />

          <button
            onClick={executeQuery}
            disabled={loadingQuery || !query.trim()}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            {loadingQuery ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} fill="currentColor" />}
            <span>{loadingQuery ? 'Running...' : 'Run'}</span>
          </button>

          {results && results.length > 0 && (
            <button
              onClick={() => setShowSaveModal(true)}
              className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-md text-sm font-medium border border-slate-700 transition-colors"
            >
              <Save size={16} />
              <span>Save as Dataset</span>
            </button>
          )}

          <span className="text-xs text-slate-600">Ctrl+Enter</span>
        </div>

        {execTime !== null && !loadingQuery && (
          <span className="text-xs text-slate-500">{execTime}ms</span>
        )}
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
        {/* Editor Area */}
        <div className="flex-1 min-w-0 flex flex-col border-r border-slate-800">
          {/* AI Input */}
          <div className="p-4 bg-slate-900 border-b border-slate-800 flex-shrink-0">
            <div className="relative">
              <input
                type="text"
                value={naturalPrompt}
                onChange={e => setNaturalPrompt(e.target.value)}
                placeholder={isMongo
                  ? "Ask AI to write a MongoDB query..."
                  : "Ask AI to write SQL (e.g., 'Show total revenue by region')"}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg pl-10 pr-24 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-slate-500"
                onKeyDown={e => e.key === 'Enter' && handleAIGeneration()}
              />
              <Sparkles className="absolute left-3 top-3.5 text-purple-500" size={18} />
              <button
                onClick={handleAIGeneration}
                disabled={loadingAI}
                className="absolute right-2 top-2 bg-slate-700 hover:bg-slate-600 text-xs px-3 py-1.5 rounded-md text-slate-200 transition-colors disabled:opacity-50"
              >
                {loadingAI ? 'Generating...' : 'Generate'}
              </button>
            </div>
          </div>

          {/* Code Area */}
          <div className="flex-1 relative bg-[#0f172a]">
            <textarea
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full h-full bg-[#0f172a] text-blue-100 font-mono p-6 resize-none focus:outline-none text-sm leading-6"
              spellCheck={false}
              placeholder={isMongo ? 'db.collection.find({})' : selectedDataset?.sourceType === 'postgres' ? 'SELECT * FROM "table_name" LIMIT 10' : 'SELECT * FROM `table_name` LIMIT 10'}
              onKeyDown={e => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  executeQuery();
                }
              }}
            />
            <div className="absolute bottom-4 right-4">
              <button
                onClick={handleCopyQuery}
                className="p-2 bg-slate-800 text-slate-400 rounded hover:text-white transition-colors"
                title="Copy query to clipboard"
              >
                {copyFeedback
                  ? <span className="text-green-400 text-xs font-medium">Copied!</span>
                  : <Copy size={16} />
                }
              </button>
            </div>
          </div>

          {/* Results Pane */}
          <div className="flex-1 min-w-0 min-h-[280px] max-h-[45vh] border-t border-slate-800 bg-slate-900 flex flex-col overflow-hidden">
            <div className="px-6 py-3 border-b border-slate-800 bg-slate-900 flex justify-between items-center flex-shrink-0">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Query Results {results && `(${results.length} rows)`}
              </span>
              {results && results.length > 0 && (
                <span className="text-xs text-slate-600">
                  {isLiveDB ? 'Live DB' : isMongo ? 'MongoDB' : 'In-memory'}
                </span>
              )}
            </div>

            <div className="flex-1 overflow-auto relative">
              {/* Loading */}
              {loadingQuery && (
                <div className="flex items-center justify-center p-8 text-slate-500 gap-2 h-full">
                  <Loader2 size={20} className="animate-spin text-blue-500" />
                  <span>Running query...</span>
                </div>
              )}

              {/* Error */}
              {!loadingQuery && error && (
                <div className="p-6 text-red-400 text-sm h-full overflow-y-auto">
                  <p className="font-semibold mb-1 flex items-center gap-2"><X size={16} /> Error</p>
                  <p className="font-mono text-xs bg-red-500/10 border border-red-500/20 p-3 rounded break-all whitespace-pre-wrap">{error}</p>
                </div>
              )}

              {/* Empty state */}
              {!loadingQuery && !results && !error && (
                <div className="flex items-center justify-center h-full text-slate-600 flex-col">
                  <Database size={32} className="mb-3 opacity-20" />
                  <p>Run a query to see results</p>
                  <p className="text-xs mt-2 text-slate-700">Press <kbd className="bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded text-xs border border-slate-700 font-sans">Ctrl+Enter</kbd> to execute</p>
                </div>
              )}

              {/* Results table */}
              {!loadingQuery && results && results.length > 0 && (
                <table className="min-w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="bg-slate-800 sticky top-0 z-10">
                      {Object.keys(results[0]).map(key => {
                        const col = selectedDataset?.columns?.find(c => c.name === key);
                        const display = col?.displayName || key;
                        return (
                          <th
                            key={key}
                            className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 whitespace-nowrap"
                          >
                            {display}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {results.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                        {Object.values(row).map((val: any, i) => (
                          <td key={i} className="px-4 py-2 text-sm text-slate-300 whitespace-nowrap font-mono">
                            {val === null || val === undefined
                              ? <span className="text-slate-600 italic">NULL</span>
                              : typeof val === 'object'
                                ? JSON.stringify(val)
                                : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* No results */}
              {!loadingQuery && results && results.length === 0 && (
                <div className="p-8 text-center text-slate-600">
                  <p>Query returned no results.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Schema Sidebar */}
        <div className="w-64 border-l border-slate-800 bg-slate-950 p-4 hidden md:flex flex-col overflow-y-auto">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 flex-shrink-0">Schema</h3>
          <div className="space-y-5">
            {datasets.map(ds => (
              <div key={ds.id}>
                <div
                  className={`flex items-start space-x-2 mb-2 cursor-pointer group`}
                  onClick={() => setActiveDatasetId(ds.id)}
                >
                  <Database
                    size={14}
                    className={`mt-0.5 flex-shrink-0 ${ds.sourceType === 'mongodb' ? 'text-yellow-500' :
                      ['postgres', 'mysql'].includes(ds.sourceType || '') ? 'text-green-500' :
                        'text-blue-500'}`}
                  />
                  <div className="min-w-0">
                    <span className={`font-medium text-sm truncate block group-hover:text-white transition-colors ${ds.id === selectedDatasetId ? 'text-white' : 'text-slate-300'}`}>
                      {ds.name || ds.id}
                    </span>
                    {ds.sourceType && (
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded mt-0.5 inline-block border ${ds.sourceType === 'mongodb'
                        ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                        : ds.sourceType === 'postgres'
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : ds.sourceType === 'mysql'
                            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                            : ds.sourceType === 'xlsx'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : ds.sourceType === 'json'
                                ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}>
                        {ds.sourceType}
                      </span>
                    )}
                  </div>
                </div>
                <div className="pl-5 space-y-0.5">
                  {ds.columns.map(col => (
                    <div
                      key={col.name}
                      className="flex items-center justify-between text-xs group cursor-pointer hover:bg-slate-900 px-2 py-1 rounded"
                      title={col.description}
                      onClick={() => {
                        // Insert column name at cursor
                        setQuery(prev => prev + col.name);
                      }}
                    >
                      <span className="text-slate-400 group-hover:text-slate-200 transition-colors truncate">{col.displayName || col.name}</span>
                      <span className="text-slate-600 ml-2 flex-shrink-0">{col.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Save View Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-2">Save Query as Dataset</h3>
            <p className="text-sm text-slate-400 mb-6">Create a new dataset from the results of this query. It will be available in the Data Catalog and can be used in Dashboards.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Dataset Name</label>
                <input
                  autoFocus
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="e.g. Q3 Regional Sales"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 uppercase mb-2">Description</label>
                <textarea
                  className="w-full bg-slate-800 border border-slate-700 rounded p-2 text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Optional description"
                  rows={3}
                  value={saveDesc}
                  onChange={e => setSaveDesc(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button disabled={savingDataset} onClick={() => setShowSaveModal(false)} className="text-slate-400 hover:text-white px-4 py-2 disabled:opacity-50">Cancel</button>
              <button
                disabled={!saveName.trim() || savingDataset}
                onClick={handleSaveView}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium disabled:opacity-50 min-w-[80px] flex justify-center items-center"
              >
                {savingDataset ? <Loader2 size={18} className="animate-spin" /> : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Editor;
