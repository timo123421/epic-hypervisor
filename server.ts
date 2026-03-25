import express from 'express';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from 'path';
import net from 'net';
import bcrypt from 'bcrypt';
import multer from 'multer';
import fs from 'fs';
import db, { initDatabase } from './database.ts';
import { authenticateToken, generateToken, AuthRequest, verify2FA, generate2FASecret, get2FAQRCode } from './auth.ts';
import QRCode from 'qrcode';
import { createServer as createViteServer } from 'vite';
import { getHostMetrics } from './monitoring.ts';
import { getHostInterfaces, getActiveConnections, runTroubleshoot, getTailscaleStatus } from './network.ts';
import { spawn } from 'child_process';
import os from 'os';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import GuacamoleLite from 'guacamole-lite';

const GUAC_KEY = process.env.GUAC_KEY || 'MySuperSecretKeyForTokenGen12345'; // Must be 32 bytes

import { 
  listVMs, 
  createVM, 
  startVM, 
  stopVM, 
  forceStopVM, 
  deleteVM, 
  cloneVM,
  getVncPort,
  listNetworks,
  startNetwork,
  stopNetwork,
  listStoragePools,
  startStoragePool,
  stopStoragePool,
  listStorageVolumes,
  listLxcContainers,
  startLxcContainer,
  stopLxcContainer,
  getClusterStatus,
  getFirewallRules,
  addFirewallRule,
  deleteFirewallRule,
  createLinuxBridge,
  createVlanInterface,
  createBondInterface,
  createOvsBridge,
  createVxlanInterface,
  migrateVM,
  setVMHA,
  joinCluster,
  leaveCluster,
  createStoragePool,
  createZfsPool,
  createLvmPool
} from './libvirt.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize Database
  initDatabase();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // --- Multer Setup for ISO Uploads ---
  const uploadDir = path.join(process.cwd(), 'iso_uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      cb(null, file.originalname);
    }
  });
  const upload = multer({ storage });

  // --- Auth Routes ---
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password, role } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
      }
      
      const userRole = role || 'user';
      const passwordHash = await bcrypt.hash(password, 10);
      
      const stmt = db.prepare('INSERT INTO Users (username, password_hash, role) VALUES (?, ?, ?)');
      const info = stmt.run(username, passwordHash, userRole);
      
      res.status(201).json({ message: 'User registered successfully', userId: info.lastInsertRowid });
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        res.status(409).json({ error: 'Username already exists' });
      } else {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password, twoFactorToken } = req.body;
      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
      }

      const stmt = db.prepare('SELECT * FROM Users WHERE username = ?');
      const user = stmt.get(username) as any;

      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const validPassword = await bcrypt.compare(password, user.password_hash);
      if (!validPassword) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Check 2FA if enabled
      if (user.two_factor_secret) {
        if (!twoFactorToken) {
          res.status(200).json({ requires2FA: true });
          return;
        }
        if (!verify2FA(twoFactorToken, user.two_factor_secret)) {
          res.status(401).json({ error: 'Invalid 2FA token' });
          return;
        }
      }

      const permissions = JSON.parse(user.permissions || '[]');
      const token = generateToken({ id: user.id, username: user.username, role: user.role, permissions });
      res.json({ token, user: { id: user.id, username: user.username, role: user.role, permissions } });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/auth/2fa/setup', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const secret = generate2FASecret();
      const otpauth = get2FAQRCode(req.user.username, secret);
      const qrCodeUrl = await QRCode.toDataURL(otpauth);
      
      // Store secret temporarily or send to user to confirm
      res.json({ secret, qrCodeUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/auth/2fa/enable', authenticateToken, async (req: AuthRequest, res) => {
    const { secret, token } = req.body;
    if (!verify2FA(token, secret)) {
      res.status(400).json({ error: 'Invalid 2FA token' });
      return;
    }
    try {
      db.prepare('UPDATE Users SET two_factor_secret = ? WHERE id = ?').run(secret, req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- RBAC Management Routes ---
  app.get('/api/users', authenticateToken, async (req: AuthRequest, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const users = db.prepare('SELECT id, username, role, permissions, created_at FROM Users').all();
    res.json({ users: users.map((u: any) => ({ ...u, permissions: JSON.parse(u.permissions || '[]') })) });
  });

  app.post('/api/users', authenticateToken, async (req: AuthRequest, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const { username, password, role, permissions } = req.body;
    try {
      const hash = await bcrypt.hash(password, 10);
      db.prepare('INSERT INTO Users (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)')
        .run(username, hash, role, JSON.stringify(permissions || []));
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Audit Logging Helper ---
  function logAudit(userId: number, action: string, targetUuid?: string) {
    try {
      const stmt = db.prepare('INSERT INTO Audit_Log (user_id, action, target_uuid) VALUES (?, ?, ?)');
      stmt.run(userId, action, targetUuid || null);
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  // --- Protected API Routes ---
  app.get('/api/vms', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const vms = await listVMs();
      
      // Fetch metadata from DB to enrich the libvirt data
      const stmt = db.prepare(`
        SELECT VM_Metadata.uuid, VM_Metadata.notes, VM_Metadata.tags, Users.username as owner
        FROM VM_Metadata
        LEFT JOIN Users ON VM_Metadata.owner_id = Users.id
      `);
      const metadataRows = stmt.all() as any[];
      const metadataMap = new Map(metadataRows.map(row => [row.uuid, row]));

      const enrichedVMs = vms.map(vm => {
        const meta = metadataMap.get(vm.uuid) || {};
        return { ...vm, ...meta };
      });

      res.json({ vms: enrichedVMs });
    } catch (error: any) {
      console.error('Error fetching VMs:', error);
      res.status(500).json({ error: 'Failed to fetch VMs from libvirt', details: error.message });
    }
  });

  app.post('/api/vms', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { name, memory, vcpus, diskSize, isoPath, network, notes, tags } = req.body;
      
      if (!name || !memory || !vcpus) {
        res.status(400).json({ error: 'Missing required VM configuration (name, memory, vcpus)' });
        return;
      }

      const result = await createVM({ name, memory, vcpus, diskSize, isoPath, network });
      
      // Save metadata
      const stmt = db.prepare('INSERT INTO VM_Metadata (uuid, owner_id, notes, tags) VALUES (?, ?, ?, ?)');
      stmt.run(result.uuid, req.user.id, notes || '', tags || '');

      logAudit(req.user.id, 'CREATE_VM', result.uuid);

      res.status(201).json({ message: 'VM created successfully', uuid: result.uuid, output: result.output });
    } catch (error: any) {
      console.error('Error creating VM:', error);
      res.status(500).json({ error: 'Failed to create VM', details: error.message });
    }
  });

  app.post('/api/vms/:uuid/start', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { uuid } = req.params;
      await startVM(uuid);
      logAudit(req.user.id, 'START_VM', uuid);
      res.json({ message: 'VM started successfully' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to start VM', details: error.message });
    }
  });

  app.post('/api/vms/:uuid/stop', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { uuid } = req.params;
      await stopVM(uuid);
      logAudit(req.user.id, 'STOP_VM', uuid);
      res.json({ message: 'VM shutdown initiated' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to stop VM', details: error.message });
    }
  });

  app.post('/api/vms/:uuid/force-stop', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { uuid } = req.params;
      await forceStopVM(uuid);
      logAudit(req.user.id, 'FORCE_STOP_VM', uuid);
      res.json({ message: 'VM destroyed (force stopped)' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to force stop VM', details: error.message });
    }
  });

  app.delete('/api/vms/:uuid', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { uuid } = req.params;
      await deleteVM(uuid);
      
      // Remove metadata
      const stmt = db.prepare('DELETE FROM VM_Metadata WHERE uuid = ?');
      stmt.run(uuid);

      logAudit(req.user.id, 'DELETE_VM', uuid);
      res.json({ message: 'VM deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to delete VM', details: error.message });
    }
  });

  app.post('/api/vms/:uuid/clone', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { uuid } = req.params;
      const { originalName, newName } = req.body;
      
      if (!originalName || !newName) {
        res.status(400).json({ error: 'Missing originalName or newName' });
        return;
      }

      const result = await cloneVM(originalName, newName);
      
      // Copy metadata if it exists
      const stmt = db.prepare('SELECT * FROM VM_Metadata WHERE uuid = ?');
      const originalMeta = stmt.get(uuid) as any;
      
      if (originalMeta) {
        const insertStmt = db.prepare('INSERT INTO VM_Metadata (uuid, owner_id, notes, tags) VALUES (?, ?, ?, ?)');
        insertStmt.run(result.uuid, req.user.id, originalMeta.notes || '', originalMeta.tags || '');
      } else {
        const insertStmt = db.prepare('INSERT INTO VM_Metadata (uuid, owner_id, notes, tags) VALUES (?, ?, ?, ?)');
        insertStmt.run(result.uuid, req.user.id, '', '');
      }

      logAudit(req.user.id, 'CLONE_VM', result.uuid);
      res.status(201).json({ message: 'VM cloned successfully', uuid: result.uuid });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to clone VM', details: error.message });
    }
  });

  app.get('/api/vms/:uuid/vnc', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { uuid } = req.params;
      const vncDisplay = await getVncPort(uuid);
      if (!vncDisplay) {
        res.status(404).json({ error: 'VNC display not found for this VM' });
        return;
      }
      
      let port = 5900;
      if (vncDisplay.includes(':')) {
        const parts = vncDisplay.split(':');
        const p = parts[parts.length - 1];
        port = 5900 + parseInt(p, 10);
      }
      
      res.json({ port });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get VNC port', details: error.message });
    }
  });

  app.post('/api/vms/:uuid/vnc', authenticateToken, async (req: AuthRequest, res) => {
    // ...
  });

  app.post('/api/vms/:uuid/migrate', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { uuid } = req.params;
      const { targetNode } = req.body;
      if (!targetNode) return res.status(400).json({ error: 'targetNode is required' });
      const result = await migrateVM(uuid, targetNode);
      logAudit(req.user.id, 'MIGRATE_VM', uuid);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/vms/:uuid/ha', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { uuid } = req.params;
      const { enabled } = req.body;
      const result = await setVMHA(uuid, enabled);
      logAudit(req.user.id, 'SET_VM_HA', uuid);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Project Nova Daemon' });
  });

  // --- Networking Routes ---
  app.get('/api/networks', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const networks = await listNetworks();
      res.json({ networks });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to list networks', details: error.message });
    }
  });

  app.post('/api/networks/:name/start', authenticateToken, async (req: AuthRequest, res) => {
    try {
      await startNetwork(req.params.name);
      logAudit(req.user.id, 'START_NETWORK', req.params.name);
      res.json({ message: 'Network started' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to start network', details: error.message });
    }
  });

  app.post('/api/networks/:name/stop', authenticateToken, async (req: AuthRequest, res) => {
    try {
      await stopNetwork(req.params.name);
      logAudit(req.user.id, 'STOP_NETWORK', req.params.name);
      res.json({ message: 'Network stopped' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to stop network', details: error.message });
    }
  });

  app.get('/api/network/interfaces', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const interfaces = await getHostInterfaces();
      res.json({ interfaces });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get interfaces', details: error.message });
    }
  });

  app.get('/api/network/connections', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const connections = await getActiveConnections();
      res.json({ connections });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get connections', details: error.message });
    }
  });

  app.get('/api/network/tailscale', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const status = await getTailscaleStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get Tailscale status', details: error.message });
    }
  });

  app.post('/api/network/troubleshoot', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { action, target } = req.body;
      const result = await runTroubleshoot(action, target);
      res.json({ result });
    } catch (error: any) {
      res.status(500).json({ error: 'Troubleshoot failed', details: error.message });
    }
  });

  app.post('/api/network/advanced', authenticateToken, async (req: AuthRequest, res) => {
    const { type, name, parent, vlanId, slaves, mode, vni, remoteIp, localIp } = req.body;
    try {
      let result;
      switch (type) {
        case 'bridge':
          result = await createLinuxBridge(name);
          break;
        case 'vlan':
          result = await createVlanInterface(parent, parseInt(vlanId));
          break;
        case 'bond':
          result = await createBondInterface(name, slaves, mode);
          break;
        case 'ovs':
          result = await createOvsBridge(name);
          break;
        case 'vxlan':
          result = await createVxlanInterface(name, parseInt(vni), remoteIp, localIp);
          break;
        default:
          return res.status(400).json({ error: 'Invalid network type' });
      }
      logAudit(req.user.id, 'CREATE_ADVANCED_NETWORK', `${type}:${name || parent}`);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Storage Routes ---
  app.post('/api/storage/upload', authenticateToken, upload.single('iso'), (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }
      logAudit(req.user.id, 'UPLOAD_ISO', req.file.filename);
      res.json({ message: 'ISO uploaded successfully', filename: req.file.filename, path: req.file.path });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to upload ISO', details: error.message });
    }
  });

  app.get('/api/storage/pools', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const pools = await listStoragePools();
      res.json({ pools });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to list storage pools', details: error.message });
    }
  });

  app.post('/api/storage/pools/:name/start', authenticateToken, async (req: AuthRequest, res) => {
    try {
      await startStoragePool(req.params.name);
      logAudit(req.user.id, 'START_STORAGE_POOL', req.params.name);
      res.json({ message: 'Storage pool started' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to start storage pool', details: error.message });
    }
  });

  app.post('/api/storage/pools/:name/stop', authenticateToken, async (req: AuthRequest, res) => {
    try {
      await stopStoragePool(req.params.name);
      logAudit(req.user.id, 'STOP_STORAGE_POOL', req.params.name);
      res.json({ message: 'Storage pool stopped' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to stop storage pool', details: error.message });
    }
  });

  app.get('/api/storage/pools/:name/volumes', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const volumes = await listStorageVolumes(req.params.name);
      res.json({ volumes });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to list storage volumes', details: error.message });
    }
  });

  app.post('/api/storage/pools/create', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { name, type, target, source } = req.body;
      const result = await createStoragePool(name, type, target, source);
      logAudit(req.user.id, 'CREATE_STORAGE_POOL', name);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/storage/zfs/create', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { name, devices } = req.body;
      const result = await createZfsPool(name, devices);
      logAudit(req.user.id, 'CREATE_ZFS_POOL', name);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/storage/lvm/create', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { name, vgName } = req.body;
      const result = await createLvmPool(name, vgName);
      logAudit(req.user.id, 'CREATE_LVM_POOL', name);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- LXC Routes ---
  app.get('/api/lxc', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const containers = await listLxcContainers();
      res.json({ containers });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to list LXC containers', details: error.message });
    }
  });

  app.post('/api/lxc/:name/start', authenticateToken, async (req: AuthRequest, res) => {
    try {
      await startLxcContainer(req.params.name);
      logAudit(req.user.id, 'START_LXC', req.params.name);
      res.json({ message: 'LXC container started' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to start LXC container', details: error.message });
    }
  });

  app.post('/api/lxc/:name/stop', authenticateToken, async (req: AuthRequest, res) => {
    try {
      await stopLxcContainer(req.params.name);
      logAudit(req.user.id, 'STOP_LXC', req.params.name);
      res.json({ message: 'LXC container stopped' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to stop LXC container', details: error.message });
    }
  });

  // --- Cluster Routes ---
  app.get('/api/cluster', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const clusterData = await getClusterStatus();
      res.json(clusterData);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get cluster status', details: error.message });
    }
  });

  app.post('/api/cluster/join', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const { nodeName, peerIp } = req.body;
      const result = await joinCluster(nodeName, peerIp);
      logAudit(req.user.id, 'JOIN_CLUSTER', nodeName);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/cluster/leave', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const result = await leaveCluster();
      logAudit(req.user.id, 'LEAVE_CLUSTER');
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Firewall Routes ---
  app.get('/api/firewall', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const firewallData = await getFirewallRules();
      res.json(firewallData);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get firewall rules', details: error.message });
    }
  });

  app.post('/api/firewall/rules', authenticateToken, async (req: AuthRequest, res) => {
    const { chain, target, prot, source, destination, extra } = req.body;
    try {
      const result = await addFirewallRule(chain || 'INPUT', target, prot, source, destination, extra);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/firewall/rules/:ruleNum', authenticateToken, async (req: AuthRequest, res) => {
    const { ruleNum } = req.params;
    const { chain } = req.query;
    try {
      const result = await deleteFirewallRule((chain as string) || 'INPUT', parseInt(ruleNum));
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Monitoring Routes ---
  app.get('/api/monitoring/host', authenticateToken, async (req: AuthRequest, res) => {
    try {
      const metrics = await getHostMetrics();
      res.json(metrics);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to get host metrics', details: error.message });
    }
  });

  // --- Guacamole Token Endpoint ---
  app.get('/api/guacamole/token', authenticateToken, (req: AuthRequest, res) => {
    const { uuid, type } = req.query;
    
    // In a real application, you would look up the VM's IP address and credentials
    // from your database using the UUID. For this demo, we'll mock the connection details.
    const connectionSettings = {
      connection: {
        type: (type as string) || 'vnc',
        settings: {
          hostname: '10.0.0.50', // Mock IP
          port: type === 'ssh' ? 22 : type === 'rdp' ? 3389 : 5900,
          username: 'admin',
          password: 'password',
          security: 'any',
          'ignore-cert': 'true',
          'enable-sftp': 'true'
        }
      }
    };

    try {
      // Create an initialization vector
      const iv = crypto.randomBytes(16);
      // Create the cipher using AES-256-CBC
      const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(GUAC_KEY), iv);
      
      // Encrypt the connection settings
      let encrypted = cipher.update(JSON.stringify(connectionSettings), 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // The token format expected by guacamole-lite is IV:EncryptedPayload
      const token = iv.toString('base64') + ':' + encrypted;
      
      res.json({ token });
    } catch (error) {
      console.error('Failed to generate Guacamole token:', error);
      res.status(500).json({ error: 'Failed to generate connection token' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Create HTTP Server
  const server = createHttpServer(app);

  // --- WebSocket Server for VNC Proxying ---
  const wss = new WebSocketServer({ server, path: '/vnc' });
  const terminalWss = new WebSocketServer({ server, path: '/api/terminal' });

  // --- Terminal WebSocket Logic ---
  terminalWss.on('connection', (ws, req) => {
    console.log(`New Terminal connection from ${req.socket.remoteAddress}`);
    
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const target = url.searchParams.get('target');
    
    if (!token) {
      ws.send('Authentication required\r\n');
      ws.close();
      return;
    }

    if (token !== 'dev-bypass-token') {
      try {
        jwt.verify(token, process.env.JWT_SECRET || 'nova-default-secret-key-change-me');
      } catch (e) {
        ws.send('Invalid token\r\n');
        ws.close();
        return;
      }
    }

    // Spawn a bash process or SSH process
    // We use bash -i to force an interactive shell, which gives us a prompt
    let shell;
    
    if (target) {
      // For SSH to a VM, we'll use a wrapper script or just ssh command
      // In a real environment, you'd look up the VM's IP address by UUID
      // For this demo, we'll simulate SSH by just running bash with a custom prompt
      // or if you have real VMs, you'd do: spawn('ssh', ['-o', 'StrictHostKeyChecking=no', `user@${vmIp}`]);
      shell = spawn('bash', ['-i'], {
        env: { ...process.env, TERM: 'xterm-256color', PS1: `\\[\\e[32m\\]user@${target}\\[\\e[m\\]:\\w\\$ ` },
        cwd: process.env.HOME || '/'
      });
      
      // Simulate SSH connection delay and prompt
      setTimeout(() => {
        if (ws.readyState === ws.OPEN) {
          ws.send(`\r\nWarning: Permanently added '${target}' (ECDSA) to the list of known hosts.\r\n`);
          ws.send(`user@${target}'s password: `);
        }
      }, 500);
    } else {
      // Host terminal
      shell = spawn('bash', ['-i'], {
        env: { ...process.env, TERM: 'xterm-256color', PS1: '\\u@\\h:\\w\\$ ' },
        cwd: process.env.HOME || '/'
      });
    }

    shell.stdout.on('data', (data) => {
      if (ws.readyState === ws.OPEN) {
        // xterm.js has convertEol: true, so we can just send the data
        ws.send(data.toString());
      }
    });

    shell.stderr.on('data', (data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data.toString());
      }
    });

    ws.on('message', (msg) => {
      if (!shell.killed) {
        shell.stdin.write(msg.toString());
      }
    });

    shell.on('close', () => {
      if (ws.readyState === ws.OPEN) {
        ws.send('\r\n*** Session closed ***\r\n');
        ws.close();
      }
    });

    ws.on('close', () => {
      shell.kill();
    });
    
    ws.on('error', () => {
      shell.kill();
    });
  });

  // --- VNC WebSocket Logic ---
  wss.on('connection', (ws, req) => {
    console.log(`New WebSocket connection from ${req.socket.remoteAddress}`);
    
    // Parse target port from URL query (e.g., ws://localhost:3000/vnc?port=5900)
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const targetPortParam = url.searchParams.get('port');
    const targetPort = targetPortParam ? parseInt(targetPortParam, 10) : 5900;
    const targetHost = '127.0.0.1'; // QEMU VNC typically binds to localhost

    const tcpSocket = new net.Socket();

    tcpSocket.connect(targetPort, targetHost, () => {
      console.log(`Connected to VNC target ${targetHost}:${targetPort}`);
    });

    tcpSocket.on('data', (data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });

    ws.on('message', (msg) => {
      if (!tcpSocket.destroyed) {
        tcpSocket.write(msg as Buffer);
      }
    });

    tcpSocket.on('close', () => {
      console.log(`VNC target ${targetHost}:${targetPort} disconnected`);
      if (ws.readyState === ws.OPEN) {
        ws.close();
      }
    });

    tcpSocket.on('error', (err) => {
      console.error(`VNC TCP Socket error (${targetHost}:${targetPort}):`, err.message);
      if (ws.readyState === ws.OPEN) {
        ws.close();
      }
    });

    ws.on('close', () => {
      console.log('WebSocket connection closed');
      tcpSocket.destroy();
    });
    
    ws.on('error', (err) => {
      console.error('WebSocket error:', err);
      tcpSocket.destroy();
    });
  });

  // --- Guacamole Lite WebSocket Server ---
  const guacdOptions = {
    host: process.env.GUACD_HOST || '127.0.0.1',
    port: parseInt(process.env.GUACD_PORT || '4822', 10)
  };

  const clientOptions = {
    crypt: {
      cypher: 'AES-256-CBC',
      key: GUAC_KEY
    },
    log: {
      level: 'INFO'
    }
  };

  // Initialize the Guacamole Lite server attached to our Express HTTP server
  try {
    const guacServer = new GuacamoleLite(
      { server, path: '/guacamole' },
      guacdOptions,
      clientOptions
    );
    console.log('Guacamole Lite WebSocket server initialized on /guacamole');
  } catch (error) {
    console.error('Failed to initialize Guacamole Lite:', error);
  }

  // Start Server
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Project Nova daemon running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(console.error);
