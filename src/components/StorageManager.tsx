import React, { useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { apiCall } from '../lib/api';

interface StorageManagerProps {
  uuid: string;
}

export default function StorageManager({ uuid }: StorageManagerProps) {
  const [adding, setAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const source = formData.get('source') as string;
    const target = formData.get('target') as string;
    setAdding(true);
    try {
      await apiCall(`/vms/${uuid}/storage`, {
        method: 'POST',
        body: JSON.stringify({ source, target }),
      });
      alert('Storage interface added');
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (target: string) => {
    if (!confirm('Are you sure you want to remove this storage interface?')) return;
    try {
      await apiCall(`/vms/${uuid}/storage/${target}`, { method: 'DELETE' });
      alert('Storage interface removed');
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="card p-6 space-y-4">
      <h3 className="text-lg font-bold text-slate-900">Storage Interfaces</h3>
      <form onSubmit={handleAdd} className="flex gap-2">
        <input name="source" placeholder="Source Path (e.g. /var/lib/libvirt/images/disk.qcow2)" className="input-field" required />
        <input name="target" placeholder="Target (e.g. vda)" className="input-field" required />
        <button type="submit" disabled={adding} className="btn-primary">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add
        </button>
      </form>
    </div>
  );
}
