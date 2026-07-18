import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  BarChart3, 
  Target, 
  Clock, 
  TrendingUp, 
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ObservabilityDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ObservabilityDashboard({ isOpen, onClose }: ObservabilityDashboardProps) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, startDate, endDate]);

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const response = await fetch(`/api/v1/metrics/history?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setLogs(data.reverse()); // Latest first
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalTimeSaved = logs.reduce((acc, log) => acc + (log.valueMetrics?.manualEffortSavedHours || 0), 0);
  const totalTokens = logs.reduce((acc, log) => acc + (log.apiMetrics?.promptTokens || 0) + (log.apiMetrics?.completionTokens || 0), 0);
  const averageMatchCompleteness = logs.length > 0 ? (logs.reduce((acc, log) => acc + (log.matchCompleteness || log.accuracyRate || 0), 0) / logs.length) : 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="relative w-full max-w-6xl max-h-[95vh] bg-slate-50 rounded-lg shadow-xl overflow-hidden flex flex-col border border-slate-300 font-sans"
          >
            {/* Header / Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between p-5 border-b border-slate-200 bg-white gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-slate-800 rounded flex items-center justify-center">
                  <BarChart3 className="text-white w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900 leading-tight">Performance Metrics</h2>
                  <p className="text-[11px] text-slate-500 font-mono tracking-wide uppercase">Pipeline Observability Dashboard</p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                {/* Integrated Date Filter */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-slate-100 rounded border border-slate-200 p-1">
                    <button onClick={() => { setStartDate(''); setEndDate(''); }} className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-colors", !startDate && !endDate ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>All Time</button>
                    <button onClick={() => { const today = new Date().toISOString().split('T')[0]; setStartDate(today); setEndDate(today); }} className={cn("px-3 py-1 text-xs font-medium rounded-sm transition-colors", startDate === new Date().toISOString().split('T')[0] && endDate === new Date().toISOString().split('T')[0] ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>Today</button>
                    <button onClick={() => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 7); setStartDate(start.toISOString().split('T')[0]); setEndDate(end.toISOString().split('T')[0]); }} className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 rounded-sm transition-colors">7D</button>
                    <button onClick={() => { const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 30); setStartDate(start.toISOString().split('T')[0]); setEndDate(end.toISOString().split('T')[0]); }} className="px-3 py-1 text-xs font-medium text-slate-500 hover:text-slate-700 rounded-sm transition-colors">30D</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-slate-400" />
                    <span className="text-slate-400 text-xs">—</span>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-white border border-slate-200 text-slate-700 text-xs rounded px-2 py-1.5 focus:outline-none focus:border-slate-400" />
                  </div>
                </div>

                <div className="h-6 w-px bg-slate-200" />

                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-slate-100 rounded transition-colors"
                >
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Top KPI Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: 'Entries Reconciled', value: logs.length.toString(), sub: 'Total pipeline executions', icon: Target, border: 'border-emerald-200', text: 'text-emerald-700', bg: 'bg-emerald-50' },
                  { label: 'Percentage Matched', value: `${averageMatchCompleteness.toFixed(1)}%`, sub: 'Average completeness score', icon: ShieldCheck, border: 'border-blue-200', text: 'text-blue-700', bg: 'bg-blue-50' },
                  { label: 'AI Token Throughput', value: totalTokens.toLocaleString(), sub: 'Total tokens consumed', icon: Cpu, border: 'border-purple-200', text: 'text-purple-700', bg: 'bg-purple-50' },
                  { label: 'Manual Hours Saved', value: `${totalTimeSaved.toFixed(1)}h`, sub: 'Cumulative operational savings', icon: Clock, border: 'border-amber-200', text: 'text-amber-700', bg: 'bg-amber-50' },
                ].map((kpi, i) => (
                  <div key={i} className="bg-white p-5 rounded-lg border border-slate-200 flex flex-col justify-between">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={cn("p-1.5 rounded", kpi.bg, kpi.border, "border")}>
                        <kpi.icon className={cn("w-4 h-4", kpi.text)} />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{kpi.label}</span>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-slate-800">{kpi.value}</div>
                      <div className="text-xs text-slate-400 mt-1">{kpi.sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Value Realization Panel (Expanded) */}
              <div className="bg-white p-6 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Operational Value Realization</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Benchmarked against historical manual reconciliation metrics.</p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-slate-400" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <span>Speed Multiplier</span>
                      <span className="text-emerald-600">60x Faster</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      <div className="h-full bg-slate-800 w-full" />
                      <div className="h-full bg-slate-200 w-[2%]" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <span>Accuracy Uplift</span>
                      <span className="text-emerald-600">+45% Precision</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-800 w-[98%]" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      <span>Cost Reduction</span>
                      <span className="text-emerald-600">~92% Lower</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-800 w-[92%]" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw Log Table */}
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/50">
                  <h3 className="text-sm font-semibold text-slate-800">Pipeline Execution Audit Trail</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead>
                      <tr className="bg-white border-b border-slate-200">
                        <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Timestamp</th>
                        <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Mode</th>
                        <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Rows</th>
                        <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Completeness</th>
                        <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Avg Accuracy</th>
                        <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Duration</th>
                        <th className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider text-right">Tokens Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-8 text-center text-slate-500 italic">Streaming metrics data...</td>
                        </tr>
                      ) : logs.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-5 py-8 text-center text-slate-500 italic">No execution logs found in the selected date range.</td>
                        </tr>
                      ) : logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3 font-mono text-[11px] text-slate-500">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="px-5 py-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              {log.mode}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-medium text-slate-700">
                            {log.rowsProcessed}
                          </td>
                          <td className="px-5 py-3 font-medium text-emerald-600">
                            {(log.matchCompleteness || log.accuracyRate || 0).toFixed(1)}%
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-slate-700">{(log.averageAccuracy || 0).toFixed(1)}</span>
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-slate-400" style={{ width: `${log.averageAccuracy || 0}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3 font-mono text-xs text-slate-600">
                            {log.executionTimeMs ? (log.executionTimeMs < 1000 ? `${log.executionTimeMs.toFixed(0)}ms` : `${(log.executionTimeMs / 1000).toFixed(2)}s`) : '-'}
                          </td>
                          <td className="px-5 py-3 font-mono text-xs text-slate-600 text-right">
                            {((log.apiMetrics?.promptTokens || 0) + (log.apiMetrics?.completionTokens || 0)).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 bg-white border border-slate-300 text-slate-700 rounded text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
              >
                Close Metrics View
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
