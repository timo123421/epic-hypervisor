import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, RefreshCw } from 'lucide-react';

interface SshTerminalProps {
  uuid: string;
  name?: string;
  onClose: () => void;
}

export default function SshTerminal({ uuid, name, onClose }: SshTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const connect = () => {
    if (!terminalRef.current) return;

    // Initialize terminal if it doesn't exist
    if (!termRef.current) {
      const term = new Terminal({
        theme: {
          background: '#0f172a', // slate-900
          foreground: '#f8fafc', // slate-50
          cursor: '#38bdf8',     // sky-400
          selectionBackground: '#334155', // slate-700
        },
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        fontSize: 14,
        cursorBlink: true,
        convertEol: true, // Automatically convert \n to \r\n
      });
      
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      
      // Only fit if the container has dimensions
      if (terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
        try {
          fitAddon.fit();
        } catch (e) {
          console.warn('Failed to fit terminal initially', e);
        }
      }
      
      termRef.current = term;
      fitAddonRef.current = fitAddon;

      // Handle resize using ResizeObserver for more reliable fitting
      const resizeObserver = new ResizeObserver(() => {
        if (fitAddonRef.current && terminalRef.current && terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
          try {
            fitAddonRef.current.fit();
          } catch (e) {
            // Ignore fit errors when dimensions are invalid
          }
        }
      });
      
      resizeObserver.observe(terminalRef.current);
      
      // Store observer to disconnect later
      (term as any)._resizeObserver = resizeObserver;
    }

    const term = termRef.current;
    if (!term) return;

    term.clear();
    term.writeln(`\x1b[36m*** Connecting to SSH Terminal for ${name || uuid}... ***\x1b[0m`);

    // Close existing WebSocket if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    const token = localStorage.getItem('nova_token');
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/terminal?token=${token}&target=${uuid}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      term.clear();
      term.writeln(`\x1b[32m*** Connected to SSH Terminal for ${name || uuid} ***\x1b[0m`);
      // Send an initial enter to get the prompt
      ws.send('\n');
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onclose = () => {
      setIsConnected(false);
      term.writeln('\r\n\x1b[31m*** Disconnected from SSH Terminal ***\x1b[0m');
    };

    ws.onerror = () => {
      term.writeln('\r\n\x1b[31m*** WebSocket Error ***\x1b[0m');
    };

    // Only attach the data listener once
    if (!term.onDataAttached) {
      term.onData((data) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(data);
        }
      });
      (term as any).onDataAttached = true;
    }
  };

  useEffect(() => {
    connect();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (termRef.current) {
        if ((termRef.current as any)._resizeObserver) {
          (termRef.current as any)._resizeObserver.disconnect();
        }
        termRef.current.dispose();
      }
    };
  }, []);

  // Re-fit terminal when fullscreen changes
  useEffect(() => {
    if (fitAddonRef.current && terminalRef.current) {
      // Small timeout to allow DOM to update before fitting
      setTimeout(() => {
        if (terminalRef.current && terminalRef.current.clientWidth > 0 && terminalRef.current.clientHeight > 0) {
          try {
            fitAddonRef.current?.fit();
          } catch (e) {
            // Ignore
          }
        }
      }, 50);
    }
  }, [isFullscreen]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8">
      <div className={`bg-slate-900 rounded-xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden transition-all duration-200 ${isFullscreen ? 'fixed inset-0 rounded-none border-none' : 'w-full max-w-5xl h-[80vh]'}`}>
        {/* Terminal Header */}
        <div className="bg-slate-950 px-4 py-3 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <TerminalIcon className="w-5 h-5 text-sky-400" />
            <h3 className="text-sm font-medium text-slate-200">SSH: {name || uuid}</h3>
            <div className="flex items-center gap-1.5 ml-4">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className="text-xs text-slate-400">{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={connect}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title="Reconnect"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
              title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <div className="w-px h-4 bg-slate-700 mx-1" />
            <button 
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Terminal Container */}
        <div className="flex-1 bg-slate-900 p-2 overflow-hidden relative">
          <div ref={terminalRef} className="w-full h-full" />
        </div>
      </div>
    </div>
  );
}
