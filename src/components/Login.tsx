import React, { useState } from 'react';
import { apiCall } from '../lib/api';
import { Server, Lock, User } from 'lucide-react';

interface LoginProps {
  onLogin: (token: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const data = await apiCall('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password, twoFactorToken: requires2FA ? twoFactorToken : undefined }),
      });
      
      if (data.requires2FA) {
        setRequires2FA(true);
        setLoading(false);
        return;
      }
      
      onLogin(data.token);
    } catch (err: any) {
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md card p-8">
        <div className="flex flex-col items-center justify-center gap-3 mb-8">
          <div className="bg-sky-600 p-3 rounded-lg text-white shadow-md">
            <Server className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Project Nova</h1>
          <p className="text-sm text-slate-500">Sign in to the virtualization management console</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          {!requires2FA ? (
            <>
              <div>
                <label className="input-label">Username</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input-field pl-10"
                    placeholder="admin"
                    required
                  />
                </div>
              </div>
              
              <div>
                <label className="input-label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-10"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="input-label">Two-Factor Authentication Code</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={twoFactorToken}
                  onChange={(e) => setTwoFactorToken(e.target.value)}
                  className="input-field pl-10"
                  placeholder="000000"
                  required
                  autoFocus
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">Please enter the 6-digit code from your authenticator app.</p>
            </div>
          )}

          {error && (
            <div className="text-red-600 text-sm border border-red-200 p-3 rounded-md bg-red-50 flex items-center gap-2">
              <span className="block w-1.5 h-1.5 rounded-full bg-red-600"></span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2 py-2.5"
          >
            {loading ? 'Authenticating...' : requires2FA ? 'Verify & Sign In' : 'Sign In'}
          </button>
          
          {requires2FA && (
            <button 
              type="button" 
              onClick={() => setRequires2FA(false)}
              className="w-full text-sm text-slate-500 hover:text-slate-700 transition-colors"
            >
              Back to login
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
