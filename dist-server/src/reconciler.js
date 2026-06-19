import { token_set_ratio } from 'fuzzball';
import { v4 as uuidv4 } from 'uuid';
export class ReconciliationEngine {
    debits = [];
    credits = [];
    matches = [];
    unmatchedDebits = new Set();
    unmatchedCredits = new Set();
    mode = 'INTERNAL';
    static DATE_WINDOW_DAYS = 30;
    static AMOUNT_TOLERANCE_PERCENT = 0;
    static NARRATION_THRESHOLD = 95; // Increased to 95 for nearly exact name matching
    cleanNarration(text) {
        if (!text)
            return '';
        let cleaned = text.toUpperCase();
        // 1. Handle "CORONATION.../" pattern (literal dots or multiple dots)
        // Example: "(CORONATION.../G I WINNAS.../CO"
        const coronationPattern = /CORONATION\.+\//;
        const coronationMatch = cleaned.match(coronationPattern);
        if (coronationMatch) {
            cleaned = cleaned.substring(coronationMatch.index + coronationMatch[0].length);
        }
        else {
            // Fallback for standard "CORONATION /"
            cleaned = cleaned.replace(/CORONATION\s*\/?/g, ' ');
        }
        // 2. Handle "R######_######_#" pattern and extract what's AFTER it
        // Example: R260201_230203_3 HILLS MART MULTI SERVICE_099AFLT
        const txnIdPattern = /R\d{6}_\d{6}_\d+/;
        const txnMatch = cleaned.match(txnIdPattern);
        if (txnMatch) {
            cleaned = cleaned.substring(txnMatch.index + txnMatch[0].length);
        }
        // 3. Handle the "first 16 digits" rule more robustly
        const firstAlphaMatch = cleaned.match(/[A-Z]{3,}/);
        if (firstAlphaMatch && firstAlphaMatch.index !== undefined && firstAlphaMatch.index > 4) {
            cleaned = cleaned.substring(firstAlphaMatch.index);
        }
        // 4. Remove all sequences of 5+ digits
        cleaned = cleaned.replace(/\d{5,}/g, ' ');
        // 5. Remove common transaction noise words and ubiquitous entities
        cleaned = cleaned.replace(/\b(TRF|PAY|REF|VAL|POST|AMT|TXN|ID|DATE|MONTH|YEAR|ST|ND|RD|TH|NIP|TO|FROM|FOR|WITH|AND|THE|OF|AT|ON|BY|IS|IN|IT|AN|CORONATION|INSURANCE|PLC|LIMITED|LTD)\b/g, ' ');
        // 6. Remove special characters
        cleaned = cleaned.replace(/[^A-Z0-9\s]/g, ' ');
        return cleaned.replace(/\s+/g, ' ').trim().toLowerCase();
    }
    static REFERENCE_PATTERNS = {
        transaction_id: /R\d{6}_\d{6}_\d+/, // R250808_123810_6
        wapx_ref: /Wapx-\d{9}/i, // Wapx-000113422
        cpu_ref: /CPU-\d{9}/i, // CPU-000000578
        policy_number: /\b\d{8,}\b/, // 8+ digit numbers
        installment: /(\d+)(ST|ND|RD|TH)\s*PAYM/i, // 3RD PAYM
        insurance_entity: /(LEADWAY|STACO|HEIRS|WAPIC)/i, // Removed CORONATION as it's a generic stopword in this audit context
        risk_type: /(FIRE AND SPECIAL|COMBINED FIRE|PLANT ALL RISK|MARINE)/i,
    };
    constructor(sourceA, sourceB) {
        if (sourceB) {
            this.mode = 'BANK_VS_GL';
            this.preprocessBankVsGL(sourceA, sourceB);
        }
        else {
            this.mode = 'INTERNAL';
            this.preprocessInternal(sourceA);
        }
    }
    parseDate(val) {
        if (!val)
            return new Date(0);
        if (val instanceof Date && !isNaN(val.getTime()))
            return val;
        if (typeof val === 'number') {
            // Handle YYYYMMDD (e.g. 20250808)
            if (val > 19000101 && val < 21001231) {
                const s = String(val);
                const y = parseInt(s.substring(0, 4));
                const m = parseInt(s.substring(4, 6));
                const d = parseInt(s.substring(6, 8));
                return new Date(y, m - 1, d);
            }
            // Handle Excel serial (only if in sane range: 1980 to 2060)
            // 29221 is 1980-01-01. 58441 is 2060-01-01.
            if (val > 25000 && val < 60000) {
                return new Date(Math.round((val - 25569) * 86400 * 1000));
            }
            // If it's a number but not a sane date, it's probably a reference
            return new Date(0);
        }
        const s = String(val).trim();
        if (!s || s === 'N/A' || s === '-')
            return new Date(0);
        // Check if it's a purely numeric date format with separators (e.g., 12/05/2023)
        // If it contains letters (like "Mar", "June"), the native Date parser is usually better.
        const hasLetters = /[a-zA-Z]/.test(s);
        if (hasLetters) {
            const dObj = new Date(s);
            if (!isNaN(dObj.getTime())) {
                const year = dObj.getFullYear();
                if (year > 1980 && year < 2060)
                    return dObj;
            }
        }
        // Manual parsing for common formats: DD/MM/YYYY or YYYY/MM/DD
        const parts = s.split(/[/-]/);
        if (parts.length >= 3) {
            let day, month, year;
            const p0 = parseInt(parts[0]);
            const p1 = parseInt(parts[1]);
            const p2 = parseInt(parts[2].split(/\s+/)[0]);
            if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
                if (p0 > 1000) { // YYYY/MM/DD
                    year = p0;
                    month = p1;
                    day = p2;
                }
                else {
                    // Ambiguous: DD/MM/YYYY or MM/DD/YYYY
                    year = p2;
                    if (year < 100)
                        year += (year > 50 ? 1900 : 2000);
                    if (p0 > 12) {
                        // If first part > 12, it MUST be DD/MM/YYYY
                        day = p0;
                        month = p1;
                    }
                    else if (p1 > 12) {
                        // If second part > 12, it MUST be MM/DD/YYYY
                        day = p1;
                        month = p0;
                    }
                    else {
                        // Both <= 12, default to DD/MM/YYYY (Standard UK/Nigerian format)
                        day = p0;
                        month = p1;
                    }
                }
                const date = new Date(year, month - 1, day);
                if (!isNaN(date.getTime()) && year > 1980 && year < 2060)
                    return date;
            }
        }
        // Fallback to native parsing
        const dObj = new Date(s);
        if (!isNaN(dObj.getTime())) {
            const year = dObj.getFullYear();
            if (year > 1980 && year < 2060)
                return dObj;
        }
        return new Date(0);
    }
    parseAmount(v) {
        if (typeof v === 'number')
            return v;
        if (!v)
            return 0;
        const s = String(v).trim();
        if (s === '-' || s === '' || s === '0' || s === '0.00')
            return 0;
        // Remove everything except digits and dot to get absolute value
        const cleaned = s.replace(/[^0-9.]/g, '');
        const num = parseFloat(cleaned) || 0;
        // Handle negative indicators if necessary
        if (s.includes('(') && s.includes(')'))
            return -num;
        if (s.startsWith('-') && !s.startsWith('_-'))
            return -num;
        return num;
    }
    getMapHeaders(firstRow) {
        if (!firstRow)
            return {};
        const rowKeys = Object.keys(firstRow);
        const findKey = (aliases) => {
            // 1. Exact match (case-insensitive)
            let key = rowKeys.find(k => aliases.some(a => a.toLowerCase() === k.trim().toLowerCase()));
            if (key)
                return key;
            // 2. Partial match
            key = rowKeys.find(k => aliases.some(a => k.trim().toLowerCase().includes(a.toLowerCase())));
            return key;
        };
        return {
            dateKey: findKey(['Date', 'Post Date', 'Posting Date', 'Transaction Date', 'Value Date', 'Val Date', 'Effective Date', 'Entry Date']),
            refKey: findKey(['Reference', 'Ref', 'Voucher', 'Ref No', 'Ref_No', 'Document No', 'Doc No', 'Txn Ref']),
            detailKey: findKey(['Details', 'Detail', 'Description', 'Particulars', 'Transaction Details', 'Narration', 'Memo', 'Remarks', 'Line Description']),
            debitKey: findKey(['Debits', 'Debit', 'Dr Amount', 'Dr', 'Withdrawal', 'Paid Out', 'Bank amount']),
            creditKey: findKey(['Credits', 'Credit', 'Cr Amount', 'Cr', 'Deposit', 'Paid In', 'Lodgment']),
        };
    }
    extractReferences(text) {
        const refs = [];
        if (!text)
            return refs;
        for (const [, pattern] of Object.entries(ReconciliationEngine.REFERENCE_PATTERNS)) {
            const match = text.match(pattern);
            if (match) {
                refs.push(match[0]);
            }
        }
        return refs;
    }
    preprocessInternal(data) {
        if (!data || data.length === 0)
            return;
        const headers = this.getMapHeaders(data[0]);
        data.forEach((row, index) => {
            const date = this.parseDate(headers.dateKey ? row[headers.dateKey] : null);
            const rawRef = String(headers.refKey ? row[headers.refKey] : '');
            const details = String(headers.detailKey ? row[headers.detailKey] : '');
            // Extract all possible references from both ref and details
            const extractedRefs = new Set([
                ...this.extractReferences(rawRef),
                ...this.extractReferences(details)
            ]);
            if (rawRef && rawRef !== 'N/A')
                extractedRefs.add(rawRef);
            const debitVal = Math.abs(this.parseAmount(headers.debitKey ? row[headers.debitKey] : 0));
            const creditVal = Math.abs(this.parseAmount(headers.creditKey ? row[headers.creditKey] : 0));
            const id = `internal_${index}_${Math.random().toString(36).substr(2, 5)}`;
            if (debitVal > 0) {
                const dId = id + '_D';
                this.debits.push({
                    id: dId, date, details,
                    reference: Array.from(extractedRefs).join('|'),
                    debit: debitVal, credit: 0, originalAmount: debitVal, absAmount: debitVal, type: 'Normal', side: 'Debit'
                });
                this.unmatchedDebits.add(dId);
            }
            if (creditVal > 0) {
                const cId = id + '_C';
                this.credits.push({
                    id: cId, date, details,
                    reference: Array.from(extractedRefs).join('|'),
                    debit: 0, credit: creditVal, originalAmount: -creditVal, absAmount: creditVal, type: 'Normal', side: 'Credit'
                });
                this.unmatchedCredits.add(cId);
            }
        });
    }
    preprocessBankVsGL(bankData, glData) {
        const bankHeaders = this.getMapHeaders(bankData[0]);
        bankData.forEach((row, index) => {
            const date = this.parseDate(bankHeaders.dateKey ? row[bankHeaders.dateKey] : null);
            const reference = String(bankHeaders.refKey ? row[bankHeaders.refKey] : '');
            const details = String(bankHeaders.detailKey ? row[bankHeaders.detailKey] : '');
            const debitVal = Math.abs(this.parseAmount(bankHeaders.debitKey ? row[bankHeaders.debitKey] : 0));
            const creditVal = Math.abs(this.parseAmount(bankHeaders.creditKey ? row[bankHeaders.creditKey] : 0));
            const id = `bank_${index}_${Math.random().toString(36).substr(2, 5)}`;
            if (creditVal > 0) {
                const cId = id + '_C';
                this.credits.push({ id: cId, date, reference, details, debit: 0, credit: creditVal, originalAmount: creditVal, absAmount: creditVal, type: 'Normal', side: 'Credit', source: 'BANK' });
                this.unmatchedCredits.add(cId);
            }
            else if (debitVal > 0) {
                const dId = id + '_D';
                this.debits.push({ id: dId, date, reference, details, debit: debitVal, credit: 0, originalAmount: -debitVal, absAmount: debitVal, type: 'Normal', side: 'Debit', source: 'BANK' });
                this.unmatchedDebits.add(dId);
            }
        });
        const glHeaders = this.getMapHeaders(glData[0]);
        glData.forEach((row, index) => {
            const date = this.parseDate(glHeaders.dateKey ? row[glHeaders.dateKey] : null);
            const reference = String(glHeaders.refKey ? row[glHeaders.refKey] : '');
            const details = String(glHeaders.detailKey ? row[glHeaders.detailKey] : '');
            const debitVal = Math.abs(this.parseAmount(glHeaders.debitKey ? row[glHeaders.debitKey] : 0));
            const creditVal = Math.abs(this.parseAmount(glHeaders.creditKey ? row[glHeaders.creditKey] : 0));
            const id = `gl_${index}_${Math.random().toString(36).substr(2, 5)}`;
            if (debitVal > 0) {
                const dId = id + '_D';
                this.debits.push({ id: dId, date, reference, details, debit: debitVal, credit: 0, originalAmount: debitVal, absAmount: debitVal, type: 'Normal', side: 'Debit', source: 'GL' });
                this.unmatchedDebits.add(dId);
            }
            else if (creditVal > 0) {
                const cId = id + '_C';
                this.credits.push({ id: cId, date, reference, details, debit: 0, credit: creditVal, originalAmount: -creditVal, absAmount: creditVal, type: 'Normal', side: 'Credit', source: 'GL' });
                this.unmatchedCredits.add(cId);
            }
        });
    }
    run() {
        const startTime = performance.now();
        if (this.mode === 'INTERNAL') {
            this.matchInternalLedger();
        }
        else {
            this.matchBankVsGL();
        }
        const output = this.generateOutput();
        const endTime = performance.now();
        // Inject metrics
        const rowsProcessed = (this.mode === 'INTERNAL')
            ? this.debits.length + this.credits.length
            : this.debits.length + this.credits.length; // Same either way since they are pre-populated
        const matchedCount = output.reconciled.length;
        const exceptionCount = output.exceptions.length;
        const totalOutputRows = matchedCount + exceptionCount;
        output.metrics = {
            rowsProcessed,
            matchedCount,
            exceptionCount,
            executionTimeMs: endTime - startTime,
            accuracyRate: totalOutputRows > 0 ? (matchedCount / totalOutputRows) * 100 : 0,
            mode: this.mode,
            timestamp: new Date().toISOString()
        };
        return output;
    }
    matchInternalLedger() {
        // Tier 1: Exact Amount Match with Narration Similarity (Syntactic/Semantic)
        this.matchByAmountAndNarration();
        // Tier 2: Exact Reference Match
        this.matchByReference();
        // Tier 3: Sum matching (One-to-Many AND Many-to-One) - DISABLED
        // The user strictly requires 1-to-1 matching where amounts are identical.
        // this.matchBySum(30);
    }
    matchByAmountAndNarration() {
        const unmatchedDebitsPool = this.getUnmatchedDebits();
        const unmatchedCredits = this.getUnmatchedCredits();
        // Sort both pools by date to respect chronological order
        unmatchedDebitsPool.sort((a, b) => a.date.getTime() - b.date.getTime());
        unmatchedCredits.sort((a, b) => a.date.getTime() - b.date.getTime());
        // Group debits by amount for O(1) lookup
        const debitsByAmount = new Map();
        for (const d of unmatchedDebitsPool) {
            const amtKey = d.absAmount.toFixed(2);
            const list = debitsByAmount.get(amtKey) || [];
            list.push(d);
            debitsByAmount.set(amtKey, list);
        }
        for (const credit of unmatchedCredits) {
            const amtKey = credit.absAmount.toFixed(2);
            const amountCandidates = debitsByAmount.get(amtKey);
            if (!amountCandidates || amountCandidates.length === 0)
                continue;
            // 2. Evaluate candidates based on Narration Similarity and Date (Reversal Logic)
            let bestMatch = null;
            let highestScore = -1;
            let matchReason = '';
            let isReversal = false;
            const cleanCreditDetails = this.cleanNarration(credit.details);
            for (const d of amountCandidates) {
                const cleanDebitDetails = this.cleanNarration(d.details);
                // Check if it's a reversal (Same amount, different month)
                const monthsDiff = d.date.getMonth() !== credit.date.getMonth() ||
                    d.date.getFullYear() !== credit.date.getFullYear();
                // Use token_set_ratio for better handling of word reordering and extra info
                let fuzzyScore = token_set_ratio(cleanCreditDetails, cleanDebitDetails);
                // Safety: If cleaned narrations are empty, don't match unless raw details are identical
                if (!cleanCreditDetails && !cleanDebitDetails) {
                    if (credit.details.trim().toUpperCase() !== d.details.trim().toUpperCase()) {
                        fuzzyScore = 0;
                    }
                    else {
                        fuzzyScore = 100;
                    }
                }
                // Base Requirement: If names are not at least 95% similar raw, reject immediately
                // unless they are exactly the same raw details.
                // This ensures the "Exact Name" requirement is met.
                if (fuzzyScore < 95 && credit.details.trim().toUpperCase() !== d.details.trim().toUpperCase()) {
                    continue;
                }
                // Date proximity bonus (up to 5 points instead of 10)
                const diffDays = Math.abs(d.date.getTime() - credit.date.getTime()) / (1000 * 60 * 60 * 24);
                const dateBonus = Math.max(0, 5 - (diffDays / 6));
                const creditEntities = credit.details.match(ReconciliationEngine.REFERENCE_PATTERNS.insurance_entity) || [];
                const debitEntities = d.details.match(ReconciliationEngine.REFERENCE_PATTERNS.insurance_entity) || [];
                const entityOverlap = creditEntities.some(e => debitEntities.includes(e));
                const creditRisks = credit.details.match(ReconciliationEngine.REFERENCE_PATTERNS.risk_type) || [];
                const debitRisks = d.details.match(ReconciliationEngine.REFERENCE_PATTERNS.risk_type) || [];
                const riskOverlap = creditRisks.some(r => debitRisks.includes(r));
                // Scoring logic
                let currentScore = fuzzyScore + dateBonus;
                if (entityOverlap)
                    currentScore += 10;
                if (riskOverlap)
                    currentScore += 10;
                // Same-month match slightly preferred but weighted less
                if (!monthsDiff) {
                    currentScore += 5;
                }
                if (currentScore > highestScore) {
                    highestScore = currentScore;
                    bestMatch = d;
                    isReversal = monthsDiff;
                    matchReason = isReversal ? 'Reversal (Same Amount, Different Month)' :
                        (entityOverlap || riskOverlap ? 'Semantic + Syntactic Match' : 'Syntactic Match');
                }
            }
            if (bestMatch) {
                const finalScore = Math.min(100, highestScore);
                const threshold = isReversal ? 60 : ReconciliationEngine.NARRATION_THRESHOLD;
                if (highestScore >= threshold) {
                    this.recordMatch(credit, [bestMatch], finalScore, finalScore, isReversal && highestScore < 60, 'M', credit.reference, credit.details, matchReason);
                    // Remove from the map so it's not matched again
                    const list = debitsByAmount.get(amtKey);
                    const idx = list.findIndex(d => d.id === bestMatch.id);
                    if (idx !== -1)
                        list.splice(idx, 1);
                }
            }
        }
    }
    matchByReference() {
        const unmatchedDebitsPool = this.getUnmatchedDebits();
        const unmatchedCredits = this.getUnmatchedCredits();
        // Create a lookup map for unmatched debits by each individual reference found
        const debitRefMap = new Map();
        for (const d of unmatchedDebitsPool) {
            if (d.reference) {
                const refs = d.reference.split('|');
                for (const r of refs) {
                    const list = debitRefMap.get(r) || [];
                    list.push(d);
                    debitRefMap.set(r, list);
                }
            }
        }
        for (const credit of unmatchedCredits) {
            if (!credit.reference)
                continue;
            const creditRefs = credit.reference.split('|');
            for (const r of creditRefs) {
                const candidates = debitRefMap.get(r);
                if (!candidates)
                    continue;
                // Strictly enforce exact amount match even with reference match
                const bestMatchIndex = candidates.findIndex(d => {
                    const diff = Math.abs(d.absAmount - credit.absAmount);
                    return diff < 0.01;
                });
                if (bestMatchIndex !== -1) {
                    const bestMatch = candidates[bestMatchIndex];
                    // Safety: Check name similarity even with reference match to prevent cross-person mismatches
                    const cleanCredit = this.cleanNarration(credit.details);
                    const cleanDebit = this.cleanNarration(bestMatch.details);
                    const nameScore = token_set_ratio(cleanCredit, cleanDebit);
                    if (nameScore < 80 && credit.details.trim().toUpperCase() !== bestMatch.details.trim().toUpperCase()) {
                        continue;
                    }
                    const variance = credit.absAmount - bestMatch.absAmount;
                    const remark = Math.abs(variance) < 0.01 ? 'Exact Reference Match' : `Ref Match with Var: ${variance.toFixed(2)}`;
                    this.recordMatch(credit, [bestMatch], 100, 100, false, 'M', r, credit.details, remark);
                    // Remove from candidates and pool
                    candidates.splice(bestMatchIndex, 1);
                    break;
                }
            }
        }
    }
    matchBankVsGL() {
        const unmatchedDebitsPool = this.getUnmatchedDebits();
        const unmatchedCredits = this.getUnmatchedCredits();
        // Sort both pools by date to respect chronological order
        unmatchedDebitsPool.sort((a, b) => a.date.getTime() - b.date.getTime());
        unmatchedCredits.sort((a, b) => a.date.getTime() - b.date.getTime());
        // Group debits by amount for O(1) lookup
        const debitsByAmount = new Map();
        for (const d of unmatchedDebitsPool) {
            const amtKey = d.absAmount.toFixed(2);
            const list = debitsByAmount.get(amtKey) || [];
            list.push(d);
            debitsByAmount.set(amtKey, list);
        }
        for (const credit of unmatchedCredits) {
            let bestMatch = null;
            let highestScore = -1;
            const amtKey = credit.absAmount.toFixed(2);
            const amountCandidates = debitsByAmount.get(amtKey);
            if (!amountCandidates || amountCandidates.length === 0)
                continue;
            const candidates = amountCandidates.filter(d => {
                const diffDays = Math.abs(d.date.getTime() - credit.date.getTime()) / (1000 * 60 * 60 * 24);
                if (diffDays > ReconciliationEngine.DATE_WINDOW_DAYS)
                    return false;
                // Source check: must match Bank entry with GL entry
                if (d.source === credit.source)
                    return false;
                return true;
            });
            for (const d of candidates) {
                const cleanCreditDetails = this.cleanNarration(credit.details);
                const cleanDebitDetails = this.cleanNarration(d.details);
                let fuzzyScore = token_set_ratio(cleanCreditDetails, cleanDebitDetails);
                // Safety: If cleaned narrations are empty, don't match unless raw details are identical
                if (!cleanCreditDetails && !cleanDebitDetails) {
                    if (credit.details.trim().toUpperCase() !== d.details.trim().toUpperCase()) {
                        fuzzyScore = 0;
                    }
                    else {
                        fuzzyScore = 100;
                    }
                }
                // Base Requirement: Strict gate for names similarity even in Bank vs GL
                if (fuzzyScore < 95 && credit.details.trim().toUpperCase() !== d.details.trim().toUpperCase()) {
                    continue;
                }
                if (fuzzyScore < ReconciliationEngine.NARRATION_THRESHOLD)
                    continue;
                if (fuzzyScore > highestScore) {
                    highestScore = fuzzyScore;
                    bestMatch = d;
                }
                else if (fuzzyScore === highestScore) {
                    if (bestMatch) {
                        const currentBestDiff = Math.abs(bestMatch.date.getTime() - credit.date.getTime());
                        const newDiff = Math.abs(d.date.getTime() - credit.date.getTime());
                        if (newDiff < currentBestDiff)
                            bestMatch = d;
                    }
                    else {
                        bestMatch = d;
                    }
                }
            }
            if (bestMatch) {
                const variance = credit.absAmount - bestMatch.absAmount;
                const remark = Math.abs(variance) < 0.01 ? 'Exact Match' : `Fee Diff: ${variance.toFixed(2)}`;
                const confidence = highestScore;
                const humanReviewRequired = confidence < 70;
                this.recordMatch(credit, [bestMatch], highestScore, confidence, humanReviewRequired, 'M', credit.reference, credit.details, remark);
                // Remove from the map
                const list = debitsByAmount.get(amtKey);
                const idx = list.findIndex(d => d.id === bestMatch.id);
                if (idx !== -1)
                    list.splice(idx, 1);
            }
        }
    }
    recordMatch(credit, debits, score, confidence, humanReviewRequired, type, ref, keyword, remark) {
        const matchId = uuidv4();
        this.matches.push({
            matchId,
            accuracyScore: score,
            confidence,
            humanReviewRequired,
            matchType: type,
            matchingReference: ref,
            matchingKeyword: keyword,
            remark,
            creditRows: [credit],
            debitRows: debits
        });
        this.unmatchedCredits.delete(credit.id);
        debits.forEach(d => this.unmatchedDebits.delete(d.id));
    }
    getUnmatchedCredits() {
        return this.credits.filter(c => this.unmatchedCredits.has(c.id));
    }
    getUnmatchedDebits() {
        return this.debits.filter(d => this.unmatchedDebits.has(d.id));
    }
    formatDate(date) {
        if (!date || isNaN(date.getTime()) || date.getTime() === 0)
            return '';
        const d = new Date(date);
        let month = '' + (d.getMonth() + 1);
        let day = '' + d.getDate();
        const year = d.getFullYear();
        if (month.length < 2)
            month = '0' + month;
        if (day.length < 2)
            day = '0' + day;
        // Use DD/MM/YYYY to avoid US/UK confusion
        return `${day}/${month}/${year}`;
    }
    generateOutput() {
        const reconciled = [];
        // Matched items
        this.matches.forEach(m => {
            // For One-to-Many or Many-to-One, we want to output one row per "primary" entry
            // In INTERNAL mode, we'll output one row per debit entry in the match
            // In BANK_VS_GL mode, we'll output one row per GL entry in the match
            if (this.mode === 'INTERNAL') {
                const credit = m.creditRows[0];
                m.debitRows.forEach(debit => {
                    // Get all unique dates from debits in case of many-to-one
                    const debitDates = Array.from(new Set(m.debitRows.map(d => this.formatDate(d.date)))).join(' | ');
                    reconciled.push({
                        // Debits Side
                        'Debits - Post Date': debitDates,
                        'Debits - Val Date': debitDates,
                        'Debits - Details': debit.details,
                        'Debits - Amount': debit.absAmount,
                        'Debits - Reference (Extracted)': debit.reference,
                        'Match Type': m.matchType,
                        'Matching Reference': m.matchingReference,
                        'Matching Keyword': m.matchingKeyword,
                        'Remark': m.remark,
                        'Confidence Score': m.confidence.toFixed(2),
                        'Human Review Flag': m.humanReviewRequired ? 'Yes' : 'No',
                        // Credits Side
                        'Credits - Post Date': this.formatDate(credit.date),
                        'Credits - Val Date': this.formatDate(credit.date),
                        'Credits - Details': credit.details,
                        'Credits - Amount': credit.absAmount,
                        'Credits - Reference (Extracted)': credit.reference,
                        'Match Report - Match Type': m.matchType,
                        'Credits - Matching Reference': m.matchingReference,
                        'Credits - Matching Keyword': m.matchingKeyword,
                        'Credits - Remark': m.remark,
                        'Match ID': m.matchId,
                    });
                });
            }
            else {
                // BANK_VS_GL mode
                // Find GL items and Bank items
                const glItems = m.creditRows.filter(c => c.source === 'GL').concat(m.debitRows.filter(d => d.source === 'GL'));
                const bankItems = m.creditRows.filter(c => c.source === 'BANK').concat(m.debitRows.filter(d => d.source === 'BANK'));
                // Output one row per GL item
                glItems.forEach(glItem => {
                    // For each GL item, we match it against the first bank item (or a summary)
                    const stmtItem = bankItems[0];
                    reconciled.push({
                        'Match ID': m.matchId,
                        'User ID': 'admin',
                        // GL Side
                        'GL Post Date': this.formatDate(glItem.date),
                        'GL Val Date': this.formatDate(glItem.date),
                        'GL Details': glItem.details,
                        'GL Amount': glItem.absAmount,
                        'GL Match Type': m.matchType,
                        'GL Matching Reference': glItem.reference,
                        'GL Matching Keyword': glItem.details,
                        'GL Remark': m.remark,
                        'GL Confidence Score': m.confidence.toFixed(2),
                        'GL Human Review Flag': m.humanReviewRequired ? 'Yes' : 'No',
                        // Statement Side
                        'Statement Post Date': stmtItem ? this.formatDate(stmtItem.date) : '',
                        'Statement Val Date': stmtItem ? this.formatDate(stmtItem.date) : '',
                        'Statement Details': stmtItem ? stmtItem.details : '',
                        'Statement Amount': stmtItem ? stmtItem.absAmount : 0,
                        'Statement Match Type': m.matchType,
                        'Statement Matching Reference': stmtItem ? stmtItem.reference : '',
                        'Statement Matching Keyword': stmtItem ? stmtItem.details : '',
                        'Statement Remark': m.remark,
                    });
                });
            }
        });
        const exceptions = [];
        // Unmatched GL / Debits
        this.getUnmatchedDebits().forEach(d => {
            exceptions.push({
                'Date': this.formatDate(d.date),
                'Reference': d.reference,
                'Details': d.details,
                'Debits': d.debit,
                'Credits': d.credit
            });
        });
        // Unmatched GL Credits / Credits
        this.getUnmatchedCredits().forEach(c => {
            exceptions.push({
                'Date': this.formatDate(c.date),
                'Reference': c.reference,
                'Details': c.details,
                'Debits': c.debit,
                'Credits': c.credit
            });
        });
        return { reconciled, exceptions };
    }
}
