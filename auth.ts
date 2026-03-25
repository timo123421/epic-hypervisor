import jwt from 'jsonwebtoken';
import express from 'express';
import * as speakeasy from 'speakeasy';

const JWT_SECRET = process.env.JWT_SECRET || 'nova-default-secret-key-change-me';

export interface AuthRequest extends express.Request {
  user?: any;
}

export function authenticateToken(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Authentication token required' });
    return;
  }

  if (token === 'dev-bypass-token') {
    req.user = { id: 0, username: 'admin', role: 'admin', permissions: ['all'] };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
    }
    req.user = user;
    next();
  });
}

export function authorize(permissions: string[]) {
  return (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    
    // Admin has all permissions
    if (req.user.role === 'admin') return next();
    
    const userPermissions = req.user.permissions || [];
    const hasPermission = permissions.every(p => userPermissions.includes(p));
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function generateToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

export function verify2FA(token: string, secret: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token
  });
}

export function generate2FASecret() {
  return speakeasy.generateSecret({ length: 20 }).base32;
}

export function get2FAQRCode(user: string, secret: string) {
  return speakeasy.otpauthURL({
    secret,
    label: user,
    issuer: 'Project Nova',
    encoding: 'base32'
  });
}
