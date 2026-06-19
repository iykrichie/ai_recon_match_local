import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, BookOpen, CheckCircle2, Info, FileText, HelpCircle, Download, BarChart3 } from 'lucide-react';

interface DocumentationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DocumentationModal: React.FC<DocumentationModalProps> = ({ isOpen, onClose }) => {
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
            className="relative w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-black/5 bg-[#F8F9FA]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
                  <BookOpen className="text-white w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight">User Documentation</h2>
                  <p className="text-xs text-black/40 font-mono uppercase tracking-widest">AIMatch - AI Ledger Matching v1.2</p>
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
            <div className="flex-1 overflow-y-auto p-8 space-y-12">
              {/* Section: Overview */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-5 h-5 text-black" />
                  <h3 className="text-lg font-bold">Application Overview</h3>
                </div>
                <p className="text-sm text-black/60 leading-relaxed">
                  AIMatch - AI Ledger Matching is an enterprise-grade reconciliation engine designed for high-precision financial matching. 
                  It supports two primary modes of operation:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="p-4 bg-black/5 rounded-xl border border-black/5">
                    <h4 className="text-sm font-bold mb-2">Internal Ledger</h4>
                    <p className="text-xs text-black/60">Reconciles debits against credits within a single GL extract. Ideal for finding matching pairs in suspense accounts or inter-company transfers.</p>
                  </div>
                  <div className="p-4 bg-black/5 rounded-xl border border-black/5">
                    <h4 className="text-sm font-bold mb-2">Bank vs GL</h4>
                    <p className="text-xs text-black/60">Cross-reconciles entries between a Bank Statement and a General Ledger extract. Matches are identified across two separate data sources.</p>
                  </div>
                </div>
              </section>

              {/* Section: Output & Exporting */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Download className="w-5 h-5 text-black" />
                  <h3 className="text-lg font-bold">Output & Exporting</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold">Standardized Date Format</p>
                      <p className="text-xs text-black/60">All output files strictly adhere to the <strong>DD/MM/YYYY</strong> date format to ensure consistency across different regions and systems.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold">Granular Export Controls</p>
                      <p className="text-xs text-black/60">The application provides two separate export options:
                        <br />• <strong>Export Matched:</strong> Downloads a report of all successfully paired transactions.
                        <br />• <strong>Export Unmatched:</strong> Downloads a report of exceptions that require manual investigation.
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section: File Requirements */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-black" />
                  <h3 className="text-lg font-bold">File Requirements</h3>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold">Format: CSV Only</p>
                      <p className="text-xs text-black/60">The application strictly accepts Comma Separated Values (.csv) files. Excel files (.xlsx, .xls) must be saved as CSV before uploading.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-bold">Required Column Headings</p>
                      <p className="text-xs text-black/60 mb-2">The engine automatically detects columns based on common aliases. Ensure your CSV contains headers similar to:</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-mono border border-black/5">Date / Post Date</div>
                        <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-mono border border-black/5">Reference / Ref</div>
                        <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-mono border border-black/5">Details / Narration</div>
                        <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-mono border border-black/5">Debits / Withdrawal</div>
                        <div className="px-2 py-1 bg-black/5 rounded text-[10px] font-mono border border-black/5">Credits / Deposit</div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section: Matching Logic */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle2 className="w-5 h-5 text-black" />
                  <h3 className="text-lg font-bold">Matching Logic</h3>
                </div>
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Multi-Tier Matching Engine</p>
                  </div>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    AIMatch uses a sophisticated multi-tier approach to maximize match rates while maintaining high confidence. It handles exact matches, reversals, and complex batch relationships.
                  </p>
                </div>
                <ul className="mt-4 space-y-3">
                  <li className="text-xs text-black/60 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-black rounded-full mt-1 shrink-0" />
                    <div>
                      <strong>Exact 1-to-1 (100%):</strong> Highest priority. Matches exact transaction IDs, references, or policy numbers with identical amounts and narrations.
                    </div>
                  </li>
                  <li className="text-xs text-black/60 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-black rounded-full mt-1 shrink-0" />
                    <div>
                      <strong>Time Lag T-1 (95%):</strong> Matches transactions with identical amounts and narrations that occur within a 1-day window.
                    </div>
                  </li>
                  <li className="text-xs text-black/60 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-black rounded-full mt-1 shrink-0" />
                    <div>
                      <strong>Reversal Logic M-1 (90%):</strong> Identifies reversals and matches based on high narration similarity and identical amounts across different months.
                    </div>
                  </li>
                  <li className="text-xs text-black/60 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-black rounded-full mt-1 shrink-0" />
                    <div>
                      <strong>Bulk-to-Bits (85%):</strong> Advanced matching for complex relationships where amounts are identical but references may vary slightly.
                    </div>
                  </li>
                </ul>
              </section>

              {/* Section: AI Semantic Matching */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <span className="text-white text-[8px] font-bold">AI</span>
                  </div>
                  <h3 className="text-lg font-bold">AI Semantic Matching (Ollama)</h3>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl mb-4">
                  <p className="text-xs text-emerald-800 leading-relaxed">
                    <strong>Local AI — No Cloud Required.</strong> AIMatch uses <code className="bg-emerald-100 px-1 rounded">llama3.1:8b</code> running on your machine via <strong>Ollama</strong> for semantic narration understanding. No data leaves your device.
                  </p>
                </div>
                <ul className="space-y-3">
                  <li className="text-xs text-black/60 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1 shrink-0" />
                    <div>
                      <strong>When is AI used?</strong> Only when the "Run Smart Match (AI)" button is clicked after reconciliation. It analyses narration pairs that Fuzzball couldn't match with high confidence.
                    </div>
                  </li>
                  <li className="text-xs text-black/60 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1 shrink-0" />
                    <div>
                      <strong>What does it analyse?</strong> It strips legal suffixes (PLC, LTD) and decodes abbreviations (TRF, PREM) to determine if two narrations refer to the same financial entity.
                    </div>
                  </li>
                  <li className="text-xs text-black/60 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full mt-1 shrink-0" />
                    <div>
                      <strong>Confidence threshold:</strong> Pairs scoring above 75% confidence are promoted to "Matched" status.
                    </div>
                  </li>
                  <li className="text-xs text-black/60 flex items-start gap-2">
                    <div className="w-1.5 h-1.5 bg-amber-400 rounded-full mt-1 shrink-0" />
                    <div>
                      <strong>Status indicator:</strong> Check the header badge — <span className="text-emerald-600 font-bold">Ollama Online</span> (green) or <span className="text-red-500 font-bold">Ollama Offline</span> (red). When offline, fuzzball-only matching continues without interruption.
                    </div>
                  </li>
                </ul>
              </section>

              {/* Section: Performance Monitoring */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <BarChart3 className="w-5 h-5 text-black" />
                  <h3 className="text-lg font-bold">Performance & Value Tracking</h3>
                </div>
                <p className="text-sm text-black/60 leading-relaxed mb-4">
                  The application features a built-in <strong>Observability Dashboard</strong> (accessible via the "System Health" button) that provides real-time insights into the value generated by AIMatch.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <p className="text-sm font-bold text-indigo-900 mb-1">Efficiency Metrics</p>
                    <p className="text-xs text-indigo-700">Tracks exactly how many ledgers have been processed and the average accuracy rate across all sessions.</p>
                  </div>
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                    <p className="text-sm font-bold text-emerald-900 mb-1">Manual Effort Savings</p>
                    <p className="text-xs text-emerald-700">Calculates hours and days of manual effort saved based on a standard baseline of 60 seconds per matching pair.</p>
                  </div>
                </div>
              </section>

              {/* Section: Troubleshooting */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <HelpCircle className="w-5 h-5 text-black" />
                  <h3 className="text-lg font-bold">Troubleshooting</h3>
                </div>
                <div className="space-y-4">
                  <div className="p-4 border border-black/5 rounded-xl hover:bg-black/[0.02] transition-colors">
                    <p className="text-sm font-bold mb-1">"Missing Required Columns" Warning</p>
                    <p className="text-xs text-black/60">Check your CSV headers. Ensure they are on the first row and use standard naming (e.g., use 'Date' instead of 'T-Date').</p>
                  </div>
                  <div className="p-4 border border-black/5 rounded-xl hover:bg-black/[0.02] transition-colors">
                    <p className="text-sm font-bold mb-1">Incorrect Amount Parsing</p>
                    <p className="text-xs text-black/60">Ensure amounts do not contain currency symbols (₦, $) or special characters other than commas and dots. The engine handles standard accounting formats like (500.00) for negatives.</p>
                  </div>
                  <div className="p-4 border border-black/5 rounded-xl hover:bg-black/[0.02] transition-colors">
                    <p className="text-sm font-bold mb-1">Low Match Rate</p>
                    <p className="text-xs text-black/60">Verify that the 'Reference' column contains unique identifiers. If references are missing, the engine relies on narrations and dates, which may be less precise.</p>
                  </div>
                  <div className="p-4 border border-emerald-100 bg-emerald-50/50 rounded-xl">
                    <p className="text-sm font-bold mb-1 text-emerald-800">"Ollama Offline" / AI not working</p>
                    <p className="text-xs text-emerald-700">The app continues with Fuzzball-only matching — no action required. To enable AI: (1) Install Ollama from <strong>ollama.com</strong>, (2) run <code className="bg-emerald-100 px-1 rounded">ollama pull llama3.1:8b</code>, (3) run <code className="bg-emerald-100 px-1 rounded">ollama serve</code>, then reload the page.</p>
                  </div>
                </div>
              </section>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-black/5 bg-[#F8F9FA] flex justify-end">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-black/80 transition-all"
              >
                Got it, thanks
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default DocumentationModal;
