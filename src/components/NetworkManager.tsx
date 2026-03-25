import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { apiCall } from '../lib/api';

interface NetworkManagerProps {
  uuid: string;
}

export default function NetworkManager({ uuid }: NetworkManagerProps) {
  const [adding, setAdding] = useState(false);
  const [interfaces, setInterfaces] = useState<any[]>([]);

  useEffect(() => {
    // In a real app, you'd fetch the current interfaces here.
    // For now, we'll assume the backend provides an endpoint to list them.
    // Since we don't have one, this is just a placeholder.
  }, [uuid]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const network = formData.get('network') as string;
    const model = formData.get('model') as string;
    setAdding(true);
    try {
      await apiCall(`/vms/${uuid}/network`, {
        method: 'POST',
        body: JSON.stringify({ network, model }),
      });
      alert('Network interface added');
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (mac: string) => {
    if (!confirm('Are you sure you want to remove this interface?')) return;
    try {
      await apiCall(`/vms/${uuid}/network/${mac}`, { method: 'DELETE' });
      alert('Network interface removed');
      // Refresh interfaces list here
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="card p-6 space-y-4">
      <h3 className="text-lg font-bold text-slate-900">Network Interfaces</h3>
      <form onSubmit={handleAdd} className="flex gap-2">
        <input name="network" placeholder="Network (e.g. default)" className="input-field" required />
        <select name="model" className="input-field">
          <option value="virtio">VirtIO</option>
          <option value="e1000">E1000</option>
        </select>
        <button type="submit" disabled={adding} className="btn-primary">
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add
        </button>
      </form>
    </div>
  );
}
