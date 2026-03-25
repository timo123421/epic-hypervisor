import React, { useState, useEffect } from 'react';
import { apiCall } from '../lib/api';
import { Play, Square, RefreshCw, Network, AlertTriangle, Activity, Terminal, Globe, Search, Server, Shield } from 'lucide-react';

interface VirtualNetwork {
  name: string;
  state: string;
  autostart: string;
  persistent: string;
}

interface HostInterface {
  name: string;
  family: string;
  address: string;
  netmask: string;
  mac: string;
  internal: boolean;
}

interface Connection {
  protocol: string;
  state: string;
  local: string;
  peer: string;
}

export default function Networking() {
  const [activeTab, setActiveTab] = useState<'virtual' | 'interfaces' | 'traffic' | 'troubleshoot' | 'tailscale'>('virtual');
  const [networks, setNetworks] = useState<VirtualNetwork[]>([]);
  const [interfaces, setInterfaces] = useState<HostInterface[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [tailscale, setTailscale] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Troubleshoot state
  const [tsAction, setTsAction] = useState('ping');
  const [tsTarget, setTsTarget] = useState('');
  const [tsResult, setTsResult] = useState('');
  const [tsLoading, setTsLoading] = useState(false);

  // Create Network state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNetType, setNewNetType] = useState('bridge');
  const [newNetName, setNewNetName] = useState('');
  const [newNetParent, setNewNetParent] = useState('');
  const [newNetVlanId, setNewNetVlanId] = useState('');
  const [newNetSlaves, setNewNetSlaves] = useState('');
  const [newNetMode, setNewNetMode] = useState('active-backup');
  const [newNetVni, setNewNetVni] = useState('');
  const [newNetRemoteIp, setNewNetRemoteIp] = useState('');
  const [newNetLocalIp, setNewNetLocalIp] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  const fetchNetworks = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/networks');
      setNetworks(data.networks || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch networks');
    } finally {
      setLoading(false);
    }
  };

  const fetchInterfaces = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/network/interfaces');
      setInterfaces(data.interfaces || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch interfaces');
    } finally {
      setLoading(false);
    }
  };

  const fetchConnections = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/network/connections');
      setConnections(data.connections || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch connections');
    } finally {
      setLoading(false);
    }
  };

  const fetchTailscale = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/network/tailscale');
      setTailscale(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch Tailscale status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'virtual') fetchNetworks();
    else if (activeTab === 'interfaces') fetchInterfaces();
    else if (activeTab === 'traffic') fetchConnections();
    else if (activeTab === 'tailscale') fetchTailscale();
    
    let interval: NodeJS.Timeout;
    if (activeTab === 'traffic') {
      interval = setInterval(fetchConnections, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab]);

  const handleAction = async (name: string, action: 'start' | 'stop') => {
    try {
      await apiCall(`/networks/${name}/${action}`, { method: 'POST' });
      fetchNetworks();
    } catch (err: any) {
      alert(`Failed to ${action} network: ${err.message}`);
    }
  };

  const handleCreateNetwork = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      await apiCall('/network/advanced', {
        method: 'POST',
        body: JSON.stringify({
          type: newNetType,
          name: newNetName,
          parent: newNetParent,
          vlanId: newNetVlanId,
          slaves: newNetSlaves.split(',').map(s => s.trim()).filter(Boolean),
          mode: newNetMode,
          vni: newNetVni,
          remoteIp: newNetRemoteIp,
          localIp: newNetLocalIp
        })
      });
      setShowCreateModal(false);
      // Reset form
      setNewNetName('');
      setNewNetParent('');
      setNewNetVlanId('');
      setNewNetSlaves('');
      setNewNetVni('');
      setNewNetRemoteIp('');
      setNewNetLocalIp('');
      
      if (activeTab === 'virtual') fetchNetworks();
      else if (activeTab === 'interfaces') fetchInterfaces();
    } catch (err: any) {
      alert(`Failed to create network: ${err.message}`);
    } finally {
      setCreateLoading(false);
    }
  };

  const runTroubleshoot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tsTarget) return;
    setTsLoading(true);
    setTsResult('Running...');
    try {
      const data = await apiCall('/network/troubleshoot', {
        method: 'POST',
        body: JSON.stringify({ action: tsAction, target: tsTarget })
      });
      setTsResult(data.result || 'No output');
    } catch (err: any) {
      setTsResult(`Error: ${err.message}`);
    } finally {
      setTsLoading(false);
    }
  };

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'active':
        return <span className="badge badge-success"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>Active</span>;
      case 'inactive':
        return <span className="badge badge-neutral"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>Inactive</span>;
      default:
        return <span className="badge badge-warning"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1.5"></span>{state}</span>;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-slate-500 text-sm">Advanced network topology, traffic flow, and troubleshooting.</p>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            <Network className="w-4 h-4" />
            Create Network
          </button>
          <button 
            onClick={() => {
              if (activeTab === 'virtual') fetchNetworks();
              else if (activeTab === 'interfaces') fetchInterfaces();
              else if (activeTab === 'traffic') fetchConnections();
            }} 
            className="btn-secondary"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex border-b border-slate-200 mb-6">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'virtual' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('virtual')}
        >
          <div className="flex items-center gap-2"><Network className="w-4 h-4" /> Virtual Networks</div>
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'interfaces' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('interfaces')}
        >
          <div className="flex items-center gap-2"><Server className="w-4 h-4" /> Host Interfaces</div>
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'traffic' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('traffic')}
        >
          <div className="flex items-center gap-2"><Activity className="w-4 h-4" /> Traffic Flow</div>
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'tailscale' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('tailscale')}
        >
          <div className="flex items-center gap-2"><Shield className="w-4 h-4" /> Tailscale VPN</div>
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'troubleshoot' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('troubleshoot')}
        >
          <div className="flex items-center gap-2"><Terminal className="w-4 h-4" /> Troubleshoot</div>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          {error}
        </div>
      )}

      {/* Virtual Networks Tab */}
      {activeTab === 'virtual' && (
        <div className="card">
          {networks.length === 0 && !loading ? (
            <div className="p-12 text-center text-slate-500">
              <Network className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">No Virtual Networks</h3>
              <p className="text-sm">No libvirt networks have been configured on this node.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Network Name</th>
                  <th>State</th>
                  <th>Autostart</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {networks.map((net) => (
                  <tr key={net.name}>
                    <td>
                      <div className="flex items-center gap-3">
                        <Network className="w-5 h-5 text-slate-400" />
                        <div className="font-medium text-slate-900">{net.name}</div>
                      </div>
                    </td>
                    <td>{getStatusBadge(net.state)}</td>
                    <td><span className="text-sm text-slate-600 capitalize">{net.autostart}</span></td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        {net.state === 'active' ? (
                          <button onClick={() => handleAction(net.name, 'stop')} className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Stop Network">
                            <Square className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => handleAction(net.name, 'start')} className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Start Network">
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
      )}

      {/* Host Interfaces Tab */}
      {activeTab === 'interfaces' && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Interface</th>
                <th>IP Address</th>
                <th>Family</th>
                <th>MAC Address</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {interfaces.map((iface, idx) => (
                <tr key={idx}>
                  <td>
                    <div className="font-medium text-slate-900">{iface.name}</div>
                    {(iface as any).description && (
                      <div className="text-xs text-slate-500 mt-0.5">{(iface as any).description}</div>
                    )}
                  </td>
                  <td><span className="font-mono text-sm text-slate-700">{iface.address}</span></td>
                  <td><span className="text-sm text-slate-500">{iface.family}</span></td>
                  <td><span className="font-mono text-sm text-slate-500">{iface.mac}</span></td>
                  <td>
                    {iface.internal ? (
                      <span className="badge badge-neutral">Loopback</span>
                    ) : iface.name.startsWith('br') ? (
                      <span className="badge badge-primary">Bridge</span>
                    ) : iface.name.includes('.') ? (
                      <span className="badge badge-warning">VLAN</span>
                    ) : iface.name.startsWith('bond') ? (
                      <span className="badge badge-indigo">Bond</span>
                    ) : iface.name.startsWith('vxlan') ? (
                      <span className="badge badge-emerald">VXLAN</span>
                    ) : iface.name.startsWith('ovs') ? (
                      <span className="badge badge-sky">OVS</span>
                    ) : (
                      <span className="badge badge-success">Physical</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Traffic Flow Tab */}
      {activeTab === 'traffic' && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Protocol</th>
                <th>State</th>
                <th>Local Address:Port</th>
                <th>Peer Address:Port</th>
              </tr>
            </thead>
            <tbody>
              {connections.map((conn, idx) => (
                <tr key={idx}>
                  <td><span className="font-mono text-sm text-slate-700 uppercase">{conn.protocol}</span></td>
                  <td>
                    <span className={`text-xs font-medium px-2 py-1 rounded ${
                      conn.state === 'ESTAB' ? 'bg-green-100 text-green-800' :
                      conn.state === 'LISTEN' ? 'bg-blue-100 text-blue-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {conn.state}
                    </span>
                  </td>
                  <td><span className="font-mono text-sm text-slate-700">{conn.local}</span></td>
                  <td><span className="font-mono text-sm text-slate-700">{conn.peer}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tailscale Tab */}
      {activeTab === 'tailscale' && tailscale && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="card p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-sky-600" />
              </div>
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Status</h3>
              <div className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                {tailscale.BackendState === 'Running' ? (
                  <><span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span> Connected</>
                ) : (
                  <><span className="w-3 h-3 rounded-full bg-red-500"></span> Disconnected</>
                )}
              </div>
            </div>
            <div className="card p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                <Globe className="w-6 h-6 text-indigo-600" />
              </div>
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Tailscale IP</h3>
              <div className="text-2xl font-bold text-slate-900 font-mono">
                {tailscale.TailscaleIPs?.[0] || 'N/A'}
              </div>
            </div>
            <div className="card p-6 flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <Server className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-1">Hostname</h3>
              <div className="text-lg font-bold text-slate-900">
                {tailscale.Self?.HostName || 'Unknown'}
              </div>
              <div className="text-xs text-slate-500 mt-1">{tailscale.Self?.OS}</div>
            </div>
          </div>

          <div className="card">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-lg font-medium text-slate-900">Connected Peers</h3>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hostname</th>
                  <th>Tailscale IP</th>
                  <th>OS</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(tailscale.Peers || {}).map((peer: any, idx) => (
                  <tr key={idx}>
                    <td>
                      <div className="font-medium text-slate-900">{peer.HostName}</div>
                      <div className="text-xs text-slate-500">{peer.DNSName}</div>
                    </td>
                    <td><span className="font-mono text-sm text-slate-700">{peer.TailscaleIPs?.[0]}</span></td>
                    <td><span className="text-sm text-slate-600 capitalize">{peer.OS}</span></td>
                    <td>
                      {peer.Online ? (
                        <span className="badge badge-success">Online</span>
                      ) : (
                        <span className="badge badge-neutral">Offline</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(!tailscale.Peers || Object.keys(tailscale.Peers).length === 0) && (
                  <tr>
                    <td colSpan={4} className="text-center py-8 text-slate-500">
                      No peers connected to this Tailnet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Troubleshoot Tab */}
      {activeTab === 'troubleshoot' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-6 lg:col-span-1 h-fit">
            <h3 className="text-lg font-medium text-slate-900 mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-slate-400" />
              Diagnostics
            </h3>
            <form onSubmit={runTroubleshoot} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Action</label>
                <select 
                  value={tsAction}
                  onChange={(e) => setTsAction(e.target.value)}
                  className="input-field"
                >
                  <option value="ping">Ping (ICMP)</option>
                  <option value="traceroute">Traceroute</option>
                  <option value="dns">DNS Lookup (dig/nslookup)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Target IP / Domain</label>
                <input 
                  type="text" 
                  value={tsTarget}
                  onChange={(e) => setTsTarget(e.target.value)}
                  placeholder="e.g., 8.8.8.8 or google.com"
                  className="input-field"
                  required
                />
              </div>
              <button 
                type="submit" 
                className="btn-primary w-full justify-center"
                disabled={tsLoading}
              >
                {tsLoading ? (
                  <><RefreshCw className="w-4 h-4 animate-spin" /> Executing...</>
                ) : (
                  <><Play className="w-4 h-4" /> Run Diagnostic</>
                )}
              </button>
            </form>
          </div>

          <div className="card p-0 lg:col-span-2 flex flex-col h-96">
            <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center gap-2 rounded-t-xl">
              <Terminal className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-mono text-slate-300">Terminal Output</span>
            </div>
            <div className="flex-1 bg-slate-950 p-4 overflow-auto rounded-b-xl">
              <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap">
                {tsResult || 'Waiting for command execution...'}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Create Network Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-900">Create Advanced Network</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <Square className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateNetwork} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Network Type</label>
                <select 
                  value={newNetType}
                  onChange={(e) => setNewNetType(e.target.value)}
                  className="input-field"
                >
                  <option value="bridge">Linux Bridge</option>
                  <option value="vlan">VLAN (802.1Q)</option>
                  <option value="bond">Network Bonding (LACP/Bond)</option>
                  <option value="ovs">Open vSwitch (OVS)</option>
                  <option value="vxlan">VXLAN (SDN)</option>
                </select>
              </div>

              {/* Conditional Fields based on Type */}
              {(newNetType === 'bridge' || newNetType === 'bond' || newNetType === 'ovs' || newNetType === 'vxlan') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Interface Name</label>
                  <input 
                    type="text" 
                    value={newNetName}
                    onChange={(e) => setNewNetName(e.target.value)}
                    placeholder={newNetType === 'bridge' ? 'e.g., br0' : newNetType === 'bond' ? 'e.g., bond0' : 'e.g., ovs-br0'}
                    className="input-field"
                    required
                  />
                </div>
              )}

              {newNetType === 'vlan' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Parent Interface</label>
                    <input 
                      type="text" 
                      value={newNetParent}
                      onChange={(e) => setNewNetParent(e.target.value)}
                      placeholder="e.g., eth0"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">VLAN ID</label>
                    <input 
                      type="number" 
                      value={newNetVlanId}
                      onChange={(e) => setNewNetVlanId(e.target.value)}
                      placeholder="1-4094"
                      className="input-field"
                      required
                    />
                  </div>
                </>
              )}

              {newNetType === 'bond' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Slave Interfaces (comma separated)</label>
                    <input 
                      type="text" 
                      value={newNetSlaves}
                      onChange={(e) => setNewNetSlaves(e.target.value)}
                      placeholder="e.g., eth0, eth1"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Bond Mode</label>
                    <select 
                      value={newNetMode}
                      onChange={(e) => setNewNetMode(e.target.value)}
                      className="input-field"
                    >
                      <option value="active-backup">Active-Backup</option>
                      <option value="802.3ad">LACP (802.3ad)</option>
                      <option value="balance-rr">Round-Robin</option>
                    </select>
                  </div>
                </>
              )}

              {newNetType === 'vxlan' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">VNI (VXLAN Network ID)</label>
                    <input 
                      type="number" 
                      value={newNetVni}
                      onChange={(e) => setNewNetVni(e.target.value)}
                      placeholder="e.g., 100"
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Remote VTEP IP</label>
                    <input 
                      type="text" 
                      value={newNetRemoteIp}
                      onChange={(e) => setNewNetRemoteIp(e.target.value)}
                      placeholder="e.g., 10.0.0.2"
                      className="input-field"
                      required
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1 justify-center"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary flex-1 justify-center"
                  disabled={createLoading}
                >
                  {createLoading ? 'Creating...' : 'Create Interface'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
