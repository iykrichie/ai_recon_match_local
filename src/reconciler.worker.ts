import { ReconciliationEngine } from './reconciler';

self.onmessage = (e: MessageEvent) => {
  const { data } = e.data;
  
  try {
    const engine = new ReconciliationEngine(data);
    const results = engine.run();
    self.postMessage({ type: 'SUCCESS', results });
  } catch (error) {
    self.postMessage({ 
      type: 'ERROR', 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
};
