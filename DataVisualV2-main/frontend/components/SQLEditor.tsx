import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dataset } from '../types';
import { Play, Sparkles, Database, Copy, ChevronDown, Loader2, Save, X } from 'lucide-react';
import { generateQueryFromNaturalLanguage } from '../services/geminiService';
import { useDatasetContext } from '../context/DatasetContext';
import { api } from '../services/api';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface EditorProps {
  datasets: Dataset[];
}

// ---------------------------------------------------------------------------
// In-memory SQL interpreter (for csv / json / xlsx datasets)
// Supports: SELECT col list or *, WHERE, ORDER BY, LIMIT, GROUP BY, aggregates
// ---------------------------------------------------------------------------

type Row = Record<string, any>;

function compareValues(a: any, b: any): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function evalCondition(row: Row, condition: string): boolean {
  // Handle AND / OR (simple left-to-right, no precedence)
  const orParts = condition.split(/\s+OR\s+/i);
  if (orParts.length > 1) {
    return orParts.some(p => evalCondition(row, p.trim()));
  }
  const andParts = condition.split(/\s+AND\s+/i);
  if (andParts.length > 1) {
    return andParts.every(p => evalCondition(row, p.trim()));
  }

  // Remove outer parens
  const trimmed = condition.replace(/^\(|\)$/g, '').trim();

  // LIKE  col LIKE '%pattern%'
  const likeMatch = trimmed.match(/^(\w+)\s+(?:NOT\s+)?LIKE\s+'([^']*)'/i);
  if (likeMatch) {
    const isNot = trimmed.match(/NOT\s+LIKE/i);
    const col = likeMatch[1];
    const pattern = likeMatch[2].replace(/%/g, '.*').replace(/_/g, '.');
    const re = new RegExp(`^${pattern}$`, 'i');
    const result = re.test(String(row[col] ?? ''));
    return isNot ? !result : result;
  }

  // IS NULL / IS NOT NULL
  const isNullMatch = trimmed.match(/^(\w+)\s+IS\s+(NOT\s+)?NULL$/i);
  if (isNullMatch) {
    const val = row[isNullMatch[1]];
    const isNull = val == null || val === '';
    return isNullMatch[2] ? !isNull : isNull;
  }

  // Comparison operators: !=, >=, <=, =, >, <
  const compMatch = trimmed.match(/^(\w+)\s*(!=|>=|<=|=|>|<)\s*'?([^']*?)'?\s*$/);
  if (compMatch) {
    const col = compMatch[1];
    const op = compMatch[2];
    const rawVal = compMatch[3];
    const cellVal = row[col];
    const numVal = parseFloat(rawVal);
    const compareNum = !isNaN(numVal) && String(numVal) === rawVal.trim();

    const diff = compareNum
      ? (Number(cellVal) - numVal)
      : String(cellVal ?? '').localeCompare(rawVal);

    switch (op) {
      case '=': return compareNum ? Number(cellVal) === numVal : String(cellVal) === rawVal;
      case '!=': return compareNum ? Number(cellVal) !== numVal : String(cellVal) !== rawVal;
      case '>': return diff > 0;
      case '<': return diff < 0;
      case '>=': return diff >= 0;
      case '<=': return diff <= 0;
    }
  }

  return true; // unknown condition — pass through
}

function applyAggregate(fn: string, col: string, rows: Row[]): any {
  const values = rows.map(r => r[col]).filter(v => v != null);
  switch (fn.toUpperCase()) {
    case 'COUNT': return rows.length;
    case 'SUM': return values.reduce((a, b) => a + Number(b), 0);
    case 'AVG': {
      const nums = values.map(Number);
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    }
    case 'MIN': return values.reduce((a, b) => compareValues(a, b) <= 0 ? a : b, values[0]);
    case 'MAX': return values.reduce((a, b) => compareValues(a, b) >= 0 ? a : b, values[0]);
    default: return null;
  }
}

function runInMemorySQL(sql: string, data: Row[]): Row[] {
  const q = sql.trim().replace(/\s+/g, ' ');

  // Must be SELECT
  if (!/^SELECT\s/i.test(q)) {
    throw new Error('Only SELECT queries are supported for in-memory datasets.');
  }

  // Extract clauses using a regex-based parser
  const parts = q.match(
    /SELECT\s+(.*?)\s+FROM\s+\S+(?:\s+WHERE\s+(.*?))?(?:\s+GROUP\s+BY\s+(.*?))?(?:\s+ORDER\s+BY\s+(.*?))?(?:\s+LIMIT\s+(\d+))?$/i
  );

  if (!parts) {
    throw new Error('Could not parse query. Supported syntax: SELECT [cols] FROM [table] [WHERE ...] [GROUP BY ...] [ORDER BY ...] [LIMIT n]');
  }

  const selectClause = parts[1].trim();
  const whereClause = parts[2]?.trim() || null;
  const groupByClause = parts[3]?.trim() || null;
  const orderByClause = parts[4]?.trim() || null;
  const limitClause = parts[5] ? parseInt(parts[5]) : null;

  // WHERE
  let rows = whereClause ? data.filter(row => evalCondition(row, whereClause)) : [...data];

  // Parse SELECT columns / aggregates
  const colDefs = selectClause.split(',').map(s => s.trim());
  const isAggOnly = colDefs.some(c => /^(COUNT|SUM|AVG|MIN|MAX)\s*\(/i.test(c));

  // GROUP BY + aggregates
  if (groupByClause || isAggOnly) {
    const groupCols = groupByClause ? groupByClause.split(',').map(s => s.trim()) : [];

    const groups: Map<string, Row[]> = new Map();
    for (const row of rows) {
      const key = groupCols.map(c => row[c] ?? '').join('|||');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    const grouped: Row[] = [];
    for (const [, groupRows] of groups) {
      const out: Row = {};
      for (const gc of groupCols) out[gc] = groupRows[0][gc];
      for (const col of colDefs) {
        const aggMatch = col.match(/^(COUNT|SUM|AVG|MIN|MAX)\s*\(\s*(\*|\w+)\s*\)(?:\s+(?:AS\s+)?(\w+))?/i);
        if (aggMatch) {
          const alias = aggMatch[3] || `${aggMatch[1]}(${aggMatch[2]})`;
          out[alias] = applyAggregate(aggMatch[1], aggMatch[2], groupRows);
        } else if (!groupCols.includes(col) && col !== '*') {
          out[col] = groupRows[0][col];
        }
      }
      grouped.push(out);
    }
    rows = grouped;
  } else if (selectClause !== '*') {
    // Simple column projection
    rows = rows.map(row => {
      const out: Row = {};
      for (const col of colDefs) {
        const aliasMatch = col.match(/^(\w+)\s+(?:AS\s+)?(\w+)$/i);
        if (aliasMatch) {
          out[aliasMatch[2]] = row[aliasMatch[1]];
        } else {
          out[col] = row[col];
        }
      }
      return out;
    });
  }

  // ORDER BY
  if (orderByClause) {
    const orderParts = orderByClause.split(',').map(s => {
      const m = s.trim().match(/^(\w+)(?:\s+(ASC|DESC))?$/i);
      return m ? { col: m[1], dir: (m[2] || 'ASC').toUpperCase() } : null;
    }).filter(Boolean) as { col: string; dir: string }[];

    rows.sort((a, b) => {
      for (const { col, dir } of orderParts) {
        const cmp = compareValues(a[col], b[col]);
        if (cmp !== 0) return dir === 'DESC' ? -cmp : cmp;
      }
      return 0;
    });
  }

  // LIMIT
  if (limitClause !== null) {
    rows = rows.slice(0, limitClause);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  // New Features States
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDesc, setSaveDesc] = useState('');
  const [savingDataset, setSavingDataset] = useState(false);

  const selectedDataset = datasets.find(d => d.id === selectedDatasetId);
  const isLiveDB = ['postgres', 'mysql'].includes(selectedDataset?.sourceType || '');
  const isMongo = selectedDataset?.sourceType === 'mongodb';

  // Set default query when dataset changes
  useEffect(() => {
    if (selectedDataset) {
      if (isMongo) {
        setQuery(`db.${selectedDataset.name}.find({}).limit(10)`);
      } else {
        setQuery(`SELECT * FROM ${selectedDataset.name} LIMIT 10`);
      }
      setResults(null);
      setError(null);
      setExecTime(null);
    }
  }, [selectedDatasetId, datasets]);

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
        const res = await api.datasets.queryDataset(selectedDataset.id, 'find');
        setResults(res.data.slice(0, 100));
      } else {
        // In-memory SQL for csv / json / xlsx
        if (!selectedDataset.data || selectedDataset.data.length === 0) {
          throw new Error('Dataset has no data to query.');
        }
        const rows = runInMemorySQL(query, selectedDataset.data);
        setResults(rows);
      }
    } catch (e: any) {
      setError(e.message || 'Query execution failed.');
    } finally {
      setExecTime(Date.now() - start);
      setLoadingQuery(false);
    }
  }, [selectedDataset, query, isLiveDB, isMongo]);

  // Run on Ctrl+Enter
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
      // In a real scenario, we'd trigger a context refresh here to make the new dataset appear.
      // E.g., fetchDatasets()
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
              placeholder={isMongo ? 'db.collection.find({})' : 'SELECT * FROM table LIMIT 10'}
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
                      {Object.keys(results[0]).map(key => (
                        <th
                          key={key}
                          className="px-4 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700 whitespace-nowrap"
                        >
                          {key}
                        </th>
                      ))}
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
                      <span className="text-slate-400 group-hover:text-slate-200 transition-colors truncate">{col.name}</span>
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
