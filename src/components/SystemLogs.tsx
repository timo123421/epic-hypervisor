import React, { useState, useEffect } from 'react';
import { apiCall } from '../lib/api';
import { ClipboardList, RefreshCw, Search, Clock, User, Activity } from 'lucide-react';

interface AuditLog {
  id: number;
  user_id: number;
  username: string;
  action: string;
  target_uuid: string | null;
  timestamp: string;
}

export default function SystemLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/audit-logs');
      setLogs(data.logs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => {
    const action = log.action || '';
    const username = log.username || '';
    const target = log.target_uuid || '';
    const term = searchTerm.toLowerCase();
    
    return action.toLowerCase().includes(term) ||
           username.toLowerCase().includes(term) ||
           target.toLowerCase().includes(term);
  });

  const getActionColor = (action: string = '') => {
    const act = action || '';
    if (act.includes('CREATE')) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (act.includes('DELETE') || act.includes('STOP')) return 'text-rose-600 bg-rose-50 border-rose-100';
    if (act.includes('START')) return 'text-sky-600 bg-sky-50 border-sky-100';
    return 'text-slate-600 bg-slate-50 border-slate-100';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">System Audit Logs</h2>
          <p className="text-slate-500 mt-1">Track all administrative actions and system changes.</p>
        </div>
        <button onClick={fetchLogs} className="btn-secondary">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Logs
        </button>
      </div>

      <div className="glass-panel p-4 flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text"
            placeholder="Search by action, user, or target UUID..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>
      </div>

      <div className="glass-panel overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 text-sky-500 animate-spin mx-auto mb-4" />
            <p className="text-slate-500 font-medium">Loading audit trail...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center text-rose-600">
            <p>{error}</p>
            <button onClick={fetchLogs} className="btn-secondary mt-4">Retry</button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p>No audit logs found matching your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-xs font-mono">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center">
                          <User className="w-3 h-3 text-slate-500" />
                        </div>
                        <span className="text-sm font-medium text-slate-700">{log.username || 'System'}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getActionColor(log.action)}`}>
                        {(log.action || 'UNKNOWN').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      {log.target_uuid ? (
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs font-mono text-slate-500">{log.target_uuid}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-300 italic">N/A</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
