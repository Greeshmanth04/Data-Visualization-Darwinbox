import React, { useState, useMemo } from 'react';
import { Dataset } from '../types';
import { Database, Search, Edit2, Save, X, LayoutTemplate, Share2 } from 'lucide-react';

interface SchemaViewProps {
    datasets: Dataset[];
    onUpdateDataset: (dataset: Dataset) => Promise<void>;
}

export const SchemaView: React.FC<SchemaViewProps> = ({ datasets, onUpdateDataset }) => {
    const [activeTab, setActiveTab] = useState<'er' | 'columns'>('er');
    const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(datasets[0]?.id || null);
    const [searchTerm, setSearchTerm] = useState('');

    // Editing state
    const [editingColumn, setEditingColumn] = useState<string | null>(null);
    const [editDisplayName, setEditDisplayName] = useState('');
    const [editDescription, setEditDescription] = useState('');
    const [saving, setSaving] = useState(false);

    const selectedDataset = useMemo(() => {
        return datasets.find(d => d.id === selectedDatasetId) || null;
    }, [datasets, selectedDatasetId]);

    const filteredColumns = useMemo(() => {
        if (!selectedDataset) return [];
        if (!searchTerm) return selectedDataset.columns;
        const term = searchTerm.toLowerCase();
        return selectedDataset.columns.filter(c =>
            c.name.toLowerCase().includes(term) ||
            (c.displayName || '').toLowerCase().includes(term) ||
            (c.description || '').toLowerCase().includes(term)
        );
    }, [selectedDataset, searchTerm]);

    const handleStartEdit = (colName: string, currentDisplay: string = '', currentDesc: string = '') => {
        setEditingColumn(colName);
        setEditDisplayName(currentDisplay);
        setEditDescription(currentDesc);
    };

    const handleSaveEdit = async () => {
        if (!selectedDataset || !editingColumn) return;

        setSaving(true);
        try {
            const updatedColumns = selectedDataset.columns.map(c => {
                if (c.name === editingColumn) {
                    return {
                        ...c,
                        displayName: editDisplayName.trim() || undefined,
                        description: editDescription.trim() || undefined
                    };
                }
                return c;
            });

            const updatedDataset = {
                ...selectedDataset,
                columns: updatedColumns
            };

            await onUpdateDataset(updatedDataset);
            setEditingColumn(null);
        } catch (e) {
            alert("Failed to save column metadata");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-slate-900 text-slate-200">
            {/* Header Tabs */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <Database className="text-blue-500" />
                    Schema Management
                </h2>

                <div className="flex space-x-2 bg-slate-800 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('er')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors text-sm font-medium ${activeTab === 'er' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <Share2 size={16} />
                        <span>ER Diagram View</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('columns')}
                        className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors text-sm font-medium ${activeTab === 'columns' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        <LayoutTemplate size={16} />
                        <span>Column Editor</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden relative">
                {/* ER Diagram View */}
                {activeTab === 'er' && (
                    <div className="h-full w-full bg-slate-950 overflow-auto p-12 custom-scrollbar relative" style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
                        {datasets.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-slate-500">No datasets schema available.</div>
                        ) : (
                            <div className="flex flex-wrap gap-12 items-start justify-center">
                                {datasets.map(dataset => (
                                    <div key={dataset.id} className="w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden flex flex-col hover:border-blue-500/50 transition-colors">
                                        <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                                            <Database size={16} className="text-blue-400" />
                                            <h3 className="font-bold text-slate-100 truncate">{dataset.name}</h3>
                                            <span className="ml-auto text-[10px] uppercase font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded">{dataset.sourceType}</span>
                                        </div>
                                        <div className="px-4 py-2 bg-slate-900/50">
                                            <p className="text-xs text-slate-400 truncate">{dataset.description || 'No description'}</p>
                                        </div>
                                        <div className="max-h-[300px] overflow-y-auto border-t border-slate-800 custom-scrollbar">
                                            <table className="w-full text-left text-xs">
                                                <tbody className="divide-y divide-slate-800/50">
                                                    {dataset.columns.map(col => (
                                                        <tr key={col.name} className="hover:bg-slate-800/30 transition-colors">
                                                            <td className="py-2 px-4 font-mono text-slate-300 w-1/2 break-all">{col.displayName || col.name}</td>
                                                            <td className="py-2 px-4 text-slate-500 text-right w-1/2">{col.type}</td>
                                                        </tr>
                                                    ))}
                                                    {dataset.columns.length === 0 && (
                                                        <tr><td colSpan={2} className="py-4 text-center text-slate-600 italic">No columns specified</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="bg-slate-800/80 px-4 py-2 border-t border-slate-700 text-center">
                                            <button
                                                onClick={() => { setSelectedDatasetId(dataset.id); setActiveTab('columns'); }}
                                                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
                                            >
                                                Edit Metadata &rarr;
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* Visual Relationships: In a full ERD this would draw SVG lines between foreign keys. Since foreign keys aren't strictly modeled in this demo's types, we just render isolated entity cards. */}
                    </div>
                )}

                {/* Column Editor View */}
                {activeTab === 'columns' && (
                    <div className="flex h-full">
                        {/* Sidebar for Dataset Selection */}
                        <div className="w-72 bg-slate-900 border-r border-slate-800 overflow-y-auto hidden md:block flex-shrink-0">
                            <div className="p-4 border-b border-slate-800 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Select Dataset</h3>
                            </div>
                            <div className="p-2 space-y-1">
                                {datasets.map(d => (
                                    <button
                                        key={d.id}
                                        onClick={() => { setSelectedDatasetId(d.id); setEditingColumn(null); setSearchTerm(''); }}
                                        className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${selectedDatasetId === d.id ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'hover:bg-slate-800 text-slate-300'
                                            }`}
                                    >
                                        <span className="font-medium truncate mr-2">{d.name}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded ${selectedDatasetId === d.id ? 'bg-blue-700' : 'bg-slate-800 text-slate-500'}`}>
                                            {d.columns?.length || 0}
                                        </span>
                                    </button>
                                ))}
                                {datasets.length === 0 && <div className="p-4 text-sm text-slate-500">No datasets available.</div>}
                            </div>
                        </div>

                        {/* Main Area for Columns */}
                        <div className="flex-1 flex flex-col min-w-0 bg-slate-950 relative">
                            {selectedDataset ? (
                                <>
                                    {/* Header */}
                                    <div className="px-8 py-6 border-b border-slate-800 bg-slate-900 sticky top-0 z-20 flex-shrink-0">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <h1 className="text-2xl font-bold text-white mb-1">{selectedDataset.name}</h1>
                                                <p className="text-slate-400 text-sm max-w-2xl">{selectedDataset.description || 'No description provided for this dataset.'}</p>
                                            </div>
                                            <div className="bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700 flex items-center space-x-2">
                                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                                <span className="text-xs font-medium text-slate-300 uppercase shrink-0">{selectedDataset.sourceType}</span>
                                            </div>
                                        </div>

                                        <div className="relative max-w-md">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Search columns..."
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Columns Table */}
                                    <div className="flex-1 overflow-auto p-8 custom-scrollbar relative">
                                        {filteredColumns.length === 0 ? (
                                            <div className="text-center text-slate-500 py-12">No columns match your search.</div>
                                        ) : (
                                            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                                                <table className="w-full text-left border-collapse">
                                                    <thead>
                                                        <tr className="bg-slate-800/80 border-b border-slate-700">
                                                            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-1/4">Column Name</th>
                                                            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-1/12">Type</th>
                                                            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider w-1/4">Display Name</th>
                                                            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider max-w-[200px]">Description</th>
                                                            <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right w-24">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-slate-800">
                                                        {filteredColumns.map((col) => {
                                                            const isEditing = editingColumn === col.name;

                                                            return (
                                                                <tr key={col.name} className={`group transition-colors ${isEditing ? 'bg-blue-900/10' : 'hover:bg-slate-800/40'}`}>
                                                                    {/* Col Name */}
                                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                                        <div className="flex items-center space-x-2">
                                                                            <span className="font-mono text-sm text-slate-200">{col.name}</span>
                                                                        </div>
                                                                    </td>

                                                                    {/* Type */}
                                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                                        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono">{col.type}</span>
                                                                    </td>

                                                                    {/* Display Name */}
                                                                    <td className="px-6 py-4">
                                                                        {isEditing ? (
                                                                            <input
                                                                                autoFocus
                                                                                type="text"
                                                                                value={editDisplayName}
                                                                                onChange={e => setEditDisplayName(e.target.value)}
                                                                                placeholder="e.g. Sales Revenue"
                                                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                                                            />
                                                                        ) : (
                                                                            <span className={`text-sm ${col.displayName ? 'text-blue-300 font-medium' : 'text-slate-500 italic'}`}>
                                                                                {col.displayName || 'None'}
                                                                            </span>
                                                                        )}
                                                                    </td>

                                                                    {/* Description */}
                                                                    <td className="px-6 py-4">
                                                                        {isEditing ? (
                                                                            <input
                                                                                type="text"
                                                                                value={editDescription}
                                                                                onChange={e => setEditDescription(e.target.value)}
                                                                                placeholder="Explain what this column means..."
                                                                                className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                                                                                onKeyDown={e => e.key === 'Enter' && handleSaveEdit()}
                                                                            />
                                                                        ) : (
                                                                            <p className="text-sm text-slate-400 truncate max-w-xs" title={col.description}>
                                                                                {col.description || <span className="text-slate-600 italic">No description</span>}
                                                                            </p>
                                                                        )}
                                                                    </td>

                                                                    {/* Actions */}
                                                                    <td className="px-6 py-4 whitespace-nowrap text-right">
                                                                        {isEditing ? (
                                                                            <div className="flex items-center justify-end space-x-2">
                                                                                <button disabled={saving} onClick={handleSaveEdit} className="text-green-400 hover:text-green-300 p-1 bg-green-400/10 rounded disabled:opacity-50">
                                                                                    <Save size={16} />
                                                                                </button>
                                                                                <button disabled={saving} onClick={() => setEditingColumn(null)} className="text-slate-400 hover:text-slate-200 p-1 bg-slate-700/50 rounded disabled:opacity-50">
                                                                                    <X size={16} />
                                                                                </button>
                                                                            </div>
                                                                        ) : (
                                                                            <button
                                                                                onClick={() => handleStartEdit(col.name, col.displayName, col.description)}
                                                                                className="text-slate-500 hover:text-blue-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                title="Edit Metadata"
                                                                            >
                                                                                <Edit2 size={16} />
                                                                            </button>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center flex-col text-slate-500">
                                    <LayoutTemplate size={48} className="mb-4 opacity-20" />
                                    <p>Select a dataset to view and edit its schema</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SchemaView;
