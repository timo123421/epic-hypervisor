import React, { useState, useEffect } from 'react';
import { apiCall } from '../lib/api';
import CreateVMModal from './CreateVMModal';
import VncConsole from './VncConsole';
import Networking from './Networking';
import Storage from './Storage';
import Containers from './Containers';
import Cluster from './Cluster';
import Firewall from './Firewall';
import Monitoring from './Monitoring';
import HostTerminal from './HostTerminal';
import SshTerminal from './SshTerminal';
import GuacamoleConsole from './GuacamoleConsole';
import Users from './Users';
import { 
  Play, Square, Trash2, RefreshCw, Server, LogOut, Terminal, 
  AlertTriangle, Network, HardDrive, Cpu, MemoryStick, Activity, 
  Box, Share2, Shield, Copy, Monitor, MonitorSmartphone, ChevronRight,
  Users as UsersIcon, Settings, Key, CheckCircle2
} from 'lucide-react';

interface VM {
  uuid: string;
  name?: string;
  state: string;
  max_memory?: string;
  used_memory?: string;
  cpu_time?: string;
  owner?: string;
  tags?: string;
  notes?: string;
  ha?: boolean;
}

export default function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState<'monitoring' | 'vms' | 'containers' | 'networking' | 'storage' | 'cluster' | 'firewall' | 'terminal' | 'users' | 'settings'>('monitoring');
  const [vms, setVms] = useState<VM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeConsole, setActiveConsole] = useState<{uuid: string, name?: string} | null>(null);
  const [activeSsh, setActiveSsh] = useState<{uuid: string, name?: string} | null>(null);
  const [activeGuac, setActiveGuac] = useState<{uuid: string, name?: string, type: 'vnc' | 'ssh' | 'rdp'} | null>(null);

  const fetchVMs = async () => {
    if (activeTab !== 'vms') return;
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/vms');
      setVms(data.vms || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch VMs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVMs();
    const interval = setInterval(() => {
      if (activeTab === 'vms') fetchVMs();
    }, 10000);
    return () => clearInterval(interval);
  }, [activeTab]);

  const handleAction = async (uuid: string, action: string) => {
    try {
      await apiCall(`/vms/${uuid}/${action}`, { method: 'POST' });
      fetchVMs();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} VM`);
    }
  };

  const handleMigrate = async (uuid: string, name?: string) => {
    const targetNode = window.prompt('Enter target node hostname or IP for live migration:', 'nova-node-02');
    if (!targetNode) return;
    setLoading(true);
    try {
      await apiCall(`/vms/${uuid}/migrate`, {
        method: 'POST',
        body: JSON.stringify({ targetNode })
      });
      alert(`Migration of ${name || uuid} to ${targetNode} initiated successfully.`);
      fetchVMs();
    } catch (err: any) {
      alert(err.message || 'Failed to migrate VM');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleHA = async (uuid: string, currentHA?: boolean) => {
    try {
      await apiCall(`/vms/${uuid}/ha`, {
        method: 'POST',
        body: JSON.stringify({ enabled: !currentHA })
      });
      fetchVMs();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle HA');
    }
  };

  const handleDelete = async (uuid: string) => {
    if (!window.confirm('Are you sure you want to delete this VM? This action cannot be undone.')) return;
    try {
      await apiCall(`/vms/${uuid}`, { method: 'DELETE' });
      fetchVMs();
    } catch (err: any) {
      alert(err.message || 'Failed to delete VM');
    }
  };

  const handleClone = async (uuid: string, name?: string) => {
    const newName = window.prompt('Enter name for the clone:', `${name || uuid}-clone`);
    if (!newName) return;
    try {
      await apiCall(`/vms/${uuid}/clone`, {
        method: 'POST',
        body: JSON.stringify({ newName })
      });
      fetchVMs();
    } catch (err: any) {
      alert(err.message || 'Failed to clone VM');
    }
  };

  const openConsole = (uuid: string, name?: string) => {
    setActiveConsole({ uuid, name });
  };

  const openSsh = (uuid: string, name?: string) => {
    setActiveSsh({ uuid, name });
  };

  const openGuac = (uuid: string, name: string | undefined, type: 'vnc' | 'ssh' | 'rdp') => {
    setActiveGuac({ uuid, name, type });
  };

  const getStatusBadge = (state: string) => {
    switch (state) {
      case 'running':
        return <span className="badge badge-success"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>Running</span>;
      case 'shut off':
        return <span className="badge badge-neutral">Shut Off</span>;
      case 'paused':
        return <span className="badge badge-warning">Paused</span>;
      default:
        return <span className="badge badge-neutral">{state}</span>;
    }
  };

  const tabs = [
    { id: 'monitoring', label: 'Overview', icon: Activity },
    { id: 'vms', label: 'Virtual Machines', icon: Server },
    { id: 'containers', label: 'LXC Containers', icon: Box },
    { id: 'networking', label: 'Networking', icon: Network },
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'firewall', label: 'Firewall', icon: Shield },
    { id: 'cluster', label: 'Cluster', icon: Share2 },
    { id: 'users', label: 'Users & RBAC', icon: UsersIcon },
    { id: 'terminal', label: 'Host Terminal', icon: Terminal },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 sidebar shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-slate-800">
          <div className="w-10 h-10 bg-sky-600 rounded-xl flex items-center justify-center shadow-lg shadow-sky-900/40">
            <Server className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">Project Nova</h1>
            <p className="text-[10px] font-bold text-sky-400 uppercase tracking-widest">Enterprise Hypervisor</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`sidebar-item w-full ${activeTab === tab.id ? 'active' : ''}`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-50" />}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button 
            onClick={onLogout}
            className="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-400 rounded-lg transition-all duration-200 hover:text-rose-400 hover:bg-rose-500/10 w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 border-b border-slate-200 flex items-center justify-between px-8 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Node:</span>
            <span className="text-xs font-mono text-sky-600 font-semibold">nova-node-01</span>
            <span className="mx-2 text-slate-200">|</span>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Uptime:</span>
            <span className="text-xs font-mono text-slate-600">12d 4h 32m</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">System Healthy</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
            {activeTab === 'vms' && (
              <>
                <div className="flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Virtual Machines</h2>
                    <p className="text-slate-500 mt-1">Manage and monitor your virtualized compute resources.</p>
                  </div>
                  <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
                    <Play className="w-4 h-4" />
                    Deploy Instance
                  </button>
                </div>

                <div className="glass-panel overflow-hidden">
                  {loading && vms.length === 0 ? (
                    <div className="p-12 text-center">
                      <RefreshCw className="w-8 h-8 text-sky-500 animate-spin mx-auto mb-4" />
                      <p className="text-slate-500 font-medium">Synchronizing with hypervisor...</p>
                    </div>
                  ) : error ? (
                    <div className="p-12 text-center">
                      <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto mb-4" />
                      <p className="text-rose-600 font-medium">{error}</p>
                      <button onClick={fetchVMs} className="btn-secondary mt-4">Retry Connection</button>
                    </div>
                  ) : vms.length === 0 ? (
                    <div className="p-12 text-center">
                      <Server className="w-8 h-8 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium">No virtual machines found on this node.</p>
                      <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary mt-4">Create First VM</button>
                    </div>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Instance Name</th>
                          <th>Resources</th>
                          <th>Owner / Tags</th>
                          <th className="text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vms.map((vm) => (
                          <tr key={vm.uuid}>
                            <td>{getStatusBadge(vm.state)}</td>
                            <td>
                              <div className="font-semibold text-slate-900">{vm.name || 'Unnamed Instance'}</div>
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">{vm.uuid}</div>
                            </td>
                            <td>
                              <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                  <Cpu className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-xs font-mono text-slate-600">{vm.cpu_time ? `${(parseInt(vm.cpu_time)/1000000000).toFixed(1)}s` : '0s'}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <MemoryStick className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-xs font-mono text-slate-600">{vm.used_memory ? `${(parseInt(vm.used_memory)/1024).toFixed(0)} MB` : '0 MB'}</span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="text-xs font-medium text-slate-600">{vm.owner || 'System'}</div>
                              {vm.tags && <div className="text-[10px] text-sky-600 mt-0.5 font-bold uppercase tracking-wider">{vm.tags}</div>}
                            </td>
                            <td>
                              <div className="flex items-center justify-end gap-1">
                                {vm.state === 'running' ? (
                                  <>
                                    <button onClick={() => openSsh(vm.uuid, vm.name)} className="btn-ghost" title="SSH Terminal">
                                      <Terminal className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => openConsole(vm.uuid, vm.name)} className="btn-ghost" title="VNC Console">
                                      <Monitor className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => openGuac(vm.uuid, vm.name, 'rdp')} className="btn-ghost text-indigo-600 hover:text-indigo-500" title="RDP (Guacamole)">
                                      <MonitorSmartphone className="w-4 h-4" />
                                    </button>
                                    <div className="w-px h-4 bg-slate-200 mx-1" />
                                    <button onClick={() => handleMigrate(vm.uuid, vm.name)} className="btn-ghost text-sky-600 hover:text-sky-500" title="Live Migration">
                                      <RefreshCw className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleToggleHA(vm.uuid, vm.ha)} className={`btn-ghost ${vm.ha ? 'text-emerald-600' : 'text-slate-400'}`} title={vm.ha ? 'HA Enabled' : 'Enable HA'}>
                                      <Shield className="w-4 h-4" />
                                    </button>
                                    <div className="w-px h-4 bg-slate-200 mx-1" />
                                    <button onClick={() => handleAction(vm.uuid, 'stop')} className="btn-ghost text-amber-600 hover:text-amber-500" title="Graceful Shutdown">
                                      <Square className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => handleAction(vm.uuid, 'force-stop')} className="btn-ghost text-rose-600 hover:text-rose-500" title="Force Stop">
                                      <AlertTriangle className="w-4 h-4" />
                                    </button>
                                  </>
                                ) : (
                                  <button onClick={() => handleAction(vm.uuid, 'start')} className="btn-ghost text-emerald-600 hover:text-emerald-500" title="Start">
                                    <Play className="w-4 h-4" />
                                  </button>
                                )}
                                
                                <div className="w-px h-4 bg-slate-200 mx-1" />
                                
                                <button onClick={() => handleClone(vm.uuid, vm.name)} className="btn-ghost" title="Clone VM">
                                  <Copy className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(vm.uuid)} className="btn-ghost text-rose-600 hover:text-rose-500" title="Delete VM">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}

            {activeTab === 'monitoring' && <Monitoring />}
            {activeTab === 'containers' && <Containers />}
            {activeTab === 'networking' && <Networking />}
            {activeTab === 'storage' && <Storage />}
            {activeTab === 'cluster' && <Cluster />}
            {activeTab === 'firewall' && <Firewall />}
            {activeTab === 'users' && <Users />}
            {activeTab === 'settings' && <SettingsTab />}
            {activeTab === 'terminal' && <HostTerminal />}
          </div>
        </div>
      </main>

      {isCreateModalOpen && <CreateVMModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSuccess={fetchVMs} />}
      
      {activeConsole && (
        <VncConsole 
          uuid={activeConsole.uuid} 
          name={activeConsole.name} 
          onClose={() => setActiveConsole(null)} 
        />
      )}

      {activeSsh && (
        <SshTerminal 
          uuid={activeSsh.uuid} 
          name={activeSsh.name} 
          onClose={() => setActiveSsh(null)} 
        />
      )}

      {activeGuac && (
        <GuacamoleConsole 
          uuid={activeGuac.uuid} 
          name={activeGuac.name} 
          type={activeGuac.type} 
          onClose={() => setActiveGuac(null)} 
        />
      )}
    </div>
  );
}

function SettingsTab() {
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSetup2FA = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/auth/2fa/setup', { method: 'POST' });
      setQrCode(data.qrCodeUrl);
      setSecret(data.secret);
    } catch (err: any) {
      setError(err.message || 'Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleEnable2FA = async () => {
    setLoading(true);
    setError('');
    try {
      await apiCall('/auth/2fa/enable', {
        method: 'POST',
        body: JSON.stringify({ secret, token })
      });
      setSuccess(true);
      setQrCode('');
    } catch (err: any) {
      setError(err.message || 'Failed to enable 2FA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-600" />
          Two-Factor Authentication (2FA)
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          Enhance your account security by requiring a 6-digit code from an authenticator app (like Google Authenticator or Authy) when signing in.
        </p>

        {success ? (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            2FA has been successfully enabled for your account.
          </div>
        ) : qrCode ? (
          <div className="space-y-6 text-center">
            <div className="inline-block p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <img src={qrCode} alt="2FA QR Code" className="w-48 h-48 mx-auto" />
            </div>
            <div className="max-w-xs mx-auto space-y-4">
              <p className="text-sm text-slate-600">Scan this QR code with your authenticator app, then enter the code below to confirm.</p>
              <input 
                type="text"
                value={token}
                onChange={e => setToken(e.target.value)}
                placeholder="000000"
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-center text-lg font-mono tracking-widest focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button 
                onClick={handleEnable2FA}
                disabled={loading || token.length !== 6}
                className="btn-primary w-full"
              >
                {loading ? 'Enabling...' : 'Confirm & Enable 2FA'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={handleSetup2FA} disabled={loading} className="btn-primary">
            {loading ? 'Loading...' : 'Setup Authenticator App'}
          </button>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Key className="w-5 h-5 text-indigo-600" />
          Authentication Realms
        </h3>
        <p className="text-sm text-slate-500 mb-4">
          Configure external authentication providers for your cluster.
        </p>
        <div className="space-y-3">
          {['Linux PAM', 'Microsoft AD', 'LDAP', 'OpenID Connect'].map(realm => (
            <div key={realm} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <span className="text-sm font-medium text-slate-700">{realm}</span>
              <button className="text-xs text-indigo-600 font-semibold hover:text-indigo-500">Configure</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
