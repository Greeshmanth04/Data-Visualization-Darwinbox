import React, { useState } from 'react';
import { Database, Loader2, X, CheckCircle, AlertCircle } from 'lucide-react';
import { DatabaseConnection } from '../types';
import { api } from '../services/api';

interface Props {
    onClose: () => void;
    onSuccess: (newConnection: DatabaseConnection) => void;
}

export const ConnectionManagerModal: React.FC<Props> = ({ onClose, onSuccess }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState('mysql');
    const [uri, setUri] = useState('');

    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const currentConfig = {
        name, type, uri
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await api.connections.test(currentConfig);
            setTestResult({ success: true, message: res.message || 'Connection successful' });
        } catch (e: any) {
            setTestResult({ success: false, message: e.message || 'Connection failed' });
        } finally {
            setTesting(false);
        }
    };

    const handleSave = async () => {
        if (!name || !uri) {
            setError('Please fill out all required fields');
            return;
        }

        setSaving(true);
        setError(null);
        try {
            const newConnection = await api.connections.create(currentConfig);
            onSuccess(newConnection);
        } catch (e: any) {
            setError(e.message || 'Failed to save connection');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in relative">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900 sticky top-0 z-10">
                    <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Database className="text-blue-500" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Add Database Connection</h2>
                            <p className="text-sm text-slate-400">Extract schemas & metadata for offline mapping</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-lg flex items-start space-x-3">
                            <AlertCircle size={20} className="shrink-0 mt-0.5" />
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Connection Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Production Replica"
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Database Type</label>
                            <select
                                value={type}
                                onChange={e => setType(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow appearance-none"
                            >
                                <option value="mysql">MySQL</option>
                                <option value="postgres">PostgreSQL</option>
                                <option value="mongodb">MongoDB</option>
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-xs font-semibold text-slate-400 uppercase mb-2">Connection String URI</label>
                            <input
                                type="text"
                                value={uri}
                                onChange={e => setUri(e.target.value)}
                                placeholder={type === 'mongodb' ? "mongodb+srv://user:pass@cluster.net/db" : `${type}://user:pass@host:port/db?sslmode=require`}
                                className="w-full font-mono text-sm bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
                            />
                            <p className="text-xs text-slate-500 mt-2">Passwords extracted from this URI will be <b>AES encrypted</b> serverside.</p>
                        </div>
                    </div>

                    <div className="bg-slate-800/50 p-4 rounded-lg flex items-center justify-between border border-slate-800">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-300">Test Connection Details</span>
                            {testResult && (
                                <span className={`text-xs mt-1 flex items-center gap-1 ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                                    {testResult.success ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                                    {testResult.message}
                                </span>
                            )}
                        </div>
                        <button
                            type="button"
                            disabled={testing || !uri}
                            onClick={handleTest}
                            className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                        >
                            {testing ? <Loader2 size={16} className="animate-spin" /> : null}
                            {testing ? 'Testing...' : 'Test Connection'}
                        </button>
                    </div>
                </div>

                <div className="p-6 border-t border-slate-800 bg-slate-900 sticky bottom-0 z-10 flex space-x-4 justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={saving || !name || !uri}
                        onClick={handleSave}
                        className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-blue-500/20"
                    >
                        {saving ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
                        {saving ? 'Importing Schema...' : 'Save & Import Metadata'}
                    </button>
                </div>
            </div>
        </div>
    );
};
