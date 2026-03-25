import React, { useState, useEffect } from 'react';
import { apiCall } from '../lib/api';
import { Box, Play, Square, RefreshCw, AlertTriangle, Trash2, Terminal, Cpu, MemoryStick } from 'lucide-react';

interface Container {
  name: string;
  state: string;
  ipv4?: string;
  ram?: string;
  pid?: string;
}

export default function Containers() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const getStatusBadge = (state: string) => {
    const s = state.toLowerCase();
    if (s === 'running') {
      return <span className="badge badge-success"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>Running</span>;
    }
    if (s === 'stopped') {
      return <span className="badge badge-neutral"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>Stopped</span>;
    }
    return <span className="badge badge-warning"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1.5"></span>{state}</span>;
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
          <button className="btn-primary opacity-50 cursor-not-allowed" title="Not available in this environment">
            <Box className="w-4 h-4" />
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
                <th>State</th>
                <th>IP Address</th>
                <th>PID</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((ct) => (
                <tr key={ct.name}>
                  <td>
                    <div className="font-medium text-slate-900">{ct.name}</div>
                  </td>
                  <td>{getStatusBadge(ct.state)}</td>
                  <td>
                    <div className="text-sm text-slate-700 font-mono">{ct.ipv4 || '-'}</div>
                  </td>
                  <td>
                    <div className="text-sm text-slate-700 font-mono">{ct.pid || '-'}</div>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      {ct.state.toLowerCase() === 'running' ? (
                        <>
                          <button onClick={() => handleAction(ct.name, 'stop')} className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Stop">
                            <Square className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleAction(ct.name, 'start')} className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Start">
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
