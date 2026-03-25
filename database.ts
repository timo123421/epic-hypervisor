import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcrypt';

// Ensure the data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'nova.db');
const db = new Database(dbPath, { verbose: console.log });
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'vm_manager', 'user')),
      permissions TEXT, -- JSON array of strings
      two_factor_secret TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS VM_Metadata (
      uuid TEXT PRIMARY KEY,
      owner_id INTEGER,
      node_name TEXT DEFAULT 'nova-node-01',
      notes TEXT,
      tags TEXT,
      FOREIGN KEY(owner_id) REFERENCES Users(id)
    );

    CREATE TABLE IF NOT EXISTS Audit_Log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      target_uuid TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES Users(id)
    );

    CREATE TABLE IF NOT EXISTS Auth_Realms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      name TEXT UNIQUE NOT NULL,
      config TEXT,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      ip TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('master', 'worker')),
      status TEXT DEFAULT 'offline',
      api_token TEXT,
      last_seen DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: Add permissions column if it doesn't exist (for existing databases)
  try {
    const tableInfo = db.pragma('table_info(Users)') as any[];
    const hasPermissions = tableInfo.some(col => col.name === 'permissions');
    if (!hasPermissions) {
      db.exec('ALTER TABLE Users ADD COLUMN permissions TEXT');
      console.log('Migrated Users table: Added permissions column.');
    }
    
    const has2FA = tableInfo.some(col => col.name === 'two_factor_secret');
    if (!has2FA) {
      db.exec('ALTER TABLE Users ADD COLUMN two_factor_secret TEXT');
      console.log('Migrated Users table: Added two_factor_secret column.');
    }
  } catch (e) {
    console.error('Migration failed:', e);
  }

  // Insert default admin user if it doesn't exist
  try {
    const checkAdmin = db.prepare('SELECT id FROM Users WHERE username = ?').get('admin');
    if (!checkAdmin) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('admin', salt);
      db.prepare('INSERT INTO Users (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)')
        .run('admin', hash, 'admin', JSON.stringify(['*']));
    }

    // Add sample manager and user
    const checkManager = db.prepare('SELECT id FROM Users WHERE username = ?').get('manager');
    if (!checkManager) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('manager', salt);
      db.prepare('INSERT INTO Users (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)')
        .run('manager', hash, 'vm_manager', JSON.stringify(['vms.*', 'containers.*']));
    }

    const checkUser = db.prepare('SELECT id FROM Users WHERE username = ?').get('user');
    if (!checkUser) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('user', salt);
      db.prepare('INSERT INTO Users (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)')
        .run('user', hash, 'user', JSON.stringify(['vms.read', 'containers.read']));
    }
  } catch (e) {
    console.error('Failed to insert default admin user:', e);
  }

  console.log('Database initialized successfully.');

  // Seed sample audit logs if empty
  try {
    const logCount = db.prepare('SELECT COUNT(*) as count FROM Audit_Log').get() as { count: number };
    if (logCount.count === 0) {
      const adminId = db.prepare('SELECT id FROM Users WHERE username = ?').get('admin') as { id: number };
      if (adminId) {
        const sampleLogs = [
          { action: 'CREATE_VM', target: '550e8400-e29b-41d4-a716-446655440000' },
          { action: 'START_VM', target: '550e8400-e29b-41d4-a716-446655440000' },
          { action: 'CREATE_STORAGE_POOL', target: 'default' },
          { action: 'CREATE_NETWORK', target: 'virbr0' },
          { action: 'JOIN_CLUSTER', target: 'nova-node-02' },
          { action: 'ADD_FIREWALL_RULE', target: 'INPUT:80' }
        ];
        const insertLog = db.prepare('INSERT INTO Audit_Log (user_id, action, target_uuid, timestamp) VALUES (?, ?, ?, ?)');
        sampleLogs.forEach((log, i) => {
          const date = new Date();
          date.setMinutes(date.getMinutes() - (i * 15)); // Spread them out
          insertLog.run(adminId.id, log.action, log.target, date.toISOString());
        });
        console.log('Sample audit logs seeded.');
      }
    }
  } catch (e) {
    console.error('Failed to seed sample audit logs:', e);
  }

  // Seed sample realms
  try {
    const realmCount = db.prepare('SELECT COUNT(*) as count FROM Auth_Realms').get() as { count: number };
    if (realmCount.count === 0) {
      const sampleRealms = [
        { type: 'pam', name: 'pam', config: { comment: 'Standard Linux PAM' }, is_default: 1 },
        { type: 'ad', name: 'corp-ad', config: { domain: 'corp.nova.local', server: '10.0.0.10' }, is_default: 0 },
        { type: 'ldap', name: 'openldap', config: { server: 'ldap.nova.local', base_dn: 'dc=nova,dc=local' }, is_default: 0 }
      ];
      const insertRealm = db.prepare('INSERT INTO Auth_Realms (type, name, config, is_default) VALUES (?, ?, ?, ?)');
      sampleRealms.forEach(realm => {
        insertRealm.run(realm.type, realm.name, JSON.stringify(realm.config), realm.is_default);
      });
      console.log('Sample auth realms seeded.');
    }
  } catch (e) {
    console.error('Failed to seed sample auth realms:', e);
  }

  // Seed sample nodes
  try {
    const nodeCount = db.prepare('SELECT COUNT(*) as count FROM Nodes').get() as { count: number };
    if (nodeCount.count === 0) {
      const sampleNodes = [
        { name: 'nova-node-01', ip: '127.0.0.1', role: 'master', status: 'online' },
        { name: 'nova-node-02', ip: '192.168.4.101', role: 'worker', status: 'online' },
        { name: 'nova-node-03', ip: '192.168.4.102', role: 'worker', status: 'offline' }
      ];
      const insertNode = db.prepare('INSERT INTO Nodes (name, ip, role, status, last_seen) VALUES (?, ?, ?, ?, ?)');
      sampleNodes.forEach(node => {
        insertNode.run(node.name, node.ip, node.role, node.status, new Date().toISOString());
      });
      console.log('Sample nodes seeded.');
    }
  } catch (e) {
    console.error('Failed to seed sample nodes:', e);
  }
}

export default db;
