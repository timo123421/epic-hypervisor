import React, { useState, useEffect } from 'react';
import { apiCall } from '../lib/api';
import { Activity, Cpu, MemoryStick, Network, Thermometer, RefreshCw, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface MetricPoint {
  time: string;
  cpu: number;
  ram: number;
  temp: number;
  rx: number;
  tx: number;
}

export default function Monitoring() {
  const [metricsHistory, setMetricsHistory] = useState<MetricPoint[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMetrics = async () => {
    try {
      const data = await apiCall('/monitoring/host');
      setCurrentMetrics(data);
      
      const now = new Date();
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      
      setMetricsHistory(prev => {
        const newHistory = [...prev, {
          time: timeStr,
          cpu: data.cpuUsage,
          ram: data.memory.usagePercent,
          temp: Math.round(data.temperature),
          rx: Math.round(data.network.rxSpeed / 1024), // KB/s
          tx: Math.round(data.network.txSpeed / 1024), // KB/s
        }];
        // Keep last 30 data points
        if (newHistory.length > 30) return newHistory.slice(newHistory.length - 30);
        return newHistory;
      });
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000); // Poll every 2 seconds for smooth charts
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <div className="flex justify-between items-center mb-6">
        <div>
          <p className="text-slate-500 text-sm mb-2">Advanced performance, temperature, and network monitoring.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchMetrics} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          {error}
        </div>
      )}

      {currentMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* CPU Card */}
          <div className="card p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
              <Cpu className="w-6 h-6 text-sky-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 mb-1">CPU Usage</div>
              <div className="text-2xl font-bold text-slate-900">{currentMetrics.cpuUsage}%</div>
            </div>
          </div>

          {/* RAM Card */}
          <div className="card p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
              <MemoryStick className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 mb-1">RAM Usage</div>
              <div className="text-2xl font-bold text-slate-900">{currentMetrics.memory.usagePercent}%</div>
              <div className="text-xs text-slate-400">{formatBytes(currentMetrics.memory.used)} / {formatBytes(currentMetrics.memory.total)}</div>
            </div>
          </div>

          {/* Network Card */}
          <div className="card p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
              <Network className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 mb-1">Network (Rx/Tx)</div>
              <div className="text-lg font-bold text-slate-900">{formatBytes(currentMetrics.network.rxSpeed)}/s</div>
              <div className="text-xs text-slate-400">{formatBytes(currentMetrics.network.txSpeed)}/s up</div>
            </div>
          </div>

          {/* Temp Card */}
          <div className="card p-6 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
              <Thermometer className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-slate-500 mb-1">Temperature</div>
              <div className="text-2xl font-bold text-slate-900">{Math.round(currentMetrics.temperature)}°C</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CPU & RAM Chart */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-slate-400" />
            System Resources (%)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricsHistory} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#0f172a' }}
                />
                <Line type="monotone" dataKey="cpu" name="CPU" stroke="#0ea5e9" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="ram" name="RAM" stroke="#6366f1" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Network Chart */}
        <div className="card p-6">
          <h3 className="text-lg font-medium text-slate-900 mb-4 flex items-center gap-2">
            <Network className="w-5 h-5 text-slate-400" />
            Network Traffic (KB/s)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metricsHistory} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickMargin={10} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#0f172a' }}
                />
                <Area type="monotone" dataKey="rx" name="Rx (Download)" stroke="#10b981" fill="#d1fae5" strokeWidth={2} isAnimationActive={false} />
                <Area type="monotone" dataKey="tx" name="Tx (Upload)" stroke="#f59e0b" fill="#fef3c7" strokeWidth={2} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
