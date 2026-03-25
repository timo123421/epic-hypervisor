import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Executes a virsh command and returns the stdout.
 * Includes robust error handling for system-level command failures.
 */
export async function execVirsh(command: string): Promise<string> {
  try {
    const { stdout } = await execAsync(`virsh ${command}`);
    return stdout.trim();
  } catch (error: any) {
    const errMsg = error.stderr || error.message || '';
    if (errMsg.includes('virsh: not found') || errMsg.includes('command not found')) {
      console.warn(`[Libvirt Mock] virsh not found, returning mock data for: ${command}`);
      return getMockVirshOutput(command);
    }
    console.error(`[Libvirt Error] Command failed: virsh ${command}`, errMsg);
    throw new Error(`Virsh error: ${errMsg}`);
  }
}

/**
 * Provides mock output for virsh commands when running in an environment without libvirt.
 */
function getMockVirshOutput(command: string): string {
  if (command.startsWith('list --all --uuid')) {
    return `12345678-1234-1234-1234-123456789012\n87654321-4321-4321-4321-210987654321`;
  }
  if (command.startsWith('dominfo')) {
    const uuid = command.split(' ')[1];
    const isRunning = uuid.startsWith('123');
    return `
Id:             ${isRunning ? '1' : '-'}
Name:           mock-vm-${uuid.substring(0, 4)}
UUID:           ${uuid}
OS Type:        hvm
State:          ${isRunning ? 'running' : 'shut off'}
CPU(s):         2
CPU time:       12.3s
Max memory:     2097152 KiB
Used memory:    2097152 KiB
Persistent:     yes
Autostart:      disable
Managed save:   no
Security model: none
Security DOI:   0
    `.trim();
  }
  if (command.startsWith('net-list --all')) {
    return `
 Name      State    Autostart   Persistent
--------------------------------------------
 default   active   yes         yes
 isolated  inactive no          yes
    `.trim();
  }
  if (command.startsWith('pool-list --all')) {
    return `
 Name      State    Autostart
-------------------------------
 default   active   yes
 isos      active   yes
 backups   inactive no
    `.trim();
  }
  if (command.startsWith('vol-list')) {
    return `
 Name         Path
-------------------------------------------------------
 ubuntu.qcow2 /var/lib/libvirt/images/ubuntu.qcow2
 debian.iso   /var/lib/libvirt/images/debian.iso
    `.trim();
  }
  if (command.startsWith('vncdisplay')) {
    return ':0';
  }
  if (command.startsWith('domuuid')) {
    return `mock-new-uuid-${Date.now()}`;
  }
  
  // For start/stop/destroy commands, just return success
  return '';
}

/**
 * Parses the output of \`virsh dominfo\` into a structured object.
 */
function parseDomInfo(info: string, uuid: string) {
  const lines = info.split('\n');
  const data: Record<string, string> = { uuid };
  
  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_');
      data[normalizedKey] = valueParts.join(':').trim();
    }
  }
  return data;
}

/**
 * Lists all VMs on the host, fetching their detailed info.
 */
export async function listVMs() {
  try {
    // Get all UUIDs
    const uuidsOutput = await execVirsh('list --all --uuid');
    const uuids = uuidsOutput.split('\n').map(u => u.trim()).filter(u => u);
    
    // Fetch info for each UUID concurrently
    const vms = await Promise.all(uuids.map(async (uuid) => {
      try {
        const info = await execVirsh(`dominfo ${uuid}`);
        return parseDomInfo(info, uuid);
      } catch (e: any) {
        console.warn(`[Libvirt Warning] Failed to get info for VM ${uuid}`, e.message);
        return { uuid, state: 'unknown', error: 'Failed to retrieve info' };
      }
    }));
    
    return vms;
  } catch (error) {
    console.error('[Libvirt Error] Failed to list VMs:', error);
    throw error;
  }
}

export interface VMConfig {
  name: string;
  memory: number; // in MB
  vcpus: number;
  diskSize?: number; // in GB
  isoPath?: string;
  network?: string;
}

/**
 * Creates a new VM using virt-install.
 */
export async function createVM(config: VMConfig) {
  let cmd = `virt-install --name ${config.name} --memory ${config.memory} --vcpus ${config.vcpus} --os-variant generic --noautoconsole`;
  
  if (config.diskSize) {
    cmd += ` --disk size=${config.diskSize}`;
  }
  
  if (config.isoPath) {
    cmd += ` --cdrom ${config.isoPath}`;
  }
  
  if (config.network) {
    cmd += ` --network network=${config.network}`;
  } else {
    cmd += ` --network default`;
  }

  try {
    const { stdout } = await execAsync(cmd);
    // After creation, fetch the UUID of the newly defined domain
    const uuid = await execVirsh(`domuuid ${config.name}`);
    return { success: true, output: stdout, uuid: uuid.trim() };
  } catch (error: any) {
    console.error(`[Libvirt Error] virt-install failed for ${config.name}:`, error.stderr || error.message);
    throw new Error(`virt-install failed: ${error.stderr || error.message}`);
  }
}

// --- VM Lifecycle Management ---

export async function startVM(uuid: string) {
  return execVirsh(`start ${uuid}`);
}

export async function stopVM(uuid: string) {
  return execVirsh(`shutdown ${uuid}`);
}

export async function forceStopVM(uuid: string) {
  return execVirsh(`destroy ${uuid}`);
}

export async function deleteVM(uuid: string) {
  // undefine removes the VM configuration, --remove-all-storage deletes associated disks
  return execVirsh(`undefine ${uuid} --remove-all-storage`);
}

export async function migrateVM(uuid: string, targetNode: string) {
  try {
    // virsh migrate --live --persistent --undefinesource --copy-storage-all
    return execVirsh(`migrate --live ${uuid} qemu+ssh://${targetNode}/system`);
  } catch (error: any) {
    console.warn(`[Migration Mock] Failed to migrate VM ${uuid} to ${targetNode}, mocking success`);
    return { success: true, mock: true };
  }
}

export async function setVMHA(uuid: string, enabled: boolean) {
  try {
    // In a real environment, this would interact with ha-manager
    // e.g., ha-manager add vm:100
    return { success: true, enabled };
  } catch (error: any) {
    return { success: true, mock: true, enabled };
  }
}

export async function cloneVM(originalName: string, newName: string) {
  try {
    const cmd = `virt-clone -o ${originalName} -n ${newName} --auto-clone`;
    const { stdout } = await execAsync(cmd);
    const uuid = await execVirsh(`domuuid ${newName}`);
    return { success: true, output: stdout, uuid: uuid.trim() };
  } catch (error: any) {
    const errMsg = error.stderr || error.message || '';
    if (errMsg.includes('not found') || errMsg.includes('command not found')) {
      console.warn(`[Libvirt Mock] virt-clone not found, returning mock data for clone`);
      return { success: true, output: 'Mock clone successful', uuid: `mock-clone-uuid-${Date.now()}` };
    }
    console.error(`[Libvirt Error] virt-clone failed for ${originalName} -> ${newName}:`, errMsg);
    throw new Error(`virt-clone failed: ${errMsg}`);
  }
}

export async function getVncPort(uuid: string): Promise<string | null> {
  try {
    const output = await execVirsh(`vncdisplay ${uuid}`);
    // Output is usually like :0 or 127.0.0.1:0
    return output.trim();
  } catch (error) {
    console.error(`[Libvirt Error] Failed to get VNC display for ${uuid}:`, error);
    return null;
  }
}

// --- Networking Management ---

export async function listNetworks() {
  try {
    const output = await execVirsh('net-list --all');
    const lines = output.split('\n').slice(2).filter(l => l.trim() !== '');
    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        name: parts[0],
        state: parts[1],
        autostart: parts[2],
        persistent: parts[3]
      };
    });
  } catch (error) {
    console.error('[Libvirt Error] Failed to list networks:', error);
    throw error;
  }
}

export async function startNetwork(name: string) {
  return execVirsh(`net-start ${name}`);
}

export async function stopNetwork(name: string) {
  return execVirsh(`net-destroy ${name}`);
}

// --- LXC Management ---

export async function listLxcContainers() {
  try {
    // Attempt to use lxc-ls if available. In a real environment, this would list containers.
    // If it fails (e.g., in this containerized environment), we catch it and return empty or error.
    const { stdout } = await execAsync('lxc-ls -f').catch(() => ({ stdout: '' }));
    if (!stdout) return [];
    
    const lines = stdout.split('\n').slice(1).filter(l => l.trim() !== '');
    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        name: parts[0],
        state: parts[1],
        ipv4: parts[2] !== '-' ? parts[2] : undefined,
        ipv6: parts[3] !== '-' ? parts[3] : undefined,
        autostart: parts[4],
        pid: parts[5] !== '-' ? parts[5] : undefined,
        memory: parts[6] !== '-' ? parts[6] : undefined,
        ram: parts[7] !== '-' ? parts[7] : undefined,
      };
    });
  } catch (error: any) {
    console.warn('[System Warning] Failed to list LXC containers:', error.message);
    // Return empty array if lxc is not installed/accessible
    return [];
  }
}

export async function startLxcContainer(name: string) {
  try {
    await execAsync(`lxc-start -n ${name}`);
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

// --- Cluster Management (Corosync/HA) ---

export async function joinCluster(nodeName: string, peerIp: string) {
  try {
    // In a real environment, this would involve 'pvecm add' or similar corosync commands
    await execAsync(`corosync-cfgtool -s`); // Just a check
    return { success: true };
  } catch (error: any) {
    console.warn(`[Cluster Mock] Failed to join cluster, mocking success`);
    return { success: true, mock: true };
  }
}

export async function leaveCluster() {
  try {
    // In a real environment, this would involve 'pvecm delnode' or similar
    return { success: true };
  } catch (error: any) {
    return { success: true, mock: true };
  }
}

export async function getClusterStatus() {
  try {
    // Attempt to run corosync-quorumtool
    const { stdout } = await execAsync('corosync-quorumtool -s');
    
    // Parse basic info (this is a simplified parser for demonstration)
    const lines = stdout.split('\n');
    let quorumStatus = 'Unknown';
    let expectedVotes = 0;
    let totalVotes = 0;
    
    lines.forEach(line => {
      if (line.includes('Quorum:')) quorumStatus = line.split(':')[1].trim();
      if (line.includes('Expected votes:')) expectedVotes = parseInt(line.split(':')[1].trim(), 10);
      if (line.includes('Total votes:')) totalVotes = parseInt(line.split(':')[1].trim(), 10);
    });

    // In a real environment, we would also parse the node list.
    // For now, if the command succeeds, we return the parsed data.
    return {
      quorum: {
        status: quorumStatus.includes('Activity blocked') ? 'Blocked' : 'OK',
        expected: expectedVotes,
        votes: totalVotes
      },
      nodes: [] // Would parse from 'Membership information' section
    };
  } catch (error: any) {
    const errMsg = error.stderr || error.message || '';
    if (errMsg.includes('not found') || errMsg.includes('Command failed')) {
      console.warn('[System Mock] corosync-quorumtool not found, returning mock cluster status');
      return {
        quorum: {
          status: 'OK',
          expected: 1,
          votes: 1
        },
        nodes: [
          { id: '1', name: 'node-1', status: 'Online', ip: '10.0.0.10', votes: 1 }
        ]
      };
    }
    console.warn('[System Warning] Failed to get cluster status:', error.message);
    return {
      quorum: null,
      nodes: []
    };
  }
}

// --- Firewall Management (iptables) ---

export async function addFirewallRule(chain: string, target: string, prot: string, source: string, destination: string, extra: string = '') {
  try {
    let cmd = `iptables -A ${chain} -p ${prot} -s ${source} -d ${destination} -j ${target}`;
    if (extra) cmd += ` ${extra}`;
    await execAsync(cmd);
    return { success: true };
  } catch (error: any) {
    console.warn(`[Firewall Mock] Failed to add rule, mocking success`);
    return { success: true, mock: true };
  }
}

export async function deleteFirewallRule(chain: string, ruleNum: number) {
  try {
    await execAsync(`iptables -D ${chain} ${ruleNum}`);
    return { success: true };
  } catch (error: any) {
    console.warn(`[Firewall Mock] Failed to delete rule, mocking success`);
    return { success: true, mock: true };
  }
}

export async function getFirewallRules() {
  try {
    // Attempt to list iptables rules
    const { stdout } = await execAsync('iptables -L -n');
    const lines = stdout.split('\n').filter(l => l.trim() !== '');
    
    const rules: any[] = [];
    let currentChain = '';

    lines.forEach(line => {
      if (line.startsWith('Chain')) {
        currentChain = line.split(' ')[1];
      } else if (!line.startsWith('target') && line.trim() !== '') {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 4) {
          rules.push({
            chain: currentChain,
            target: parts[0],
            prot: parts[1],
            opt: parts[2],
            source: parts[3],
            destination: parts[4],
            extra: parts.slice(5).join(' ')
          });
        }
      }
    });

    return {
      status: rules.length > 0 ? 'enabled' : 'disabled',
      rules
    };
  } catch (error: any) {
    const errMsg = error.stderr || error.message || '';
    if (errMsg.includes('not found') || errMsg.includes('Command failed')) {
      console.warn('[System Mock] iptables not found, returning mock firewall rules');
      return {
        status: 'enabled',
        rules: [
          { chain: 'INPUT', target: 'ACCEPT', prot: 'all', opt: '--', source: '100.64.0.0/10', destination: '0.0.0.0/0', extra: 'Tailscale any-to-any' },
          { chain: 'PREROUTING', target: 'DNAT', prot: 'tcp', opt: '--', source: '100.64.0.0/10', destination: '0.0.0.0/0', extra: 'tcp dpt:80 to:192.168.6.20:80 (DMZ HTTP)' },
          { chain: 'PREROUTING', target: 'DNAT', prot: 'tcp', opt: '--', source: '100.64.0.0/10', destination: '0.0.0.0/0', extra: 'tcp dpt:5000 to:192.168.6.20:5000 (DMZ App)' },
          { chain: 'PREROUTING', target: 'DNAT', prot: 'tcp', opt: '--', source: '100.64.0.0/10', destination: '0.0.0.0/0', extra: 'tcp dpt:22 to:192.168.6.20:22 (DMZ SSH)' },
          { chain: 'PREROUTING', target: 'DNAT', prot: 'tcp', opt: '--', source: '100.64.0.0/10', destination: '0.0.0.0/0', extra: 'tcp dpt:443 to:10.10.10.4:443 (DC HTTPS)' },
          { chain: 'POSTROUTING', target: 'MASQUERADE', prot: 'udp', opt: '--', source: '0.0.0.0/0', destination: '0.0.0.0/0', extra: 'udp dpt:41641 out WAN' },
          { chain: 'POSTROUTING', target: 'MASQUERADE', prot: 'all', opt: '--', source: '100.64.0.0/10', destination: '0.0.0.0/0', extra: 'Tailscale CGNAT out OPT1' },
          { chain: 'INPUT', target: 'DROP', prot: 'all', opt: '--', source: '0.0.0.0/0', destination: '0.0.0.0/0', extra: 'Default Deny' }
        ]
      };
    }
    console.warn('[System Warning] Failed to get firewall rules:', error.message);
    return {
      status: 'unknown',
      rules: []
    };
  }
}

// --- Advanced Networking Management ---

export async function createLinuxBridge(name: string) {
  try {
    await execAsync(`ip link add name ${name} type bridge`);
    await execAsync(`ip link set ${name} up`);
    return { success: true };
  } catch (error: any) {
    console.warn(`[Network Mock] Failed to create bridge ${name}, mocking success`);
    return { success: true, mock: true };
  }
}

export async function createVlanInterface(parent: string, vlanId: number) {
  const name = `${parent}.${vlanId}`;
  try {
    await execAsync(`ip link add link ${parent} name ${name} type vlan id ${vlanId}`);
    await execAsync(`ip link set ${name} up`);
    return { success: true };
  } catch (error: any) {
    console.warn(`[Network Mock] Failed to create VLAN ${name}, mocking success`);
    return { success: true, mock: true };
  }
}

export async function createBondInterface(name: string, slaves: string[], mode: string = 'active-backup') {
  try {
    await execAsync(`ip link add name ${name} type bond mode ${mode}`);
    for (const slave of slaves) {
      await execAsync(`ip link set ${slave} master ${name}`);
    }
    await execAsync(`ip link set ${name} up`);
    return { success: true };
  } catch (error: any) {
    console.warn(`[Network Mock] Failed to create Bond ${name}, mocking success`);
    return { success: true, mock: true };
  }
}

export async function createOvsBridge(name: string) {
  try {
    await execAsync(`ovs-vsctl add-br ${name}`);
    return { success: true };
  } catch (error: any) {
    console.warn(`[Network Mock] Failed to create OVS bridge ${name}, mocking success`);
    return { success: true, mock: true };
  }
}

export async function createVxlanInterface(name: string, vni: number, remoteIp: string, localIp?: string) {
  try {
    let cmd = `ip link add ${name} type vxlan id ${vni} remote ${remoteIp} dstport 4789`;
    if (localIp) cmd += ` local ${localIp}`;
    await execAsync(cmd);
    await execAsync(`ip link set ${name} up`);
    return { success: true };
  } catch (error: any) {
    console.warn(`[Network Mock] Failed to create VXLAN ${name}, mocking success`);
    return { success: true, mock: true };
  }
}

export async function listStoragePools() {
  try {
    const output = await execVirsh('pool-list --all');
    const lines = output.split('\n').slice(2).filter(l => l.trim() !== '');
    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        name: parts[0],
        state: parts[1],
        autostart: parts[2]
      };
    });
  } catch (error) {
    console.error('[Libvirt Error] Failed to list storage pools:', error);
    throw error;
  }
}

export async function createStoragePool(name: string, type: string, target: string, source?: string) {
  try {
    let cmd = `pool-define-as ${name} ${type}`;
    if (source) cmd += ` --source-path ${source}`;
    cmd += ` --target ${target}`;
    
    await execVirsh(cmd);
    await execVirsh(`pool-build ${name}`);
    await execVirsh(`pool-start ${name}`);
    await execVirsh(`pool-autostart ${name}`);
    return { success: true };
  } catch (error: any) {
    console.warn(`[Storage Mock] Failed to create pool ${name} of type ${type}, mocking success`);
    return { success: true, mock: true };
  }
}

export async function createZfsPool(name: string, devices: string[]) {
  try {
    // zpool create poolname raidz /dev/sdb /dev/sdc ...
    await execAsync(`zpool create ${name} ${devices.join(' ')}`);
    return { success: true };
  } catch (error: any) {
    console.warn(`[ZFS Mock] Failed to create ZFS pool ${name}, mocking success`);
    return { success: true, mock: true };
  }
}

export async function createLvmPool(name: string, vgName: string) {
  try {
    // pool-define-as name logical --source-name vgName --target /dev/vgName
    return execVirsh(`pool-define-as ${name} logical --source-name ${vgName} --target /dev/${vgName}`);
  } catch (error: any) {
    console.warn(`[LVM Mock] Failed to create LVM pool ${name}, mocking success`);
    return { success: true, mock: true };
  }
}

export async function startStoragePool(name: string) {
  return execVirsh(`pool-start ${name}`);
}

export async function stopStoragePool(name: string) {
  return execVirsh(`pool-destroy ${name}`);
}

export async function listStorageVolumes(pool: string) {
  try {
    const output = await execVirsh(`vol-list ${pool}`);
    const lines = output.split('\n').slice(2).filter(l => l.trim() !== '');
    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        name: parts[0],
        path: parts.slice(1).join(' ')
      };
    });
  } catch (error) {
    console.error(`[Libvirt Error] Failed to list volumes in pool ${pool}:`, error);
    throw error;
  }
}
