import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { Users, Search, Check, X, Trash2, Mail, Clock } from 'lucide-react';
import { api } from '../services/api';

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    try {
        const data = await api.users.getAll();
        setUsers(data);
    } catch (e) {
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (userId: string) => {
    await api.users.update(userId, { status: 'active' });
    fetchUsers();
  };

  const handleReject = async (userId: string) => {
    await api.users.update(userId, { status: 'rejected' });
    fetchUsers();
  };

  const handleDelete = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
        await api.users.delete(userId);
        fetchUsers();
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    await api.users.update(userId, { role: newRole });
    fetchUsers();
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pendingUsers = filteredUsers.filter(u => u.status === 'pending');
  const activeUsers = filteredUsers.filter(u => u.status !== 'pending');

  return (
    <div className="flex h-full bg-slate-900 text-slate-200">
      <div className="flex-1 flex flex-col p-8 overflow-hidden">
        
        <div className="flex justify-between items-end mb-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <Users className="text-blue-500" size={32} />
                    User Management
                </h1>
                <p className="text-slate-400">Manage access requests and user roles.</p>
            </div>
            <div className="relative w-64">
                <input 
                    type="text"
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/50 text-white"
                />
                <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
            </div>
        </div>

        {loading ? (
            <div className="text-center p-10 text-slate-500">Loading users...</div>
        ) : (
        <div className="flex-1 overflow-y-auto space-y-8">
            
            {/* Pending Requests */}
            {pendingUsers.length > 0 && (
                <div className="bg-slate-800/50 border border-orange-500/30 rounded-xl overflow-hidden animate-fade-in">
                    <div className="bg-orange-900/20 px-6 py-4 border-b border-orange-500/30 flex items-center gap-2">
                        <Clock className="text-orange-400" size={20} />
                        <h2 className="text-lg font-bold text-orange-100">Pending Approval ({pendingUsers.length})</h2>
                    </div>
                    <div className="divide-y divide-slate-700/50">
                        {pendingUsers.map(user => (
                            <div key={user.id} className="p-4 flex items-center justify-between hover:bg-slate-800 transition-colors">
                                <div className="flex items-center gap-4">
                                    <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full bg-slate-700" />
                                    <div>
                                        <div className="font-semibold text-white">{user.name}</div>
                                        <div className="text-sm text-slate-400 flex items-center gap-1">
                                            <Mail size={12} /> {user.email}
                                        </div>
                                    </div>
                                    <span className="bg-orange-500/20 text-orange-400 text-xs px-2 py-0.5 rounded border border-orange-500/30 capitalize">
                                        {user.role.toLowerCase()} Request
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => handleApprove(user.id)}
                                        className="flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <Check size={16} /> Approve
                                    </button>
                                    <button 
                                        onClick={() => handleReject(user.id)}
                                        className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        <X size={16} /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Users Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">Active Users</h2>
                    <span className="text-sm text-slate-500">Total: {activeUsers.length}</span>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-slate-950 text-slate-500 text-xs uppercase font-semibold tracking-wider">
                        <tr>
                            <th className="px-6 py-3">User</th>
                            <th className="px-6 py-3">Role</th>
                            <th className="px-6 py-3">Status</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {activeUsers.map(user => (
                            <tr key={user.id} className="hover:bg-slate-800/30 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full bg-slate-700" />
                                        <div>
                                            <div className="font-medium text-slate-200">{user.name}</div>
                                            <div className="text-xs text-slate-500">{user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <select 
                                        value={user.role}
                                        onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                                        className="bg-slate-800 border border-slate-700 text-slate-300 text-sm rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        disabled={user.email === 'admin@gmail.com'}
                                    >
                                        {Object.values(UserRole).map(role => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize border ${
                                        user.status === 'active' 
                                        ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                                    }`}>
                                        {user.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    {user.email !== 'admin@gmail.com' && (
                                        <button 
                                            onClick={() => handleDelete(user.id)}
                                            className="text-slate-500 hover:text-red-400 p-2 rounded hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                            title="Delete User"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {activeUsers.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                    No users found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;