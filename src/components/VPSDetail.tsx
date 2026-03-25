import React, { useState } from 'react';
import { 
  ArrowLeft, Server, Shield, HardDrive, Cpu, Network, 
  RefreshCw, Play, Square, Trash2, Copy, Save, AlertTriangle,
  Settings, Database, GitBranch, Clock, Mail, Camera, Box
} from 'lucide-react';
import SnapshotManager from './SnapshotManager';
import BackupManager from './BackupManager';
import ConfigEditor from './ConfigEditor';
import NetworkManager from './NetworkManager';
import StorageManager from './StorageManager';
import { apiCall } from '../lib/api';
import Modal from './ui/Modal';

interface VPSDetailProps {
  uuid: string;
  name: string;
  onBack: () => void;
  onDelete: () => void;
}

export default function VPSDetail({ uuid, name, onBack, onDelete }: VPSDetailProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'network' | 'storage' | 'backups' | 'snapshots' | 'config'>('overview');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleAction = async (action: string, endpoint: string, method: string = 'POST', body?: any) => {
    setActionInProgress(action);
    try {
      await apiCall(endpoint, { method, body: body ? JSON.stringify(body) : undefined });
      alert(`${action} successful`);
    } catch (err: any) {
      alert(`Failed to ${action.toLowerCase()}: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRename = async () => {
    const newName = window.prompt('Enter new name for the VM:', name);
    if (!newName || newName === name) return;
    try {
      await apiCall(`/vms/${uuid}/rename`, {
        method: 'POST',
        body: JSON.stringify({ newName })
      });
      alert('VM renamed successfully');
      window.location.reload();
    } catch (err: any) {
      alert(err.message || 'Failed to rename VM');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{name}</h2>
            <p className="text-sm text-slate-500 font-mono">{uuid}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleRename} className="btn-secondary"><Settings className="w-4 h-4 mr-2" /> Rename</button>
          <button onClick={() => setIsDeleteModalOpen(true)} className="btn-secondary text-rose-600 hover:text-rose-700 hover:bg-rose-50"><Trash2 className="w-4 h-4 mr-2" /> Delete VM</button>
        </div>
      </div>
      <Modal 
        isOpen={isDeleteModalOpen} 
        onClose={() => setIsDeleteModalOpen(false)} 
        title="Delete VM"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setIsDeleteModalOpen(false)}>Cancel</button>
            <button className="btn-primary bg-rose-600 hover:bg-rose-700" onClick={async () => {
              try {
                await apiCall(`/vms/${uuid}`, { method: 'DELETE' });
                alert('VM deleted successfully');
                onDelete();
              } catch (err: any) {
                alert(err.message);
              } finally {
                setIsDeleteModalOpen(false);
              }
            }}>Delete</button>
          </>
        }
      >
        <p className="text-slate-600">Are you sure you want to delete this VM? This action cannot be undone.</p>
      </Modal>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200">
        {(['overview', 'network', 'storage', 'backups', 'snapshots', 'config'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium capitalize ${activeTab === tab ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'overview' && <div className="card p-6 text-slate-500">Overview content placeholder</div>}
          {activeTab === 'network' && <NetworkManager uuid={uuid} />}
          {activeTab === 'storage' && <StorageManager uuid={uuid} />}
          {activeTab === 'backups' && <BackupManager uuid={uuid} />}
          {activeTab === 'snapshots' && <SnapshotManager uuid={uuid} />}
          {activeTab === 'config' && <ConfigEditor type="vm" id={uuid} />}
        </div>

        {/* Sidebar Actions */}
        <div className="space-y-4">
          <div className="card p-4 space-y-2">
            <h4 className="font-bold text-slate-900 mb-2">Quick Actions</h4>
            {actionInProgress && (
              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden mb-2">
                <div className="h-full bg-indigo-500 animate-pulse"></div>
              </div>
            )}
            <button 
              onClick={() => handleAction('Add-ons', `/vms/${uuid}/addons`)} 
              disabled={!!actionInProgress}
              className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-md disabled:opacity-50"
            >
              {actionInProgress === 'Add-ons' ? 'Processing...' : 'Add-ons'}
            </button>
            <button 
              onClick={() => handleAction('Handover', `/vms/${uuid}/handover`)} 
              disabled={!!actionInProgress}
              className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-md disabled:opacity-50"
            >
              {actionInProgress === 'Handover' ? 'Processing...' : 'Handover'}
            </button>
            <button 
              onClick={async () => {
                const newName = window.prompt('Enter name for the clone:', `${name}-clone`);
                if (newName) await handleAction('Clone', `/vms/${uuid}/clone`, 'POST', { newName });
              }} 
              disabled={!!actionInProgress}
              className="w-full text-left px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-md disabled:opacity-50"
            >
              {actionInProgress === 'Clone' ? 'Processing...' : 'Clone'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
