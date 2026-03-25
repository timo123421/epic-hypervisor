import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// --- Advanced CPU/NUMA Management ---

export async function setCpuAffinity(uuid: string, vcpu: number, pcpu: number) {
  try {
    await execAsync(`virsh vcpupin ${uuid} ${vcpu} ${pcpu}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to set CPU affinity: ${error.message}`);
  }
}

export async function setNumaTopology(uuid: string, nodeset: string) {
  try {
    // Requires editing XML config
    await execAsync(`virsh numatune ${uuid} --nodeset ${nodeset}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to set NUMA topology: ${error.message}`);
  }
}

// --- Advanced Device Passthrough (PCIe) ---

export async function attachPciDevice(uuid: string, pciAddress: string) {
  try {
    // Requires detaching from host driver first
    await execAsync(`virsh nodedev-detach ${pciAddress}`);
    await execAsync(`virsh attach-device ${uuid} --config --live --file <(echo '<hostdev mode="subsystem" type="pci" managed="yes"><source><address domain="0x0000" bus="0x${pciAddress.split(':')[0]}" slot="0x${pciAddress.split(':')[1]}" function="0x${pciAddress.split(':')[2]}"/></source></hostdev>')`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to attach PCI device: ${error.message}`);
  }
}

// --- Advanced Storage QoS ---

export async function setStorageQos(uuid: string, diskTarget: string, readBytesSec: number, writeBytesSec: number) {
  try {
    await execAsync(`virsh blkdeviotune ${uuid} ${diskTarget} --read-bytes-sec ${readBytesSec} --write-bytes-sec ${writeBytesSec}`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to set storage QoS: ${error.message}`);
  }
}

// --- Advanced Snapshot Management ---

export async function createExternalSnapshot(uuid: string, name: string, diskOnly: boolean) {
  try {
    const flags = diskOnly ? '--disk-only' : '';
    await execAsync(`virsh snapshot-create-as ${uuid} ${name} ${flags} --atomic`);
    return { success: true };
  } catch (error: any) {
    throw new Error(`Failed to create external snapshot: ${error.message}`);
  }
}
