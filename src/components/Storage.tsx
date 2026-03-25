import React, { useState, useEffect, useRef } from 'react';
import { apiCall } from '../lib/api';
import { Play, Square, RefreshCw, HardDrive, AlertTriangle, Database, ChevronDown, ChevronRight, FileUp, Trash2 } from 'lucide-react';

interface StoragePool {
  name: string;
  state: string;
  autostart: string;
}

interface StorageVolume {
  name: string;
  path: string;
}

interface PhysicalDisk {
  name: string;
  size: string;
  model: string;
  type: string;
  tran: string;
}

export default function Storage() {
  const [activeSubTab, setActiveSubTab] = useState<'pools' | 'disks'>('pools');
  const [pools, setPools] = useState<StoragePool[]>([]);
  const [volumes, setVolumes] = useState<Record<string, StorageVolume[]>>({});
  const [disks, setDisks] = useState<PhysicalDisk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedPools, setExpandedPools] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);
  const [selectedDisk, setSelectedDisk] = useState<PhysicalDisk | null>(null);
  const [fsType, setFsType] = useState('ext4');
  const [newPool, setNewPool] = useState({ name: '', type: 'dir', target: '', source: '', vgName: '', devices: '' });

  const fetchPools = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiCall('/storage/pools');
      const fetchedPools = data.pools || [];
      setPools(fetchedPools);

      // Fetch volumes for active pools
      const vols: Record<string, StorageVolume[]> = {};
      await Promise.all(fetchedPools.map(async (pool: StoragePool) => {
        if (pool.state === 'active') {
          try {
            const volData = await apiCall(`/storage/pools/${pool.name}/volumes`);
            vols[pool.name] = volData.volumes || [];
          } catch (e) {
            console.error(`Failed to fetch volumes for pool ${pool.name}`, e);
          }
        }
      }));
      setVolumes(vols);

    } catch (err: any) {
      setError(err.message || 'Failed to fetch storage pools');
    } finally {
      setLoading(false);
    }
  };

  const fetchDisks = async () => {
    setLoading(true);
    try {
      const data = await apiCall('/storage/disks');
      setDisks(data.disks || []);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch physical disks');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePool = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (newPool.type === 'zfs') {
        await apiCall('/storage/zfs/create', { method: 'POST', body: JSON.stringify({ name: newPool.name, devices: newPool.devices.split(',').map(d => d.trim()) }) });
      } else if (newPool.type === 'logical') {
        await apiCall('/storage/lvm/create', { method: 'POST', body: JSON.stringify({ name: newPool.name, vgName: newPool.vgName }) });
      } else {
        await apiCall('/storage/pools/create', { method: 'POST', body: JSON.stringify(newPool) });
      }
      setIsCreateModalOpen(false);
      fetchPools();
    } catch (err: any) {
      setError(err.message || 'Failed to create storage pool');
    } finally {
      setLoading(false);
    }
  };

  const handleFormatDisk = async () => {
    if (!selectedDisk) return;
    setLoading(true);
    try {
      await apiCall(`/storage/disks/${selectedDisk.name}/format`, {
        method: 'POST',
        body: JSON.stringify({ fsType })
      });
      setIsFormatModalOpen(false);
      fetchDisks();
    } catch (err: any) {
      setError(err.message || 'Failed to format disk');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSubTab === 'pools') {
      fetchPools();
    } else {
      fetchDisks();
    }
  }, [activeSubTab]);

  const handleAction = async (name: string, action: 'start' | 'stop') => {
    try {
      await apiCall(`/storage/pools/${name}/${action}`, { method: 'POST' });
      fetchPools();
    } catch (err: any) {
      alert(`Failed to ${action} storage pool: ${err.message}`);
    }
  };

  const togglePool = (name: string) => {
    const newExpanded = new Set(expandedPools);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedPools(newExpanded);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!(file.name || '').toLowerCase().endsWith('.iso')) {
      alert('Please select a valid .iso file');
      return;
    }

    const formData = new FormData();
    formData.append('iso', file);

    setUploading(true);
    setUploadProgress(0);

    try {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          alert('ISO uploaded successfully!');
          fetchPools();
        } else {
          let errorMsg = 'Upload failed';
          try {
            const res = JSON.parse(xhr.responseText);
            errorMsg = res.error || errorMsg;
          } catch (e) {}
          alert(errorMsg);
        }
        setUploading(false);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      });

      xhr.addEventListener('error', () => {
        alert('Upload failed due to network error');
        setUploading(false);
        setUploadProgress(0);
        if (fileInputRef.current) fileInputRef.current.value = '';
      });

      xhr.open('POST', '/api/storage/upload');
      const token = localStorage.getItem('nova_token') || 'dev-bypass-token';
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);

    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const getStatusBadge = (state: string = '') => {
    const s = (state || '').toLowerCase();
    switch (s) {
      case 'active':
      case 'running':
        return <span className="badge badge-success"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse"></span>Active</span>;
      case 'inactive':
        return <span className="badge badge-neutral"><span className="w-1.5 h-1.5 rounded-full bg-slate-400 mr-1.5"></span>Inactive</span>;
      default:
        return <span className="badge badge-warning"><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1.5"></span>{state || 'Unknown'}</span>;
    }
  };

  return (
    <div>
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept=".iso" 
        onChange={handleFileChange} 
      />
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-4 border-b border-slate-200 w-full max-w-md">
          <button 
            onClick={() => setActiveSubTab('pools')}
            className={`pb-2 px-4 text-sm font-medium transition-colors relative ${activeSubTab === 'pools' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Storage Pools
            {activeSubTab === 'pools' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>}
          </button>
          <button 
            onClick={() => setActiveSubTab('disks')}
            className={`pb-2 px-4 text-sm font-medium transition-colors relative ${activeSubTab === 'disks' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Physical Disks
            {activeSubTab === 'disks' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600"></div>}
          </button>
        </div>
        <div className="flex gap-3">
          <button onClick={activeSubTab === 'pools' ? fetchPools : fetchDisks} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {activeSubTab === 'pools' && (
            <>
              <button onClick={() => setIsCreateModalOpen(true)} className="btn-secondary">
                <Database className="w-4 h-4" />
                Create Pool
              </button>
              <button 
                onClick={handleUploadClick} 
                className="btn-primary"
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Uploading {uploadProgress}%
                  </>
                ) : (
                  <>
                    <FileUp className="w-4 h-4" />
                    Upload ISO
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-600" />
                Create Storage Pool
              </h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <AlertTriangle className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <form onSubmit={handleCreatePool} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pool Name</label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="e.g. fast-storage"
                  value={newPool.name}
                  onChange={(e) => setNewPool({ ...newPool, name: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pool Type</label>
                <select
                  className="input-field"
                  value={newPool.type}
                  onChange={(e) => setNewPool({ ...newPool, type: e.target.value })}
                >
                  <option value="dir">Directory</option>
                  <option value="fs">Filesystem</option>
                  <option value="netfs">Network Filesystem (NFS)</option>
                  <option value="logical">LVM (Logical)</option>
                  <option value="zfs">ZFS</option>
                  <option value="iscsi">iSCSI</option>
                  <option value="ceph">Ceph</option>
                </select>
              </div>

              {newPool.type === 'logical' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Volume Group (VG) Name</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. vg_nova"
                    value={newPool.vgName}
                    onChange={(e) => setNewPool({ ...newPool, vgName: e.target.value })}
                  />
                </div>
              ) : newPool.type === 'zfs' ? (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Devices (comma separated)</label>
                  <input
                    type="text"
                    required
                    className="input-field"
                    placeholder="e.g. /dev/sdb, /dev/sdc"
                    value={newPool.devices}
                    onChange={(e) => setNewPool({ ...newPool, devices: e.target.value })}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Target Path</label>
                    <input
                      type="text"
                      required
                      className="input-field"
                      placeholder="e.g. /var/lib/libvirt/images"
                      value={newPool.target}
                      onChange={(e) => setNewPool({ ...newPool, target: e.target.value })}
                    />
                  </div>
                  {newPool.type === 'netfs' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Source Path (NFS Server)</label>
                      <input
                        type="text"
                        required
                        className="input-field"
                        placeholder="e.g. 10.0.0.5:/export/nfs"
                        value={newPool.source}
                        onChange={(e) => setNewPool({ ...newPool, source: e.target.value })}
                      />
                    </div>
                  )}
                </>
              )}

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Create Pool
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFormatModalOpen && selectedDisk && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-indigo-600" />
                Format Disk: {selectedDisk.name}
              </h3>
              <button onClick={() => setIsFormatModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <AlertTriangle className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="font-bold mb-1 uppercase">Warning: Data Loss</p>
                  Formatting this disk will permanently erase all data on it. This action cannot be undone.
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Filesystem Type</label>
                <select
                  className="input-field"
                  value={fsType}
                  onChange={(e) => setFsType(e.target.value)}
                >
                  <option value="ext4">ext4 (Standard Linux)</option>
                  <option value="xfs">XFS (High Performance)</option>
                  <option value="zfs">ZFS (Hyper-Converged)</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button onClick={() => setIsFormatModalOpen(false)} className="btn-secondary flex-1">
                  Cancel
                </button>
                <button 
                  onClick={handleFormatDisk} 
                  className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-sm flex items-center justify-center gap-2 flex-1"
                >
                  Format & Wipe
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          {error}
        </div>
      )}

      <div className="card">
        {activeSubTab === 'pools' ? (
          pools.length === 0 && !loading ? (
            <div className="p-12 text-center text-slate-500">
              <Database className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">No Storage Pools</h3>
              <p className="text-sm">No storage pools have been configured on this node.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8"></th>
                  <th>Pool Name</th>
                  <th>State</th>
                  <th>Autostart</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pools.map((pool) => (
                  <React.Fragment key={pool.name}>
                    <tr className={expandedPools.has(pool.name) ? 'bg-slate-50' : ''}>
                      <td>
                        <button 
                          onClick={() => togglePool(pool.name)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded transition-colors"
                          disabled={pool.state !== 'active'}
                        >
                          {pool.state === 'active' && (
                            expandedPools.has(pool.name) ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )
                          )}
                        </button>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <Database className="w-5 h-5 text-slate-400" />
                          <div className="font-medium text-slate-900">{pool.name}</div>
                        </div>
                      </td>
                      <td>
                        {getStatusBadge(pool.state)}
                      </td>
                      <td>
                        <span className="text-sm text-slate-600 capitalize">{pool.autostart}</span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-2">
                          {pool.state === 'active' ? (
                            <button onClick={() => handleAction(pool.name, 'stop')} className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors" title="Stop Pool">
                              <Square className="w-4 h-4" />
                            </button>
                          ) : (
                            <>
                              <button onClick={() => handleAction(pool.name, 'start')} className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Start Pool">
                                <Play className="w-4 h-4" />
                              </button>
                              <button onClick={async () => {
                                if (confirm(`Are you sure you want to delete storage pool ${pool.name}?`)) {
                                  try {
                                    await apiCall(`/storage/pools/${pool.name}`, { method: 'DELETE' });
                                    fetchPools();
                                  } catch (err: any) {
                                    alert(`Failed to delete storage pool: ${err.message}`);
                                  }
                                }
                              }} className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors" title="Delete Pool">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    
                    {expandedPools.has(pool.name) && pool.state === 'active' && (
                      <tr>
                        <td colSpan={5} className="p-0 border-b border-slate-200 bg-slate-50">
                          <div className="pl-12 pr-4 py-4">
                            <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Volumes in {pool.name}</h4>
                            
                            {volumes[pool.name] && volumes[pool.name].length > 0 ? (
                              <div className="bg-white border border-slate-200 rounded-md overflow-hidden">
                                <table className="w-full text-sm text-left">
                                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                                    <tr>
                                      <th className="px-4 py-2 font-medium">Volume Name</th>
                                      <th className="px-4 py-2 font-medium">Path</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {volumes[pool.name].map((vol) => (
                                      <tr key={vol.name} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-2">
                                          <div className="flex items-center gap-2">
                                            <HardDrive className="w-4 h-4 text-slate-400" />
                                            <span className="font-medium text-slate-700">{vol.name}</span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-2 text-slate-500 font-mono text-xs">{vol.path}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="text-sm text-slate-500 italic py-2">
                                No volumes found in this pool.
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )
        ) : (
          disks.length === 0 && !loading ? (
            <div className="p-12 text-center text-slate-500">
              <HardDrive className="w-12 h-12 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">No Physical Disks Found</h3>
              <p className="text-sm">Could not detect any physical storage devices on this node.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Model</th>
                  <th>Size</th>
                  <th>Type</th>
                  <th>Transport</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {disks.map((disk) => (
                  <tr key={disk.name}>
                    <td>
                      <div className="flex items-center gap-3">
                        <HardDrive className="w-5 h-5 text-slate-400" />
                        <div className="font-mono text-sm font-semibold text-sky-600">/dev/{disk.name}</div>
                      </div>
                    </td>
                    <td>
                      <span className="text-sm text-slate-700">{disk.model}</span>
                    </td>
                    <td>
                      <span className="text-sm font-medium text-slate-900">{disk.size}</span>
                    </td>
                    <td>
                      <span className="badge badge-neutral uppercase text-[10px]">{disk.type}</span>
                    </td>
                    <td>
                      <span className="text-xs text-slate-500 uppercase tracking-wider">{disk.tran}</span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => {
                            setSelectedDisk(disk);
                            setIsFormatModalOpen(true);
                          }}
                          className="text-xs font-bold text-rose-600 hover:text-rose-700 px-3 py-1 bg-rose-50 hover:bg-rose-100 rounded-md transition-all uppercase tracking-tighter"
                        >
                          Format
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
