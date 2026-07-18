# AIMatch API Documentation

This document describes the programmatic API endpoints for the **AIMatch** application (v1.2.0). These endpoints allow you to automate reconciliation by sending transaction data and receiving matched/unmatched results, and to inspect system health including the local Ollama AI backend.

---

## 🛰 Base URL
`http://{your-app-url}/api`

---

## 🛣 Endpoints

### 1. Health Check
Returns application health and Ollama AI backend status. Use this to confirm whether semantic AI matching is active.

- **URL:** `/health`
- **Method:** `GET`

#### Response
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
  "timestamp": "2026-06-19T10:00:00.000Z"
}
```

| Field | Type | Description |
|:---|:---|:---|
| `status` | `string` | Always `"ok"` if the Express server is running. |
| `version` | `string` | App version. |
| `ai.provider` | `string` | Always `"ollama"`. |
| `ai.host` | `string` | Configured Ollama host (from `OLLAMA_HOST` env var). |
| `ai.model` | `string` | Active model (from `OLLAMA_MODEL` env var). |
| `ai.status` | `"online"` \| `"offline"` | Whether Ollama is reachable. |
| `ai.fallback` | `"fuzzball"` \| `null` | `"fuzzball"` when Ollama is offline; `null` when AI is active. |

---

### 2. Reconcile Transactions
Performs reconciliation on one or two datasets using the same two-phase matching logic as the web UI.

**Phase 1:** Strict 1-to-1 matching (85% narration threshold, 90-day date window).
**Phase 2:** Aggregation matching (Many-to-One / One-to-Many) with AND-gate dual-layer validation and zero-tolerance sum matching.

- **URL:** `/v1/reconcile`
- **Method:** `POST`
- **Content-Type:** `application/json`

> **Note:** This endpoint uses Fuzzball for narration matching. For semantic AI matching on difficult pairs, use the "Run Smart Match" feature in the UI (calls `ollamaService.batchAnalyze` in the frontend).

#### Request Body
| Field | Type | Required | Description |
|:---|:---|:---|:---|
| `mode` | `string` | Yes | `INTERNAL` or `BANK_VS_GL`. |
| `sourceA` | `string` \| `Array` | Yes | Raw CSV string **or** JSON array of transaction objects. |
| `sourceB` | `string` \| `Array` | Conditional | Required when `mode` is `BANK_VS_GL`. |
| `format` | `string` | No | `json` (default) or `csv`. |

#### Example Request — JSON Array
```json
{
  "mode": "INTERNAL",
  "sourceA": [
    { "Date": "2026-02-24", "Details": "CORONATION_JOHN DOE_9T", "Debits": "37500", "Credits": "0" },
    { "Date": "2026-02-24", "Details": "CORONATION_JOHN DOE_9T", "Debits": "0",    "Credits": "37500" }
  ]
}
```

#### Example Request — CSV String
```json
{
  "mode": "INTERNAL",
  "sourceA": "Date,Details,Debits,Credits\n2026-02-24,CORONATION_JOHN DOE_9T,37500,0\n2026-02-24,CORONATION_JOHN DOE_9T,0,37500",
  "format": "csv"
}
```

#### Response — JSON (default)
```json
{
  "reconciled": [
    {
      "Match ID": "uuid-v4",
      "Debits - Post Date": "24/02/2026",
      "Debits - Details": "CORONATION_JOHN DOE_9T",
      "Debits - Amount": 37500,
      "Match Type": "1-to-1",
      "Credits - Post Date": "24/02/2026",
      "Credits - Details": "CORONATION_JOHN DOE_9T",
      "Credits - Amount": 37500,
      "Remark": "Syntactic Match",
      "Confidence Score": "100.00",
      "Human Review Flag": "No"
    }
  ],
  "exceptions": [],
  "metrics": {
    "rowsProcessed": 2,
    "matchedCount": 1,
    "exceptionCount": 0,
    "executionTimeMs": 12.5,
    "matchCompleteness": 100.0,
    "averageAccuracy": 100.0,
    "mode": "INTERNAL",
    "timestamp": "2026-06-19T10:00:00.000Z"
  }
}
```

#### Match Type Values
| Value | Description |
|:---|:---|
| `1-to-1` | Phase 1 exact amount + narration match. |
| `M-to-1` | Phase 2 aggregation — multiple entries sum to one. |
| `M` | AI-promoted match via Smart Match. |

#### Response — CSV Format
When `format: "csv"` is set, the response contains two keys with raw CSV strings:
```json
{
  "reconciled": "\"Match ID\",\"Debits - Post Date\",...",
  "exceptions": "\"Date\",\"Reference\",\"Details\",..."
}
```

---

### 3. Post Execution Metrics
Ships performance and execution metrics to the observability pipeline. Called automatically by the frontend after a successful reconciliation run.

- **URL:** `/v1/metrics`
- **Method:** `POST`
- **Content-Type:** `application/json`

#### Request Body (example)
```json
{
  "rowsProcessed": 4557,
  "matchedCount": 1670,
  "exceptionCount": 1243,
  "executionTimeMs": 3324,
  "matchCompleteness": 57.33,
  "averageAccuracy": 95.7,
  "mode": "INTERNAL",
  "timestamp": "2026-06-19T10:00:00.000Z",
  "apiMetrics": {
    "apiCalls": 12,
    "promptTokens": 4820,
    "completionTokens": 384
  },
  "valueMetrics": {
    "manualEffortSavedHours": 27.83,
    "manualEffortSavedDays": 3.48,
    "estimatedCostSaving": 695.83
  },
  "systemInfo": {
    "userAgent": "Mozilla/5.0 ...",
    "platform": "Linux x86_64",
    "workerSupported": true
  }
}
```

#### Metrics Field Reference

| Field | Type | Description |
|:---|:---|:---|
| `matchCompleteness` | `number` | Percentage of total rows that were matched. *(Physical coverage)* |
| `averageAccuracy` | `number` | Mean confidence/similarity score across all matched pairs. *(Mathematical precision)* |
| `apiMetrics.apiCalls` | `number` | Total Ollama `/api/generate` calls made during the session. |
| `apiMetrics.promptTokens` | `number` | Total prompt tokens consumed by the LLM. |
| `apiMetrics.completionTokens` | `number` | Total completion tokens generated by the LLM. |

> **Note:** `apiMetrics` is populated only when Ollama is online and AI matching has been invoked. It will be absent or contain zeroes for Fuzzball-only runs.

#### Response
```json
{ "status": "logged", "id": "uuid-v4" }
```

---

### 4. Fetch Execution History
Retrieves the full audit trail of all processed requests. Consumed by the in-app Performance Dashboard.

- **URL:** `/v1/metrics/history`
- **Method:** `GET`

#### Response
A JSON array of metric log entries (most recent first):
```json
[
  {
    "id": "uuid-v4",
    "timestamp": "2026-06-19T10:00:00.000Z",
    "mode": "INTERNAL",
    "rowsProcessed": 4557,
    "matchedCount": 1670,
    "matchCompleteness": 57.33,
    "averageAccuracy": 95.7,
    "executionTimeMs": 3324,
    "apiMetrics": {
      "apiCalls": 12,
      "promptTokens": 4820,
      "completionTokens": 384
    },
    "valueMetrics": { "manualEffortSavedHours": 27.83 }
  }
]
```

---

## 🤖 AI Integration (Ollama — Client-Side)

The semantic AI matching feature calls Ollama **directly from the browser** (or Web Worker), not through the Express server. This keeps the server stateless and avoids proxying large LLM payloads.

| Endpoint | Method | Caller | Purpose |
|:---|:---|:---|:---|
| `{OLLAMA_HOST}/api/tags` | `GET` | Browser (on mount) | Availability probe / health check |
| `{OLLAMA_HOST}/api/generate` | `POST` | Browser (Smart Match) | Semantic narration similarity analysis |

### `/api/generate` Request Shape
```json
{
  "model": "llama3.1:8b",
  "prompt": "Compare these two transaction narrations...",
  "system": "<Nigerian finance expert system prompt>",
  "stream": false,
  "format": "json",
  "options": {
    "temperature": 0.0,
    "num_predict": 256
  }
}
```

### `/api/generate` Response Shape
```json
{
  "model": "llama3.1:8b",
  "response": "{\"confidence\": 87}",
  "done": true,
  "prompt_eval_count": 412,
  "eval_count": 32
}
```

The `ollamaService` parses `response` as JSON and returns the `confidence` integer (0–100). It also captures `prompt_eval_count` and `eval_count` for token tracking via `getUsageMetrics()`.

### Token Tracking API (Client-Side)

The `ollamaService` singleton exposes:

| Method | Returns | Description |
|:---|:---|:---|
| `getUsageMetrics()` | `{ apiCalls, promptTokens, completionTokens }` | Cumulative usage for the current session. |
| `resetMetrics()` | `void` | Resets all counters to zero. |

These metrics are attached to the `ReconciliationOutput.metrics.apiMetrics` object before being shipped to the `/api/v1/metrics` endpoint.

---

## 🛠 Usage Notes

### 1. Payload Limits
The API supports payloads up to **500 MB**. For very large datasets, ensure your HTTP client timeout is set to at least **120 seconds**.

### 2. Matching Logic

#### Phase 1 — One-to-One
- **Narration Threshold:** 85% similarity required (Fuzzball `token_set_ratio`).
- **Date Window:** 90 days.
- **Reference Extraction:** Automatic handling of `R######_...` and `Wapx-...` patterns.
- **Noise Cleaning:** Strips `PLC`, `LTD`, `CORONATION`, etc.

#### Phase 2 — Aggregation (Many-to-One / One-to-Many)
- **Sum Validation:** Zero tolerance (< 0.01 variance).
- **Dual-Layer AND Gate:** Both semantic (narration ≥ 70%) AND structural (reference alignment) must pass.
- **Circuit Breaker:** 50,000 iteration limit per candidate group.
- **Subset Limit:** Max 15 entries per group.

#### AI Layer
- Activated only via the browser "Run Smart Match" button — not during the core `/v1/reconcile` call.
- Token consumption is tracked and reported per session.

### 3. Error Handling
| Code | Meaning |
|:---|:---|
| `400` | Missing required fields or invalid JSON. |
| `413` | Payload exceeds 500 MB limit. |
| `500` | Internal error during reconciliation. |

---

## 🔒 Security
- All data processing remains local — no transaction data is sent to any external cloud.
- Ollama runs entirely on-premise; `llama3.1:8b` inference is local.
- Ensure Express API calls are made over **HTTPS** in production environments.
- Consider adding an `Authorization` header or API Key middleware if deploying in a shared environment.

---

### ✍️ Credits
* **Technology Stack:** Powered by [Ollama](https://ollama.com) + `llama3.1:8b`
