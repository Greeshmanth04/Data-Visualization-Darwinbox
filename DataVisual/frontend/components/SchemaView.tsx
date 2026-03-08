import React, { useState, useEffect, useMemo } from 'react';
import { Dataset, DatabaseConnection, User, CrossDBRelationship, JoinType, RowPolicy, UserRole } from '../types';
import { Database, Search, Edit2, Save, X, LayoutTemplate, Share2, Plus, Cable, Key, Trash2, Table as TableIcon, Download, Loader2, RefreshCw, AlertTriangle, Link2, Layers, Eye, ShieldCheck, Filter } from 'lucide-react';
import { api } from '../services/api';
import { ConnectionManagerModal } from './ConnectionManagerModal';

const DB_COLORS: Record<string, string> = { mysql: '#10b981', postgres: '#3b82f6', mongodb: '#a855f7', default: '#64748b' };
const DB_BORDER: Record<string, string> = { mysql: 'border-emerald-500/60', postgres: 'border-blue-500/60', mongodb: 'border-purple-500/60', default: 'border-slate-500/60' };
const DB_BG: Record<string, string> = { mysql: 'bg-emerald-500/10', postgres: 'bg-blue-500/10', mongodb: 'bg-purple-500/10', default: 'bg-slate-500/10' };
const DB_BADGE: Record<string, string> = { mysql: 'bg-emerald-900/60 text-emerald-300 border border-emerald-500/30', postgres: 'bg-blue-900/60 text-blue-300 border border-blue-500/30', mongodb: 'bg-purple-900/60 text-purple-300 border border-purple-500/30', default: 'bg-slate-800 text-slate-300 border border-slate-600' };
const dbColor = (type: string) => DB_COLORS[type] ?? DB_COLORS.default;
const dbBadge = (type: string) => DB_BADGE[type] ?? DB_BADGE.default;

interface SchemaViewProps {
    datasets: Dataset[];
    onUpdateDataset: (d: Dataset) => Promise<void>;
    onAddDataset?: (d: Dataset) => void;
    currentUser?: User | null;
}

// ── Relationship Creator Modal ────────────────────────────────────────────────
interface RelModalProps {
    connections: DatabaseConnection[];
    existing?: CrossDBRelationship;
    onSave: (rel: Omit<CrossDBRelationship, 'id'>) => Promise<void>;
    onClose: () => void;
}
const RelationshipModal: React.FC<RelModalProps> = ({ connections, existing, onSave, onClose }) => {
    const empty = { sourceConnectionId: '', sourceTable: '', sourceColumn: '', targetConnectionId: '', targetTable: '', targetColumn: '', joinType: '1:N' as JoinType };
    const [form, setForm] = useState(existing ? { ...existing } : { ...empty });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');
    const srcConn = connections.find(c => c.id === form.sourceConnectionId);
    const tgtConn = connections.find(c => c.id === form.targetConnectionId);
    const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
    const handleSave = async () => {
        if (!form.sourceConnectionId || !form.sourceTable || !form.sourceColumn || !form.targetConnectionId || !form.targetTable || !form.targetColumn) { setErr('All fields required'); return; }
        setSaving(true);
        try { await onSave(form); onClose(); } catch (e: any) { setErr(e.message || 'Save failed'); } finally { setSaving(false); }
    };
    const sel = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500';
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg">
                <div className="px-6 py-4 border-b border-slate-800 flex items-center gap-3">
                    <Link2 className="text-blue-400" size={20} />
                    <h2 className="text-lg font-bold text-white">{existing ? 'Edit' : 'Create'} Cross-DB Relationship</h2>
                    <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"><X size={16} /></button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Source</p>
                            <select className={sel} value={form.sourceConnectionId} onChange={e => set('sourceConnectionId', e.target.value)}>
                                <option value="">Select DB…</option>
                                {connections.map(c => <option key={c.id} value={c.id}>[{c.type}] {c.name}</option>)}
                            </select>
                            <select className={sel} value={form.sourceTable} onChange={e => set('sourceTable', e.target.value)} disabled={!srcConn}>
                                <option value="">Select Table…</option>
                                {srcConn?.tables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                            </select>
                            <select className={sel} value={form.sourceColumn} onChange={e => set('sourceColumn', e.target.value)} disabled={!form.sourceTable}>
                                <option value="">Select Column…</option>
                                {srcConn?.tables.find(t => t.name === form.sourceTable)?.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target</p>
                            <select className={sel} value={form.targetConnectionId} onChange={e => set('targetConnectionId', e.target.value)}>
                                <option value="">Select DB…</option>
                                {connections.map(c => <option key={c.id} value={c.id}>[{c.type}] {c.name}</option>)}
                            </select>
                            <select className={sel} value={form.targetTable} onChange={e => set('targetTable', e.target.value)} disabled={!tgtConn}>
                                <option value="">Select Table…</option>
                                {tgtConn?.tables.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                            </select>
                            <select className={sel} value={form.targetColumn} onChange={e => set('targetColumn', e.target.value)} disabled={!form.targetTable}>
                                <option value="">Select Column…</option>
                                {tgtConn?.tables.find(t => t.name === form.targetTable)?.columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Join Type</p>
                        <select className={sel} value={form.joinType} onChange={e => set('joinType', e.target.value as JoinType)}>
                            {(['1:1', '1:N', 'N:1'] as JoinType[]).map(j => <option key={j} value={j}>{j}</option>)}
                        </select>
                    </div>
                    {err && <p className="text-red-400 text-sm flex items-center gap-2"><AlertTriangle size={14} />{err}</p>}
                    {form.sourceTable && form.targetTable && (
                        <div className="bg-slate-950/60 border border-slate-700 rounded-lg px-4 py-2 text-xs font-mono text-slate-300">
                            <span style={{ color: dbColor(srcConn?.type || '') }}>{form.sourceTable}</span>.{form.sourceColumn}
                            <span className="text-slate-500 mx-2">→ ({form.joinType}) →</span>
                            <span style={{ color: dbColor(tgtConn?.type || '') }}>{form.targetTable}</span>.{form.targetColumn}
                        </div>
                    )}
                </div>
                <div className="px-6 py-4 border-t border-slate-800 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors">Cancel</button>
                    <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} {existing ? 'Update' : 'Create'} Relationship
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const SchemaView: React.FC<SchemaViewProps> = ({ datasets, onUpdateDataset, onAddDataset, currentUser }) => {
    const [activeTab, setActiveTab] = useState<'er' | 'relationships'>('er');
    const [connections, setConnections] = useState<DatabaseConnection[]>([]);
    const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
    const [failedIds, setFailedIds] = useState<Record<string, string>>({});
    const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
    const [relationships, setRelationships] = useState<CrossDBRelationship[]>([]);
    const [showRelModal, setShowRelModal] = useState(false);
    const [editingRel, setEditingRel] = useState<CrossDBRelationship | undefined>();
    const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(datasets[0]?.id || null);
    const [searchTerm, setSearchTerm] = useState('');
    const [previewModal, setPreviewModal] = useState<{ connId: string; connName: string; connType: string; tableName: string } | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [previewColumns, setPreviewColumns] = useState<{ name: string; type: string }[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState('');
    const [creatingDataset, setCreatingDataset] = useState(false);
    const isAdmin = currentUser?.role === 'ADMIN';


    // Merge / join state
    const [joinModal, setJoinModal] = useState<{
        rel: CrossDBRelationship;
        data: any[];
        columns: { name: string; type: string }[];
        meta: any;
    } | null>(null);
    const [joiningId, setJoiningId] = useState<string | null>(null);
    const [joinError, setJoinError] = useState<string>('');
    const [savingMerge, setSavingMerge] = useState(false);
    const [mergeName, setMergeName] = useState('');

    useEffect(() => {
        api.connections.getAll().then(setConnections).catch(e => console.error('Failed to load connections', e));
        api.schema.getRelationships().then(setRelationships).catch(() => { });
    }, []);

    const handleRefresh = async (connId: string) => {
        setRefreshingIds(p => new Set(p).add(connId));
        setFailedIds(p => { const n = { ...p }; delete n[connId]; return n; });
        try {
            const updated = await api.connections.refresh(connId);
            setConnections(p => p.map(c => c.id === connId ? { ...c, tables: (updated as any).tables || c.tables } : c));
        } catch (e: any) {
            setFailedIds(p => ({ ...p, [connId]: e.message || 'Refresh failed' }));
        } finally {
            setRefreshingIds(p => { const n = new Set(p); n.delete(connId); return n; });
        }
    };

    const handleDeleteConnection = async (id: string) => {
        if (!window.confirm('Remove this connection?')) return;
        try { await api.connections.delete(id); setConnections(p => p.filter(c => c.id !== id)); }
        catch { alert('Failed to remove connection'); }
    };

    const handleViewData = async (connId: string, connName: string, connType: string, tableName: string) => {
        setPreviewModal({ connId, connName, connType, tableName });
        setPreviewData([]); setPreviewColumns([]); setPreviewError(''); setPreviewLoading(true);
        try {
            const payload = connType === 'mongodb' ? { collection: tableName, limit: 50 } : { table: tableName, limit: 50 };
            const res = await api.connections.query(connId, payload);
            setPreviewData(res.data); setPreviewColumns(res.columns);
        } catch (e: any) { setPreviewError(e.message || 'Failed to fetch data'); }
        finally { setPreviewLoading(false); }
    };

    const handleCreateDataset = async () => {
        if (!previewModal || previewData.length === 0) return;
        setCreatingDataset(true);
        try {
            const columns = Object.keys(previewData[0]).map(k => {
                const v = previewData[0][k]; const type = typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'string';
                return { name: k, type, description: k };
            });
            const ds = await api.datasets.createExternal({ name: `${previewModal.connName} - ${previewModal.tableName}`, description: `Live data from ${previewModal.connType}`, sourceType: previewModal.connType as any, columns, data: previewData });
            if (onAddDataset) onAddDataset(ds);
            alert(`Dataset "${ds.name}" created!`);
            setPreviewModal(null);
        } catch (e: any) { alert('Failed: ' + (e.message || 'Unknown error')); }
        finally { setCreatingDataset(false); }
    };

    const handleSaveRel = async (rel: Omit<CrossDBRelationship, 'id'>) => {
        if (editingRel) {
            const updated = await api.schema.updateRelationship(editingRel.id, rel);
            setRelationships(p => p.map(r => r.id === editingRel.id ? updated : r));
        } else {
            const created = await api.schema.createRelationship(rel);
            setRelationships(p => [...p, created]);
        }
        setEditingRel(undefined);
    };

    const handleDeleteRel = async (id: string) => {
        if (!window.confirm('Delete this relationship?')) return;
        try { await api.schema.deleteRelationship(id); setRelationships(p => p.filter(r => r.id !== id)); }
        catch { alert('Failed to delete relationship'); }
    };

    const handleExecuteJoin = async (rel: CrossDBRelationship) => {
        setJoiningId(rel.id);
        setJoinError('');
        setMergeName(`${rel.sourceTable} × ${rel.targetTable}`);
        try {
            const result = await api.schema.executeJoin(rel.id, 2000);
            setJoinModal({ rel, data: result.data, columns: result.columns, meta: result.meta });
        } catch (e: any) {
            setJoinError(e.message || 'Join failed');
        } finally {
            setJoiningId(null);
        }
    };

    const handleSaveMergedDataset = async () => {
        if (!joinModal || !mergeName.trim()) return;
        setSavingMerge(true);
        try {
            const ds = await api.schema.createMergedDataset(joinModal.rel.id, {
                name: mergeName.trim(),
                description: `Merged: ${joinModal.meta.sourceDB}.${joinModal.meta.sourceTable} × ${joinModal.meta.targetDB}.${joinModal.meta.targetTable}`,
                data: joinModal.data,
                columns: joinModal.columns
            });
            if (onAddDataset) onAddDataset(ds);
            alert(`✅ Dataset "${mergeName}" created! You can now use it in Dashboards.`);
            setJoinModal(null);
        } catch (e: any) {
            alert('Failed to save: ' + (e.message || 'Unknown error'));
        } finally {
            setSavingMerge(false);
        }
    };

    const selectedDataset = useMemo(() => datasets.find(d => d.id === selectedDatasetId) || null, [datasets, selectedDatasetId]);
    const filteredColumns = useMemo(() => {
        if (!selectedDataset) return [];
        if (!searchTerm) return selectedDataset.columns;
        const t = searchTerm.toLowerCase();
        return selectedDataset.columns.filter(c => c.name.toLowerCase().includes(t) || (c.displayName || '').toLowerCase().includes(t) || (c.description || '').toLowerCase().includes(t));
    }, [selectedDataset, searchTerm]);


    const tabBtn = (key: typeof activeTab, label: string, icon: React.ReactNode) => (
        <button onClick={() => setActiveTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors text-sm font-medium ${activeTab === key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {icon}<span>{label}</span>
        </button>
    );

    return (<>
        <div className="flex flex-col h-full bg-slate-900 text-slate-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xl font-bold flex items-center gap-2"><Database className="text-blue-500" />Schema Management</h2>
                    {isAdmin && (
                        <button onClick={() => setIsConnectionModalOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 text-sm transition-colors">
                            <Plus size={14} />Add Connection
                        </button>
                    )}
                </div>



                {/* Tab Bar */}
                <div className="flex gap-1 bg-slate-800 p-1 rounded-lg w-fit">
                    {tabBtn('er', 'ER Diagram', <Share2 size={15} />)}
                    {tabBtn('relationships', `Relationships (${relationships.length})`, <Link2 size={15} />)}
                </div>
            </div>

            {isConnectionModalOpen && (
                <ConnectionManagerModal onClose={() => setIsConnectionModalOpen(false)} onSuccess={newConn => { setConnections(p => [...p, newConn]); setIsConnectionModalOpen(false); }} />
            )}
            {showRelModal && (
                <RelationshipModal connections={connections} existing={editingRel} onSave={handleSaveRel} onClose={() => { setShowRelModal(false); setEditingRel(undefined); }} />
            )}

            <div className="flex-1 overflow-hidden relative">

                {/* ── ER Diagram ── */}
                {activeTab === 'er' && (
                    <div className="h-full w-full overflow-auto p-8 custom-scrollbar" style={{ backgroundImage: 'radial-gradient(#334155 1px,transparent 1px)', backgroundSize: '30px 30px' }}>
                        {connections.length === 0 && datasets.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                                <Database size={48} className="opacity-20" />
                                <p>No databases selected. Add a connection or adjust the DB selector above.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-12">
                                {/* Failed DB warnings */}
                                {Object.entries(failedIds).map(([id, msg]) => (
                                    <div key={id} className="flex items-center gap-3 px-4 py-3 bg-amber-900/30 border border-amber-500/40 rounded-xl text-amber-300 text-sm">
                                        <AlertTriangle size={16} className="shrink-0" />
                                        <span>Connection <strong>{connections.find(c => c.id === id)?.name || id}</strong> refresh failed: {msg}. Schema may be stale.</span>
                                    </div>
                                ))}

                                {connections.map(conn => (
                                    <div key={conn.id} className="space-y-4">
                                        {/* DB Group Header */}
                                        <div className={`flex items-center gap-3 px-5 py-3 rounded-xl border ${DB_BG[conn.type] || DB_BG.default} ${DB_BORDER[conn.type] || DB_BORDER.default}`}>
                                            <div className="w-3 h-3 rounded-full" style={{ background: dbColor(conn.type) }} />
                                            <div>
                                                <h3 className="font-bold text-white flex items-center gap-2">
                                                    {conn.name}
                                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${dbBadge(conn.type)}`}>{conn.type}</span>
                                                </h3>
                                                <p className="text-xs text-slate-400">{conn.tables.length} tables</p>
                                            </div>
                                            <div className="ml-auto flex items-center gap-2">
                                                {isAdmin && (
                                                    <button onClick={() => handleRefresh(conn.id)} disabled={refreshingIds.has(conn.id)}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors disabled:opacity-50">
                                                        <RefreshCw size={12} className={refreshingIds.has(conn.id) ? 'animate-spin' : ''} />
                                                        {refreshingIds.has(conn.id) ? 'Refreshing…' : 'Refresh Schema'}
                                                    </button>
                                                )}
                                                {isAdmin && (
                                                    <button onClick={() => handleDeleteConnection(conn.id)} className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"><Trash2 size={16} /></button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Table Cards */}
                                        <div className="flex flex-wrap gap-6 pl-4">
                                            {conn.tables.length === 0 && <p className="text-slate-500 text-sm italic">No tables found.</p>}
                                            {conn.tables.map(table => {
                                                const crossRels = relationships.filter(r =>
                                                    (r.sourceConnectionId === conn.id && r.sourceTable === table.name) ||
                                                    (r.targetConnectionId === conn.id && r.targetTable === table.name)
                                                );
                                                return (
                                                    <div key={`${conn.id}-${table.name}`} className={`w-72 bg-slate-900/90 border rounded-xl shadow-xl overflow-hidden flex flex-col transition-all hover:shadow-2xl ${crossRels.length > 0 ? 'border-violet-500/50' : (DB_BORDER[conn.type] || 'border-slate-700/80')}`}>
                                                        <div className="px-3 py-2.5 border-b border-slate-700 flex items-center gap-2" style={{ borderLeftWidth: 3, borderLeftColor: dbColor(conn.type) }}>
                                                            <LayoutTemplate size={14} className="text-slate-400 shrink-0" />
                                                            <h3 className="font-bold text-slate-200 truncate text-sm flex-1">{table.name}</h3>
                                                            {crossRels.length > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-900/60 text-violet-300 border border-violet-500/30 shrink-0">{crossRels.length} links</span>}
                                                            <button onClick={() => handleViewData(conn.id, conn.name, conn.type, table.name)}
                                                                className="shrink-0 flex items-center gap-1 text-[10px] uppercase font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-2 py-1 rounded transition-colors">
                                                                <Eye size={10} />View
                                                            </button>
                                                        </div>
                                                        <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                                            <table className="w-full text-left text-xs">
                                                                <tbody className="divide-y divide-slate-800/30">
                                                                    {table.columns.map(col => {
                                                                        const isFk = table.foreignKeys.find(fk => fk.column === col.name);
                                                                        return (
                                                                            <tr key={col.name} className="hover:bg-slate-800/30 transition-colors">
                                                                                <td className="py-1.5 px-3 font-mono text-slate-300 w-1/2 flex items-center gap-1.5 break-all">
                                                                                    {col.isPrimaryKey && <Key size={10} className="text-yellow-500 shrink-0" title="Primary Key" />}
                                                                                    {isFk && <Cable size={10} className="text-emerald-400 shrink-0" title={`FK → ${isFk.referenceTable}.${isFk.referenceColumn}`} />}
                                                                                    {col.name}
                                                                                </td>
                                                                                <td className="py-1.5 px-3 text-slate-500 text-right w-1/2 break-all">{col.type}</td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                    {table.columns.length === 0 && <tr><td colSpan={2} className="py-3 text-center text-slate-600 italic">No columns</td></tr>}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                        {crossRels.length > 0 && (
                                                            <div className="px-3 py-2 border-t border-violet-500/20 bg-violet-950/20">
                                                                {crossRels.map(r => {
                                                                    const isSrc = r.sourceConnectionId === conn.id && r.sourceTable === table.name;
                                                                    const otherConnId = isSrc ? r.targetConnectionId : r.sourceConnectionId;
                                                                    const otherTable = isSrc ? r.targetTable : r.sourceTable;
                                                                    const otherConn = connections.find(c => c.id === otherConnId);
                                                                    return (
                                                                        <div key={r.id} className="text-[10px] text-violet-300 flex items-center gap-1 py-0.5">
                                                                            <Link2 size={9} className="shrink-0" />
                                                                            <span className="font-mono">{isSrc ? r.sourceColumn : r.targetColumn}</span>
                                                                            <span className="text-slate-500">↔ ({r.joinType})</span>
                                                                            <span style={{ color: dbColor(otherConn?.type || '') }}>[{otherConn?.type || '?'}]</span>
                                                                            <span className="font-mono">{otherTable}.{isSrc ? r.targetColumn : r.sourceColumn}</span>
                                                                        </div>
                                                                    );
                                                                })}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}

                                {/* Static Datasets */}
                                {datasets.length > 0 && (
                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-slate-300 border-b border-slate-800 pb-2 flex items-center gap-2"><Database size={18} className="text-blue-500" />Static Datasets</h3>
                                        <div className="flex flex-wrap gap-6 pl-4">
                                            {datasets.map(ds => (
                                                <div key={ds.id} className="w-72 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden hover:border-blue-500/50 transition-colors">
                                                    <div className="bg-slate-800 px-3 py-2.5 border-b border-slate-700 flex items-center gap-2">
                                                        <Database size={14} className="text-blue-400" />
                                                        <h3 className="font-bold text-slate-100 truncate text-sm flex-1">{ds.name}</h3>
                                                        <span className="text-[10px] uppercase font-bold text-slate-500 bg-slate-950 px-2 py-0.5 rounded">{ds.sourceType}</span>
                                                    </div>
                                                    <div className="max-h-64 overflow-y-auto custom-scrollbar">
                                                        <table className="w-full text-left text-xs">
                                                            <tbody className="divide-y divide-slate-800/50">
                                                                {ds.columns.map(col => (
                                                                    <tr key={col.name} className="hover:bg-slate-800/30"><td className="py-1.5 px-3 font-mono text-slate-300 w-1/2 break-all">{col.displayName || col.name}</td><td className="py-1.5 px-3 text-slate-500 text-right w-1/2">{col.type}</td></tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                    <div className="px-3 py-2 border-t border-slate-700 text-center">
                                                        <span className="text-[10px] text-slate-500 italic">Static Dataset</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}


                {/* ── Relationships ── */}
                {activeTab === 'relationships' && (
                    <div className="h-full overflow-auto custom-scrollbar p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-slate-200 flex items-center gap-2"><Link2 className="text-violet-400" />Cross-DB Relationships</h3>
                            {isAdmin && (
                                <button onClick={() => { setEditingRel(undefined); setShowRelModal(true); }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors">
                                    <Plus size={15} />New Relationship
                                </button>
                            )}
                        </div>
                        {relationships.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                                <Link2 size={48} className="mb-4 opacity-20" />
                                <p className="mb-2">No cross-database relationships defined yet.</p>
                                <p className="text-sm">Create one to virtually link tables across different database connections.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {relationships.map(r => {
                                    const srcConn = connections.find(c => c.id === r.sourceConnectionId);
                                    const tgtConn = connections.find(c => c.id === r.targetConnectionId);
                                    return (
                                        <div key={r.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4 flex items-center gap-4 hover:border-violet-500/40 transition-colors group">
                                            <div className="flex-1 flex items-center gap-3 min-w-0">
                                                <div className="text-right min-w-0">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${dbBadge(srcConn?.type || '')}`}>{srcConn?.type || '?'}</span>
                                                    <p className="font-bold text-white text-sm mt-1">{r.sourceConnectionName || srcConn?.name}</p>
                                                    <p className="font-mono text-xs text-slate-400">{r.sourceTable}.<span className="text-slate-200">{r.sourceColumn}</span></p>
                                                </div>
                                                <div className="flex flex-col items-center shrink-0 px-2">
                                                    <div className="w-16 h-px border-t-2 border-dashed border-violet-500/60"></div>
                                                    <span className="text-[10px] font-bold text-violet-400 mt-1 bg-violet-950/50 px-2 py-0.5 rounded">{r.joinType}</span>
                                                    <div className="w-16 h-px border-t-2 border-dashed border-violet-500/60 mt-1"></div>
                                                </div>
                                                <div className="min-w-0">
                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${dbBadge(tgtConn?.type || '')}`}>{tgtConn?.type || '?'}</span>
                                                    <p className="font-bold text-white text-sm mt-1">{r.targetConnectionName || tgtConn?.name}</p>
                                                    <p className="font-mono text-xs text-slate-400">{r.targetTable}.<span className="text-slate-200">{r.targetColumn}</span></p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                {/* Execute Join — always visible */}
                                                <button
                                                    onClick={() => handleExecuteJoin(r)}
                                                    disabled={joiningId === r.id}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30 text-xs font-medium transition-colors disabled:opacity-50">
                                                    {isAdmin && (
                                                        <>
                                                            {joiningId === r.id
                                                                ? <Loader2 size={12} className="animate-spin" />
                                                                : <Layers size={12} />}
                                                            {joiningId === r.id ? 'Fetching…' : 'Execute Join'}
                                                        </>
                                                    )}
                                                    {!isAdmin && (
                                                        <>
                                                            <Layers size={12} />
                                                            Preview Result
                                                        </>
                                                    )}
                                                </button>
                                                {isAdmin && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => { setEditingRel(r); setShowRelModal(true); }} className="p-2 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-blue-400 transition-colors"><Edit2 size={15} /></button>
                                                        <button onClick={() => handleDeleteRel(r.id)} className="p-2 rounded-lg hover:bg-red-900/30 text-slate-400 hover:text-red-400 transition-colors"><Trash2 size={15} /></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Join error banner */}
                        {joinError && (
                            <div className="mt-4 flex items-center gap-3 px-4 py-3 bg-red-900/30 border border-red-500/40 rounded-xl text-red-300 text-sm">
                                <AlertTriangle size={16} className="shrink-0" />
                                <span>{joinError}</span>
                                <button onClick={() => setJoinError('')} className="ml-auto"><X size={14} /></button>
                            </div>
                        )}

                        {/* SQL Hint Panel */}
                        {relationships.length > 0 && (
                            <div className="mt-8 bg-slate-950 border border-slate-700 rounded-xl p-5">
                                <h4 className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2"><TableIcon size={14} className="text-blue-400" />SQL Editor — Virtual Join Hints</h4>
                                <div className="space-y-2">
                                    {relationships.map(r => {
                                        const srcConn = connections.find(c => c.id === r.sourceConnectionId);
                                        const tgtConn = connections.find(c => c.id === r.targetConnectionId);
                                        return (
                                            <div key={r.id} className="font-mono text-xs bg-slate-900 rounded-lg px-4 py-2.5 text-slate-300 border border-slate-800">
                                                <span className="text-slate-500">-- [{srcConn?.type || '?'}→{tgtConn?.type || '?'}] </span>
                                                <span className="text-blue-300">SELECT</span> * <span className="text-blue-300">FROM</span>{' '}
                                                <span style={{ color: dbColor(srcConn?.type || '') }}>{r.sourceTable}</span>
                                                {' '}<span className="text-blue-300">JOIN</span>{' '}
                                                <span style={{ color: dbColor(tgtConn?.type || '') }}>{r.targetTable}</span>
                                                {' '}<span className="text-blue-300">ON</span>{' '}
                                                {r.sourceTable}.{r.sourceColumn} = {r.targetTable}.{r.targetColumn}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}



            </div>
        </div>


        {/* Data Preview Modal */}
        {previewModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-6xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-4 shrink-0">
                        <div className="h-10 w-10 bg-blue-500/10 rounded-lg flex items-center justify-center border border-blue-500/20"><TableIcon className="text-blue-400" size={20} /></div>
                        <div className="flex-1">
                            <h2 className="text-xl font-bold text-white">{previewModal.tableName}</h2>
                            <p className="text-xs text-slate-400">{previewModal.connName} · {previewModal.connType} · {previewData.length} rows</p>
                        </div>
                        <button onClick={handleCreateDataset} disabled={creatingDataset || previewData.length === 0}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50">
                            {creatingDataset ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                            {creatingDataset ? 'Creating…' : 'Create Dataset'}
                        </button>
                        <button onClick={() => setPreviewModal(null)} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"><X size={20} /></button>
                    </div>
                    <div className="flex-1 overflow-auto">
                        {previewLoading ? (
                            <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-blue-400" /><span className="ml-3 text-slate-400">Fetching live data…</span></div>
                        ) : previewError ? (
                            <div className="flex items-center justify-center h-64 text-red-400"><p>{previewError}</p></div>
                        ) : previewData.length === 0 ? (
                            <div className="flex items-center justify-center h-64 text-slate-500"><p>No data found.</p></div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-800/80 sticky top-0 z-10"><tr>
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-700 w-10">#</th>
                                    {previewColumns.map(c => <th key={c.name} className="px-4 py-3 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-700 whitespace-nowrap">{c.name}</th>)}
                                </tr></thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {previewData.map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-800/30">
                                            <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{i + 1}</td>
                                            {previewColumns.map(c => (
                                                <td key={c.name} className="px-4 py-2.5 text-slate-300 font-mono text-xs max-w-[200px] truncate" title={String(row[c.name] ?? '')}>
                                                    {row[c.name] === null || row[c.name] === undefined ? <span className="text-slate-600 italic">NULL</span> : typeof row[c.name] === 'object' ? JSON.stringify(row[c.name]) : String(row[c.name])}
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
        {/* ── Merge Preview Modal ── */}
        {joinModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
                <div className="bg-slate-900 border border-slate-700 w-full max-w-7xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
                    <div className="px-6 py-5 border-b border-slate-800 flex items-center gap-4 shrink-0">
                        <Layers size={22} className="text-emerald-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <h2 className="text-xl font-bold text-white">Merged Data Preview</h2>
                            <div className="flex flex-wrap gap-4 mt-1 text-xs text-slate-400">
                                <span><span className="font-semibold" style={{ color: dbColor(joinModal.meta.sourceType) }}>{joinModal.meta.sourceDB}</span> · {joinModal.meta.sourceTable}</span>
                                <span className="text-slate-600">⟺ ({joinModal.rel.joinType})</span>
                                <span><span className="font-semibold" style={{ color: dbColor(joinModal.meta.targetType) }}>{joinModal.meta.targetDB}</span> · {joinModal.meta.targetTable}</span>
                                <span className="text-slate-600 mx-1">|</span>
                                <span className="font-mono">{joinModal.meta.joinColumn}</span>
                                <span className="bg-emerald-900/40 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">{joinModal.meta.rowCount.toLocaleString()} total rows</span>
                                {joinModal.meta.matchedCount !== undefined && (
                                    <>
                                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${joinModal.meta.matchedCount > 0 ? 'bg-green-900/40 text-green-300 border-green-500/30' : 'bg-amber-900/40 text-amber-300 border-amber-500/30'}`}>
                                            {joinModal.meta.matchedCount} matched
                                        </span>
                                        {joinModal.meta.unmatchedCount > 0 && (
                                            <span className="bg-slate-800 text-slate-400 border border-slate-600 px-2 py-0.5 rounded text-[10px]">
                                                {joinModal.meta.unmatchedCount} no match (NULL)
                                            </span>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        <button onClick={() => setJoinModal(null)} className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"><X size={20} /></button>
                    </div>
                    <div className="flex-1 overflow-auto">
                        {joinModal.data.length === 0 || joinModal.meta.matchedCount === 0 ? (
                            <div className="flex items-center justify-center py-10 text-slate-500 flex-col gap-3 px-8">
                                <AlertTriangle size={32} className="opacity-40 text-amber-400" />
                                <p className="font-semibold text-amber-300 text-sm">
                                    {joinModal.meta.matchedCount === 0 ? '0 rows matched — all target columns are NULL' : 'No data returned'}
                                </p>
                                <p className="text-xs text-center max-w-lg">Check that you selected the correct join columns and the values overlap between the two databases. Sample values are shown below.</p>
                                {(joinModal.meta.srcSampleKeys || joinModal.meta.tgtSampleKeys) && (
                                    <div className="flex gap-6 mt-2 text-xs font-mono">
                                        <div className="bg-slate-900 border border-emerald-500/20 rounded-lg px-4 py-3">
                                            <p className="text-slate-500 mb-2 text-[10px] uppercase tracking-wider">
                                                <span style={{ color: dbColor(joinModal.meta.sourceType) }}>{joinModal.meta.sourceTable}</span>.{joinModal.rel.sourceColumn}
                                            </p>
                                            {(joinModal.meta.srcSampleKeys || []).map((v: any, i: number) => <p key={i} className="text-emerald-300 py-0.5">{String(v)}</p>)}
                                        </div>
                                        <div className="bg-slate-900 border border-blue-500/20 rounded-lg px-4 py-3">
                                            <p className="text-slate-500 mb-2 text-[10px] uppercase tracking-wider">
                                                <span style={{ color: dbColor(joinModal.meta.targetType) }}>{joinModal.meta.targetTable}</span>.{joinModal.rel.targetColumn}
                                            </p>
                                            {(joinModal.meta.tgtSampleKeys || []).map((v: any, i: number) => <p key={i} className="text-blue-300 py-0.5">{String(v)}</p>)}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-800/80 sticky top-0 z-10"><tr>
                                    <th className="px-4 py-3 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-700 w-10">#</th>
                                    {joinModal.columns.map(c => {
                                        const isTarget = c.name.startsWith(`${joinModal.rel.targetTable}__`);
                                        return <th key={c.name} className="px-4 py-3 text-[10px] font-bold uppercase border-b border-slate-700 whitespace-nowrap"
                                            style={{ color: isTarget ? dbColor(joinModal.meta.targetType) : dbColor(joinModal.meta.sourceType) }}>
                                            {c.name.replace(`${joinModal.rel.targetTable}__`, `${joinModal.rel.targetTable}.`)}
                                        </th>;
                                    })}
                                </tr></thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {joinModal.data.slice(0, 500).map((row, i) => (
                                        <tr key={i} className="hover:bg-slate-800/30">
                                            <td className="px-4 py-2 text-slate-600 font-mono text-xs">{i + 1}</td>
                                            {joinModal.columns.map(c => (
                                                <td key={c.name} className="px-4 py-2 text-slate-300 font-mono text-xs max-w-[180px] truncate" title={String(row[c.name] ?? '')}>
                                                    {row[c.name] == null ? <span className="text-slate-600 italic">NULL</span> : typeof row[c.name] === 'object' ? JSON.stringify(row[c.name]) : String(row[c.name])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center gap-4 shrink-0">
                        <div className="flex-1">
                            <p className="text-xs text-slate-400 mb-1.5">Save as Dataset to use in Dashboards</p>
                            <input type="text" value={mergeName} onChange={e => setMergeName(e.target.value)}
                                placeholder="Dataset name…"
                                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 w-80" />
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <button onClick={() => setJoinModal(null)} className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm transition-colors">Close</button>
                            <button onClick={handleSaveMergedDataset} disabled={savingMerge || !mergeName.trim() || joinModal.data.length === 0}
                                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-colors disabled:opacity-50">
                                {savingMerge ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                                {savingMerge ? 'Creating…' : 'Create Dataset for Dashboard'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </>);

};

export default SchemaView;
