import React, { useState, useEffect } from 'react';
import { apiCall } from '../lib/api';
import { ArrowRight, RefreshCw, AlertTriangle, Server, Box } from 'lucide-react';

export default function Migration() {
  const [vms, setVms] = useState<any[]>([]);
  const [containers, setContainers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [nodes, setNodes] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<string>('');

  useEffect(() => {
    fetchData();
    fetchNodes();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vmData, containerData] = await Promise.all([
        apiCall('/vms'),
        apiCall('/lxc')
      ]);
      setVms(vmData.vms || []);
      setContainers(containerData.containers || []);
    } catch (err) {
      console.error('Failed to fetch migration data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchNodes = async () => {
    try {
      const data = await apiCall('/cluster');
      setNodes(data.nodes || []);
      if (data.nodes?.length > 0) setSelectedNode(data.nodes[0].name);
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    }
  };

  const toggleSelection = (uuid: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(uuid)) newSelected.delete(uuid);
    else newSelected.add(uuid);
    setSelectedItems(newSelected);
  };

  const handleMigrate = async (uuid: string, name: string, type: 'vm' | 'container') => {
    if (!selectedNode) {
      alert('Please select a target node.');
      return;
    }

    setMigrating(prev => new Set(prev).add(uuid));
    try {
      const endpoint = type === 'vm' ? `/vms/${uuid}/migrate` : `/lxc/${uuid}/migrate`;
      await apiCall(endpoint, {
        method: 'POST',
        body: JSON.stringify({ targetNode: selectedNode })
      });
      alert(`Migration of ${name} to ${selectedNode} initiated.`);
      fetchData();
    } catch (err: any) {
      alert(err.message || 'Migration failed');
    } finally {
      setMigrating(prev => {
        const next = new Set(prev);
        next.delete(uuid);
        return next;
      });
    }
  };

  const handleBulkMigrate = async (type: 'vm' | 'container') => {
    if (!selectedNode) {
      alert('Please select a target node.');
      return;
    }

    const itemsToMigrate = Array.from(selectedItems).filter(uuid => {
      const item = type === 'vm' ? vms.find(v => v.uuid === uuid) : containers.find(c => c.name === uuid);
      return item;
    });

    setMigrating(prev => new Set([...prev, ...itemsToMigrate]));
    
    for (const uuid of itemsToMigrate) {
      try {
        const endpoint = type === 'vm' ? `/vms/${uuid}/migrate` : `/lxc/${uuid}/migrate`;
        await apiCall(endpoint, {
          method: 'POST',
          body: JSON.stringify({ targetNode: selectedNode })
        });
      } catch (err: any) {
        console.error(`Migration of ${uuid} failed:`, err);
      }
    }
    
    setMigrating(prev => {
      const next = new Set(prev);
      itemsToMigrate.forEach(uuid => next.delete(uuid));
      return next;
    });
    setSelectedItems(new Set());
    fetchData();
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Live Migration</h2>
        <p className="text-slate-500 mt-1">Move running workloads between cluster nodes with zero downtime.</p>
      </div>

      <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-sm border border-slate-200">
        <label className="text-sm font-medium text-slate-700">Target Node:</label>
        <select 
          value={selectedNode} 
          onChange={(e) => setSelectedNode(e.target.value)}
          className="p-2 border border-slate-300 rounded-md text-sm"
        >
          {nodes.map(node => (
            <option key={node.name} value={node.name}>{node.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* VMs Section */}
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-600" />
              Virtual Machines
            </h3>
            {selectedItems.size > 0 && (
              <button onClick={() => handleBulkMigrate('vm')} className="btn-primary text-xs">Migrate Selected</button>
            )}
          </div>
          <div className="space-y-2">
            {vms.filter(vm => vm.state === 'running').map(vm => (
              <div key={vm.uuid} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedItems.has(vm.uuid)} onChange={() => toggleSelection(vm.uuid)} />
                  <span className="font-medium text-slate-700">{vm.name}</span>
                </div>
                <button 
                  onClick={() => handleMigrate(vm.uuid, vm.name, 'vm')}
                  disabled={migrating.has(vm.uuid)}
                  className="btn-secondary text-xs"
                >
                  {migrating.has(vm.uuid) ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Migrate'}
                </button>
              </div>
            ))}
            {vms.filter(vm => vm.state === 'running').length === 0 && <p className="text-sm text-slate-400">No running VMs.</p>}
          </div>
        </div>

        {/* Containers Section */}
        <div className="glass-panel p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Box className="w-5 h-5 text-indigo-600" />
              LXC Containers
            </h3>
            {selectedItems.size > 0 && (
              <button onClick={() => handleBulkMigrate('container')} className="btn-primary text-xs">Migrate Selected</button>
            )}
          </div>
          <div className="space-y-2">
            {containers.filter(c => c.status === 'running').map(c => (
              <div key={c.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedItems.has(c.name)} onChange={() => toggleSelection(c.name)} />
                  <span className="font-medium text-slate-700">{c.name}</span>
                </div>
                <button 
                  onClick={() => handleMigrate(c.name, c.name, 'container')}
                  disabled={migrating.has(c.name)}
                  className="btn-secondary text-xs"
                >
                  {migrating.has(c.name) ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Migrate'}
                </button>
              </div>
            ))}
            {containers.filter(c => c.status === 'running').length === 0 && <p className="text-sm text-slate-400">No running containers.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
