import React, { useState, useEffect } from 'react';
import { Save, Loader2 } from 'lucide-react';

interface ConfigEditorProps {
  type: 'vm' | 'lxc';
  id: string;
}

export default function ConfigEditor({ type, id }: ConfigEditorProps) {
  const [config, setConfig] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/${type === 'vm' ? 'vms' : 'lxc'}/${id}/config`)
      .then(res => res.json())
      .then(data => setConfig(data.config))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [type, id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/${type === 'vm' ? 'vms' : 'lxc'}/${id}/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(type === 'vm' ? { xml: config } : { config })
      });
      alert('Configuration updated successfully');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  return (
    <div className="card p-6 space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-slate-900">Edit Configuration</h3>
        <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>
      <textarea
        value={config}
        onChange={(e) => setConfig(e.target.value)}
        className="w-full h-96 p-4 font-mono text-sm border border-slate-300 rounded-md"
      />
    </div>
  );
}
