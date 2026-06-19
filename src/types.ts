export type ReconciliationMode = 'INTERNAL_GL' | 'BANK_VS_GL';

export interface Transaction {
  id: string;
  date: Date;
  reference: string;
  details: string;
  debit: number;
  credit: number;
  originalAmount: number;
  absAmount: number;
  type: 'Normal' | 'Reversal';
  side: 'Debit' | 'Credit';
  source?: 'BANK' | 'GL';
}

export interface MatchResult {
  matchId: string;
  accuracyScore: number;
  confidence: number;
  humanReviewRequired: boolean;
  matchType: string;
  matchingReference: string;
  matchingKeyword: string;
  remark: string;
  creditRows: Transaction[];
  debitRows: Transaction[];
}

export interface ReconciliationOutput {
  reconciled: any[];
  exceptions: any[];
  metrics?: {
    rowsProcessed: number;
    matchedCount: number;
    exceptionCount: number;
    executionTimeMs: number;
    matchCompleteness: number;
    averageAccuracy: number;
    mode: string;
    timestamp: string;
    apiMetrics?: {
      apiCalls: number;
      promptTokens: number;
      completionTokens: number;
    };
  };
}
