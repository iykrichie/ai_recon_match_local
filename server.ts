import express from "express";
import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const LOGS_DIR = path.join(process.cwd(), 'logs');
  const LOGS_FILE = path.join(LOGS_DIR, 'execution_metrics.json');

  // Ensure logs directory and file exist
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    try {
      await fs.access(LOGS_FILE);
    } catch {
      await fs.writeFile(LOGS_FILE, JSON.stringify([]));
    }
  } catch (err) {
    console.error("Error initializing logs:", err);
  }

  app.use(express.json({ limit: '500mb' }));
  app.use(express.urlencoded({ limit: '500mb', extended: true }));

  // Error handler for JSON parsing errors
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Express error:", err);
    if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: "Invalid JSON payload" });
    }
    if (err.type === 'entity.too.large') {
      return res.status(413).json({ error: "Payload too large. Please try a smaller dataset." });
    }
    // Catch all other errors from body-parser
    if (err.status) {
      return res.status(err.status).json({ error: err.message || "Request parsing error" });
    }
    next(err);
  });

  // API routes
  // Health check — reports app status + Ollama AI backend status
  app.get("/api/health", async (req, res) => {
    let ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
    if (ollamaHost === '0.0.0.0') {
      ollamaHost = 'http://localhost:11434';
    } else if (ollamaHost.includes('0.0.0.0')) {
      ollamaHost = ollamaHost.replace('0.0.0.0', '127.0.0.1');
    }
    if (!ollamaHost.startsWith('http://') && !ollamaHost.startsWith('https://')) {
      ollamaHost = 'http://' + ollamaHost;
    }

    const ollamaModel = process.env.OLLAMA_MODEL || 'llama3.1:8b';
    let ollamaStatus: 'online' | 'offline' = 'offline';

    try {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), 3000);
      const probe = await fetch(`${ollamaHost}/api/tags`, { signal: controller.signal });
      if (probe.ok) ollamaStatus = 'online';
    } catch {
      // Ollama unreachable — fuzzball fallback is active
    }

    res.json({
      status: "ok",
      version: "1.2.0",
      ai: {
        provider: "ollama",
        host: ollamaHost,
        model: ollamaModel,
        status: ollamaStatus,
        fallback: ollamaStatus === 'offline' ? 'fuzzball' : null,
      },
      timestamp: new Date().toISOString(),
    });
  });


  // Observability: Performance & Execution Logging
  app.post("/api/v1/metrics", async (req, res) => {
    try {
      const metrics = req.body;
      const timestamp = new Date().toISOString();
      const logEntry = {
        id: uuidv4(),
        timestamp,
        ...metrics
      };

      const data = await fs.readFile(LOGS_FILE, 'utf8');
      const logs = JSON.parse(data);
      logs.push(logEntry);
      
      await fs.writeFile(LOGS_FILE, JSON.stringify(logs, null, 2));
      
      res.status(201).json({ status: "logged", id: logEntry.id });
    } catch (error) {
      console.error("Metric Logging Error:", error);
      res.status(500).json({ error: "Failed to log metrics" });
    }
  });

  // History endpoint for Performance Dashboard
  app.get("/api/v1/metrics/history", async (req, res) => {
    try {
      const data = await fs.readFile(LOGS_FILE, 'utf8');
      let logs = JSON.parse(data);
      const { startDate, endDate } = req.query;

      if (startDate) {
        logs = logs.filter((l: any) => new Date(l.timestamp) >= new Date(startDate as string));
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setDate(end.getDate() + 1);
        logs = logs.filter((l: any) => new Date(l.timestamp) < end);
      }

      res.json(logs);
    } catch {
      res.json([]);
    }
  });

  // Programmatic Reconciliation API
  app.post("/api/v1/reconcile", async (req, res) => {
    const { mode, sourceA, sourceB, format = 'json' } = req.body;
    
    if (!sourceA) {
      return res.status(400).json({ error: "sourceA is required" });
    }

    if (mode === 'BANK_VS_GL' && !sourceB) {
      return res.status(400).json({ error: "sourceB is required for BANK_VS_GL mode" });
    }

    try {
      const { ReconciliationEngine } = await import("./src/reconciler");
      const Papa = (await import("papaparse")).default;

      // Helper to parse data if it's a string (CSV)
      const parseInput = (input: any) => {
        if (typeof input === 'string') {
          const results = Papa.parse(input, { header: true, skipEmptyLines: true });
          return results.data;
        }
        return input; // Assume it's already an array of objects
      };

      const dataA = parseInput(sourceA);
      const dataB = sourceB ? parseInput(sourceB) : undefined;

      const engine = new ReconciliationEngine(dataA, dataB);
      const output = engine.run();

      if (format === 'csv') {
        const reconciledCsv = Papa.unparse(output.reconciled);
        const exceptionsCsv = Papa.unparse(output.exceptions);
        
        return res.json({
          reconciled: reconciledCsv,
          exceptions: exceptionsCsv
        });
      }

      res.json(output);
    } catch (error) {
      console.error("Reconciliation API Error:", error);
      res.status(500).json({ error: "Internal server error during reconciliation" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  server.timeout = 600000; // 10 minute timeout
}

startServer();
