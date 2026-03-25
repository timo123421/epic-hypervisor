import React, { useEffect, useRef, useState } from 'react';
import RFB from '@novnc/novnc/lib/rfb';
import { X, Terminal, MonitorPlay } from 'lucide-react';
import { apiCall } from '../lib/api';

interface VncConsoleProps {
  uuid: string;
  name?: string;
  onClose: () => void;
}

export default function VncConsole({ uuid, name, onClose }: VncConsoleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('Connecting...');

  useEffect(() => {
    let rfb: RFB | null = null;

    const connectVnc = async () => {
      try {
        // 1. Get the VNC port for this VM
        const { port } = await apiCall(`/vms/${uuid}/vnc`);
        
        // 2. Connect to the WebSocket proxy
        if (!containerRef.current) return;
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/vnc?port=${port}`;
        
        rfb = new RFB(containerRef.current, wsUrl, {
          credentials: { password: '' } // Add password if configured in libvirt
        });

        rfb.addEventListener('connect', () => {
          setStatus('Connected');
        });

        rfb.addEventListener('disconnect', (e: any) => {
          setStatus('Disconnected');
          if (e.detail && !e.detail.clean) {
            // In this demo environment, the backend doesn't speak real RFB protocol
            // so noVNC will disconnect immediately. We'll show a friendly message instead of an error.
            setError('VNC console is simulated in this environment. Use SSH Terminal instead.');
          }
        });

        // Scale to fit
        rfb.scaleViewport = true;
        rfb.resizeSession = true;

      } catch (err: any) {
        setError(err.message || 'Failed to connect to VNC console');
        setStatus('Error');
      }
    };

    connectVnc();

    return () => {
      if (rfb) {
        try {
          // Only disconnect if we're not already disconnected to avoid noVNC errors
          if ((rfb as any)._rfbConnectionState !== 'disconnected') {
            rfb.disconnect();
          }
        } catch (e) {
          // Ignore disconnect errors
        }
      }
    };
  }, [uuid]);

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col p-4 sm:p-8">
      <div className="bg-white rounded-lg shadow-2xl flex flex-col h-full w-full max-w-6xl mx-auto overflow-hidden border border-slate-700">
        <div className="flex justify-between items-center p-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-white">
              <MonitorPlay className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                {name || uuid}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 font-mono">{uuid}</span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                  status === 'Connected' ? 'bg-green-100 text-green-700' :
                  status === 'Error' ? 'bg-red-100 text-red-700' :
                  'bg-amber-100 text-amber-700'
                }`}>
                  {status === 'Connected' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse"></span>}
                  {status}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 bg-slate-950 relative overflow-hidden flex items-center justify-center p-4">
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-md font-mono text-sm z-10 flex items-center gap-2 shadow-lg backdrop-blur-md">
              <Terminal className="w-4 h-4" />
              {error}
            </div>
          )}
          <div ref={containerRef} className="w-full h-full flex items-center justify-center [&>div]:w-full [&>div]:h-full [&>div]:flex [&>div]:items-center [&>div]:justify-center" />
        </div>
      </div>
    </div>
  );
}
