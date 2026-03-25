import React, { useState, useEffect } from 'react';
import { apiCall } from '../lib/api';
import { Shield, RefreshCw, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface Rule {
  id: number;
  target: string;
  prot: string;
  opt: string;
  source: string;
  destination: string;
  extra?: string;
}

export default function Firewall() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'enabled' | 'disabled' | 'unknown'>('unknown');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    chain: 'INPUT',
    target: 'ACCEPT',
    prot: 'tcp',
    source: '0.0.0.0/0',
    destination: '0.0.0.0/0',
    extra: ''
  });

  const fetchFirewall = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/firewall');
      setRules(data.rules || []);
      setStatus(data.status || 'unknown');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch firewall rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFirewall();
  }, []);

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await apiCall('/firewall/rules', {
        method: 'POST',
        body: JSON.stringify(newRule)
      });
      setIsModalOpen(false);
      fetchFirewall();
    } catch (err: any) {
      setError(err.message || 'Failed to add rule');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRule = async (ruleNum: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    setLoading(true);
    try {
      await apiCall(`/firewall/rules/${ruleNum}`, { method: 'DELETE' });
      fetchFirewall();
    } catch (err: any) {
      setError(err.message || 'Failed to delete rule');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-slate-500 text-sm mb-2">Distributed firewall configuration for the node and VMs.</p>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Firewall Status:</span>
            {status === 'enabled' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <CheckCircle2 className="w-3.5 h-3.5" /> Enabled
              </span>
            ) : status === 'disabled' ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                <XCircle className="w-3.5 h-3.5" /> Disabled
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                Unknown
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchFirewall} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button onClick={() => setIsModalOpen(true)} className="btn-primary">
            <Shield className="w-4 h-4" />
            Add Rule
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
        {rules.length === 0 && !loading ? (
          <div className="p-12 text-center text-slate-500">
            <Shield className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <h3 className="text-lg font-medium text-slate-900 mb-1">No Rules Found</h3>
            <p className="text-sm">iptables/nftables might not be accessible or no rules are configured.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Num</th>
                <th>Target</th>
                <th>Protocol</th>
                <th>Source</th>
                <th>Destination</th>
                <th>Options/Extra</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, idx) => (
                <tr key={idx}>
                  <td><span className="text-xs text-slate-400 font-mono">{idx + 1}</span></td>
                  <td>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      rule.target === 'ACCEPT' ? 'bg-green-100 text-green-800' :
                      rule.target === 'DROP' || rule.target === 'REJECT' ? 'bg-red-100 text-red-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {rule.target}
                    </span>
                  </td>
                  <td><span className="font-mono text-sm text-slate-700">{rule.prot}</span></td>
                  <td><span className="font-mono text-sm text-slate-700">{rule.source}</span></td>
                  <td><span className="font-mono text-sm text-slate-700">{rule.destination}</span></td>
                  <td><span className="text-sm text-slate-500">{rule.extra || rule.opt}</span></td>
                  <td className="text-right">
                    <button onClick={() => handleDeleteRule(idx + 1)} className="text-red-600 hover:text-red-500 text-xs font-medium">
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                Add Firewall Rule
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleAddRule} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Chain</label>
                  <select 
                    value={newRule.chain}
                    onChange={e => setNewRule({...newRule, chain: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="INPUT">INPUT</option>
                    <option value="OUTPUT">OUTPUT</option>
                    <option value="FORWARD">FORWARD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Target</label>
                  <select 
                    value={newRule.target}
                    onChange={e => setNewRule({...newRule, target: e.target.value})}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="ACCEPT">ACCEPT</option>
                    <option value="DROP">DROP</option>
                    <option value="REJECT">REJECT</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Protocol</label>
                <select 
                  value={newRule.prot}
                  onChange={e => setNewRule({...newRule, prot: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                >
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="icmp">ICMP</option>
                  <option value="all">All</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Source IP/CIDR</label>
                <input 
                  type="text"
                  value={newRule.source}
                  onChange={e => setNewRule({...newRule, source: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="0.0.0.0/0"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Destination IP/CIDR</label>
                <input 
                  type="text"
                  value={newRule.destination}
                  onChange={e => setNewRule({...newRule, destination: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="0.0.0.0/0"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Extra Options</label>
                <input 
                  type="text"
                  value={newRule.extra}
                  onChange={e => setNewRule({...newRule, extra: e.target.value})}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  placeholder="--dport 80"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={loading} className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50">
                  {loading ? 'Adding...' : 'Add Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
