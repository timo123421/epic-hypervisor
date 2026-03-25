/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

export default function App() {
  // DEV BYPASS: Hardcode token to bypass login screen
  const [token, setToken] = useState<string | null>('dev-bypass-token');

  useEffect(() => {
    if (token) {
      localStorage.setItem('nova_token', token);
    } else {
      localStorage.removeItem('nova_token');
    }
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {token ? (
        <Dashboard onLogout={() => setToken(null)} />
      ) : (
        <Login onLogin={setToken} />
      )}
    </div>
  );
}
