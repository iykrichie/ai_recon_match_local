/**
 * ollamaService.ts
 *
 * Handles all communication with the local Ollama instance for semantic
 * narration matching in the Coroncilia reconciliation engine.
 *
 * Key design decisions:
 *  - Uses the /api/generate endpoint with "format":"json" so llama3.1:8b
 *    always emits a machine-parseable JSON blob (no markdown fences).
 *  - Gracefully degrades: if Ollama is unreachable, every method returns a
 *    sentinel value of 0 (or an empty array) so fuzzball matching takes over.
 *  - Compatible with both the main thread (React) AND Web Workers (fetch is
 *    available in modern browser workers), so it can be imported anywhere.
 *  - Singleton export mirrors the previous anythingLlmService pattern so
 *    App.tsx needs only a one-line import swap.
 */

// ── Config ──────────────────────────────────────────────────────────────────

/**
 * Reads config from Vite env (browser / worker) or Node process.env (server).
 * Falls back to sane defaults so the app boots without a .env file.
 */
function getConfig() {
  const env = (typeof import.meta !== 'undefined' && (import.meta as any).env)
    ? (import.meta as any).env
    : ({} as Record<string, string>);

  const procEnv = (typeof process !== 'undefined' && process.env)
    ? process.env
    : ({} as Record<string, string>);

  let host = env.VITE_OLLAMA_HOST || procEnv.OLLAMA_HOST || 'http://localhost:11434';
  if (host === '0.0.0.0') {
    host = 'http://localhost:11434';
  } else if (host.includes('0.0.0.0')) {
    host = host.replace('0.0.0.0', '127.0.0.1');
  }
  if (!host.startsWith('http://') && !host.startsWith('https://')) {
    host = 'http://' + host;
  }

  return {
    host,
    model:   env.VITE_OLLAMA_MODEL   || procEnv.OLLAMA_MODEL   || 'llama3.1:8b',
    timeout: parseInt(env.VITE_OLLAMA_TIMEOUT || procEnv.OLLAMA_TIMEOUT || '60000', 10),
  };
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface OllamaSimilarityResult {
  id: string;
  confidence: number;
}

// ── Service class ─────────────────────────────────────────────────────────────

export class OllamaService {
  private host: string;
  private model: string;
  private timeout: number;
  private available: boolean | null = null; // null = not yet probed

  private metrics = {
    apiCalls: 0,
    promptTokens: 0,
    completionTokens: 0
  };

  constructor() {
    const cfg = getConfig();
    this.host    = cfg.host;
    this.model   = cfg.model;
    this.timeout = cfg.timeout;
  }

  getUsageMetrics() {
    return { ...this.metrics };
  }

  resetMetrics() {
    this.metrics = { apiCalls: 0, promptTokens: 0, completionTokens: 0 };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Probes Ollama's /api/tags endpoint once to confirm it is reachable.
   * The result is cached for the lifetime of the service instance.
   */
  private async isAvailable(): Promise<boolean> {
    if (this.available !== null) return this.available;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000); // fast probe

      const res = await fetch(`${this.host}/api/tags`, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timer);
      this.available = res.ok;
    } catch {
      this.available = false;
    }

    if (!this.available) {
      console.warn(
        `[OllamaService] WARNING: Ollama is not reachable at ${this.host}. ` +
        'AI semantic matching is disabled — falling back to Fuzzball string matching.'
      );
    }
    return this.available;
  }

  /**
   * Core request method.
   * Sends a prompt to /api/generate with format:"json" enforced.
   * Returns the parsed response object, or null on failure.
   */
  private async generate(prompt: string, systemPrompt: string): Promise<any | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);

    try {
      const res = await fetch(`${this.host}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model:  this.model,
          prompt,
          system: systemPrompt,
          stream: false,   // wait for the full response; no streaming needed
          format: 'json',  // CRITICAL: forces llama3.1:8b to output raw JSON
          options: {
            temperature: 0.0,  // deterministic output for financial data
            num_predict: 256,  // cap token output — responses are small JSON objects
          },
        }),
      });

      clearTimeout(timer);

      if (!res.ok) {
        console.error(`[OllamaService] HTTP ${res.status} from Ollama`);
        return null;
      }

      const data = await res.json();
      
      this.metrics.apiCalls++;
      if (data.prompt_eval_count) this.metrics.promptTokens += data.prompt_eval_count;
      if (data.eval_count) this.metrics.completionTokens += data.eval_count;

      // Ollama wraps the model output in data.response
      return JSON.parse(data.response || '{}');
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === 'AbortError') {
        console.error(`[OllamaService] Request timed out after ${this.timeout}ms`);
      } else {
        console.error('[OllamaService] Fetch error:', err.message);
      }
      return null;
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Determines whether two transaction narrations refer to the same entity /
   * transaction using llama3.1:8b semantic understanding.
   *
   * This is called ONLY when Fuzzball's token_set_ratio falls below the 95%
   * threshold — i.e. when syntactic matching alone is insufficient.
   *
   * @returns confidence score 0–100, or 0 if Ollama is unavailable (fuzzball fallback)
   */
  async analyzeSimilarity(narrationA: string, narrationB: string): Promise<number> {
    if (!(await this.isAvailable())) return 0;

    const cleanA = narrationA.substring(0, 200).trim();
    const cleanB = narrationB.substring(0, 200).trim();

    const systemPrompt = `You are a senior financial reconciliation expert specialising in Nigerian insurance and banking transactions.

Your task is to determine whether two transaction narrations refer to the SAME underlying transaction or payment.

RULES FOR MATCHING:
1. Strip legal suffixes when comparing entity names: "PLC", "LTD", "LIMITED", "CO", "NIG", "NIGERIA", "GROUP" are noise words.
2. Extract the CORE IDENTITY — e.g. "HEIRS LIFE ASSURANCE PLC" and "HEIRS LIFE" are the same entity.
3. Two narrations with the same core entity name are a strong match even if wording differs.
4. Numeric references (policy numbers, transaction IDs like R######_######_#) are strong identity anchors.
5. Common abbreviations: "TRF" = Transfer, "PAY" = Payment, "INS" = Insurance, "PREM" = Premium.
6. A confidence of 0 means completely different parties. A confidence of 100 means certainly the same.

You MUST return ONLY a valid JSON object with exactly one key: "confidence" (integer 0–100). No explanation, no markdown.`;

    const prompt = `Compare these two transaction narrations and determine if they refer to the same transaction or payment:

Narration A: "${cleanA}"
Narration B: "${cleanB}"

Return JSON: {"confidence": <integer 0-100>}`;

    const result = await this.generate(prompt, systemPrompt);

    if (result && typeof result.confidence === 'number') {
      return Math.min(100, Math.max(0, Math.round(result.confidence)));
    }
    return 0;
  }

  /**
   * Batch-analyzes up to 10 narration pairs in a single Ollama call.
   * More efficient than calling analyzeSimilarity per-pair for bulk AI review.
   *
   * @returns array of {id, confidence} — empty array if Ollama unavailable
   */
  async batchAnalyze(
    pairs: { id: string; narrationA: string; narrationB: string }[]
  ): Promise<OllamaSimilarityResult[]> {
    if (pairs.length === 0) return [];
    if (!(await this.isAvailable())) return [];

    // Sanitise inputs
    const sanitised = pairs.map(p => ({
      id: p.id,
      a: p.narrationA.substring(0, 200).trim(),
      b: p.narrationB.substring(0, 200).trim(),
    }));

    const systemPrompt = `You are a senior financial reconciliation expert specialising in Nigerian insurance and banking transactions.

For each pair of transaction narrations provided, determine whether they refer to the SAME underlying transaction or payment.

MATCHING RULES:
1. Strip legal suffixes: "PLC", "LTD", "LIMITED", "CO", "NIG", "NIGERIA", "GROUP".
2. Match on CORE IDENTITY — "HEIRS LIFE ASSURANCE PLC" == "HEIRS LIFE".
3. Numeric IDs (policy numbers, R######_######_# codes) are strong identity anchors.
4. Abbreviations: TRF=Transfer, PAY=Payment, INS=Insurance, PREM=Premium.
5. confidence=0 means completely different; confidence=100 means certainly the same.

You MUST return ONLY a valid JSON array — one element per pair, each with "id" and "confidence" (integer 0–100). No explanation, no markdown.`;

    const pairsText = sanitised
      .map((p, i) => `${i + 1}. [ID: ${p.id}]\n   A: "${p.a}"\n   B: "${p.b}"`)
      .join('\n\n');

    const prompt = `Analyze these transaction narration pairs:\n\n${pairsText}\n\nReturn JSON array: [{"id":"<id>","confidence":<0-100>}, ...]`;

    const result = await this.generate(prompt, systemPrompt);

    // Ollama may wrap the array in an object — handle both cases
    if (Array.isArray(result)) {
      return result
        .filter(r => r && typeof r.id === 'string' && typeof r.confidence === 'number')
        .map(r => ({ id: r.id, confidence: Math.min(100, Math.max(0, Math.round(r.confidence))) }));
    }

    // Sometimes models wrap array in {"results": [...]} or similar
    if (result && Array.isArray(result.results)) {
      return result.results
        .filter((r: any) => r && typeof r.id === 'string' && typeof r.confidence === 'number')
        .map((r: any) => ({ id: r.id, confidence: Math.min(100, Math.max(0, Math.round(r.confidence))) }));
    }

    console.warn('[OllamaService] batchAnalyze: unexpected response shape, returning empty');
    return [];
  }

  /**
   * Health check — can be used by the UI to show Ollama connection status.
   * Returns { available, model, host }.
   */
  async healthCheck(): Promise<{ available: boolean; model: string; host: string }> {
    const available = await this.isAvailable();
    return { available, model: this.model, host: this.host };
  }
}

// Singleton — mirrors the pattern used by anythingLlmService and geminiService
export const ollamaService = new OllamaService();
