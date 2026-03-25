import React, { useState, useEffect } from 'react';
import { apiCall } from '../lib/api';
import Migration from './Migration';
import CreateVMModal from './CreateVMModal';
import VncConsole from './VncConsole';
import Networking from './Networking';
import Storage from './Storage';
import Containers from './Containers';
import Cluster from './Cluster';
import Firewall from './Firewall';
import Monitoring from './Monitoring';
import SystemLogs from './SystemLogs';
import HostTerminal from './HostTerminal';
import SshTerminal from './SshTerminal';
import GuacamoleConsole from './GuacamoleConsole';
import Users from './Users';
import VPSDetail from './VPSDetail';
import Modal from './ui/Modal';
import { 
  Play, Square, Trash2, RefreshCw, Server, LogOut, Terminal, 
  AlertTriangle, Network, HardDrive, Cpu, MemoryStick, Activity, 
  Box, Share2, Shield, Copy, Monitor, MonitorSmartphone, ChevronRight, ArrowRight,
  Users as UsersIcon, Settings, Key, CheckCircle2, ClipboardList, Plus, X
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
  const [activeTab, setActiveTab] = useState<'monitoring' | 'vms' | 'containers' | 'networking' | 'storage' | 'cluster' | 'firewall' | 'terminal' | 'users' | 'settings' | 'logs' | 'migration'>('monitoring');
  const [selectedVm, setSelectedVm] = useState<VM | null>(null);
  const [vms, setVms] = useState<VM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeConsole, setActiveConsole] = useState<{uuid: string, name?: string} | null>(null);
  const [activeSsh, setActiveSsh] = useState<{uuid: string, name?: string} | null>(null);
  const [activeGuac, setActiveGuac] = useState<{uuid: string, name?: string, type: 'vnc' | 'ssh' | 'rdp'} | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const [promptModal, setPromptModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (value: string) => void;
    defaultValue?: string;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [promptValue, setPromptValue] = useState('');

  const fetchVMs = async () => {
    if (activeTab !== 'vms' && !selectedVm) return;
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
      if (activeTab === 'vms' || selectedVm) fetchVMs();
    }, 10000);
    return () => clearInterval(interval);
  }, [activeTab, selectedVm]);

  const handleAction = async (uuid: string, action: string) => {
    try {
      await apiCall(`/vms/${uuid}/${action}`, { method: 'POST' });
      fetchVMs();
    } catch (err: any) {
      alert(err.message || `Failed to ${action} VM`);
    }
  };

  const handleMigrate = async (uuid: string, name?: string) => {
    setPromptModal({
      isOpen: true,
      title: 'Live Migration',
      message: 'Enter target node hostname or IP for live migration:',
      onConfirm: async (targetNode) => {
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
      }
    });
    setPromptValue('nova-node-02');
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
    setConfirmModal({
      isOpen: true,
      title: 'Delete VM',
      message: 'Are you sure you want to delete this VM? This action cannot be undone.',
      onConfirm: async () => {
        // Optimistic UI update
        setVms(prev => prev.filter(vm => vm.uuid !== uuid));
        
        try {
          await apiCall(`/vms/${uuid}`, { method: 'DELETE' });
        } catch (err: any) {
          alert(err.message || 'Failed to delete VM');
          fetchVMs(); // Re-fetch on error to restore state
        }
      }
    });
  };

  const handleClone = async (uuid: string, name?: string) => {
    setPromptModal({
      isOpen: true,
      title: 'Clone VM',
      message: 'Enter name for the clone:',
      onConfirm: async (newName) => {
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
      }
    });
    setPromptValue(`${name || uuid}-clone`);
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
    { id: 'migration', label: 'Migration', icon: ArrowRight },
    { id: 'networking', label: 'Networking', icon: Network },
    { id: 'storage', label: 'Storage', icon: HardDrive },
    { id: 'firewall', label: 'Firewall', icon: Shield },
    { id: 'cluster', label: 'Cluster', icon: Share2 },
    { id: 'users', label: 'Users & RBAC', icon: UsersIcon },
    { id: 'logs', label: 'System Logs', icon: ClipboardList },
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
            {selectedVm ? (
              <VPSDetail 
                uuid={selectedVm.uuid} 
                name={selectedVm.name || 'Unnamed Instance'} 
                onBack={() => setSelectedVm(null)} 
                onDelete={() => { setSelectedVm(null); fetchVMs(); }}
              />
            ) : activeTab === 'vms' ? (
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
                          <tr key={vm.uuid} onClick={() => setSelectedVm(vm)} className="cursor-pointer hover:bg-slate-50">
                            <td>{getStatusBadge(vm.state)}</td>
                            <td>
                              <div className="font-semibold text-slate-900">{vm.name || 'Unnamed Instance'}</div>
                              <div className="text-[10px] font-mono text-slate-400 mt-0.5">{vm.uuid}</div>
                            </td>
                            <td>
                              <div className="flex items-center gap-4">
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <Cpu className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-xs font-mono text-slate-600">
                                      {vm.cpu_time && vm.cpu_time !== '0' ? 
                                        `${(parseInt(vm.cpu_time)/1000000000).toFixed(1)}s` : 
                                        '0s'}
                                    </span>
                                  </div>
                                  <div className="w-24 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                    <div className="h-full bg-indigo-500" style={{ width: vm.state === 'running' ? '45%' : '0%' }}></div>
                                  </div>
                                </div>
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <MemoryStick className="w-3.5 h-3.5 text-slate-400" />
                                    <span className="text-xs font-mono text-slate-600">
                                      {vm.used_memory ? `${(parseInt(vm.used_memory)/1024).toFixed(0)} MB` : '0 MB'}
                                    </span>
                                  </div>
                                  <div className="w-24 h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
                                    <div className="h-full bg-sky-500" style={{ 
                                      width: vm.used_memory && vm.max_memory ? 
                                        `${(parseInt(vm.used_memory) / parseInt(vm.max_memory) * 100).toFixed(0)}%` : 
                                        '0%' 
                                    }}></div>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td>
                              <div className="text-xs font-medium text-slate-600">{vm.owner || 'System'}</div>
                              {vm.tags && <div className="text-[10px] text-sky-600 mt-0.5 font-bold uppercase tracking-wider">{vm.tags}</div>}
                            </td>
                            <td>
                              <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
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
            ) : (
              <>
                {activeTab === 'monitoring' && <Monitoring />}
                {activeTab === 'containers' && <Containers />}
                {activeTab === 'migration' && <Migration />}
                {activeTab === 'networking' && <Networking />}
                {activeTab === 'storage' && <Storage />}
                {activeTab === 'cluster' && <Cluster />}
                {activeTab === 'firewall' && <Firewall />}
                {activeTab === 'users' && <Users />}
                {activeTab === 'logs' && <SystemLogs />}
                {activeTab === 'settings' && <SettingsTab />}
                {activeTab === 'terminal' && <HostTerminal />}
              </>
            )}
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

      <Modal 
        isOpen={confirmModal.isOpen} 
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}>Cancel</button>
            <button className="btn-primary bg-rose-600 hover:bg-rose-700" onClick={() => { confirmModal.onConfirm(); setConfirmModal(prev => ({ ...prev, isOpen: false })); }}>Confirm</button>
          </>
        }
      >
        <p className="text-slate-600">{confirmModal.message}</p>
      </Modal>

      <Modal 
        isOpen={promptModal.isOpen} 
        onClose={() => setPromptModal(prev => ({ ...prev, isOpen: false }))}
        title={promptModal.title}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setPromptModal(prev => ({ ...prev, isOpen: false }))}>Cancel</button>
            <button className="btn-primary" onClick={() => { promptModal.onConfirm(promptValue); setPromptModal(prev => ({ ...prev, isOpen: false })); }}>Confirm</button>
          </>
        }
      >
        <p className="text-slate-600 mb-4">{promptModal.message}</p>
        <input 
          type="text" 
          value={promptValue} 
          onChange={(e) => setPromptValue(e.target.value)} 
          className="input-field w-full"
        />
      </Modal>
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
  const [realms, setRealms] = useState<any[]>([]);
  const [showRealmModal, setShowRealmModal] = useState(false);
  const [editingRealm, setEditingRealm] = useState<any>(null);

  const [systemStatus, setSystemStatus] = useState<any[]>([]);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    fetchRealms();
    fetchSystemStatus();
  }, []);

  const fetchSystemStatus = async () => {
    try {
      const data = await apiCall('/system/check');
      setSystemStatus(data.results || []);
    } catch (err) {
      console.error('Failed to fetch system status:', err);
    }
  };

  const handleInstallPrerequisites = async () => {
    console.log('Button pressed');
    if (!confirm('This will initiate the installation of KVM, Libvirt, LXC, and Guacamole. Proceed?')) return;
    console.log('Confirmed');
    setInstalling(true);
    try {
      const data = await apiCall('/system/install', { method: 'POST' });
      console.log('Installation success', data);
      alert(data.message);
      fetchSystemStatus();
    } catch (err: any) {
      console.error('Installation error', err);
      alert(err.message);
    } finally {
      setInstalling(false);
    }
  };

  const fetchRealms = async () => {
    try {
      const data = await apiCall('/auth/realms');
      setRealms(data.realms || []);
    } catch (err) {
      console.error('Failed to fetch realms:', err);
    }
  };

  const handleSaveRealm = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const type = formData.get('type') as string;
    const name = formData.get('name') as string;
    const is_default = formData.get('is_default') === 'on';
    
    // Basic config extraction
    const config: any = {};
    config.server = formData.get('server');
    config.port = formData.get('port');
    config.domain = formData.get('domain');
    config.base_dn = formData.get('base_dn');
    config.bind_user = formData.get('bind_user');

    try {
      await apiCall('/auth/realms', {
        method: 'POST',
        body: JSON.stringify({ type, name, config, is_default }),
      });
      setShowRealmModal(false);
      setEditingRealm(null);
      fetchRealms();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteRealm = async (id: number) => {
    if (!confirm('Are you sure you want to delete this realm?')) return;
    try {
      await apiCall(`/auth/realms/${id}`, { method: 'DELETE' });
      fetchRealms();
    } catch (err: any) {
      alert(err.message);
    }
  };

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
          <Server className="w-5 h-5 text-indigo-600" />
          System Status & Dependencies
        </h3>
        <p className="text-sm text-slate-500 mb-6">
          Check the status of virtualization binaries and core system dependencies.
        </p>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          {systemStatus.map(check => (
            <div key={check.name} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-700">{check.name}</span>
                <span className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">{check.version || 'N/A'}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                check.status === 'installed' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {check.status}
              </span>
            </div>
          ))}
        </div>

        <button 
          onClick={handleInstallPrerequisites} 
          disabled={installing}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          {installing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
          {installing ? 'Installing Dependencies...' : 'Install All Prerequisites (KVM, LXC, Guac)'}
        </button>
      </div>

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
          {realms.map(realm => (
            <div key={realm.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-700">
                  {realm.name} 
                  {realm.is_default === 1 && <span className="ml-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] rounded uppercase font-bold">Default</span>}
                </span>
                <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">{realm.type}</span>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => { setEditingRealm(realm); setShowRealmModal(true); }}
                  className="text-xs text-indigo-600 font-semibold hover:text-indigo-500"
                >
                  Configure
                </button>
                {realm.type !== 'pam' && (
                  <button 
                    onClick={() => handleDeleteRealm(realm.id)}
                    className="text-xs text-red-600 font-semibold hover:text-red-500"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
          <button 
            onClick={() => { setEditingRealm(null); setShowRealmModal(true); }}
            className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg text-sm text-slate-500 hover:border-indigo-300 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add New Realm
          </button>
        </div>
      </div>

      {showRealmModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-bold text-slate-900">{editingRealm ? 'Edit Realm' : 'Add Authentication Realm'}</h3>
              <button onClick={() => setShowRealmModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleSaveRealm} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="input-label">Realm Type</label>
                <select name="type" defaultValue={editingRealm?.type || 'ad'} className="input-field">
                  <option value="pam">Linux PAM</option>
                  <option value="ad">Microsoft Active Directory</option>
                  <option value="ldap">LDAP</option>
                  <option value="oidc">OpenID Connect</option>
                </select>
              </div>
              <div>
                <label className="input-label">Realm Name</label>
                <input name="name" type="text" defaultValue={editingRealm?.name || ''} className="input-field" placeholder="e.g. corp-ad" required />
              </div>
              
              <div className="space-y-4 pt-2 border-t border-slate-50">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Configuration</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="input-label">Server / Issuer URL</label>
                    <input name="server" type="text" defaultValue={editingRealm?.config?.server || editingRealm?.config?.issuer || ''} className="input-field" placeholder="10.0.0.10 or https://..." />
                  </div>
                  <div>
                    <label className="input-label">Port</label>
                    <input name="port" type="number" defaultValue={editingRealm?.config?.port || ''} className="input-field" placeholder="389 / 636" />
                  </div>
                  <div>
                    <label className="input-label">Domain (AD only)</label>
                    <input name="domain" type="text" defaultValue={editingRealm?.config?.domain || ''} className="input-field" placeholder="corp.local" />
                  </div>
                </div>

                <div>
                  <label className="input-label">Base DN / Client ID</label>
                  <input name="base_dn" type="text" defaultValue={editingRealm?.config?.base_dn || editingRealm?.config?.client_id || ''} className="input-field" placeholder="dc=corp,dc=local" />
                </div>

                <div>
                  <label className="input-label">Bind User / Client Secret</label>
                  <input name="bind_user" type="text" defaultValue={editingRealm?.config?.bind_user || editingRealm?.config?.client_secret || ''} className="input-field" placeholder="user@domain or secret" />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input name="is_default" type="checkbox" defaultChecked={editingRealm?.is_default === 1} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <label className="text-sm text-slate-700">Set as default realm</label>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowRealmModal(false)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1">Save Realm</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
