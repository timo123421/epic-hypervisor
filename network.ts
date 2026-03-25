import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

export async function getHostInterfaces() {
  // We'll mock the specific OPNsense interfaces requested by the user
  // to fully integrate the topology into Project Nova.
  const mockInterfaces = [
    { name: 'vtnet1', family: 'IPv4', address: '192.168.2.93', netmask: '255.255.255.0', mac: '00:1b:21:c0:8a:11', internal: false, description: 'WAN Gateway' },
    { name: 'vtnet0', family: 'IPv4', address: '192.168.4.254', netmask: '255.255.255.0', mac: '00:1b:21:c0:8a:10', internal: false, description: 'Primary LAN' },
    { name: 'tailscale0', family: 'IPv4', address: '100.x.y.z', netmask: '255.192.0.0', mac: '00:00:00:00:00:00', internal: false, description: 'Tailscale VPN (OPT1)' },
    { name: 'vtnet3', family: 'IPv4', address: '10.10.10.1', netmask: '255.255.255.0', mac: '00:1b:21:c0:8a:13', internal: false, description: 'DC Network (OPT2)' },
    { name: 'vtnet2', family: 'IPv4', address: '10.10.2.1', netmask: '255.255.255.0', mac: '00:1b:21:c0:8a:12', internal: false, description: 'Client Network (OPT3)' },
    { name: 'vtnet4', family: 'IPv4', address: '192.168.6.1', netmask: '255.255.255.0', mac: '00:1b:21:c0:8a:14', internal: false, description: 'DMZ Network (OPT4)' },
    { name: 'vtnet5', family: 'IPv4', address: '192.168.2.250', netmask: '255.255.255.0', mac: '00:1b:21:c0:8a:15', internal: false, description: 'Home Network (OPT5)' },
    { name: 'lo0', family: 'IPv4', address: '127.0.0.1', netmask: '255.0.0.0', mac: '00:00:00:00:00:00', internal: true, description: 'Loopback' }
  ];
  return mockInterfaces;
}

export async function getTailscaleStatus() {
  try {
    const { stdout } = await execAsync('tailscale status --json');
    return JSON.parse(stdout);
  } catch (error: any) {
    console.warn('[Network Mock] tailscale not found or not running, returning mock status');
    return {
      TailscaleIPs: ['100.105.42.12'],
      BackendState: 'Running',
      Self: {
        HostName: 'OPNsense.localdomain',
        DNSName: 'opnsense.tailnet-abcd.ts.net',
        OS: 'FreeBSD',
        Online: true
      },
      Peers: {
        'node1': { HostName: 'admin-laptop', DNSName: 'admin-laptop.tailnet-abcd.ts.net', OS: 'macOS', Online: true, TailscaleIPs: ['100.99.88.77'] },
        'node2': { HostName: 'dmz-web', DNSName: 'dmz-web.tailnet-abcd.ts.net', OS: 'linux', Online: true, TailscaleIPs: ['100.111.22.33'] }
      }
    };
  }
}

export async function getActiveConnections() {
  try {
    // Get active TCP and UDP connections
    const { stdout } = await execAsync('ss -tun');
    const lines = stdout.split('\n').slice(1).filter(l => l.trim());
    return lines.map(line => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 6) {
        return {
          protocol: parts[0],
          state: parts[1],
          local: parts[4],
          peer: parts[5]
        };
      }
      return null;
    }).filter(Boolean);
  } catch (e) {
    console.warn('[Network Warning] Failed to get active connections:', e);
    return [];
  }
}

export async function runTroubleshoot(action: string, target: string) {
  // Sanitize target to prevent command injection
  const cleanTarget = target.replace(/[^a-zA-Z0-9.-]/g, '');
  if (!cleanTarget) throw new Error('Invalid target');

  let cmd = '';
  if (action === 'ping') cmd = `ping -c 4 ${cleanTarget}`;
  else if (action === 'traceroute') cmd = `traceroute ${cleanTarget}`; // Might not be installed, but we'll try
  else if (action === 'dns') cmd = `nslookup ${cleanTarget}`;
  else throw new Error('Invalid action');

  try {
    const { stdout, stderr } = await execAsync(cmd);
    return stdout || stderr;
  } catch (e: any) {
    return e.stdout || e.stderr || e.message;
  }
}
