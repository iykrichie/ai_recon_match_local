# Ollama + llama3.1:8b Local AI Setup Guide

## Overview
This guide walks you through configuring the **local Ollama AI integration** for AIMatch.

The application uses `llama3.1:8b` hosted locally via [Ollama](https://ollama.com) for semantic narration matching. No API keys, no cloud calls, no data leaves your machine.

> **Graceful Degradation:** If Ollama is not running, AIMatch continues to work using Fuzzball string matching only. The "Ollama Offline" badge in the header indicates this state.

---

## Prerequisites
1. A machine running Linux, macOS, or Windows (WSL2).
2. ~5–6 GB of free RAM (or VRAM for GPU acceleration).
3. ~5 GB of free disk space for the model weights.

---

## Step-by-Step Setup

### 1. Install Ollama
Visit [https://ollama.com/download](https://ollama.com/download) and follow the instructions for your OS.

**Linux (one-liner):**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

**Verify installation:**
```bash
ollama --version
```

---

### 2. Pull the `llama3.1:8b` Model
This is a one-time download (~4.7 GB):
```bash
ollama pull llama3.1:8b
```

Verify it's available:
```bash
ollama list
# Expected output:
# NAME            ID              SIZE    MODIFIED
# llama3.1:8b     ...             4.7 GB  ...
```

---

### 3. Start the Ollama Server
```bash
ollama serve
```

Ollama listens on `http://localhost:11434` by default.

> **Tip:** On Linux, Ollama can be configured as a `systemd` service to start automatically on boot. See the Ollama documentation for details.

**Verify the server is running:**
```bash
curl http://localhost:11434/api/tags
# Expected: JSON listing available models
```

---

### 4. Configure the Application

Copy the example environment file:
```bash
cp .env.example .env
```

The default values work for a standard local Ollama install:
```env
# Ollama Configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
OLLAMA_VISION_MODEL=minicpm-v   # Optional — future OCR use
OLLAMA_TIMEOUT=60000             # Milliseconds

# Vite frontend variables (same values, VITE_ prefix required)
VITE_OLLAMA_HOST=http://localhost:11434
VITE_OLLAMA_MODEL=llama3.1:8b
VITE_OLLAMA_TIMEOUT=60000

APP_URL=http://localhost:3000
```

---

### 5. Start AIMatch
```bash
npm run dev
```

Open `http://localhost:3000`. You should see a pulsing **green "Ollama Online"** badge in the top-right header.

---

## Environment Variable Reference

| Variable | Description | Default |
|:---|:---|:---|
| `OLLAMA_HOST` | Base URL of the Ollama instance | `http://localhost:11434` |
| `OLLAMA_MODEL` | Primary model for semantic matching | `llama3.1:8b` |
| `OLLAMA_VISION_MODEL` | Optional vision model for future OCR tasks | `minicpm-v` |
| `OLLAMA_TIMEOUT` | Request timeout in milliseconds | `60000` (60 s) |
| `VITE_OLLAMA_HOST` | Same as above — exposed to the React bundle | `http://localhost:11434` |
| `VITE_OLLAMA_MODEL` | Same as above — exposed to the React bundle | `llama3.1:8b` |
| `VITE_OLLAMA_TIMEOUT` | Same as above — exposed to the React bundle | `60000` |

---

## How AI Matching Works

1. The **Reconciliation Engine** runs entirely in a Web Worker using Fuzzball's `token_set_ratio` with an **85% narration threshold**.
2. **Phase 1** (1-to-1) and **Phase 2** (Aggregation) complete without any LLM calls — they use Fuzzball exclusively.
3. After both phases finish, the user can click **"Run Smart Match (AI)"** on the results screen.
4. This calls `ollamaService.batchAnalyze()` which sends narration pairs to `llama3.1:8b` via:
   ```
   POST http://localhost:11434/api/generate
   ```
5. The model receives a **financial reconciliation system prompt** tuned for Nigerian banking — it strips legal suffixes (`PLC`, `LTD`), decodes abbreviations (`TRF`, `PREM`), and returns `{"confidence": 0–100}`.
6. Pairs with confidence > 75% are promoted to matched status in the UI.
7. The `"format":"json"` field is always set to guarantee machine-parseable output.

### Token Tracking
Every API call to Ollama captures token usage from the response:
- `prompt_eval_count` → accumulated as `promptTokens`.
- `eval_count` → accumulated as `completionTokens`.

These are exposed via `ollamaService.getUsageMetrics()` and attached to the reconciliation output metrics as `apiMetrics`. The Observability Dashboard displays:
- **API Calls** — total number of Ollama generate invocations.
- **Tokens Consumed** — total prompt + completion tokens across all calls.

---

## Health Check API
You can verify the full system state (including Ollama) via:
```bash
curl http://localhost:3000/api/health
```

**Expected response (Ollama online):**
```json
{
  "status": "ok",
  "version": "1.2.0",
  "ai": {
    "provider": "ollama",
    "host": "http://localhost:11434",
    "model": "llama3.1:8b",
    "status": "online",
    "fallback": null
  },
  "timestamp": "..."
}
```

**Expected response (Ollama offline — graceful fallback active):**
```json
{
  "status": "ok",
  "ai": {
    "status": "offline",
    "fallback": "fuzzball"
  }
}
```

---

## Troubleshooting

### "Ollama Offline" badge in the UI
1. Confirm Ollama is running: `curl http://localhost:11434/api/tags`
2. If not running: `ollama serve`
3. Verify `VITE_OLLAMA_HOST` in your `.env` matches the actual Ollama address.

### Model slow to respond / first request takes 30+ seconds
This is normal on first inference (model is loaded into RAM). Subsequent calls are much faster. Increase `OLLAMA_TIMEOUT` if requests abort.

### "model not found" error in browser console
The model isn't pulled yet:
```bash
ollama pull llama3.1:8b
```

### Running Ollama on a different machine / port
Update `.env`:
```env
OLLAMA_HOST=http://192.168.1.100:11434
VITE_OLLAMA_HOST=http://192.168.1.100:11434
```

### Using a different model (e.g., llama3.2:3b for faster inference)
```bash
ollama pull llama3.2:3b
```
Then in `.env`:
```env
OLLAMA_MODEL=llama3.2:3b
VITE_OLLAMA_MODEL=llama3.2:3b
```
> Note: Smaller models may produce less accurate semantic matches but respond faster on low-RAM systems.

---

### ✍️ Credits
* **Technology Stack:** Powered by [Ollama](https://ollama.com) + `llama3.1:8b`
