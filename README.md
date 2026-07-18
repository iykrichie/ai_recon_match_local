# AIMatch

**AIMatch** is a high-performance, full-stack reconciliation engine. It automates the complex process of matching financial records, supporting both internal ledger offsets and side-by-side Bank vs. General Ledger (GL) reconciliation.

---

## 🚀 Features

### 1. Dual Reconciliation Modes
- **Internal Ledger Match:** Automatically identifies offsetting debits and credits within a single ledger file.
- **Bank vs GL Match:** Performs a comprehensive comparison between a Bank Statement and a General Ledger extract.

### 2. Two-Phase Matching Architecture

The engine executes a strict, sequential two-phase workflow:

#### Phase 1 — One-to-One Matching (Immutable Core)
- **Strict 1-to-1 Matching:** Enforces identical amounts on both credit and debit sides for maximum financial integrity.
- **Identity Enforcement:**
  - **Narration Threshold (85%):** Transactions are only matched if the extracted names/identities are at least 85% similar (Fuzzball `token_set_ratio`) — preventing mismatches between different individuals who share the same transaction amount.
  - **Pattern Extraction:** Automatically extracts core identity details following `CORONATION.../` and transaction IDs like `R260201_230203_3`.
- **Advanced Narration Cleaning:**
  - Strips ubiquitous noise words: `PLC`, `LIMITED`, `LTD`, `INSURANCE`, `CORONATION`.
  - Removes common transaction codes: `NIP`, `TRF`, `PAY`, `VAL`, etc.
  - Efficiently isolates the core entity name for precise fuzzy matching.
- **Date Window (90 days):** Candidates must fall within a 90-day window for consideration.
- **Reference Matching:** Automatic extraction and comparison of structured reference patterns (`R######_######_#`, `Wapx-#########`, NIP refs, etc.).
- **Chronological Priority:** Matches are processed in date order to respect transaction sequencing.
- **Background Processing:** Utilises Web Workers to process large datasets without freezing the UI.

#### Phase 2 — High-Precision Aggregation Matching
Operates **only** on transactions left unmatched after Phase 1. Finds Many-to-One and One-to-Many combinations where multiple smaller entries sum exactly to a single larger entry.

- **Zero-Tolerance Sum Validation:** The subset must sum to the target amount with zero tolerance (< 0.01 variance).
- **Dual-Layer AND Gate:** Every candidate group must pass **both**:
  - **Semantic Validation:** Narration similarity ≥ 70% (Fuzzball `token_set_ratio`).
  - **Structural Validation:** Reference alignment via substring containment, fuzzy match (≥ 80%), or details-column cross-reference.
- **Circuit Breaker:** Backtracking is capped at 50,000 iterations per target to prevent CPU stalls.
- **Subset Depth Limit:** Maximum 15 entries per aggregation group.
- **Mathematical Pre-Screening:** If all candidates combined cannot reach the target sum, the group is skipped entirely.

### 3. AI-Powered Semantic Matching (`llama3.1:8b` via Ollama)
- **Local AI — No Cloud Required:** Uses `llama3.1:8b` running on a local [Ollama](https://ollama.com) instance. No API keys, no external calls, complete data privacy.
- **Semantic Narration Matching:** When Fuzzball string similarity falls below the 85% threshold, the engine calls the local LLM to determine if two narrations refer to the same financial entity (e.g., "HEIRS LIFE ASSURANCE PLC" → "HEIRS LIFE").
- **Nigerian Finance Tuned:** System prompt is explicitly tuned for Nigerian banking and insurance narrations — handles `TRF`, `PREM`, policy numbers, `R######_######_#` transaction IDs, and legal suffix stripping.
- **Graceful Fallback:** If Ollama is not running, the app seamlessly continues with Fuzzball-only matching. A live status badge ("Ollama Online" / "Ollama Offline") in the header shows current AI availability.
- **`format:"json"` Enforced:** All requests to `llama3.1:8b` include `"format":"json"` to guarantee machine-parseable output.
- **Token Tracking:** Every API call captures `prompt_eval_count` and `eval_count` from Ollama responses for real-time observability.

### 4. Enterprise Reporting & Guidance
- **Multi-Format Upload:** Accepts CSV (`.csv`), Excel (`.xls`, `.xlsx`) files.
- **Tabbed Results View:** Results are organized into three tabs:
  - **1-to-1 Matches:** Direct debit-credit pairs from Phase 1.
  - **Grouped Matches:** Many-to-One and One-to-Many aggregation matches from Phase 2.
  - **Unmatched / Exceptions:** Transactions that could not be reconciled.
- **Triple Export Options:** Separate buttons to export "1-to-1 Matched", "Group Matched", and "Unmatched" results as CSV files.
- **Standardized Date Format:** All output dates are consistently formatted as `DD/MM/YYYY`.
- **Audit Ready:** Every match is assigned a unique `Match ID` (UUID) for easy tracking and auditing.
- **Integrated Documentation:** Built-in user guidance and troubleshooting accessible directly within the app.

### 5. Observability & Reliability Metrics
- **Match Completeness:** The percentage of total rows that were successfully reconciled (physical coverage).
- **Average Accuracy:** The mathematical mean of similarity/confidence scores across all matched pairs (precision).
- **API Call Tracking:** Total Ollama `/api/generate` invocations during the session.
- **Token Consumption:** Real-time tracking of prompt tokens and completion tokens consumed by the LLM.
- **Value Realization:** Automated ROI calculations comparing engine speed vs. manual effort baselines.
- **Audit Trail:** Full JSON-backed execution history with per-run breakdowns.

---

## 🛠 Tech Stack

- **Frontend:** React 19, Vite 7, Tailwind CSS 4, Lucide React, Motion (Framer Motion).
- **Backend:** Node.js, Express 5, TSX (TypeScript Execution).
- **Data Processing:** PapaParse (CSV parsing), SheetJS/xlsx (Excel parsing), Fuzzball (String similarity), UUID, Web Workers (Background processing).
- **AI Integration:** [Ollama](https://ollama.com) — local `llama3.1:8b` for semantic narration matching. *(No cloud dependency — runs entirely on your hardware.)*

---

## 👨‍💻 Local Developer Guide

### Prerequisites
- **Node.js:** v18.x or higher.
- **npm:** v9.x or higher.
- **Ollama:** Installed and running locally. See [https://ollama.com](https://ollama.com).
- **llama3.1:8b model:** Pulled via `ollama pull llama3.1:8b`.

### Getting Started

1. **Clone the repository** and navigate to the project root.

2. **Install Dependencies:**
   ```bash
   npm install
   ```

3. **Pull the AI model** (one-time, ~4.7 GB download):
   ```bash
   ollama pull llama3.1:8b
   ```

4. **Start Ollama** (if not already running as a system service):
   ```bash
   ollama serve
   ```

5. **Set Environment Variables:**
   Copy the example file and adjust if needed:
   ```bash
   cp .env.example .env
   ```
   The defaults work out of the box for a standard local Ollama install:
   ```env
   OLLAMA_HOST=http://localhost:11434
   OLLAMA_MODEL=llama3.1:8b
   OLLAMA_TIMEOUT=60000
   ```

6. **Run Development Server:**
   ```bash
   npm run dev
   ```
   The app runs on `http://localhost:3000`. The Ollama status badge in the header confirms AI connectivity.

### Project Structure
```
├── server.ts                        # Express entry point — serves frontend + API
├── src/
│   ├── App.tsx                      # Main dashboard UI + file uploads + tabbed results
│   ├── reconciler.ts                # Core ReconciliationEngine class (Phase 1 + Phase 2)
│   ├── reconciler.worker.ts         # Web Worker wrapper (background processing)
│   ├── types.ts                     # Shared TypeScript interfaces (Transaction, MatchResult, ReconciliationOutput)
│   └── services/
│       ├── ollamaService.ts         # ✅ PRIMARY — Ollama llama3.1:8b integration + token tracking
│       └── monitoringService.ts     # Observability & metrics shipping to /api/v1/metrics
└── src/components/
    ├── DocumentationModal.tsx       # In-app user guide
    └── PerformanceDashboard.tsx   # Real-time performance dashboard (5 KPI cards + audit trail)
```

### Key Data Types (`src/types.ts`)

```typescript
interface ReconciliationOutput {
  reconciled: any[];
  exceptions: any[];
  metrics?: {
    rowsProcessed: number;
    matchedCount: number;
    exceptionCount: number;
    executionTimeMs: number;
    matchCompleteness: number;   // (matchedCount / totalRows) * 100
    averageAccuracy: number;     // Mean confidence score across all matches
    mode: string;                // 'INTERNAL' | 'BANK_VS_GL'
    timestamp: string;
    apiMetrics?: {
      apiCalls: number;          // Total Ollama generate calls
      promptTokens: number;      // Total prompt tokens consumed
      completionTokens: number;  // Total completion tokens generated
    };
  };
}
```

### Key Development Commands
- `npm run dev` — Start development server (port 3000).
- `npm run lint` — Run ESLint for code quality.
- `npm run build` — Compile frontend for production.
- `npm start` — Start production server.

---

## 🧪 Tester Guide

### Test Scenarios

#### 1. Internal Ledger Reconciliation
- **Input:** A single CSV or Excel file containing both debits and credits.
- **Expected (Phase 1):** The engine pairs debits with credits of the same amount using a strict 1-to-1 constraint with 85% narration threshold.
- **Expected (Phase 2):** Remaining unmatched entries are checked for aggregation combinations (M-to-1 / 1-to-M) with zero-tolerance sum validation and AND-gate semantic+structural checks.

#### 2. Bank vs GL Reconciliation
- **Input:** Two CSV or Excel files (Bank Statement + GL Extract).
- **Expected:** The engine matches entries across files based on amount, date window (90 days), and narration similarity (85%).

#### 3. AI Semantic Matching (`Run Smart Match`)
- **Trigger:** Click "Run Smart Match (AI)" on the results screen.
- **Expected (Ollama Online):** Narration pairs below the 85% fuzzball threshold are submitted to `llama3.1:8b` for semantic analysis. Matches above 75% confidence are promoted.
- **Expected (Ollama Offline):** Button completes with 0 new matches; the header badge shows "Ollama Offline". No error, no crash.

#### 4. Tabbed Results Navigation
- **Trigger:** After reconciliation completes, click through the "1-to-1", "Grouped", and "Unmatched" tabs.
- **Expected:** Each tab correctly filters and displays only the relevant match type.

### Data Requirements
The engine accepts **CSV** and **Excel** (`.xls`, `.xlsx`) files. Preferred headers (or similar aliases):
- `Date`, `Reference`, `Details`, `Debits`, `Credits`.

### Verification Steps
1. **Upload Files:** Ensure "Rows", "Dr", and "Cr" counts update correctly (CSV and Excel).
2. **Check Ollama Badge:** Confirm "Ollama Online" (green) or "Ollama Offline" (red) in the header.
3. **Run Process:** Monitor "Elapsed Time"; reconciliation runs in a Web Worker.
4. **Verify Metrics:** Check "Match Completeness" and "Average Accuracy" in the results stats.
5. **Tab Navigation:** Verify 1-to-1, Grouped, and Unmatched tabs display correctly.
6. **CSV Export:** Verify reports use `DD/MM/YYYY` date format and include `Match ID`.
7. **Performance Dashboard:** Open the dashboard and confirm all 5 KPI cards render (Match Completeness, Avg. Accuracy, Time Saved, API Calls, Tokens Consumed).

---

## 🏗 Deployment Guide

### Build & Deployment
The application is optimized for **local/on-premise** deployment given its dependency on a local Ollama instance.

> ⚠️ **Cloud Deployment Note:** Because `llama3.1:8b` runs locally via Ollama, cloud platforms like Vercel (serverless) are **not compatible** without co-deploying an Ollama instance. Use a VM-based deployment (e.g., a dedicated Linux VM or Docker Compose) instead.

1. **Build for Production:**
   ```bash
   npm run build
   ```
   This generates static assets in the `dist/` directory.

2. **Start Production Server:**
   ```bash
   npm start
   ```

### Production Environment Configuration
- **Port:** The application binds to port `3000`.
- **Host:** The server listens on `0.0.0.0`.
- **NODE_ENV:** Set to `production`.
- **Ollama:** Must be running on the same machine or accessible via `OLLAMA_HOST`.

Required environment variables:
```env
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_TIMEOUT=60000
```

### Resource Allocation
- **Memory:** Minimum 1 GB RAM for the Node.js app. `llama3.1:8b` requires an additional ~5–6 GB RAM (or VRAM for GPU acceleration).
- **Timeout:** Ollama responses on CPU typically take 3–15 s. Ensure the load balancer timeout is at least 300 s for large Smart Match batches.
- **HP ZBook Firefly G9:** Fully supported; `llama3.1:8b` runs comfortably on CPU.

---

## 🛠 Troubleshooting

### "Ollama Offline" badge / AI matching not working
The app runs fine without Ollama — it silently falls back to Fuzzball-only matching.

**To enable AI matching:**
1. Install Ollama: `https://ollama.com/download`
2. Pull the model: `ollama pull llama3.1:8b`
3. Start the server: `ollama serve`
4. Verify: `curl http://localhost:11434/api/tags`
5. Reload the app — the badge should turn green.

### `sh: 1: tsx: not found`
```bash
npm install          # installs tsx as a local dep
# or
npx tsx server.ts
```

### `EADDRINUSE: address already in use :::3000`
```bash
fuser -k 3000/tcp    # Linux
```

### Ollama model not responding / very slow
- Ensure `llama3.1:8b` is fully downloaded: `ollama list`
- On CPU-only machines, first inference after cold start takes ~10–30 s. Subsequent calls are faster.
- Increase `OLLAMA_TIMEOUT` in `.env` if requests abort early.

---

### ✍️ Authorship & Credits
* **Built By:** Ikechukwu Mbaliri ([iyk.richie@yahoo.com](mailto:iyk.richie@yahoo.com))
* **Technology Stack:** Powered by [Ollama](https://ollama.com) + `llama3.1:8b`
