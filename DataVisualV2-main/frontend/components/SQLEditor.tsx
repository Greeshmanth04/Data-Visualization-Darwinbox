import React, { useState, useEffect, useMemo } from 'react';
import { Dataset } from '../types';
import { Play, Sparkles, Database, Save, Copy, ChevronDown } from 'lucide-react';
import { generateQueryFromNaturalLanguage } from '../services/geminiService';
import { useDatasetContext } from '../context/DatasetContext';

interface EditorProps {
  datasets: Dataset[];
}

const Editor: React.FC<EditorProps> = ({ datasets }) => {
  const { activeDatasetId, setActiveDatasetId } = useDatasetContext();

  // Compute effective selection: use active if valid, else default to first
  const selectedDatasetId = useMemo(() => {
    if (activeDatasetId && datasets.some(d => d.id === activeDatasetId)) {
      return activeDatasetId;
    }
    return datasets[0]?.id || '';
  }, [activeDatasetId, datasets]);

  const [query, setQuery] = useState('');
  const [naturalPrompt, setNaturalPrompt] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedDataset = datasets.find(d => d.id === selectedDatasetId);
  const isMongo = selectedDataset?.sourceType === 'mongodb';
  const dialect = isMongo ? 'mongodb' : 'sql';

  // Sync query when effective selection changes
  useEffect(() => {
    if (selectedDataset) {
      if (isMongo) {
        setQuery(`db.${selectedDataset.name}.find({}).limit(10)`);
      } else {
        setQuery(`SELECT * FROM ${selectedDataset.name} LIMIT 10`);
      }
    }
  }, [selectedDatasetId, datasets, isMongo, selectedDataset]);

  // Fake SQL Execution Engine
  const executeQuery = () => {
    setError(null);
    setResults(null);

    // Simplistic parser for demo purposes
    const lowerQuery = query.toLowerCase();

    // 1. Try to find a dataset mentioned in the query
    let targetDataset = datasets.find(d => lowerQuery.includes(d.id) || lowerQuery.includes(d.name.toLowerCase()));

    // 2. If not found, use the SELECTED dataset (Scoping feature)
    if (!targetDataset) {
      targetDataset = selectedDataset;
    }

    if (!targetDataset) {
      setError("No table found or selected.");
      return;
    }

    // Mock filtering logic
    let filteredData = [...targetDataset.data];

    if (lowerQuery.includes('where')) {
      // Very basic mock filter for demo
      if (lowerQuery.includes('region = \'na\'')) {
        filteredData = filteredData.filter(d => d['region'] === 'NA');
      }
      // Add generic textual search for demo if exact column match isn't implemented in this mock
    }

    if (lowerQuery.includes('limit')) {
      // Extract limit number
      const limitMatch = lowerQuery.match(/limit\s+(\d+)/);
      if (limitMatch) {
        filteredData = filteredData.slice(0, parseInt(limitMatch[1]));
      }
    }

    // Mock aggregation if group by is present (very basic)
    if (lowerQuery.includes('group by')) {
      // Just return the first 5 for visual indication of change
      filteredData = filteredData.slice(0, 5);
    }

    setTimeout(() => {
      setResults(filteredData);
    }, 400); // Simulate network latency
  };

  const handleAIGeneration = async () => {
    if (!naturalPrompt.trim()) return;
    setLoadingAI(true);
    // Pass the selected dataset context and active ID to AI for dialect detection
    const generatedQuery = await generateQueryFromNaturalLanguage(naturalPrompt, datasets, selectedDatasetId);
    setQuery(generatedQuery);
    setLoadingAI(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200 relative">
      {/* Toolbar */}
      <div className="h-16 border-b border-slate-800 flex items-center px-6 justify-between bg-slate-900">
        <div className="flex items-center space-x-4">
          <div className="group relative">
            <div className="flex items-center space-x-2 text-slate-400 cursor-pointer hover:text-white transition-colors">
              <Database size={18} />
              <select
                value={selectedDatasetId}
                onChange={(e) => {
                  setActiveDatasetId(e.target.value);
                }}
                className="bg-transparent font-medium text-sm focus:outline-none appearance-none pr-4 cursor-pointer"
              >
                {datasets.map(ds => <option key={ds.id} value={ds.id} className="bg-slate-800 text-slate-200">{ds.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-0 pointer-events-none" />
            </div>
          </div>
          <div className="h-6 w-px bg-slate-700 mx-2"></div>
          <button
            onClick={executeQuery}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
          >
            <Play size={16} fill="currentColor" />
            <span>Run</span>
          </button>
          <button className="flex items-center space-x-2 text-slate-400 hover:text-white px-3 py-1.5 rounded-md text-sm transition-colors">
            <Save size={16} />
            <span>Save</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Editor Area */}
        <div className="flex-1 flex flex-col border-r border-slate-800">
          {/* AI Input */}
          <div className="p-4 bg-slate-900 border-b border-slate-800">
            <div className="relative">
              <input
                type="text"
                value={naturalPrompt}
                onChange={(e) => setNaturalPrompt(e.target.value)}
                placeholder={isMongo ? "Ask AI to write MongoDB query (e.g., 'Find all items where region is NA')" : "Ask AI to write SQL (e.g., 'Show total revenue by region')"}
                className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-lg pl-10 pr-24 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder-slate-500"
                onKeyDown={(e) => e.key === 'Enter' && handleAIGeneration()}
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
              onChange={(e) => setQuery(e.target.value)}
              className="w-full h-full bg-[#0f172a] text-blue-100 font-mono p-6 resize-none focus:outline-none text-sm leading-6"
              spellCheck={false}
            />
            <div className="absolute bottom-4 right-4">
              <button className="p-2 bg-slate-800 text-slate-400 rounded hover:text-white transition-colors">
                <Copy size={16} />
              </button>
            </div>
          </div>

          {/* Results Pane */}
          <div className="h-1/2 border-t border-slate-800 bg-slate-900 flex flex-col">
            <div className="px-6 py-3 border-b border-slate-800 bg-slate-900 flex justify-between items-center">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Query Results {results && `(${results.length} rows)`}
              </span>
            </div>

            <div className="flex-1 overflow-auto p-0">
              {error && (
                <div className="p-8 text-center text-red-400">
                  <p>{error}</p>
                </div>
              )}

              {!results && !error && (
                <div className="p-8 text-center text-slate-600">
                  <p>Run a query to see results</p>
                </div>
              )}

              {results && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-800 sticky top-0">
                      {Object.keys(results[0]).map(key => (
                        <th key={key} className="px-6 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider border-b border-slate-700 whitespace-nowrap">
                          {key}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {results.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/50 transition-colors">
                        {Object.values(row).map((val: any, i) => (
                          <td key={i} className="px-6 py-3 text-sm text-slate-300 whitespace-nowrap">
                            {val !== null && typeof val === 'object' ? JSON.stringify(val) : String(val ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Schema Sidebar (Right) */}
        <div className="w-64 border-l border-slate-800 bg-slate-950 p-4 hidden md:block overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Schema</h3>
          <div className="space-y-4">
            {datasets.map(ds => (
              <div key={ds.id}>
                <div className="flex items-center space-x-2 text-slate-200 mb-2">
                  <Database size={14} className={ds.sourceType === 'mongodb' ? 'text-green-500' : 'text-blue-500'} />
                  <span className="font-medium text-sm truncate">{ds.name || ds.id}</span>
                  {ds.sourceType && <span className={`text-[10px] px-1.5 py-0.5 rounded ${ds.sourceType === 'mongodb' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>{ds.sourceType.toUpperCase()}</span>}
                </div>
                <div className="pl-6 space-y-1">
                  {ds.columns.map(col => (
                    <div key={col.name} className="flex items-center justify-between text-xs group cursor-pointer hover:bg-slate-900 p-1 rounded">
                      <span className="text-slate-400 group-hover:text-slate-200 transition-colors">{col.name}</span>
                      <span className="text-slate-600">{col.type}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;
