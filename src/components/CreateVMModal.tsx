import React, { useState } from 'react';
import { apiCall } from '../lib/api';
import { X, Server, Cpu, MemoryStick, HardDrive, Network, Tag, FileText } from 'lucide-react';

interface CreateVMModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateVMModal({ isOpen, onClose, onSuccess }: CreateVMModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    memory: 1024,
    vcpus: 1,
    diskSize: 10,
    isoPath: '',
    network: 'default',
    notes: '',
    tags: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await apiCall('/vms', {
        method: 'POST',
        body: JSON.stringify(formData),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create VM');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value,
    }));
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-600">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Provision Virtual Machine</h2>
              <p className="text-sm text-slate-500">Configure resources for your new instance</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          <form id="create-vm-form" onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="input-label">Hostname</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Server className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  required
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="e.g., web-server-01"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="input-label">Memory (MB)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MemoryStick className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    required
                    type="number"
                    name="memory"
                    min="512"
                    step="512"
                    value={formData.memory}
                    onChange={handleChange}
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="input-label">vCPUs</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Cpu className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    required
                    type="number"
                    name="vcpus"
                    min="1"
                    max="32"
                    value={formData.vcpus}
                    onChange={handleChange}
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Disk Size (GB)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <HardDrive className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    required
                    type="number"
                    name="diskSize"
                    min="1"
                    value={formData.diskSize}
                    onChange={handleChange}
                    className="input-field pl-10"
                  />
                </div>
              </div>

              <div>
                <label className="input-label">Network</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Network className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    required
                    name="network"
                    value={formData.network}
                    onChange={handleChange}
                    className="input-field pl-10"
                    placeholder="default"
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-200" />

            <div>
              <label className="input-label">ISO Path (Optional)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <HardDrive className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  name="isoPath"
                  value={formData.isoPath}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="/var/lib/libvirt/images/ubuntu.iso"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">Path to the installation media on the host.</p>
            </div>

            <div>
              <label className="input-label">Tags (Comma separated)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Tag className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  className="input-field pl-10"
                  placeholder="prod, web, linux"
                />
              </div>
            </div>

            <div>
              <label className="input-label">Notes</label>
              <div className="relative">
                <div className="absolute top-3 left-3 pointer-events-none">
                  <FileText className="h-4 w-4 text-slate-400" />
                </div>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleChange}
                  className="input-field pl-10 min-h-[80px] resize-y"
                  placeholder="Description or purpose of this VM..."
                />
              </div>
            </div>
          </form>
        </div>

        <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" form="create-vm-form" disabled={loading} className="btn-primary">
            {loading ? 'Provisioning...' : 'Deploy Instance'}
          </button>
        </div>
      </div>
    </div>
  );
}
