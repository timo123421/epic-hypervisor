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
  `);

  // Insert default admin user if it doesn't exist
  try {
    const checkAdmin = db.prepare('SELECT id FROM Users WHERE username = ?').get('admin');
    if (!checkAdmin) {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('admin', salt);
      db.prepare('INSERT INTO Users (username, password_hash, role, permissions) VALUES (?, ?, ?, ?)')
        .run('admin', hash, 'admin', JSON.stringify(['*']));
    }
  } catch (e) {
    console.error('Failed to insert default admin user:', e);
  }

  console.log('Database initialized successfully.');
}

export default db;
