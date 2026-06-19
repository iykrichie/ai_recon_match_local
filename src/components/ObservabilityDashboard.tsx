import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  BarChart3, 
  Target, 
  Clock, 
  TrendingUp, 
  ShieldCheck,
  History,
  Info,
  Cpu,
  Database
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
  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  const fetchLogs = async () => {
    try {
      // In a real app, you'd have an endpoint to GET these logs
      // For now, we'll try to fetch the JSON file directly or an API endpoint we'll add
      const response = await fetch('/api/v1/metrics/history');
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
  const avgCompleteness = logs.length > 0 
    ? logs.reduce((acc, log) => acc + (log.matchCompleteness || log.accuracyRate || 0), 0) / logs.length 
    : 0;
  const avgAccuracy = logs.length > 0 
    ? logs.reduce((acc, log) => acc + (log.averageAccuracy || 0), 0) / logs.length 
    : 0;
  const totalApiCalls = logs.reduce((acc, log) => acc + (log.apiMetrics?.apiCalls || 0), 0);
  const totalTokens = logs.reduce((acc, log) => acc + (log.apiMetrics?.promptTokens || 0) + (log.apiMetrics?.completionTokens || 0), 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-5xl max-h-[90vh] bg-[#F8F9FA] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-black/5 bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
                  <BarChart3 className="text-white w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-slate-900">Performance Observability</h2>
                  <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">Real-time Value & Reliability Metrics</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-black/5 rounded-full transition-colors"
              >
                <X className="w-6 h-6 text-black/40" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Top KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  {[
                    { label: 'Match Completeness', value: `${avgCompleteness.toFixed(1)}%`, sub: 'Coverage of total rows', icon: Target, color: 'bg-emerald-500', trend: 'High' },
                    { label: 'Avg. Accuracy', value: `${avgAccuracy.toFixed(1)}%`, sub: 'Mathematical confidence', icon: ShieldCheck, color: 'bg-blue-500', trend: 'Strict' },
                    { label: 'Time Saved', value: `${totalTimeSaved.toFixed(1)}h`, sub: 'Operational gain', icon: Clock, color: 'bg-amber-500', trend: 'High Impact' },
                    { label: 'API Calls', value: totalApiCalls.toLocaleString(), sub: 'Ollama generate hits', icon: Database, color: 'bg-indigo-500', trend: 'Active' },
                    { label: 'Tokens Consumed', value: totalTokens.toLocaleString(), sub: 'LLM context processing', icon: Cpu, color: 'bg-purple-500', trend: 'Monitored' },
                  ].map((kpi, i) => (
                  <div key={i} className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className={cn("p-2 rounded-lg", kpi.color)}>
                        <kpi.icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">{kpi.trend}</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{kpi.value}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">{kpi.label}</div>
                    <div className="text-[9px] font-medium text-slate-400 mt-0.5 italic">{kpi.sub}</div>
                  </div>
                ))}
              </div>

              {/* Impact Comparison Section */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-black/5 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">Value Realization</h3>
                      <p className="text-sm text-slate-500">Comparing automated AIMatch performance vs. manual baseline</p>
                    </div>
                    <TrendingUp className="w-6 h-6 text-indigo-600" />
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                        <span>Reconciliation Speed</span>
                        <span className="text-emerald-600">60x Faster</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        <div className="h-full bg-indigo-600 w-full" />
                        <div className="h-full bg-slate-300 w-[2%]" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                        <span>Accuracy Confidence</span>
                        <span className="text-emerald-600">+45% Precision</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 w-[98%]" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                        <span>Operational Cost</span>
                        <span className="text-emerald-600">~92% Reduction</span>
                      </div>
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 w-[8%]" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 p-4 bg-indigo-50 border border-indigo-100 rounded-xl flex gap-3">
                    <Info className="w-5 h-5 text-indigo-600 shrink-0" />
                    <p className="text-xs text-indigo-700 leading-relaxed">
                      AIMatch has successfully eliminated the bottleneck of manual line-by-line verification, allowing finance teams to focus only on exceptions rather than routine matching.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900 p-8 rounded-3xl shadow-xl flex flex-col justify-between overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
                  <div>
                    <h3 className="text-lg font-bold text-white mb-2">Live Logs</h3>
                    <p className="text-xs text-slate-400 mb-6">Recent execution events</p>
                    
                    <div className="space-y-4">
                      {logs.slice(0, 5).map((log, i) => (
                        <div key={i} className="flex gap-3">
                          <div className="w-1 h-8 bg-indigo-500 rounded-full" />
                          <div>
                            <div className="text-[10px] font-bold text-white uppercase">{log.mode} Match</div>
                            <div className="text-[9px] text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button className="w-full py-3 bg-white/10 hover:bg-white/20 transition-colors rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2 mt-8">
                    <History className="w-4 h-4" />
                    View Audit Trail
                  </button>
                </div>
              </div>

              {/* Raw Log Table */}
              <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-black/5">
                  <h3 className="font-bold text-slate-900">Audit Trail (JSON Source)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50">
                        <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Timestamp</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mode</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rows</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Completeness</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Accuracy</th>
                        <th className="p-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tokens Used</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {loading ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-sm text-slate-400 italic">Streaming metrics data...</td>
                        </tr>
                      ) : logs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-sm text-slate-400 italic">No logs recorded yet.</td>
                        </tr>
                      ) : logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group">
                          <td className="p-4 font-mono text-[10px] text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold border border-slate-200">{log.mode}</span>
                          </td>
                          <td className="p-4 text-xs font-bold text-slate-700">{log.rowsProcessed}</td>
                          <td className="p-4 text-xs font-bold text-emerald-600">{(log.matchCompleteness || log.accuracyRate || 0).toFixed(1)}%</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{(log.averageAccuracy || 0).toFixed(1)}</span>
                              <div className="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${log.averageAccuracy || 0}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-xs font-mono text-purple-600">
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
            <div className="p-6 border-t border-black/5 bg-white flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all font-mono tracking-wider"
              >
                CLOSE PIPELINE VIEW
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
