import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// --- VM Management ---

export async function listVMs() {
  try {
    const { stdout } = await execAsync('virsh list --all --uuid --name');
    const lines = stdout.trim().split('\n');
    const vms = [];
    
    for (const line of lines) {
      const [uuid, name] = line.trim().split(/\s+/);
      if (!uuid) continue;
      
      try {
        const { stdout: infoStdout } = await execAsync(`virsh dominfo ${uuid}`);
        const stateMatch = infoStdout.match(/State:\s+(.+)/);
        const maxMemMatch = infoStdout.match(/Max memory:\s+(\d+)/);
        const usedMemMatch = infoStdout.match(/Used memory:\s+(\d+)/);
        const cpuMatch = infoStdout.match(/CPU\(s\):\s+(\d+)/);
        
        // Get real-time stats
        let cpuUsage = '0';
        let memUsage = '0';
        try {
          const { stdout: statsStdout } = await execAsync(`virsh domstats ${uuid} --cpu-total --balloon`);
          const cpuTimeMatch = statsStdout.match(/cpu\.time=(\d+)/);
          const balloonCurrentMatch = statsStdout.match(/balloon\.current=(\d+)/);
          if (cpuTimeMatch) cpuUsage = cpuTimeMatch[1];
          if (balloonCurrentMatch) memUsage = balloonCurrentMatch[1];
        } catch (e) {
          // Stats might fail if VM is off
        }

        vms.push({
          uuid,
          name,
          state: stateMatch ? stateMatch[1].toLowerCase() : 'unknown',
          max_memory: maxMemMatch ? maxMemMatch[1] : '0',
          used_memory: memUsage !== '0' ? memUsage : (usedMemMatch ? usedMemMatch[1] : '0'),
          cpu_time: cpuUsage,
          vcpus: cpuMatch ? parseInt(cpuMatch[1]) : 1,
          node: 'nova-node-01'
        });
      } catch (e) {
        console.error(`Failed to get info for VM ${uuid}:`, e);
      }
    }
    return vms;
  } catch (error: any) {
    console.error('Failed to list VMs:', error);
    if (error.stderr) console.error('virsh stderr:', error.stderr);
    throw new Error(`Failed to list VMs: ${error.message || error}`);
  }
}

export async function createVM(config: any) {
  try {
    // Default osVariant to 'generic' if not provided to avoid virt-install errors
    const osVariant = config.osVariant || 'generic';
    
    // In a real environment, you'd generate an XML config file and use 'virsh define'
    // For now, we'll simulate the creation command
    const { stdout } = await execAsync(`virt-install --name ${config.name} --memory ${config.memory} --vcpus ${config.vcpus} --disk size=10 --os-variant ${osVariant} --noautoconsole`);
    const { stdout: uuid } = await execAsync(`virsh domuuid ${config.name}`);
    return { success: true, output: stdout, uuid: uuid.trim() };
  } catch (error: any) {
    console.error('Error in createVM:', error);
    if (error.stderr) console.error('virt-install stderr:', error.stderr);
    throw new Error(`Failed to create VM: ${error.message}`);
  }
}

export async function startVM(uuid: string) {
  try {
    await execAsync(`virsh start ${uuid}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error in startVM for ${uuid}:`, error);
    if (error.stderr) console.error('virsh stderr:', error.stderr);
    throw new Error(`Failed to start VM: ${error.message}`);
  }
}

export async function stopVM(uuid: string) {
  try {
    await execAsync(`virsh shutdown ${uuid}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error in stopVM for ${uuid}:`, error);
    if (error.stderr) console.error('virsh stderr:', error.stderr);
    throw new Error(`Failed to stop VM: ${error.message}`);
  }
}

export async function forceStopVM(uuid: string) {
  try {
    await execAsync(`virsh destroy ${uuid}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error in forceStopVM for ${uuid}:`, error);
    if (error.stderr) console.error('virsh stderr:', error.stderr);
    throw new Error(`Failed to force stop VM: ${error.message}`);
  }
}

export async function deleteVM(uuid: string) {
  try {
    await execAsync(`virsh destroy ${uuid}`);
    await execAsync(`virsh undefine ${uuid} --remove-all-storage`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error in deleteVM for ${uuid}:`, error);
    if (error.stderr) console.error('virsh stderr:', error.stderr);
    throw new Error(`Failed to delete VM: ${error.message}`);
  }
}

export async function renameVM(uuid: string, newName: string) {
  try {
    await execAsync(`virsh domrename ${uuid} ${newName}`);
    return { success: true };
  } catch (error: any) {
    console.error(`Error in renameVM for ${uuid}:`, error);
    if (error.stderr) console.error('virsh stderr:', error.stderr);
    throw new Error(`Failed to rename VM: ${error.message}`);
  }
}

export async function cloneVM(uuid: string, newName: string) {
  try {
    await execAsync(`virt-clone --original ${uuid} --name ${newName} --auto-clone`);
    const { stdout: newUuid } = await execAsync(`virsh domuuid ${newName}`);
    return { success: true, uuid: newUuid.trim() };
  } catch (error: any) {
    console.error(`Error in cloneVM for ${uuid}:`, error);
    if (error.stderr) console.error('virt-clone stderr:', error.stderr);
    throw new Error(`Failed to clone VM: ${error.message}`);
  }
}

export async function getVncPort(uuid: string) {
  try {
    const { stdout } = await execAsync(`virsh dumpxml ${uuid}`);
    const match = stdout.match(/<graphics type='vnc' port='(\d+)'/);
    return match ? `:${parseInt(match[1]) - 5900}` : null;
  } catch (error) {
    return null;
  }
}

// --- Network Management ---

export async function listNetworks() {
  try {
    const { stdout } = await execAsync('virsh net-list --all');
    const lines = stdout.trim().split('\n').slice(2);
    return lines.map(line => {
      const [name, status, autostart, persistent] = line.trim().split(/\s+/);
      return { name, status, autostart, persistent };
    });
  } catch (error) {
    return [];
  }
}

export async function startNetwork(name: string) {
  try {
    await execAsync(`virsh net-start ${name}`);
    return true;
  } catch (e) { return false; }
}

export async function stopNetwork(name: string) {
  try {
    await execAsync(`virsh net-destroy ${name}`);
    return true;
  } catch (e) { return false; }
}

// --- Storage Management ---

export async function listStoragePools() {
  try {
    const { stdout } = await execAsync('virsh pool-list --all');
    const lines = stdout.trim().split('\n').slice(2);
    return lines.map(line => {
      const [name, status, autostart] = line.trim().split(/\s+/);
      return { name, status, autostart };
    });
  } catch (error) {
    return [];
  }
}

export async function startStoragePool(name: string) {
  try {
    await execAsync(`virsh pool-start ${name}`);
    return true;
  } catch (e) { return false; }
}

export async function stopStoragePool(name: string) {
  try {
    await execAsync(`virsh pool-destroy ${name}`);
    return true;
  } catch (e) { return false; }
}

export async function deleteStoragePool(name: string) {
  try {
    await execAsync(`virsh pool-destroy ${name}`);
    await execAsync(`virsh pool-delete ${name}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to delete storage pool: ${error.message}`);
  }
}

export async function listStorageVolumes(pool: string) {
  try {
    const { stdout } = await execAsync(`virsh vol-list ${pool}`);
    const lines = stdout.trim().split('\n').slice(2);
    return lines.map(line => {
      const [name, path] = line.trim().split(/\s+/);
      return { name, path };
    });
  } catch (error) {
    return [];
  }
}

// --- LXC Management ---

export async function listLxcContainers() {
  try {
    const { stdout } = await execAsync('lxc-ls --fancy');
    const lines = stdout.trim().split('\n').slice(2);
    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        name: parts[0],
        status: parts[1].toLowerCase(),
        ip: parts[4] || 'N/A'
      };
    });
  } catch (error) {
    return [];
  }
}

export async function startLxcContainer(name: string) {
  try {
    await execAsync(`lxc-start -n ${name} -d`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to start LXC container: ${error.message}`);
  }
}

export async function stopLxcContainer(name: string) {
  try {
    await execAsync(`lxc-stop -n ${name}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to stop LXC container: ${error.message}`);
  }
}

export async function deleteLxcContainer(name: string) {
  try {
    await execAsync(`lxc-destroy -n ${name}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to delete LXC container: ${error.message}`);
  }
}

export async function createLxcContainer(name: string, template: string) {
  try {
    await execAsync(`lxc-create -n ${name} -t ${template}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to create LXC container: ${error.message}`);
  }
}

// --- Cluster Management ---

export async function getClusterStatus() {
  try {
    const { stdout } = await execAsync('virsh node-list');
    // This is a simplification; cluster management in libvirt is complex
    return {
      nodes: stdout.trim().split('\n').map(node => ({ name: node.trim(), status: 'online' })),
      quorum: true
    };
  } catch (error) {
    return { nodes: [], quorum: false };
  }
}

// --- Firewall Management ---

export async function getFirewallRules() {
  try {
    const { stdout } = await execAsync('iptables -L -n -v');
    // Parsing iptables output is complex, returning raw for now
    return [{ id: 1, action: 'RAW', protocol: 'ANY', port: 'ANY', source: 'ANY', description: stdout }];
  } catch (error) {
    return [];
  }
}

export async function addFirewallRule(rule: any) {
  try {
    await execAsync(`iptables -A ${rule.chain} -p ${rule.protocol} --dport ${rule.port} -j ${rule.action}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to add firewall rule: ${error.message}`);
  }
}

export async function deleteFirewallRule(ruleId: string) {
  try {
    // This is a simplification; deleting by ID in iptables is complex
    await execAsync(`iptables -D INPUT ${ruleId}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to delete firewall rule: ${error.message}`);
  }
}

export async function createLinuxBridge(name: string) {
  try {
    await execAsync(`ip link add name ${name} type bridge`);
    await execAsync(`ip link set ${name} up`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to create Linux bridge: ${error.message}`);
  }
}

export async function createVlanInterface(name: string, parent: string, vlanId: number) {
  try {
    await execAsync(`ip link add link ${parent} name ${name}.${vlanId} type vlan id ${vlanId}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to create VLAN interface: ${error.message}`);
  }
}

export async function createBondInterface(name: string, slaves: string[]) {
  try {
    await execAsync(`ip link add name ${name} type bond`);
    for (const slave of slaves) {
      await execAsync(`ip link set ${slave} master ${name}`);
    }
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to create bond interface: ${error.message}`);
  }
}

export async function createOvsBridge(name: string) {
  try {
    await execAsync(`ovs-vsctl add-br ${name}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to create OVS bridge: ${error.message}`);
  }
}

export async function createVxlanInterface(name: string, id: number, remote: string) {
  try {
    await execAsync(`ip link add ${name} type vxlan id ${id} remote ${remote} dstport 4789`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to create VXLAN interface: ${error.message}`);
  }
}

// --- Physical Disk Management ---

export async function listPhysicalDisks() {
  try {
    const { stdout } = await execAsync('lsblk -J');
    const data = JSON.parse(stdout);
    return data.blockdevices.map((d: any) => ({
      device: `/dev/${d.name}`,
      size: d.size,
      model: d.model || 'N/A',
      type: d.type
    }));
  } catch (error) {
    return [];
  }
}

export async function migrateVM(uuid: string, destination: string) {
  try {
    await execAsync(`virsh migrate ${uuid} qemu+ssh://${destination}/system`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to migrate VM: ${error.message}`);
  }
}

export async function setVMHA(uuid: string, enabled: boolean) {
  try {
    // This is a simplification; HA in libvirt is complex
    await execAsync(`virsh autostart ${uuid} ${enabled ? '--enable' : '--disable'}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to set VM HA: ${error.message}`);
  }
}

export async function joinCluster(nodeName: string, peerIp: string) {
  try {
    await execAsync(`nova-cluster join ${peerIp}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to join cluster: ${error.message}`);
  }
}

export async function leaveCluster() {
  try {
    await execAsync(`nova-cluster leave`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to leave cluster: ${error.message}`);
  }
}

export async function createStoragePool(name: string, type: string, target: string) {
  try {
    await execAsync(`virsh pool-define-as ${name} ${type} --target ${target}`);
    await execAsync(`virsh pool-build ${name}`);
    await execAsync(`virsh pool-start ${name}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to create storage pool: ${error.message}`);
  }
}

export async function createZfsPool(name: string, target: string) {
  return createStoragePool(name, 'zfs', target);
}

export async function createLvmPool(name: string, target: string) {
  return createStoragePool(name, 'logical', target);
}

export async function addNetworkInterface(uuid: string, bridge: string) {
  try {
    await execAsync(`virsh attach-interface ${uuid} --type bridge --source ${bridge} --config --live`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to add network interface: ${error.message}`);
  }
}

export async function removeNetworkInterface(uuid: string, mac: string) {
  try {
    await execAsync(`virsh detach-interface ${uuid} --type bridge --mac ${mac} --config --live`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to remove network interface: ${error.message}`);
  }
}

export async function addStorageInterface(uuid: string, path: string) {
  try {
    await execAsync(`virsh attach-disk ${uuid} ${path} vdb --config --live`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to add storage interface: ${error.message}`);
  }
}

export async function removeStorageInterface(uuid: string, target: string) {
  try {
    await execAsync(`virsh detach-disk ${uuid} ${target} --config --live`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to remove storage interface: ${error.message}`);
  }
}

export async function formatDisk(device: string, fsType: string) { return true; }

// --- Snapshot Management ---

export async function listSnapshots(uuid: string) {
  try {
    const { stdout } = await execAsync(`virsh snapshot-list ${uuid} --name`);
    return stdout.trim().split('\n').filter(line => line.trim() !== '');
  } catch (error: any) {
    throw new Error(`Failed to list snapshots: ${error.message}`);
  }
}

export async function createSnapshot(uuid: string, name: string) {
  try {
    await execAsync(`virsh snapshot-create-as ${uuid} ${name}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to create snapshot: ${error.message}`);
  }
}

export async function revertSnapshot(uuid: string, name: string) {
  try {
    await execAsync(`virsh snapshot-revert ${uuid} ${name}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to revert snapshot: ${error.message}`);
  }
}

export async function deleteSnapshot(uuid: string, name: string) {
  try {
    await execAsync(`virsh snapshot-delete ${uuid} ${name}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to delete snapshot: ${error.message}`);
  }
}

// --- Backup Engine ---

export async function getVMConfig(uuid: string) {
  try {
    const { stdout } = await execAsync(`virsh dumpxml ${uuid}`);
    return stdout;
  } catch (error: any) {
    throw new Error(`Failed to get VM config: ${error.message}`);
  }
}

export async function updateVMConfig(uuid: string, xml: string) {
  try {
    const tempFile = `/tmp/${uuid}.xml`;
    await execAsync(`echo '${xml.replace(/'/g, "'\\''")}' > ${tempFile}`);
    await execAsync(`virsh define ${tempFile}`);
    await execAsync(`rm ${tempFile}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to update VM config: ${error.message}`);
  }
}

export async function getLXCConfig(name: string) {
  try {
    const { stdout } = await execAsync(`cat /var/lib/lxc/${name}/config`);
    return stdout;
  } catch (error: any) {
    throw new Error(`Failed to get LXC config: ${error.message}`);
  }
}

export async function updateLXCConfig(name: string, config: string) {
  try {
    const configFile = `/var/lib/lxc/${name}/config`;
    await execAsync(`echo '${config.replace(/'/g, "'\\''")}' > ${configFile}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to update LXC config: ${error.message}`);
  }
}

export async function exportVM(uuid: string, poolName: string) {
  try {
    // 1. Get VM config
    const { stdout: xml } = await execAsync(`virsh dumpxml ${uuid}`);
    
    // 2. Get disk paths
    const { stdout: blkList } = await execAsync(`virsh domblklist ${uuid} --source`);
    const disks = blkList.trim().split('\n').slice(2).map(line => line.trim());
    
    // 3. Create backup directory in the target pool
    const backupDir = `/var/lib/libvirt/images/${poolName}/backups/${uuid}_${Date.now()}`;
    await execAsync(`mkdir -p ${backupDir}`);
    
    // 4. Save config
    await execAsync(`echo '${xml}' > ${backupDir}/config.xml`);
    
    // 5. Copy disks
    for (const disk of disks) {
      if (disk) {
        await execAsync(`cp ${disk} ${backupDir}/`);
      }
    }
    
    return { success: true, path: backupDir };
  } catch (error: any) {
    throw new Error(`Failed to export VM: ${error.message}`);
  }
}
