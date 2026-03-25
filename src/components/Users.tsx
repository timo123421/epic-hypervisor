import React, { useState, useEffect } from 'react';
import { apiCall } from '../lib/api';
import { Users as UsersIcon, UserPlus, Shield, Key, Trash2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface User {
  id: number;
  username: string;
  role: 'admin' | 'vm_manager' | 'user';
  permissions: string[];
  created_at: string;
}

export default function Users() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    role: 'user' as const,
    permissions: [] as string[]
  });

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/users');
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiCall('/users', {
        method: 'POST',
        body: JSON.stringify(newUser)
      });
      setIsModalOpen(false);
      setNewUser({ username: '', password: '', role: 'user', permissions: [] });
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const availablePermissions = [
    'vm.create', 'vm.delete', 'vm.start', 'vm.stop', 'vm.migrate',
    'storage.create', 'storage.delete', 'network.manage', 'firewall.manage'
  ];

  const togglePermission = (perm: string) => {
    setNewUser(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }));
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-slate-500 text-sm mb-2">Manage user accounts and granular resource permissions.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="btn-primary">
          <UserPlus className="w-4 h-4" />
          Create User
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Permissions</th>
              <th>Created At</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      <UsersIcon className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-slate-900">{user.username}</span>
                  </div>
                </td>
                <td>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                    user.role === 'vm_manager' ? 'bg-blue-100 text-blue-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td>
                  <div className="flex flex-wrap gap-1 max-w-xs">
                    {user.permissions.length === 0 ? (
                      <span className="text-xs text-slate-400 italic">No specific permissions</span>
                    ) : user.permissions.includes('*') ? (
                      <span className="text-xs text-indigo-600 font-medium">Full Access (*)</span>
                    ) : (
                      user.permissions.map(p => (
                        <span key={p} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-mono">
                          {p}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td><span className="text-sm text-slate-500">{new Date(user.created_at).toLocaleDateString()}</span></td>
                <td className="text-right">
                  <div className="flex justify-end gap-2">
                    <button className="p-1 text-slate-400 hover:text-indigo-600 transition-colors">
                      <Shield className="w-4 h-4" />
                    </button>
                    <button onClick={async () => {
                      if (confirm(`Are you sure you want to delete user ${user.username}?`)) {
                        try {
                          await apiCall(`/users/${user.id}`, { method: 'DELETE' });
                          fetchUsers();
                        } catch (err: any) {
                          alert(`Failed to delete user: ${err.message}`);
                        }
                      }
                    }} className="p-1 text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                Create New User
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Username</label>
                  <input 
                    type="text"
                    value={newUser.username}
                    onChange={e => setNewUser({...newUser, username: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Password</label>
                  <input 
                    type="password"
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Role</label>
                <select 
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value as any})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="user">User (Standard)</option>
                  <option value="vm_manager">VM Manager (Restricted Admin)</option>
                  <option value="admin">Admin (Full Access)</option>
                </select>
              </div>
              
              {newUser.role !== 'admin' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Granular Permissions</label>
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                    {availablePermissions.map(perm => (
                      <label key={perm} className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox"
                          checked={newUser.permissions.includes(perm)}
                          onChange={() => togglePermission(perm)}
                          className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-slate-600 group-hover:text-slate-900 transition-colors">{perm}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
                  {loading ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
