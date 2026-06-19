import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { motion } from 'motion/react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  ArrowRightLeft,
  Loader2,
  Table as TableIcon,
  ChevronRight,
  Info,
  Percent,
  BookOpen,
  BarChart3
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import DocumentationModal from './components/DocumentationModal';
import ObservabilityDashboard from './components/ObservabilityDashboard';
import { ollamaService } from './services/ollamaService';
import { monitoringService } from './services/monitoringService';
import { ReconciliationEngine } from './reconciler';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [mode] = useState<'INTERNAL' | 'BANK_VS_GL'>('INTERNAL');
  const [fileA, setFileA] = useState<File | null>(null);
  const [fileB, setFileB] = useState<File | null>(null);
  const [statsA, setStatsA] = useState<{ rows: number, debits: number, credits: number, data: any[] } | null>(null);
  const [statsB, setStatsB] = useState<{ rows: number, debits: number, credits: number, data: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    let interval: any;
    if (loading) {
      setElapsedTime(0);
      interval = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [loading]);
  const [results, setResults] = useState<{ reconciled: any[], exceptions: any[] } | null>(null);
  const [activeTab, setActiveTab] = useState<'1-to-1' | 'Grouped' | 'Unmatched'>('1-to-1');
  const [error, setError] = useState<string | null>(null);
  const [isDocOpen, setIsDocOpen] = useState(false);
  const [isObsOpen, setIsObsOpen] = useState(false);
  const [isSmartMatching, setIsSmartMatching] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  // Probe Ollama availability on mount
  useEffect(() => {
    ollamaService.healthCheck().then(({ available }) => {
      setOllamaStatus(available ? 'online' : 'offline');
    });
  }, []);

  const fileInputARef = useRef<HTMLInputElement>(null);
  const fileInputBRef = useRef<HTMLInputElement>(null);

  const readFile = (file: File, callback: (stats: any) => void) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (ext !== 'csv' && ext !== 'xls' && ext !== 'xlsx') {
      setError('Only CSV and Excel files (.xls, .xlsx) are allowed.');
      return;
    }

    const processJson = (json: any[]) => {
      if (json.length === 0) {
        setError('The uploaded file appears to be empty.');
        return;
      }

      const firstRow = json[0];
      const keys = Object.keys(firstRow);
      const findKey = (aliases: string[]) =>
        keys.find(k => {
          const normalized = k.trim().toLowerCase();
          return aliases.some(a => a.toLowerCase() === normalized);
        });

      const dateKey = findKey(['date', 'post date', 'transaction date', 'value date', 'val date']);
      const refKey = findKey(['reference', 'ref', 'voucher', 'ref no', 'ref_no']);
      const detailKey = findKey(['details', 'detail', 'description', 'particulars', 'narration']);
      const debitKey = findKey(['debit', 'debits', 'dr amount', 'dr', 'withdrawal', 'paid out', 'bank amount', 'amount']);
      const creditKey = findKey(['credit', 'credits', 'cr amount', 'cr', 'deposit', 'paid in', 'lodgment', 'amount']);

      const missing = [];
      if (!dateKey) missing.push('Date');
      if (!refKey) missing.push('Reference');
      if (!detailKey) missing.push('Details');
      if (!debitKey) missing.push('Debits');
      if (!creditKey) missing.push('Credits');

      if (missing.length > 0) {
        console.warn(`Missing columns: ${missing.join(', ')}. The reconciliation might be incomplete.`);
      }

      let debits = 0;
      let credits = 0;

      const parseAccountingAmount = (val: any) => {
        if (typeof val === 'number') return val;
        const s = String(val || '').trim();
        if (s === '-' || s === '' || s === '0' || s === '0.00') return 0;
        const cleaned = s.replace(/[^0-9.]/g, '');
        const num = parseFloat(cleaned) || 0;
        if (s.includes('(') && s.includes(')')) return -num;
        if (s.startsWith('-') && !s.startsWith('_-')) return -num;
        return num;
      };

      json.forEach(row => {
        let d = 0;
        let c = 0;
        if (debitKey === creditKey && debitKey) {
          const amt = parseAccountingAmount(row[debitKey]);
          if (amt > 0) d = amt;
          else if (amt < 0) c = Math.abs(amt);
        } else {
          d = parseAccountingAmount(row[debitKey || '']);
          c = parseAccountingAmount(row[creditKey || '']);
        }
        if (Math.abs(d) > 0) debits++;
        if (Math.abs(c) > 0) credits++;
      });

      callback({ rows: json.length, debits, credits, data: json });
    };

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => processJson(results.data as any[]),
        error: (err) => {
          console.error('File read error:', err);
          setError('Failed to read file. Please ensure it is a valid CSV file.');
        }
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
          processJson(json);
        } catch (err) {
          console.error('Excel parse error:', err);
          setError('Failed to parse Excel file. Ensure it is not corrupted.');
        }
      };
      reader.readAsBinaryString(file);
    }
  };

  const handleFileA = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileA(file);
      setResults(null);
      setError(null);
      readFile(file, setStatsA);
    }
  };

  const handleFileB = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileB(file);
      setResults(null);
      setError(null);
      readFile(file, setStatsB);
    }
  };

  const processReconciliation = async () => {
    if (!statsA) return;
    if (mode === 'BANK_VS_GL' && !statsB) return;

    setLoading(true);
    setError(null);

    const runMainThread = () => {
      try {
        console.log('Running reconciliation on the main thread...');
        const engine = new ReconciliationEngine(statsA.data, statsB?.data || undefined);
        const results = engine.run();
        if (results.metrics) {
          results.metrics.apiMetrics = ollamaService.getUsageMetrics();
        }
        setResults(results);
        setLoading(false);
        monitoringService.logReconciliation(results);
      } catch (err: any) {
        console.error('Main thread reconciliation error:', err);
        setError(err?.message || 'Reconciliation failed on main thread.');
        setLoading(false);
      }
    };

    try {
      const worker = new Worker(new URL('./reconciler.worker.ts', import.meta.url), { type: 'module' });

      worker.onmessage = (e) => {
        const { type, results, error } = e.data;
        if (type === 'SUCCESS') {
          if (results.metrics) {
            results.metrics.apiMetrics = ollamaService.getUsageMetrics();
          }
          setResults(results);
          setLoading(false);
          // Ship metrics to observability pipeline
          monitoringService.logReconciliation(results);
        } else {
          console.error('Worker returned error. Falling back to main thread:', error);
          runMainThread();
        }
        worker.terminate();
      };

      worker.onerror = (err) => {
        console.error('Worker error. Falling back to main thread:', err);
        runMainThread();
        worker.terminate();
      };

      worker.postMessage({
        data: statsA.data,
        dataB: statsB?.data || null
      });
    } catch (workerInitError) {
      console.warn('Failed to initialize Worker. Running on main thread:', workerInitError);
      runMainThread();
    }
  };

  const runSmartMatch = async () => {
    if (!results) return;
    setIsSmartMatching(true);

    try {
      // Find unmatched items
      const unmatched = results.reconciled.filter(r =>
        (r['GL Match Type'] === 'U' || r['Statement Match Type'] === 'U' || r['Match Type'] === 'U' || r['Match Report - Match Type'] === 'U')
      );

      if (unmatched.length === 0) {
        alert("No unmatched items to analyze.");
        setIsSmartMatching(false);
        return;
      }

      // Group into potential pairs (this is a simplified heuristic for demo)
      // In a real app, we'd look for items with same amounts but different narrations
      const debits = unmatched.filter(u => (u['Debits - Amount'] > 0 || u['GL Amount'] > 0));
      const credits = unmatched.filter(u => (u['Credits - Amount'] > 0 || u['Statement Amount'] > 0));

      const potentialPairs: any[] = [];
      debits.forEach(d => {
        const dAmount = d['Debits - Amount'] || d['GL Amount'];
        const dDetails = d['Debits - Details'] || d['GL Details'];

        credits.forEach(c => {
          const cAmount = c['Credits - Amount'] || c['Statement Amount'];
          const cDetails = c['Credits - Details'] || c['Statement Details'];

          if (Math.abs(dAmount - cAmount) < 0.01) {
            potentialPairs.push({
              id: `${d['Match ID']}_${c['Match ID']}`,
              debit: d,
              credit: c,
              narrationA: dDetails,
              narrationB: cDetails
            });
          }
        });
      });

      if (potentialPairs.length === 0) {
        alert("No potential amount-based pairs found for AI analysis.");
        setIsSmartMatching(false);
        return;
      }

      // Take first 10 — llama3.1:8b processes them in a single batch call
      const pairsToAnalyze = potentialPairs.slice(0, 10);
      const aiResults = await ollamaService.batchAnalyze(pairsToAnalyze);

      // Update results with AI findings
      const updatedReconciled = [...results.reconciled];
      aiResults.forEach(aiRes => {
        if (aiRes.confidence > 75) {
          const pair = pairsToAnalyze.find(p => p.id === aiRes.id);
          if (pair) {
            // Find and update the rows in the results
            // This is a complex update in a real app, here we just mark them
            const dIdx = updatedReconciled.findIndex(r => r['Match ID'] === pair.debit['Match ID']);
            const cIdx = updatedReconciled.findIndex(r => r['Match ID'] === pair.credit['Match ID']);

            if (dIdx !== -1 && cIdx !== -1) {
              updatedReconciled[dIdx]['Remark'] = `AI Matched (${aiRes.confidence}%)`;
              updatedReconciled[dIdx]['Match Type'] = 'M';
              updatedReconciled[dIdx]['Confidence Score'] = aiRes.confidence.toString();

              // Remove the credit row if it was separate
              updatedReconciled.splice(cIdx, 1);
            }
          }
        }
      });

      const newResults = { ...results, reconciled: updatedReconciled };
      
      if (newResults.metrics) {
        newResults.metrics.apiMetrics = ollamaService.getUsageMetrics();
        monitoringService.logReconciliation(newResults);
      }

      setResults(newResults);
      alert(`AI Analysis complete. Found ${aiResults.filter(r => r.confidence > 75).length} new matches.`);
    } catch (err) {
      console.error("Smart Match Error:", err);
      alert("AI Analysis failed. Please ensure Ollama is running locally (ollama serve) and the llama3.1:8b model is pulled.");
    } finally {
      setIsSmartMatching(false);
    }
  };

  const downloadCsv = (data: any[], suffix: string) => {
    let prefix = "Reconciliation";
    if (fileA) {
      prefix = fileA.name.replace(/\.[^/.]+$/, "");
    }
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${prefix}_${suffix}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const export1to1Matched = () => {
    if (!results || !results.reconciled) return;
    const filtered = results.reconciled.filter(r => {
      const t = String(r['GL Match Type'] || r['Statement Match Type'] || r['Match Type'] || r['Match Report - Match Type'] || '');
      return t === '1-to-1' || t === 'M';
    });
    if (filtered.length === 0) {
      alert("No 1-to-1 matches to export.");
      return;
    }
    downloadCsv(filtered, "1-to-1_Matched");
  };

  const exportManyMatched = () => {
    if (!results || !results.reconciled) return;
    const filtered = results.reconciled.filter(r => {
      const t = String(r['GL Match Type'] || r['Statement Match Type'] || r['Match Type'] || r['Match Report - Match Type'] || '');
      return t.includes('to') && t !== '1-to-1';
    });
    if (filtered.length === 0) {
      alert("No Grouped matches to export.");
      return;
    }
    downloadCsv(filtered, "Group_Matched");
  };

  const exportUnmatched = () => {
    if (!results || !results.exceptions || results.exceptions.length === 0) return;
    downloadCsv(results.exceptions, "Unmatched_Report");
  };

  const reset = () => {
    setResults(null);
    setFileA(null);
    setFileB(null);
    setStatsA(null);
    setStatsB(null);
    setError(null);
    if (fileInputARef.current) fileInputARef.current.value = '';
    if (fileInputBRef.current) fileInputBRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1A1A1A] font-sans">
      {/* Header */}
      <header className="bg-white border-b border-black/5 py-6 px-8 sticky top-0 z-50 backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
              <ArrowRightLeft className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">AIMatch - AI Ledger Matching</h1>
              <p className="text-xs text-black/40 font-mono uppercase tracking-widest">Enterprise Reconciliation v1.1</p>
            </div>
          </div>
          <div className="flex items-center gap-4">

            {!results && (
              <div className="flex bg-black/5 p-1 rounded-lg">
                <div className="px-4 py-1.5 rounded-md text-xs font-bold bg-white shadow-sm text-black">
                  INTERNAL LEDGER
                </div>
              </div>
            )}
            {results && (
              <div className="flex items-center gap-2">
                <button
                  onClick={export1to1Matched}
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Export 1-to-1 Matched
                </button>
                <button
                  onClick={exportManyMatched}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-all shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Export Group Matched
                </button>
                {results.exceptions && results.exceptions.length > 0 && (
                  <button
                    onClick={exportUnmatched}
                    className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-amber-700 transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    Export Unmatched ({results.exceptions.length})
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        {!results ? (
          <div className="max-w-4xl mx-auto mt-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-black/5 shadow-sm p-12"
            >
              <div className="text-center mb-12">
                <div className="w-16 h-16 bg-[#F1F3F5] rounded-full flex items-center justify-center mx-auto mb-6">
                  <FileSpreadsheet className="w-8 h-8 text-black/20" />
                </div>
                <h2 className="text-2xl font-bold mb-2">
                  {mode === 'INTERNAL' ? 'Upload Ledger Dump' : 'Upload Bank & GL Files'}
                </h2>
                <p className="text-black/50 max-w-md mx-auto text-sm">
                  {mode === 'INTERNAL'
                    ? 'The engine will match Debits and Credits within a single ledger file.'
                    : 'The engine will match Bank Statement entries against your General Ledger records.'}
                </p>
              </div>

              <div className={cn("grid gap-6 mb-8", mode === 'BANK_VS_GL' ? "grid-cols-2" : "grid-cols-1")}>
                {/* File A */}
                <div className="space-y-4">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">
                    {mode === 'INTERNAL' ? 'LEDGER FILE' : 'BANK STATEMENT'}
                  </label>
                  <div
                    onClick={() => fileInputARef.current?.click()}
                    className={cn(
                      "border-2 border-dashed border-black/10 rounded-xl p-8 cursor-pointer transition-all hover:border-black/30 text-center",
                      fileA && "border-black/40 bg-black/5"
                    )}
                  >
                    <input type="file" ref={fileInputARef} onChange={handleFileA} accept=".csv, .xls, .xlsx" className="hidden" />
                    {fileA ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                        <span className="text-sm font-medium truncate max-w-full">{fileA.name}</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-6 h-6 text-black/20" />
                        <span className="text-xs font-medium text-black/40">Drop file or click</span>
                      </div>
                    )}
                  </div>
                  {statsA && (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-black/5 p-2 rounded-lg text-center">
                        <div className="text-[8px] font-bold text-black/40 uppercase">Rows</div>
                        <div className="text-xs font-bold">{statsA.rows}</div>
                      </div>
                      <div className="bg-emerald-50 p-2 rounded-lg text-center">
                        <div className="text-[8px] font-bold text-emerald-600/60 uppercase">Dr</div>
                        <div className="text-xs font-bold text-emerald-700">{statsA.debits}</div>
                      </div>
                      <div className="bg-blue-50 p-2 rounded-lg text-center">
                        <div className="text-[8px] font-bold text-blue-600/60 uppercase">Cr</div>
                        <div className="text-xs font-bold text-blue-700">{statsA.credits}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* File B (Only for Bank vs GL) */}
                {mode === 'BANK_VS_GL' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-black/40">GENERAL LEDGER</label>
                    <div
                      onClick={() => fileInputBRef.current?.click()}
                      className={cn(
                        "border-2 border-dashed border-black/10 rounded-xl p-8 cursor-pointer transition-all hover:border-black/30 text-center",
                        fileB && "border-black/40 bg-black/5"
                      )}
                    >
                      <input type="file" ref={fileInputBRef} onChange={handleFileB} accept=".csv, .xls, .xlsx" className="hidden" />
                      {fileB ? (
                        <div className="flex flex-col items-center gap-2">
                          <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                          <span className="text-sm font-medium truncate max-w-full">{fileB.name}</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="w-6 h-6 text-black/20" />
                          <span className="text-xs font-medium text-black/40">Drop file or click</span>
                        </div>
                      )}
                    </div>
                    {statsB && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-black/5 p-2 rounded-lg text-center">
                          <div className="text-[8px] font-bold text-black/40 uppercase">Rows</div>
                          <div className="text-xs font-bold">{statsB.rows}</div>
                        </div>
                        <div className="bg-emerald-50 p-2 rounded-lg text-center">
                          <div className="text-[8px] font-bold text-emerald-600/60 uppercase">Dr</div>
                          <div className="text-xs font-bold text-emerald-700">{statsB.debits}</div>
                        </div>
                        <div className="bg-blue-50 p-2 rounded-lg text-center">
                          <div className="text-[8px] font-bold text-blue-600/60 uppercase">Cr</div>
                          <div className="text-xs font-bold text-blue-700">{statsB.credits}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-lg text-sm mb-6">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <button
                disabled={!statsA || (mode === 'BANK_VS_GL' && !statsB) || loading}
                onClick={processReconciliation}
                className={cn(
                  "w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-3",
                  (!statsA || (mode === 'BANK_VS_GL' && !statsB) || loading)
                    ? "bg-black/5 text-black/20 cursor-not-allowed"
                    : "bg-black text-white hover:bg-black/90 shadow-lg shadow-black/10"
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Processing Algorithm...
                  </>
                ) : (
                  <>
                    Run Reconciliation
                    <ChevronRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </motion.div>

            {/* Info Section */}
            <div className="mt-12 grid grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-black/5">
                <h3 className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4 flex items-center gap-2">
                  <Info className="w-3 h-3" />
                  Matching Hierarchy
                </h3>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-center gap-2 text-black/60">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Exact 1-to-1 (100%)
                  </li>
                  <li className="flex items-center gap-2 text-black/60">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Time Lag T-1 (95%)
                  </li>
                  <li className="flex items-center gap-2 text-black/60">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
                    Reversal Logic M-1 (90%)
                  </li>
                  <li className="flex items-center gap-2 text-black/60">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Bulk-to-Bits (85%)
                  </li>
                </ul>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-black/5">
                <h3 className="text-xs font-mono uppercase tracking-widest text-black/40 mb-4 flex items-center gap-2">
                  <TableIcon className="w-3 h-3" />
                  Input Format
                </h3>
                <p className="text-sm text-black/60 leading-relaxed">
                  Expected headers: <code className="bg-black/5 px-1 rounded">Date</code>, <code className="bg-black/5 px-1 rounded">Reference</code>, <code className="bg-black/5 px-1 rounded">Details</code>, <code className="bg-black/5 px-1 rounded">Debits</code>, <code className="bg-black/5 px-1 rounded">Credits</code>.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            {/* Stats */}
            <div className="grid grid-cols-3 gap-6">
              {[
                { label: 'Total GL Entries', value: statsA?.rows || 0, icon: FileSpreadsheet, color: 'text-black' },
                {
                  label: 'Matched Entries',
                  value: (statsA?.rows || 0) - (results.exceptions?.length || 0),
                  icon: CheckCircle2,
                  color: 'text-emerald-500'
                },
                {
                  label: 'Percentage Match',
                  value: `${(((statsA?.rows || 0) - (results.exceptions?.length || 0)) / (statsA?.rows || 1) * 100).toFixed(1)}%`,
                  icon: Percent,
                  color: 'text-blue-500'
                },
              ].map((stat, i) => (
                <div key={i} className="bg-white p-6 rounded-2xl border border-black/5 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono uppercase tracking-widest text-black/40">{stat.label}</span>
                    <stat.icon className={cn("w-5 h-5", stat.color)} />
                  </div>
                  <div className="text-2xl font-bold truncate">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Results Table Preview */}
            <div className="bg-white rounded-2xl border border-black/5 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-black/5 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                  <h3 className="font-bold">Reconciled Pairs Preview</h3>
                  <button
                    onClick={runSmartMatch}
                    disabled={isSmartMatching}
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border transition-all flex items-center gap-2",
                      isSmartMatching
                        ? "bg-black/5 text-black/20 border-black/5 cursor-not-allowed"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                    )}
                  >
                    {isSmartMatching ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        Run Smart Match (AI)
                      </>
                    )}
                  </button>
                </div>
                <span className="text-xs text-black/40">Showing first 10 entries</span>
              </div>
              <div className="px-6 py-2 border-b border-black/5 flex gap-4 bg-[#F8F9FA]">
                <button 
                  onClick={() => setActiveTab('1-to-1')}
                  className={cn("text-xs font-bold px-3 py-1.5 rounded-lg transition-all", activeTab === '1-to-1' ? "bg-white shadow-sm text-black" : "text-black/40 hover:text-black")}
                >
                  1-to-1 Matched
                </button>
                <button 
                  onClick={() => setActiveTab('Grouped')}
                  className={cn("text-xs font-bold px-3 py-1.5 rounded-lg transition-all", activeTab === 'Grouped' ? "bg-white shadow-sm text-black" : "text-black/40 hover:text-black")}
                >
                  Grouped Matched
                </button>
                <button 
                  onClick={() => setActiveTab('Unmatched')}
                  className={cn("text-xs font-bold px-3 py-1.5 rounded-lg transition-all", activeTab === 'Unmatched' ? "bg-white shadow-sm text-black" : "text-black/40 hover:text-black")}
                >
                  Unmatched
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#F8F9FA] border-b border-black/5">
                      {activeTab === 'Unmatched' ? (
                        <>
                          <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-black/40">Date</th>
                          <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-black/40">Reference</th>
                          <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-black/40">Details</th>
                          <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-black/40">Debits</th>
                          <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-black/40">Credits</th>
                        </>
                      ) : (
                        <>
                          <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-black/40">Match ID</th>
                          <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-black/40">{mode === 'INTERNAL' ? 'Debit Details' : 'GL Details'}</th>
                          <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-black/40">{mode === 'INTERNAL' ? 'Debit Amount' : 'GL Amount'}</th>
                          <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-black/40">{mode === 'INTERNAL' ? 'Credit Details' : 'Stmt Details'}</th>
                          <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-black/40">{mode === 'INTERNAL' ? 'Credit Amount' : 'Stmt Amount'}</th>
                          <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-black/40">Type</th>
                          <th className="px-6 py-3 text-[10px] font-mono uppercase tracking-widest text-black/40">Remark</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {(() => {
                      let displayData: any[] = [];
                      if (activeTab === '1-to-1') {
                        displayData = results.reconciled.filter(r => {
                          const t = String(r['GL Match Type'] || r['Statement Match Type'] || r['Match Type'] || r['Match Report - Match Type'] || '');
                          return t === '1-to-1' || t === 'M';
                        });
                      } else if (activeTab === 'Grouped') {
                        displayData = results.reconciled.filter(r => {
                          const t = String(r['GL Match Type'] || r['Statement Match Type'] || r['Match Type'] || r['Match Report - Match Type'] || '');
                          return t.includes('to') && t !== '1-to-1';
                        });
                      } else {
                        displayData = results.exceptions;
                      }

                      if (displayData.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="px-6 py-8 text-center text-black/40 text-sm italic">
                              No {activeTab} entries found.
                            </td>
                          </tr>
                        );
                      }

                      return displayData.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-black/[0.02] transition-colors">
                          {activeTab === 'Unmatched' ? (
                            <>
                              <td className="px-6 py-4 text-xs font-mono text-black/60 truncate max-w-[100px]">{row['Date']}</td>
                              <td className="px-6 py-4 text-sm font-medium truncate max-w-[150px]">{row['Reference']}</td>
                              <td className="px-6 py-4 text-sm font-medium truncate max-w-[300px]">{row['Details']}</td>
                              <td className="px-6 py-4 text-sm font-mono text-emerald-600">{row['Debits'] > 0 ? row['Debits'] : ''}</td>
                              <td className="px-6 py-4 text-sm font-mono text-blue-600">{row['Credits'] > 0 ? row['Credits'] : ''}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-6 py-4 text-xs font-mono text-black/60 truncate max-w-[100px]">{row['Match ID']}</td>
                              <td className="px-6 py-4 text-sm font-medium truncate max-w-[200px]">
                                {mode === 'INTERNAL' ? row['Debits - Details'] : row['GL Details']}
                              </td>
                              <td className="px-6 py-4 text-sm font-mono text-emerald-600">
                                {mode === 'INTERNAL' ? row['Debits - Amount'] : row['GL Amount']}
                              </td>
                              <td className="px-6 py-4 text-sm font-medium truncate max-w-[200px]">
                                {mode === 'INTERNAL' ? row['Credits - Details'] : row['Statement Details']}
                              </td>
                              <td className="px-6 py-4 text-sm font-mono text-blue-600">
                                {mode === 'INTERNAL' ? row['Credits - Amount'] : row['Statement Amount']}
                              </td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tighter",
                                  (row['GL Match Type'] === 'M' || row['Match Type'] === 'M') ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                )}>
                                  {row['GL Match Type'] || row['Statement Match Type'] || row['Match Type'] || row['Match Report - Match Type']}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-[10px] font-medium text-black/60 italic">
                                {row['GL Remark'] || row['Statement Remark'] || row['Remark'] || row['Credits - Remark']}
                              </td>
                            </>
                          )}
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              <div className="p-6 bg-[#F8F9FA] border-t border-black/5 text-center">
                <button
                  onClick={reset}
                  className="text-sm font-medium text-black/40 hover:text-black transition-colors"
                >
                  Clear and Process New File
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto py-8 px-8 border-t border-black/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsDocOpen(true)}
            className="flex items-center gap-2 text-black/40 hover:text-black text-xs font-bold transition-all"
          >
            <BookOpen className="w-4 h-4" />
            GUIDE
          </button>
          {/* Ollama Status Badge */}
          <div className={cn(
            "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1.5 rounded-lg border",
            ollamaStatus === 'online'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : ollamaStatus === 'offline'
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-black/5 text-black/40 border-black/10'
          )}>
            <div className={cn(
              "w-1.5 h-1.5 rounded-full",
              ollamaStatus === 'online' ? 'bg-emerald-500 animate-pulse' :
                ollamaStatus === 'offline' ? 'bg-red-500' : 'bg-black/20 animate-pulse'
            )} />
            {ollamaStatus === 'online' ? 'Ollama Online' :
              ollamaStatus === 'offline' ? 'Ollama Offline' : 'Checking...'}
          </div>
          <button
            onClick={() => setIsObsOpen(true)}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 text-xs font-bold transition-all px-3 py-1.5 bg-indigo-50 rounded-lg border border-indigo-100"
          >
            <BarChart3 className="w-4 h-4" />
            SYSTEM HEALTH
          </button>
        </div>
      </footer>

      {loading && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-8 text-center">
          <div className="w-24 h-24 mb-8 relative">
            <div className="absolute inset-0 border-4 border-black/5 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
          </div>
          <h2 className="text-2xl font-bold mb-2">Reconciling Data...</h2>
          <p className="text-black/60 max-w-md">
            Our multi-tier engine is analyzing references, narrations, and batch sums.
            Large datasets may take a few minutes.
          </p>
          <div className="mt-6 font-mono text-sm bg-black/5 px-4 py-2 rounded-lg">
            Elapsed Time: {Math.floor(elapsedTime / 60)}:{(elapsedTime % 60).toString().padStart(2, '0')}
          </div>
        </div>
      )}

      <DocumentationModal
        isOpen={isDocOpen}
        onClose={() => setIsDocOpen(false)}
      />
      <ObservabilityDashboard
        isOpen={isObsOpen}
        onClose={() => setIsObsOpen(false)}
      />
    </div>
  );
}
