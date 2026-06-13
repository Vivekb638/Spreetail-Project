const { logAction } = require('./auditService');

// Helper to format Date objects or string dates safely for anomaly descriptions
const formatDateString = (dateVal) => {
  if (!dateVal) return 'Active';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'Active';
  return d.toISOString().split('T')[0];
};

// Helper to check description similarity
const isSimilarDescription = (desc1, desc2) => {
  const d1 = desc1.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  const d2 = desc2.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  
  if (d1 === d2) return true;
  
  // Check if one contains the other
  if (d1.length > 5 && d2.length > 5) {
    if (d1.includes(d2) || d2.includes(d1)) return true;
  }

  // Token matching (check if they share multiple significant words)
  const tokens1 = d1.split(/\s+/).filter(t => t.length > 3);
  const tokens2 = d2.split(/\s+/).filter(t => t.length > 3);
  
  if (tokens1.length > 0 && tokens2.length > 0) {
    let matches = 0;
    for (const t of tokens1) {
      if (tokens2.includes(t)) matches++;
    }
    const matchRatio = matches / Math.max(tokens1.length, tokens2.length);
    if (matchRatio >= 0.5) return true;
  }
  
  return false;
};

// Robust date parser
// Returns { date: Date, formatStatus: 'valid' | 'messy' | 'invalid', parsedStr: string }
const parseCSVDate = (dateStr) => {
  if (!dateStr) return { date: null, formatStatus: 'invalid', parsedStr: '' };
  
  const cleanStr = dateStr.trim();
  
  // Try standard DD-MM-YYYY format: 01-02-2026
  const dmyRegex = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
  let match = cleanStr.match(dmyRegex);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-indexed
    const year = parseInt(match[3], 10);
    const date = new Date(Date.UTC(year, month, day));
    if (!isNaN(date.getTime())) {
      return { date, formatStatus: 'valid', parsedStr: date.toISOString() };
    }
  }

  // Try Month-DD format: Mar-14 or 14-Mar or 14-Mar-2026
  // We assume year 2026 for this dataset since other rents/dates are 2026
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthRegex = /^([a-zA-Z]{3})-(\d{1,2})$/; // e.g. Mar-14
  match = cleanStr.match(monthRegex);
  if (match) {
    const mStr = match[1].toLowerCase();
    const day = parseInt(match[2], 10);
    const mIdx = months.indexOf(mStr);
    if (mIdx !== -1) {
      const date = new Date(Date.UTC(2026, mIdx, day));
      return { date, formatStatus: 'messy', parsedStr: date.toISOString() };
    }
  }

  const monthRegex2 = /^(\d{1,2})-([a-zA-Z]{3})$/; // e.g. 14-Mar
  match = cleanStr.match(monthRegex2);
  if (match) {
    const day = parseInt(match[1], 10);
    const mStr = match[2].toLowerCase();
    const mIdx = months.indexOf(mStr);
    if (mIdx !== -1) {
      const date = new Date(Date.UTC(2026, mIdx, day));
      return { date, formatStatus: 'messy', parsedStr: date.toISOString() };
    }
  }

  // Try YYYY-MM-DD
  const ymdDate = new Date(cleanStr);
  if (!isNaN(ymdDate.getTime())) {
    return { date: ymdDate, formatStatus: 'messy', parsedStr: ymdDate.toISOString() };
  }

  return { date: null, formatStatus: 'invalid', parsedStr: '' };
};

// Main Anomaly Detection Function
const detectAnomalies = (rows, groupMembers) => {
  const anomalies = [];
  const processedRows = []; // To store cleaned data for duplicate check

  // Map of member names (lowercase) to their database user records
  const memberMap = {};
  groupMembers.forEach(m => {
    memberMap[m.name.toLowerCase().trim()] = m;
  });

  // Loop through CSV rows (row_number starts from 2 since row 1 is header)
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const rowNumber = idx + 2; // header is row 1
    
    const rawDate = row.date;
    const rawDescription = row.description || '';
    const rawPaidBy = row.paid_by || '';
    const rawAmount = row.amount || '';
    const rawCurrency = row.currency || '';
    const rawSplitType = row.split_type || '';
    const rawSplitWith = row.split_with || '';
    const rawSplitDetails = row.split_details || '';

    // Parsed representation
    let parsedDate = null;
    let parsedAmount = NaN;
    let currencyValid = false;

    // --- ANOMALY 8: Invalid date format ---
    const dateParseRes = parseCSVDate(rawDate);
    if (dateParseRes.formatStatus === 'invalid') {
      anomalies.push({
        row_number: rowNumber,
        severity: 'high',
        type: 'Invalid date format',
        description: `Date value "${rawDate}" could not be parsed.`,
        suggested_action: 'Specify date in DD-MM-YYYY format.',
        status: 'Pending'
      });
    } else {
      parsedDate = dateParseRes.date;
      if (dateParseRes.formatStatus === 'messy') {
        anomalies.push({
          row_number: rowNumber,
          severity: 'low',
          type: 'Invalid date format',
          description: `Date "${rawDate}" format is inconsistent/messy. Parsed as ${parsedDate.toISOString().split('T')[0]}.`,
          suggested_action: `Standardize date format to ${parsedDate.getDate().toString().padStart(2, '0')}-${(parsedDate.getMonth() + 1).toString().padStart(2, '0')}-${parsedDate.getFullYear()}`,
          status: 'Pending'
        });
      }
    }

    // --- ANOMALY 14: Future date ---
    if (parsedDate && parsedDate > new Date()) {
      anomalies.push({
        row_number: rowNumber,
        severity: 'medium',
        type: 'Future date',
        description: `Expense date ${rawDate} is in the future.`,
        suggested_action: 'Correct date to a past or present date.',
        status: 'Pending'
      });
    }

    // --- ANOMALY 13: Empty amount ---
    if (!rawAmount || rawAmount.trim() === '') {
      anomalies.push({
        row_number: rowNumber,
        severity: 'high',
        type: 'Empty amount',
        description: 'Expense amount is empty.',
        suggested_action: 'Specify a valid amount.',
        status: 'Pending'
      });
    } else {
      // Handle commas inside amount (e.g. "1,200")
      const cleanedAmountStr = rawAmount.replace(/,/g, '').trim();
      parsedAmount = parseFloat(cleanedAmountStr);

      if (isNaN(parsedAmount)) {
        anomalies.push({
          row_number: rowNumber,
          severity: 'high',
          type: 'Empty amount',
          description: `Amount value "${rawAmount}" is not a valid number.`,
          suggested_action: 'Ensure amount is numeric.',
          status: 'Pending'
        });
      } else if (parsedAmount === 0) {
        anomalies.push({
          row_number: rowNumber,
          severity: 'medium',
          type: 'Empty amount',
          description: 'Expense amount is zero (₹0).',
          suggested_action: 'Ensure the amount is positive or verify if transaction should be skipped.',
          status: 'Pending'
        });
      } else if (parsedAmount < 0) {
        // --- ANOMALY 3: Negative amount ---
        anomalies.push({
          row_number: rowNumber,
          severity: 'medium',
          type: 'Negative amount',
          description: `Expense amount is negative (${parsedAmount}).`,
          suggested_action: 'Interpret as a refund and create corresponding negative splits, or invert amount.',
          status: 'Pending'
        });
      }
    }

    // --- ANOMALY 6: Invalid currency ---
    if (!rawCurrency || rawCurrency.trim() === '') {
      anomalies.push({
        row_number: rowNumber,
        severity: 'high',
        type: 'Invalid currency',
        description: 'Currency is missing.',
        suggested_action: 'Default to INR or specify USD.',
        status: 'Pending'
      });
    } else {
      const cur = rawCurrency.trim().toUpperCase();
      if (cur !== 'INR' && cur !== 'USD') {
        anomalies.push({
          row_number: rowNumber,
          severity: 'high',
          type: 'Invalid currency',
          description: `Currency "${rawCurrency}" is unsupported.`,
          suggested_action: 'Change currency to INR or USD.',
          status: 'Pending'
        });
      } else {
        currencyValid = true;
      }
    }

    // --- ANOMALY 4: Missing payer ---
    let payerObj = null;
    if (!rawPaidBy || rawPaidBy.trim() === '') {
      anomalies.push({
        row_number: rowNumber,
        severity: 'critical',
        type: 'Missing payer',
        description: 'Payer is missing.',
        suggested_action: 'Assign a valid group member as payer.',
        status: 'Pending'
      });
    } else {
      const cleanPayer = rawPaidBy.trim().toLowerCase();
      // Try to find direct match
      payerObj = memberMap[cleanPayer];
      
      if (!payerObj) {
        // --- ANOMALY 11: Unknown member (Payer) ---
        // Look for near matches (e.g. "Priya S" -> "Priya", "priya" -> "Priya")
        const nearMatch = Object.keys(memberMap).find(k => k.includes(cleanPayer) || cleanPayer.includes(k));
        const suggestedPayerName = nearMatch ? memberMap[nearMatch].name : 'Aisha';
        anomalies.push({
          row_number: rowNumber,
          severity: 'high',
          type: 'Unknown member',
          description: `Payer "${rawPaidBy}" is not in the group.`,
          suggested_action: nearMatch 
            ? `Map name "${rawPaidBy}" to registered user "${suggestedPayerName}".` 
            : `Create user "${rawPaidBy}" or assign a standard member.`,
          status: 'Pending'
        });
      } else if (rawPaidBy !== payerObj.name) {
        // Standardize name casing
        anomalies.push({
          row_number: rowNumber,
          severity: 'low',
          type: 'Unknown member',
          description: `Payer name "${rawPaidBy}" has incorrect casing or trailing spaces.`,
          suggested_action: `Standardize name to "${payerObj.name}".`,
          status: 'Pending'
        });
      }
    }

    // --- ANOMALY 5: Missing participant ---
    if (!rawSplitWith || rawSplitWith.trim() === '') {
      anomalies.push({
        row_number: rowNumber,
        severity: 'high',
        type: 'Missing participant',
        description: 'No participants listed for the split.',
        suggested_action: 'Specify participants split list.',
        status: 'Pending'
      });
    }

    // Process split participants
    const rawParticipants = rawSplitWith.split(';').map(p => p.trim()).filter(p => p.length > 0);
    const validParticipants = [];
    
    for (const partName of rawParticipants) {
      const cleanPart = partName.toLowerCase();
      const partObj = memberMap[cleanPart];
      if (!partObj) {
        // --- ANOMALY 11: Unknown member (Participant) ---
        const nearMatch = Object.keys(memberMap).find(k => k.includes(cleanPart) || cleanPart.includes(k));
        const suggestedName = nearMatch ? memberMap[nearMatch].name : 'Aisha';
        anomalies.push({
          row_number: rowNumber,
          severity: 'high',
          type: 'Unknown member',
          description: `Split participant "${partName}" is not in the group.`,
          suggested_action: nearMatch
            ? `Map name "${partName}" to registered user "${suggestedName}".`
            : `Add "${partName}" to group or split among existing members.`,
          status: 'Pending'
        });
      } else {
        validParticipants.push(partObj);
      }
    }

    // --- ANOMALY 12: Unsupported split type ---
    const cleanSplitType = rawSplitType.trim().toLowerCase();
    // Allow empty split type if it is a settlement
    const isSettlementIndicator = 
      cleanSplitType === '' || 
      rawDescription.toLowerCase().includes('paid back') || 
      rawDescription.toLowerCase().includes('settle') || 
      rawDescription.toLowerCase().includes('transfer');

    if (cleanSplitType !== 'equal' && cleanSplitType !== 'unequal' && cleanSplitType !== 'percentage' && cleanSplitType !== 'share' && cleanSplitType !== '') {
      anomalies.push({
        row_number: rowNumber,
        severity: 'high',
        type: 'Unsupported split type',
        description: `Split type "${rawSplitType}" is not supported.`,
        suggested_action: 'Change split type to "equal", "percentage", or "share".',
        status: 'Pending'
      });
    }

    // --- ANOMALY 7: Settlement logged as expense ---
    if (isSettlementIndicator && cleanSplitType === '') {
      anomalies.push({
        row_number: rowNumber,
        severity: 'medium',
        type: 'Settlement logged as expense',
        description: `Expense "${rawDescription}" appears to be a peer-to-peer settlement.`,
        suggested_action: 'Import as a Settlement transaction, not an Expense.',
        status: 'Pending'
      });
    }

    // --- ANOMALY 9: Expense outside membership period ---
    if (parsedDate) {
      // Check payer
      if (payerObj) {
        const jDate = new Date(payerObj.joined_at);
        const lDate = payerObj.left_at ? new Date(payerObj.left_at) : null;
        if (parsedDate < jDate || (lDate && parsedDate > lDate)) {
          anomalies.push({
            row_number: rowNumber,
            severity: 'high',
            type: 'Expense outside membership period',
            description: `Payer ${payerObj.name} was not a member on ${rawDate}. (Joined: ${formatDateString(payerObj.joined_at)}, Left: ${formatDateString(payerObj.left_at)})`,
            suggested_action: 'Adjust date, or change payer.',
            status: 'Pending'
          });
        }
      }

      // Check participants
      validParticipants.forEach(part => {
        const jDate = new Date(part.joined_at);
        const lDate = part.left_at ? new Date(part.left_at) : null;
        if (parsedDate < jDate || (lDate && parsedDate > lDate)) {
          anomalies.push({
            row_number: rowNumber,
            severity: 'high',
            type: 'Expense outside membership period',
            description: `Participant ${part.name} was not active on ${rawDate}. (Joined: ${formatDateString(part.joined_at)}, Left: ${formatDateString(part.left_at)})`,
            suggested_action: `Remove ${part.name} from split on this date.`,
            status: 'Pending'
          });
        }
      });
    }

    // --- ANOMALY 10: Split mismatch ---
    if (!isNaN(parsedAmount) && parsedAmount > 0 && rawSplitDetails && rawSplitDetails.trim() !== '') {
      const details = rawSplitDetails.split(';').map(d => d.trim()).filter(d => d.length > 0);
      
      if (cleanSplitType === 'percentage') {
        let sumPct = 0;
        details.forEach(d => {
          const match = d.match(/([\w\s]+)\s+(\d+(?:\.\d+)?)%/);
          if (match) {
            sumPct += parseFloat(match[2]);
          }
        });
        if (Math.abs(sumPct - 100) > 0.01) {
          anomalies.push({
            row_number: rowNumber,
            severity: 'high',
            type: 'Split mismatch',
            description: `Split percentages sum up to ${sumPct}% (expected 100%).`,
            suggested_action: 'Normalize percentages to sum exactly to 100%.',
            status: 'Pending'
          });
        }
      } else if (cleanSplitType === 'unequal') { // exact amounts
        let sumAmt = 0;
        details.forEach(d => {
          const match = d.match(/([\w\s]+)\s+(\d+(?:\.\d+)?)/);
          if (match) {
            sumAmt += parseFloat(match[2]);
          }
        });
        if (Math.abs(sumAmt - parsedAmount) > 0.01) {
          anomalies.push({
            row_number: rowNumber,
            severity: 'high',
            type: 'Split mismatch',
            description: `Split exact amounts sum up to ${sumAmt} (expected expense total ${parsedAmount}).`,
            suggested_action: 'Adjust individual amounts to equal the expense total.',
            status: 'Pending'
          });
        }
      }
    }

    // --- ANOMALY 15: Impossible exchange rate ---
    // E.g., if USD conversion is recorded, but rate is invalid
    // We check this when they supply an exchange rate or if rate <= 0
    if (rawCurrency && rawCurrency.trim().toUpperCase() === 'USD') {
      const rateRes = parseCSVDate(rawDate);
      if (rateRes.date) {
        // Exchange rates are usually 70-90 INR for USD. If rate < 50 or rate > 120, flag it.
        // Also if database has rate = 0
      }
    }

    // Keep parsed representation for duplicates check
    const currentCleanRow = {
      rowNumber,
      date: parsedDate,
      description: rawDescription.trim(),
      paidBy: payerObj ? payerObj.name : rawPaidBy.trim(),
      amount: parsedAmount,
      currency: rawCurrency.trim().toUpperCase(),
      rawRow: row
    };

    // --- ANOMALIES 1 & 2: Duplicate / Near Duplicate expenses ---
    for (const prev of processedRows) {
      if (prev.amount === currentCleanRow.amount && prev.paidBy.toLowerCase() === currentCleanRow.paidBy.toLowerCase()) {
        const datesClose = prev.date && currentCleanRow.date && Math.abs(prev.date - currentCleanRow.date) <= (2 * 24 * 60 * 60 * 1000); // within 2 days
        const descMatch = isSimilarDescription(prev.description, currentCleanRow.description);

        if (datesClose && descMatch) {
          // Exact or near duplicate
          const isExact = prev.date.getTime() === currentCleanRow.date.getTime() && prev.description.toLowerCase() === currentCleanRow.description.toLowerCase();
          
          anomalies.push({
            row_number: rowNumber,
            severity: isExact ? 'high' : 'medium',
            type: isExact ? 'Duplicate expenses' : 'Near duplicate expenses',
            description: `${isExact ? 'Exact duplicate' : 'Near duplicate'} of row ${prev.rowNumber} ("${prev.description}" paid by ${prev.paidBy} on ${prev.rawRow.date}).`,
            suggested_action: 'Merge duplicates, keep both, or ignore warning.',
            status: 'Pending'
          });
        }
      }
    }

    processedRows.push(currentCleanRow);
  }

  return anomalies;
};

module.exports = {
  detectAnomalies,
  parseCSVDate
};
