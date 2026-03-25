import React, { useState, useEffect } from 'react';
import { Camera, RefreshCw, Trash2, Plus } from 'lucide-react';

interface SnapshotManagerProps {
  uuid: string;
}

export default function SnapshotManager({ uuid }: SnapshotManagerProps) {
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState('');

  const fetchSnapshots = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/vms/${uuid}/snapshots`);
      const data = await response.json();
      setSnapshots(data.snapshots || []);
    } catch (err) {
      console.error('Failed to fetch snapshots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, [uuid]);

  const handleCreate = async () => {
    if (!newSnapshotName) return;
    try {
      await fetch(`/api/vms/${uuid}/snapshots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newSnapshotName })
      });
      setNewSnapshotName('');
      fetchSnapshots();
    } catch (err) {
      alert('Failed to create snapshot');
    }
  };

  const handleRevert = async (name: string) => {
    if (!confirm(`Revert to snapshot ${name}?`)) return;
    try {
      await fetch(`/api/vms/${uuid}/snapshots/${name}/revert`, { method: 'POST' });
      fetchSnapshots();
    } catch (err) {
      alert('Failed to revert snapshot');
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete snapshot ${name}?`)) return;
    try {
      await fetch(`/api/vms/${uuid}/snapshots/${name}`, { method: 'DELETE' });
      fetchSnapshots();
    } catch (err) {
      alert('Failed to delete snapshot');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newSnapshotName}
          onChange={(e) => setNewSnapshotName(e.target.value)}
          placeholder="New snapshot name"
          className="flex-1 p-2 border border-slate-300 rounded-md text-sm"
        />
        <button onClick={handleCreate} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Create
        </button>
      </div>

      <div className="card divide-y divide-slate-200">
        {loading ? (
          <div className="p-4 text-center text-slate-500">Loading...</div>
        ) : snapshots.length === 0 ? (
          <div className="p-4 text-center text-slate-500">No snapshots found.</div>
        ) : (
          snapshots.map(name => (
            <div key={name} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-slate-400" />
                <span className="font-medium text-slate-900">{name}</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleRevert(name)} className="btn-secondary p-2" title="Revert">
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(name)} className="btn-secondary p-2 text-red-600" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
