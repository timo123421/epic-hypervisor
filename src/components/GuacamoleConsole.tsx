import React, { useEffect, useRef, useState } from 'react';
import Guacamole from 'guacamole-common-js';
import { X, MonitorPlay, Terminal, MonitorSmartphone } from 'lucide-react';
import { apiCall } from '../lib/api';

interface GuacamoleConsoleProps {
  uuid: string;
  name?: string;
  type: 'vnc' | 'ssh' | 'rdp';
  onClose: () => void;
}

export default function GuacamoleConsole({ uuid, name, type, onClose }: GuacamoleConsoleProps) {
  const displayRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Connecting...');
  const [error, setError] = useState('');
  const clientRef = useRef<Guacamole.Client | null>(null);

  useEffect(() => {
    let client: Guacamole.Client | null = null;
    let tunnel: Guacamole.WebSocketTunnel | null = null;

    const connectGuac = async () => {
      try {
        // 1. Get the connection token from our backend
        const { token } = await apiCall(`/guacamole/token?uuid=${uuid}&type=${type}`);
        
        // 2. Connect to the Guacamole WebSocket proxy
        if (!displayRef.current) return;
        
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/guacamole?token=${encodeURIComponent(token)}`;
        
        tunnel = new Guacamole.WebSocketTunnel(wsUrl);
        client = new Guacamole.Client(tunnel);
        clientRef.current = client;

        // Error handler
        client.onerror = (err: any) => {
          console.error("Guacamole error:", err);
          // In this demo environment, guacd isn't actually running on localhost:4822
          // So we'll catch the connection refused error and show a friendly message
          setError(
            err.message || 
            'Guacamole server (guacd) is not reachable. In a real environment, guacd would connect to the VM now.'
          );
          setStatus('Error');
        };

        // State change handler
        tunnel.onstatechange = (state) => {
          switch (state) {
            case Guacamole.Tunnel.State.CONNECTING:
              setStatus('Connecting...');
              break;
            case Guacamole.Tunnel.State.OPEN:
              setStatus('Connected');
              break;
            case Guacamole.Tunnel.State.CLOSED:
              setStatus('Disconnected');
              break;
          }
        };

        // Add the display element to the DOM
        const element = client.getDisplay().getElement();
        element.style.zIndex = '10';
        displayRef.current.appendChild(element);

        // Connect
        client.connect();

        // Handle window resize to scale the remote desktop
        const handleResize = () => {
          if (client && displayRef.current) {
            const display = client.getDisplay();
            const width = displayRef.current.clientWidth;
            const height = displayRef.current.clientHeight;
            
            // Send the new size to the remote server (RDP/SSH support this well)
            client.sendSize(width, height);
            
            // Scale the local display to fit
            const scale = Math.min(
              width / Math.max(display.getWidth(), 1),
              height / Math.max(display.getHeight(), 1)
            );
            display.scale(scale);
          }
        };

        window.addEventListener('resize', handleResize);
        // Initial resize
        setTimeout(handleResize, 100);

        // Handle keyboard events
        const keyboard = new Guacamole.Keyboard(document);
        keyboard.onkeydown = (keysym) => {
          client?.sendKeyEvent(1, keysym);
        };
        keyboard.onkeyup = (keysym) => {
          client?.sendKeyEvent(0, keysym);
        };

        // Handle mouse events
        const mouse = new Guacamole.Mouse(element);
        mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (mouseState) => {
          client?.sendMouseState(mouseState);
        };

      } catch (err: any) {
        setError(err.message || 'Failed to initialize Guacamole session');
        setStatus('Error');
      }
    };

    connectGuac();

    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, [uuid, type]);

  const getIcon = () => {
    switch (type) {
      case 'ssh': return <Terminal className="w-4 h-4" />;
      case 'rdp': return <MonitorSmartphone className="w-4 h-4" />;
      default: return <MonitorPlay className="w-4 h-4" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col p-4 sm:p-8">
      <div className="bg-slate-900 rounded-lg shadow-2xl flex flex-col h-full w-full max-w-6xl mx-auto overflow-hidden border border-slate-700">
        <div className="flex justify-between items-center p-4 border-b border-slate-800 bg-slate-950 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded flex items-center justify-center text-white ${
              type === 'ssh' ? 'bg-sky-600' : type === 'rdp' ? 'bg-indigo-600' : 'bg-emerald-600'
            }`}>
              {getIcon()}
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-200">
                {type.toUpperCase()}: {name || uuid}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500 font-mono">{uuid}</span>
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                  status === 'Connected' ? 'bg-green-500/20 text-green-400' :
                  status === 'Error' ? 'bg-red-500/20 text-red-400' :
                  'bg-amber-500/20 text-amber-400'
                }`}>
                  {status === 'Connected' && <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1 animate-pulse"></span>}
                  {status}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 bg-black relative overflow-hidden flex items-center justify-center p-0">
          {error && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 border border-slate-700 text-slate-300 px-6 py-4 rounded-lg font-mono text-sm z-20 flex flex-col gap-2 shadow-2xl max-w-lg text-center">
              <div className="flex items-center justify-center gap-2 text-amber-400 mb-2">
                <MonitorPlay className="w-5 h-5" />
                <span className="font-bold">Guacamole Integration Demo</span>
              </div>
              <p>{error}</p>
              <p className="text-xs text-slate-500 mt-2">
                The frontend is fully integrated with guacamole-common-js and the backend is running guacamole-lite. 
                To see the remote desktop, you must run guacd on port 4822.
              </p>
            </div>
          )}
          
          {/* The Guacamole display will be injected here */}
          <div 
            ref={displayRef} 
            className="w-full h-full flex items-center justify-center focus:outline-none"
            tabIndex={0} // Make it focusable to capture keyboard events
          />
        </div>
      </div>
    </div>
  );
}
