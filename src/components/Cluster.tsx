import React, { useState, useEffect } from 'react';
import { apiCall } from '../lib/api';
import { Share2, RefreshCw, AlertTriangle, Server, Activity, Trash2, ShieldCheck, Plus, X } from 'lucide-react';

interface Node {
  id: number;
  name: string;
  ip: string;
  role: string;
  status: string;
  last_seen: string;
}

export default function Cluster() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinData, setJoinData] = useState({ nodeName: '', peerIp: '', role: 'worker' });

  const fetchCluster = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/cluster');
      setNodes(data.nodes || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch cluster status');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiCall('/cluster/join', { method: 'POST', body: JSON.stringify(joinData) });
      setIsJoinModalOpen(false);
      setJoinData({ nodeName: '', peerIp: '', role: 'worker' });
      fetchCluster();
    } catch (err: any) {
      setError(err.message || 'Failed to join cluster');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveNode = async (nodeName: string) => {
    if (!confirm(`Are you sure you want to remove node ${nodeName} from the cluster?`)) return;
    setLoading(true);
    try {
      await apiCall('/cluster/leave', { method: 'POST', body: JSON.stringify({ nodeName }) });
      fetchCluster();
    } catch (err: any) {
      setError(err.message || 'Failed to remove node');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCluster();
    const interval = setInterval(fetchCluster, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Cluster Management</h2>
          <p className="text-slate-500 text-sm">Manage multi-node High Availability (HA) and resource aggregation.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchCluster} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setIsJoinModalOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" />
            Add Node
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
        {nodes.length === 0 && !loading ? (
          <div className="p-12 text-center text-slate-500">
            <Share2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">Standalone Node</h3>
            <p className="text-sm">This node is not part of a cluster. Add nodes to enable HA.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Node Name</th>
                <th>IP Address</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => (
                <tr key={node.id}>
                  <td>
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      <Server className="w-4 h-4 text-indigo-500" />
                      {node.name}
                      {node.role === 'master' && <ShieldCheck className="w-3.5 h-3.5 text-amber-500" title="Master Node" />}
                    </div>
                  </td>
                  <td><span className="font-mono text-sm text-slate-700">{node.ip}</span></td>
                  <td>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      node.role === 'master' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {node.role}
                    </span>
                  </td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      node.status === 'online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {node.status === 'online' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                      {node.status}
                    </span>
                  </td>
                  <td className="text-sm text-slate-500">
                    {node.last_seen ? new Date(node.last_seen).toLocaleString() : 'Never'}
                  </td>
                  <td className="text-right">
                    {node.role !== 'master' && (
                      <button 
                        onClick={() => handleRemoveNode(node.name)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Remove Node"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                Add Node to Cluster
              </h3>
              <button onClick={() => setIsJoinModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleJoinCluster} className="p-6 space-y-4">
              <div>
                <label className="input-label">Node Name</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. nova-node-02"
                  value={joinData.nodeName}
                  onChange={(e) => setJoinData({ ...joinData, nodeName: e.target.value })}
                />
              </div>
              <div>
                <label className="input-label">Node IP Address</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. 192.168.4.101"
                  value={joinData.peerIp}
                  onChange={(e) => setJoinData({ ...joinData, peerIp: e.target.value })}
                />
              </div>
              <div>
                <label className="input-label">Role</label>
                <select 
                  className="input-field"
                  value={joinData.role}
                  onChange={(e) => setJoinData({ ...joinData, role: e.target.value })}
                >
                  <option value="worker">Worker</option>
                  <option value="master">Master (HA Candidate)</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsJoinModalOpen(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Add Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
