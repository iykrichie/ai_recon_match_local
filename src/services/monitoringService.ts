import { ReconciliationOutput } from '../types';

export const monitoringService = {
  async logReconciliation(output: ReconciliationOutput) {
    if (!output.metrics) return;

    // Value metrics: Compare automated vs manual
    // Assume manual reconciliation takes 60 seconds per matching pair on average
    const ESTIMATED_MANUAL_TIME_PER_RECORD_SEC = 60; 
    const manualEffortSavedSeconds = output.metrics.matchedCount * ESTIMATED_MANUAL_TIME_PER_RECORD_SEC;
    
    const enrichedMetrics = {
      ...output.metrics,
      valueMetrics: {
        manualEffortSavedHours: Number((manualEffortSavedSeconds / 3600).toFixed(2)),
        manualEffortSavedDays: Number((manualEffortSavedSeconds / (3600 * 8)).toFixed(2)), // 8-hour workday
        estimatedCostSaving: Number((manualEffortSavedSeconds / 3600 * 25).toFixed(2)), // Assume $25/hr labor cost
      },
      systemInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        workerSupported: typeof Worker !== 'undefined'
      }
    };

    try {
      const response = await fetch('/api/v1/metrics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(enrichedMetrics),
      });

      if (!response.ok) {
        throw new Error('Failed to ship metrics to observability pipeline');
      }

      console.log('Performance metrics logged successfully:', await response.json());
    } catch (error) {
      console.error('Monitoring Service Error:', error);
    }
  }
};
