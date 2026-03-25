import React, { useState, useEffect } from 'react';
import { apiCall } from '../lib/api';
import { Share2, RefreshCw, AlertTriangle, Server, Activity } from 'lucide-react';

interface Node {
  id: string;
  name: string;
  ip: string;
  status: string;
  votes: number;
}

export default function Cluster() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quorum, setQuorum] = useState<{ status: string; expected: number; votes: number } | null>(null);

  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [joinData, setJoinData] = useState({ nodeName: '', peerIp: '' });

  const fetchCluster = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/cluster');
      setNodes(data.nodes || []);
      setQuorum(data.quorum || null);
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
      fetchCluster();
    } catch (err: any) {
      setError(err.message || 'Failed to join cluster');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveCluster = async () => {
    if (!confirm('Are you sure you want to leave the cluster? This will disable HA for this node.')) return;
    setLoading(true);
    try {
      await apiCall('/cluster/leave', { method: 'POST' });
      fetchCluster();
    } catch (err: any) {
      setError(err.message || 'Failed to leave cluster');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCluster();
  }, []);

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-slate-500 text-sm mb-2">High Availability (HA) and Corosync cluster management.</p>
          {quorum && (
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium text-slate-700">Quorum Status:</span>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                quorum.status === 'OK' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {quorum.status === 'OK' ? <Activity className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                {quorum.status}
              </span>
              <span className="text-slate-500">Votes: {quorum.votes} / {quorum.expected}</span>
            </div>
          )}
        </div>
        <div className="flex gap-3">
          <button onClick={fetchCluster} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {nodes.length > 0 ? (
            <button onClick={handleLeaveCluster} className="btn-danger">
              <AlertTriangle className="w-4 h-4" />
              Leave Cluster
            </button>
          ) : (
            <button onClick={() => setIsJoinModalOpen(true)} className="btn-primary">
              <Share2 className="w-4 h-4" />
              Join Cluster
            </button>
          )}
        </div>
      </div>

      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Share2 className="w-5 h-5 text-indigo-600" />
                Join Corosync Cluster
              </h3>
              <button onClick={() => setIsJoinModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <AlertTriangle className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleJoinCluster} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Node Name</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. node-2"
                  value={joinData.nodeName}
                  onChange={(e) => setJoinData({ ...joinData, nodeName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Peer IP Address</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. 10.0.0.10"
                  value={joinData.peerIp}
                  onChange={(e) => setJoinData({ ...joinData, peerIp: e.target.value })}
                />
                <p className="text-xs text-slate-500 mt-1">The IP of an existing node in the cluster.</p>
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsJoinModalOpen(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Join Cluster
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            <p className="text-sm">This node is not part of a Corosync cluster.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Node ID</th>
                <th>Name</th>
                <th>IP Address</th>
                <th>Status</th>
                <th className="text-right">Votes</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node, idx) => (
                <tr key={node.id || idx}>
                  <td><span className="font-mono text-sm text-slate-700">{node.id}</span></td>
                  <td>
                    <div className="flex items-center gap-2 font-medium text-slate-900">
                      <Server className="w-4 h-4 text-slate-400" />
                      {node.name}
                    </div>
                  </td>
                  <td><span className="font-mono text-sm text-slate-700">{node.ip}</span></td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      node.status === 'Online' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {node.status === 'Online' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
                      {node.status}
                    </span>
                  </td>
                  <td className="text-right text-sm text-slate-700 font-mono">{node.votes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
