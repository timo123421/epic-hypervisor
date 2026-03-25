import React, { useState, useEffect } from 'react';
import { apiCall } from '../lib/api';
import { Box, Play, Square, RefreshCw, AlertTriangle, Trash2, Terminal, Cpu, MemoryStick, Plus, X, Settings } from 'lucide-react';
import ConfigModal from './ConfigModal';

interface Container {
  name: string;
  status: string;
  ip?: string;
  ram?: string;
  pid?: string;
}

export default function Containers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingConfig, setEditingConfig] = useState<string | null>(null);

  const fetchContainers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/lxc');
      setContainers(data.containers || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch LXC containers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
    const interval = setInterval(fetchContainers, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (name: string, action: 'start' | 'stop') => {
    try {
      await apiCall(`/lxc/${name}/${action}`, { method: 'POST' });
      fetchContainers();
    } catch (err: any) {
      alert(`Failed to ${action} container: ${err.message}`);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const name = formData.get('name') as string;
    const dist = formData.get('dist') as string;
    const release = formData.get('release') as string;
    const arch = formData.get('arch') as string;

    setCreating(true);
    try {
      await apiCall('/lxc', {
        method: 'POST',
        body: JSON.stringify({ name, dist, release, arch }),
      });
      setShowCreateModal(false);
      fetchContainers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreating(false);
    }
  };

  const getStatusBadge = (status: string = '') => {
    const s = (status || '').toLowerCase();
    if (s === 'running') {
      return <span className="badge badge-success"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>Running</span>;
    }
    if (s === 'stopped') {
      return <span className="badge badge-neutral"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>Stopped</span>;
    }
    return <span className="badge badge-warning"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1.5"></span>{status || 'Unknown'}</span>;
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <p className="text-slate-500 text-sm">Manage Linux Containers (LXC) on this node.</p>
        <div className="flex gap-3">
          <button onClick={fetchContainers} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Create CT
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          {error}
        </div>
      )}

      <div className="card">
        {containers.length === 0 && !loading ? (
          <div className="p-12 text-center text-slate-500">
            <Box className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No Containers Found</h3>
            <p className="text-sm">LXC might not be configured or no containers exist on this host.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Container Name</th>
                <th>Status</th>
                <th>IP Address</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((ct) => (
                <tr key={ct.name}>
                  <td>
                    <div className="font-medium text-slate-900">{ct.name}</div>
                  </td>
                  <td>{getStatusBadge(ct.status)}</td>
                  <td>
                    <div className="text-sm text-slate-700 font-mono">{ct.ip || '-'}</div>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setEditingConfig(ct.name)} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors" title="Edit Config">
                        <Settings className="w-4 h-4" />
                      </button>
                      {(ct.status || '').toLowerCase() === 'running' ? (
                        <>
                          <button onClick={() => handleAction(ct.name, 'stop')} className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Stop">
                            <Square className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleAction(ct.name, 'start')} className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Start">
                            <Play className="w-4 h-4" />
                          </button>
                          <button onClick={async () => {
                            if (confirm(`Are you sure you want to delete container ${ct.name}?`)) {
                              // Optimistic UI update
                              setContainers(prev => prev.filter(c => c.name !== ct.name));
                              
                              try {
                                await apiCall(`/lxc/${ct.name}`, { method: 'DELETE' });
                              } catch (err: any) {
                                alert(`Failed to delete container: ${err.message}`);
                                fetchContainers();
                              }
                            }
                          }} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">Create LXC Container</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="input-label">Container Name</label>
                <input name="name" type="text" className="input-field" placeholder="ct-01" required />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="input-label">Distribution</label>
                  <select name="dist" className="input-field">
                    <option value="ubuntu">Ubuntu</option>
                    <option value="debian">Debian</option>
                    <option value="alpine">Alpine</option>
                    <option value="centos">CentOS</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Release</label>
                  <input name="release" type="text" className="input-field" placeholder="jammy / bullseye" defaultValue="jammy" required />
                </div>
              </div>

              <div>
                <label className="input-label">Architecture</label>
                <select name="arch" className="input-field">
                  <option value="amd64">amd64</option>
                  <option value="arm64">arm64</option>
                </select>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={creating} className="btn-primary flex-1">
                  {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Box className="w-4 h-4" />}
                  {creating ? 'Creating...' : 'Create Container'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {editingConfig && (
        <ConfigModal type="lxc" id={editingConfig} onClose={() => setEditingConfig(null)} />
      )}
    </>
  );
}
