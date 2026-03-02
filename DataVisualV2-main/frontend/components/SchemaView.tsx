import React, { useState, useMemo, useEffect } from 'react';
import { Dataset, DatabaseConnection } from '../types';
import { Database, Search, Edit2, Save, X, LayoutTemplate, Share2, Plus, Cable, Key, Trash2, Eye, Table as TableIcon, Download, Loader2 } from 'lucide-react';
import { api } from '../services/api';
import { ConnectionManagerModal } from './ConnectionManagerModal';

interface SchemaViewProps {
    datasets: Dataset[];
    onUpdateDataset: (dataset: Dataset) => Promise<void>;
    onAddDataset?: (dataset: Dataset) => void;
}

export const SchemaView: React.FC<SchemaViewProps> = ({ datasets, onUpdateDataset, onAddDataset }) => {
    const [activeTab, setActiveTab] = useState<'er' | 'columns'>('er');
    const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(datasets[0]?.id || null);
    const [searchTerm, setSearchTerm] = useState('');

    const [connections, setConnections] = useState<DatabaseConnection[]>([]);
    const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);

    // Data Preview Modal state
    const [previewModal, setPreviewModal] = useState<{ connId: string; connName: string; connType: string; tableName: string } | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [previewColumns, setPreviewColumns] = useState<{ name: string; type: string }[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [creatingDataset, setCreatingDataset] = useState(false);

    useEffect(() => {
        const fetchConnections = async () => {
            try {
                const data = await api.connections.getAll();
                setConnections(data);
            } catch (e) {
                console.error("Failed to load connections", e);
            }
        };
        fetchConnections();
    }, []);

    const handleDeleteConnection = async (id: string) => {
        if (window.confirm('Are you sure you want to remove this connection? This will remove all associated schema metadata.')) {
            try {
                await api.connections.delete(id);
                setConnections(connections.filter(c => c.id !== id));
            } catch (e) {
                console.error("Failed to delete connection", e);
                alert("Failed to remove connection");
            }
        }
    };

    // View Data handler
    const handleViewData = async (connId: string, connName: string, connType: string, tableName: string) => {
        setPreviewModal({ connId, connName, connType, tableName });
        setPreviewData([]);
        setPreviewColumns([]);
        setPreviewError('');
        setPreviewLoading(true);
        try {
            const payload = connType === 'mongodb' ? { collection: tableName, limit: 50 } : { table: tableName, limit: 50 };
            const res = await api.connections.query(connId, payload);
            setPreviewData(res.data);
            setPreviewColumns(res.columns);
        } catch (e: any) {
            setPreviewError(e.message || 'Failed to fetch data');
        } finally {
            setPreviewLoading(false);
        }
    };

    // Create Dataset handler
    const handleCreateDataset = async () => {
        if (!previewModal || previewData.length === 0) return;
        setCreatingDataset(true);
        try {
            const firstRow = previewData[0];
            const columns = Object.keys(firstRow).map(key => {
                const value = firstRow[key];
                let type: 'string' | 'number' | 'boolean' = 'string';
                if (typeof value === 'number') type = 'number';
                else if (typeof value === 'boolean') type = 'boolean';
                return { name: key, type, description: key };
            });

            const newDataset = await api.datasets.createExternal({
                name: `${previewModal.connName} - ${previewModal.tableName}`,
                description: `Live data from ${previewModal.connType} connection: ${previewModal.tableName}`,
                sourceType: previewModal.connType as any,
                columns,
                data: previewData
            });

            if (onAddDataset) onAddDataset(newDataset);
            alert(`Dataset "${newDataset.name}" created! You can now use it in Dashboards.`);
            setPreviewModal(null);
        } catch (e: any) {
            alert('Failed to create dataset: ' + (e.message || 'Unknown error'));
        } finally {
            setCreatingDataset(false);
        }
    };

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

    return (<>
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
                    <div className="w-px bg-slate-700 mx-1"></div>
                    <button
                        onClick={() => setIsConnectionModalOpen(true)}
                        className="flex items-center space-x-2 px-4 py-2 rounded-md transition-colors text-sm font-medium text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
                    >
                        <Plus size={16} />
                        <span>Add Connection</span>
                    </button>
                </div>
            </div>

            {isConnectionModalOpen && (
                <ConnectionManagerModal
                    onClose={() => setIsConnectionModalOpen(false)}
                    onSuccess={(newConn) => {
                        setConnections([...connections, newConn]);
                        setIsConnectionModalOpen(false);
                    }}
                />
            )}

            <div className="flex-1 overflow-hidden relative">
                {/* ER Diagram View */}
                {activeTab === 'er' && (
                    <div className="h-full w-full bg-slate-950 overflow-auto p-12 custom-scrollbar relative" style={{ backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
                        {datasets.length === 0 && connections.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-slate-500">No schema data available.</div>
                        ) : (
                            <div className="flex flex-col gap-16 pb-20">

                                {connections.length > 0 && (
                                    <div className="space-y-6">
                                        <h3 className="text-xl font-bold border-b border-slate-800 pb-2 text-slate-300 flex items-center gap-2">
                                            <Cable className="text-emerald-500" /> Connected Databases
                                        </h3>
                                        {connections.map(conn => (
                                            <div key={conn.id} className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800">
                                                <div className="mb-6 flex items-center gap-3">
                                                    <div className="h-10 w-10 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/20">
                                                        <Database className="text-emerald-400" size={20} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-bold text-white">{conn.name}</h4>
                                                        <p className="text-xs text-slate-400">{conn.type} &bull; {conn.tables.length} tables</p>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteConnection(conn.id)}
                                                        className="ml-auto p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                        title="Remove Connection"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>

                                                <div className="flex flex-wrap gap-8 items-start">
                                                    {conn.tables.map(table => (
                                                        <div key={`${conn.id}-${table.name}`} className="w-80 bg-slate-900/80 border border-slate-700/80 rounded-xl shadow-xl overflow-hidden flex flex-col hover:border-emerald-500/50 transition-colors">
                                                            <div className="bg-slate-800/80 px-4 py-3 border-b border-slate-700 flex items-center gap-2">
                                                                <LayoutTemplate size={16} className="text-slate-400" />
                                                                <h3 className="font-bold text-slate-200 truncate">{table.name}</h3>
                                                                <button
                                                                    onClick={() => handleViewData(conn.id, conn.name, conn.type, table.name)}
                                                                    className="ml-auto flex items-center gap-1 text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded transition-colors"
                                                                    title="View rows & columns"
                                                                >
                                                                    <Eye size={12} /> View Data
                                                                </button>
                                                            </div>
                                                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                                                <table className="w-full text-left text-xs">
                                                                    <tbody className="divide-y divide-slate-800/30">
                                                                        {table.columns.map(col => {
                                                                            const isFk = table.foreignKeys.find(fk => fk.column === col.name);
                                                                            return (
                                                                                <tr key={col.name} className="hover:bg-slate-800/30 transition-colors">
                                                                                    <td className="py-2 px-4 font-mono text-slate-300 w-1/2 flex items-center gap-1.5 break-all">
                                                                                        {col.isPrimaryKey && <Key size={12} className="text-yellow-500 shrink-0" title="Primary Key" />}
                                                                                        {isFk && <Cable size={12} className="text-emerald-400 shrink-0" title={`Foreign Key to ${isFk.referenceTable}.${isFk.referenceColumn}`} />}
                                                                                        {col.name}
                                                                                    </td>
                                                                                    <td className="py-2 px-4 text-slate-500 text-right w-1/2 break-all">{col.type}</td>
                                                                                </tr>
                                                                            );
                                                                        })}
                                                                        {table.columns.length === 0 && (
                                                                            <tr><td colSpan={2} className="py-4 text-center text-slate-600 italic">No columns found</td></tr>
                                                                        )}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {datasets.length > 0 && (
                                    <div className="space-y-6">
                                        <h3 className="text-xl font-bold border-b border-slate-800 pb-2 text-slate-300 flex items-center gap-2">
                                            <Database className="text-blue-500" /> Static Datasets
                                        </h3>
                                        <div className="flex flex-wrap gap-8 items-start">
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
                                    </div>
                                )}

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

        {/* Data Preview Modal */}
        {previewModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
                    {/* Header */}
                    <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-4 shrink-0">
                        <div className="h-10 w-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20">
                            <TableIcon className="text-blue-400" size={20} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-white">{previewModal.tableName}</h2>
                            <p className="text-xs text-slate-400">{previewModal.connName} &bull; {previewModal.connType} &bull; {previewData.length} rows loaded</p>
                        </div>
                        <button
                            onClick={handleCreateDataset}
                            disabled={creatingDataset || previewData.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 shadow-lg shadow-emerald-900/20"
                        >
                            {creatingDataset ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                            {creatingDataset ? 'Creating...' : 'Create Dataset for Dashboard'}
                        </button>
                        <button onClick={() => setPreviewModal(null)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto">
                        {previewLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <Loader2 size={32} className="animate-spin text-blue-400" />
                                <span className="ml-3 text-slate-400">Fetching live data...</span>
                            </div>
                        ) : previewError ? (
                            <div className="flex items-center justify-center h-64 text-red-400">
                                <p>{previewError}</p>
                            </div>
                        ) : previewData.length === 0 ? (
                            <div className="flex items-center justify-center h-64 text-slate-500">
                                <p>No data found in this table.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-800/80 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-700 w-10">#</th>
                                        {previewColumns.map(col => (
                                            <th key={col.name} className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-700 whitespace-nowrap">
                                                {col.name}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {previewData.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-800/30 transition-colors">
                                            <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{i + 1}</td>
                                            {previewColumns.map(col => (
                                                <td key={col.name} className="px-4 py-2.5 text-slate-300 font-mono text-xs max-w-[200px] truncate" title={String(row[col.name] ?? '')}>
                                                    {row[col.name] === null || row[col.name] === undefined
                                                        ? <span className="text-slate-600 italic">NULL</span>
                                                        : typeof row[col.name] === 'object'
                                                            ? JSON.stringify(row[col.name])
                                                            : String(row[col.name])}
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
        )}
    </>);
};

export default SchemaView;
