import React, { useState } from 'react';
import { Save, Loader2 } from 'lucide-react';

interface BackupManagerProps {
  uuid: string;
}

export default function BackupManager({ uuid }: BackupManagerProps) {
  const [poolName, setPoolName] = useState('default');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleBackup = async () => {
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(`/api/vms/${uuid}/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poolName })
      });
      const data = await response.json();
      if (data.success) {
        setResult(`Backup created at: ${data.path}`);
      } else {
        throw new Error(data.error || 'Backup failed');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-6 space-y-4">
      <h3 className="text-lg font-bold text-slate-900">Backup VM</h3>
      <div className="flex gap-2">
        <input
          type="text"
          value={poolName}
          onChange={(e) => setPoolName(e.target.value)}
          placeholder="Storage pool name"
          className="flex-1 p-2 border border-slate-300 rounded-md text-sm"
        />
        <button onClick={handleBackup} disabled={loading} className="btn-primary flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Backup
        </button>
      </div>
      {result && <p className="text-sm text-emerald-600 bg-emerald-50 p-2 rounded">{result}</p>}
    </div>
  );
}
