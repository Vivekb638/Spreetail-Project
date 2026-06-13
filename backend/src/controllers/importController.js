const { parse } = require('csv-parse/sync');
const PDFDocument = require('pdfkit');
const db = require('../config/db');
const { detectAnomalies, parseCSVDate } = require('../services/anomalyEngine');
const { logAction } = require('../services/auditService');

// POST /imports/csv
const uploadCSV = async (req, res) => {
  const { csvData, filename, group_id } = req.body;
  const userId = req.user.id;

  if (!csvData || !filename || !group_id) {
    return res.status(400).json({ error: 'csvData, filename, and group_id are required.' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch group members (both active and past) to detect timeline anomalies
    const membersRes = await client.query(
      `SELECT gm.id, gm.joined_at, gm.left_at, u.id as user_id, u.name, u.email
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1`,
      [group_id]
    );
    const groupMembers = membersRes.rows;

    if (groupMembers.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'The specified group has no members. Add members first.' });
    }

    // 2. Parse CSV
    let records;
    try {
      records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
    } catch (parseErr) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `CSV Parsing error: ${parseErr.message}` });
    }

    // 3. Run Anomaly Detection
    const detected = detectAnomalies(records, groupMembers);

    const totalRows = records.length;
    const flaggedRows = new Set(detected.map(a => a.row_number)).size;
    const invalidRows = new Set(detected.filter(a => a.severity === 'high' || a.severity === 'critical').map(a => a.row_number)).size;
    const validRows = totalRows - flaggedRows;

    // 4. Create Import Record
    const importRes = await client.query(
      `INSERT INTO imports (group_id, filename, status, total_rows, imported_rows, valid_rows, invalid_rows, flagged_rows, created_by)
       VALUES ($1, $2, 'pending', $3, 0, $4, $5, $6, $7) RETURNING *`,
      [group_id, filename, totalRows, validRows, invalidRows, flaggedRows, userId]
    );
    const importRecord = importRes.rows[0];

    // 5. Save Import Rows
    for (let i = 0; i < records.length; i++) {
      await client.query(
        `INSERT INTO import_rows (import_id, row_number, raw_data, status)
         VALUES ($1, $2, $3, 'parsed')`,
        [importRecord.id, i + 2, JSON.stringify(records[i])]
      );
    }

    // 6. Save Anomalies
    for (const anom of detected) {
      await client.query(
        `INSERT INTO anomalies (import_id, row_number, severity, type, description, suggested_action, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'Pending')`,
        [importRecord.id, anom.row_number, anom.severity, anom.type, anom.description, anom.suggested_action]
      );
    }

    // Audit Log
    await logAction({
      client,
      actionType: 'UPLOAD_IMPORT_CSV',
      entityType: 'import',
      entityId: importRecord.id,
      performedBy: userId,
      newValues: importRecord
    });

    await client.query('COMMIT');

    return res.status(201).json({
      message: 'CSV uploaded and analyzed.',
      import: importRecord,
      anomalies: detected,
      summary: {
        totalRows,
        validRows,
        invalidRows,
        flaggedRows
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('uploadCSV error:', err);
    return res.status(500).json({ error: 'Database error importing CSV file.' });
  } finally {
    client.release();
  }
};

// GET /imports/:id/anomalies
const getImportAnomalies = async (req, res) => {
  const importId = req.params.id;
  try {
    const result = await db.query(
      'SELECT * FROM anomalies WHERE import_id = $1 ORDER BY row_number ASC, severity DESC',
      [importId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('getImportAnomalies error:', err);
    return res.status(500).json({ error: 'Database error fetching anomalies.' });
  }
};

// GET /imports/:id/report
const getImportReport = async (req, res) => {
  const importId = req.params.id;
  try {
    const importRes = await db.query('SELECT * FROM imports WHERE id = $1', [importId]);
    if (importRes.rows.length === 0) {
      return res.status(404).json({ error: 'Import not found.' });
    }

    const anomaliesRes = await db.query(
      'SELECT * FROM anomalies WHERE import_id = $1 ORDER BY row_number ASC',
      [importId]
    );

    return res.json({
      import: importRes.rows[0],
      anomalies: anomaliesRes.rows
    });
  } catch (err) {
    console.error('getImportReport error:', err);
    return res.status(500).json({ error: 'Database error retrieving report.' });
  }
};

// POST /imports/:id/approve
// Body: { resolutions: { [anomalyId]: { decision: 'merge'|'keep_both'|'ignore_warning'|'map_user'|'fix_manual', data: { ... } } } }
const approveImport = async (req, res) => {
  const importId = req.params.id;
  const { resolutions = {} } = req.body;
  const userId = req.user.id;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch import metadata
    const importRes = await client.query('SELECT * FROM imports WHERE id = $1', [importId]);
    if (importRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Import record not found.' });
    }
    const importRecord = importRes.rows[0];

    if (importRecord.status === 'completed' || importRecord.status === 'rejected') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Import is already ${importRecord.status}.` });
    }

    // 2. Fetch all anomalies for this import
    const anomaliesRes = await client.query('SELECT * FROM anomalies WHERE import_id = $1', [importId]);
    const dbAnomalies = anomaliesRes.rows;

    // Check if there are unhandled high/critical anomalies
    const pendingHigh = dbAnomalies.filter(a => 
      a.status === 'Pending' && 
      (a.severity === 'high' || a.severity === 'critical') && 
      !resolutions[a.id]
    );

    if (pendingHigh.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'Cannot approve import. There are unhandled high/critical severity anomalies.',
        pendingAnomalies: pendingHigh
      });
    }

    // 3. Save resolutions in database
    for (const anom of dbAnomalies) {
      const resData = resolutions[anom.id];
      if (resData) {
        await client.query(
          `UPDATE anomalies 
           SET status = 'Approved', decision = $1, fixed_data = $2
           WHERE id = $3`,
          [resData.decision, resData.data ? JSON.stringify(resData.data) : null, anom.id]
        );
      } else if (anom.status === 'Pending') {
        // Automatically approve/ignore warnings if low severity and no specific resolution provided
        await client.query(
          `UPDATE anomalies SET status = 'Approved', decision = 'ignore_warning' WHERE id = $1`,
          [anom.id]
        );
      }
    }

    // Fetch refreshed group members map
    const membersRes = await client.query(
      `SELECT gm.id as membership_id, u.id as user_id, u.name, u.email
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1`,
      [importRecord.group_id]
    );
    const groupMembers = membersRes.rows;
    const memberNameMap = {};
    groupMembers.forEach(m => {
      memberNameMap[m.name.toLowerCase().trim()] = m.user_id;
    });

    // 4. Process and insert the rows
    const rowsRes = await client.query('SELECT * FROM import_rows WHERE import_id = $1 ORDER BY row_number ASC', [importId]);
    const importRows = rowsRes.rows;

    // Build an anomaly resolution map by row_number
    const updatedAnomsRes = await client.query('SELECT * FROM anomalies WHERE import_id = $1', [importId]);
    const resolvedAnomalies = updatedAnomsRes.rows;
    const anomalyMap = {};
    resolvedAnomalies.forEach(a => {
      if (!anomalyMap[a.row_number]) anomalyMap[a.row_number] = [];
      anomalyMap[a.row_number].push(a);
    });

    let importedCount = 0;

    for (const row of importRows) {
      const rowNum = row.row_number;
      const data = row.raw_data;
      const rowAnoms = anomalyMap[rowNum] || [];

      // Check resolutions for duplicates/skips
      const mergeAnom = rowAnoms.find(a => a.type === 'Duplicate expenses' || a.type === 'Near duplicate expenses');
      if (mergeAnom && mergeAnom.decision === 'merge') {
        // Skip inserting this duplicate row
        await client.query("UPDATE import_rows SET status = 'ignored' WHERE id = $1", [row.id]);
        continue; 
      }

      // Check if logged as settlement resolution
      const setlAnom = rowAnoms.find(a => a.type === 'Settlement logged as expense');
      const forceSettlement = setlAnom && setlAnom.decision === 'map_settlement';

      // 1. Resolve Payer ID
      let payerName = data.paid_by;
      let payerId = null;

      // Check if there was a user mapping resolution for payer
      const payerAnom = rowAnoms.find(a => a.type === 'Unknown member' && a.description.includes('Payer'));
      if (payerAnom && payerAnom.decision === 'map_user' && payerAnom.fixed_data?.mappedUserId) {
        payerId = payerAnom.fixed_data.mappedUserId;
      } else {
        payerId = memberNameMap[payerName.toLowerCase().trim()] || null;
      }

      if (!payerId && !forceSettlement) {
        // Skip rows that have unresolved missing/unknown payer
        continue;
      }

      // 2. Resolve Amount
      let rawAmtStr = data.amount.replace(/,/g, '').trim();
      let amount = Math.abs(parseFloat(rawAmtStr)); // convert negative refunds into absolute (we will handle splits accordingly)
      
      const isRefund = parseFloat(rawAmtStr) < 0;

      // 3. Resolve Currency & Exchange Rate
      const currency = (data.currency || 'INR').trim().toUpperCase() || 'INR';
      let exchangeRate = 1.000000;
      
      // Look up rate for USD
      const dateParse = parseCSVDate(data.date);
      const effectiveDateStr = dateParse.date ? dateParse.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

      if (currency === 'USD') {
        const rateRes = await client.query(
          "SELECT rate FROM exchange_rates WHERE from_currency = 'USD' AND to_currency = 'INR' AND effective_date = $1",
          [effectiveDateStr]
        );
        if (rateRes.rows.length > 0) {
          exchangeRate = parseFloat(rateRes.rows[0].rate);
        } else {
          exchangeRate = 83.50; // fallback
        }
      }

      const amountInInr = amount * exchangeRate;

      // 4. Perform Insertion
      if (data.split_type === '' || forceSettlement) {
        // It is a Settlement!
        // Extract receiver
        let receiverName = data.split_with || '';
        let receiverId = null;
        
        const recAnom = rowAnoms.find(a => a.type === 'Unknown member' && a.description.includes('participant'));
        if (recAnom && recAnom.decision === 'map_user' && recAnom.fixed_data?.mappedUserId) {
          receiverId = recAnom.fixed_data.mappedUserId;
        } else {
          receiverId = memberNameMap[receiverName.toLowerCase().trim()] || null;
        }

        if (payerId && receiverId) {
          await client.query(
            `INSERT INTO settlements (group_id, payer_id, receiver_id, amount, currency, exchange_rate, converted_amount_in_inr, settlement_date, note)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [importRecord.group_id, payerId, receiverId, amount, currency, exchangeRate, amountInInr, dateParse.date || new Date(), data.notes || 'Imported settlement']
          );
          importedCount++;
          await client.query("UPDATE import_rows SET status = 'imported' WHERE id = $1", [row.id]);
        }
      } else {
        // It is an Expense!
        const title = data.description || 'Imported Expense';
        const description = data.notes || '';
        const splitType = data.split_type.trim().toLowerCase() || 'equal';

        // Save Expense
        const expInsert = await client.query(
          `INSERT INTO expenses (group_id, title, description, original_amount, original_currency, exchange_rate, converted_amount_in_inr, expense_date, paid_by, created_by, split_type)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
          [importRecord.group_id, title, description, amount, currency, exchangeRate, amountInInr, dateParse.date || new Date(), payerId, userId, splitType]
        );
        const expenseId = expInsert.rows[0].id;

        // Process Splits
        const rawSplitWith = data.split_with || '';
        const rawSplitDetails = data.split_details || '';

        const splitNames = rawSplitWith.split(';').map(n => n.trim().toLowerCase()).filter(n => n.length > 0);
        
        // Resolve participant user IDs
        const participantIds = [];
        for (const sName of splitNames) {
          // Check map resolutions
          const partAnom = rowAnoms.find(a => a.type === 'Unknown member' && a.description.includes(sName));
          if (partAnom && partAnom.decision === 'map_user' && partAnom.fixed_data?.mappedUserId) {
            participantIds.push(partAnom.fixed_data.mappedUserId);
          } else {
            const pId = memberNameMap[sName];
            if (pId) participantIds.push(pId);
          }
        }

        if (participantIds.length > 0) {
          if (splitType === 'equal') {
            const shareAmount = amountInInr / participantIds.length;
            for (const pId of participantIds) {
              await client.query(
                `INSERT INTO expense_splits (expense_id, user_id, split_value, owed_amount_in_inr)
                 VALUES ($1, $2, 1, $3)`,
                [expenseId, pId, shareAmount]
              );
            }
          } else if (splitType === 'percentage') {
            // Parse details e.g. Aisha 30%; Rohan 30%; Priya 30%; Meera 20%
            // But wait, the sum might have been 110%. If there was a split mismatch, did they normalize?
            // E.g., we can read mapping values or adjust them
            const detailsMap = {};
            rawSplitDetails.split(';').forEach(d => {
              const match = d.trim().match(/([\w\s]+)\s+(\d+(?:\.\d+)?)%/);
              if (match) {
                detailsMap[match[1].trim().toLowerCase()] = parseFloat(match[2]);
              }
            });

            // Calculate total details sum
            let totalPct = Object.values(detailsMap).reduce((a, b) => a + b, 0);
            if (totalPct === 0) totalPct = 100;

            for (const pId of participantIds) {
              // Lookup member name
              const memObj = groupMembers.find(m => m.user_id === pId);
              const pName = memObj ? memObj.name.toLowerCase() : '';
              const rawPct = detailsMap[pName] || (100 / participantIds.length);
              
              // Normalize if sum is not 100%
              const normalizedPct = (rawPct / totalPct) * 100;
              const shareAmount = (normalizedPct / 100) * amountInInr;

              await client.query(
                `INSERT INTO expense_splits (expense_id, user_id, split_value, owed_amount_in_inr)
                 VALUES ($1, $2, $3, $4)`,
                [expenseId, pId, normalizedPct, shareAmount]
              );
            }
          } else if (splitType === 'share' || splitType === 'unequal') {
            // share details: Aisha 1; Rohan 2; Priya 1; Dev 2
            // unequal details: Rohan 700; Priya 400; Meera 400
            const detailsMap = {};
            rawSplitDetails.split(';').forEach(d => {
              const match = d.trim().match(/([\w\s]+)\s+(\d+(?:\.\d+)?)/);
              if (match) {
                detailsMap[match[1].trim().toLowerCase()] = parseFloat(match[2]);
              }
            });

            if (splitType === 'share') {
              const totalShares = Object.values(detailsMap).reduce((a, b) => a + b, 0) || participantIds.length;
              for (const pId of participantIds) {
                const memObj = groupMembers.find(m => m.user_id === pId);
                const pName = memObj ? memObj.name.toLowerCase() : '';
                const shares = detailsMap[pName] || 1;
                const shareAmount = (shares / totalShares) * amountInInr;

                await client.query(
                  `INSERT INTO expense_splits (expense_id, user_id, split_value, owed_amount_in_inr)
                   VALUES ($1, $2, $3, $4)`,
                  [expenseId, pId, shares, shareAmount]
                );
              }
            } else { // unequal (exact amount)
              // We convert the exact original amount split to INR
              let totalExactAmt = Object.values(detailsMap).reduce((a, b) => a + b, 0);
              if (totalExactAmt === 0) totalExactAmt = amount;

              for (const pId of participantIds) {
                const memObj = groupMembers.find(m => m.user_id === pId);
                const pName = memObj ? memObj.name.toLowerCase() : '';
                const exactAmt = detailsMap[pName] || (amount / participantIds.length);
                
                // Convert to INR proportional to exchange rate
                const shareAmountInr = exactAmt * exchangeRate;

                await client.query(
                  `INSERT INTO expense_splits (expense_id, user_id, split_value, owed_amount_in_inr)
                   VALUES ($1, $2, $3, $4)`,
                  [expenseId, pId, exactAmt, shareAmountInr]
                );
              }
            }
          }
        }
        importedCount++;
        await client.query("UPDATE import_rows SET status = 'imported' WHERE id = $1", [row.id]);
      }
    }

    // 5. Update Import status
    await client.query(
      "UPDATE imports SET status = 'completed', imported_rows = $1 WHERE id = $2",
      [importedCount, importId]
    );

    // Audit Log
    await logAction({
      client,
      actionType: 'APPROVE_IMPORT_CSV',
      entityType: 'import',
      entityId: importId,
      performedBy: userId,
      newValues: { importedRows: importedCount, status: 'completed' }
    });

    await client.query('COMMIT');
    return res.json({ message: 'Import approved and executed successfully.', importedCount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('approveImport error:', err);
    return res.status(500).json({ error: 'Database error executing CSV import approval.' });
  } finally {
    client.release();
  }
};

// POST /imports/:id/reject
const rejectImport = async (req, res) => {
  const importId = req.params.id;
  const userId = req.user.id;

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const importRes = await client.query('SELECT * FROM imports WHERE id = $1', [importId]);
    if (importRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Import record not found.' });
    }
    const importRecord = importRes.rows[0];

    if (importRecord.status !== 'pending') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Import has already been ${importRecord.status}.` });
    }

    await client.query("UPDATE imports SET status = 'rejected' WHERE id = $1", [importId]);
    await client.query("UPDATE import_rows SET status = 'ignored' WHERE import_id = $1", [importId]);
    await client.query("UPDATE anomalies SET status = 'Rejected' WHERE import_id = $1", [importId]);

    // Audit Log
    await logAction({
      client,
      actionType: 'REJECT_IMPORT_CSV',
      entityType: 'import',
      entityId: importId,
      performedBy: userId
    });

    await client.query('COMMIT');
    return res.json({ message: 'Import rejected.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('rejectImport error:', err);
    return res.status(500).json({ error: 'Database error rejecting import.' });
  } finally {
    client.release();
  }
};

// GET /imports/:id/report/export
const exportReport = async (req, res) => {
  const importId = req.params.id;
  const { format } = req.query;

  try {
    const importRes = await db.query(
      `SELECT i.*, g.name as group_name 
       FROM imports i
       JOIN groups g ON i.group_id = g.id
       WHERE i.id = $1`, 
      [importId]
    );
    if (importRes.rows.length === 0) {
      return res.status(404).json({ error: 'Import not found.' });
    }
    const importRecord = importRes.rows[0];

    const anomaliesRes = await db.query(
      'SELECT * FROM anomalies WHERE import_id = $1 ORDER BY row_number ASC',
      [importId]
    );
    const anomalies = anomaliesRes.rows;

    const reportData = {
      summary: {
        filename: importRecord.filename,
        groupName: importRecord.group_name,
        status: importRecord.status,
        totalRows: importRecord.total_rows,
        importedRows: importRecord.imported_rows,
        validRows: importRecord.valid_rows,
        invalidRows: importRecord.invalid_rows,
        flaggedRows: importRecord.flagged_rows,
        createdAt: importRecord.created_at
      },
      anomalies: anomalies.map(a => ({
        rowNumber: a.row_number,
        severity: a.severity,
        type: a.type,
        description: a.description,
        suggestedAction: a.suggested_action,
        status: a.status,
        decision: a.decision
      }))
    };

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=import-report-${importId}.json`);
      return res.send(JSON.stringify(reportData, null, 2));
    }

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=import-report-${importId}.pdf`);

      doc.pipe(res);

      // Header
      doc.fontSize(20).text('CSV Import Validation Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated on: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);

      // Metadata Section
      doc.fontSize(14).text('Import Summary', { underline: true });
      doc.moveDown();
      doc.fontSize(11);
      doc.text(`Filename: ${reportData.summary.filename}`);
      doc.text(`Group: ${reportData.summary.groupName}`);
      doc.text(`Status: ${reportData.summary.status.toUpperCase()}`);
      doc.text(`Total Rows: ${reportData.summary.totalRows}`);
      doc.text(`Imported Rows: ${reportData.summary.importedRows}`);
      doc.text(`Valid Rows: ${reportData.summary.validRows}`);
      doc.text(`Invalid Rows (High/Critical): ${reportData.summary.invalidRows}`);
      doc.text(`Flagged Rows: ${reportData.summary.flaggedRows}`);
      doc.text(`Created At: ${new Date(reportData.summary.createdAt).toLocaleString()}`);
      doc.moveDown(2);

      // Anomalies Section
      doc.fontSize(14).text('Detected Anomalies & Resolutions', { underline: true });
      doc.moveDown();

      if (reportData.anomalies.length === 0) {
        doc.fontSize(11).text('No anomalies detected. All rows were imported cleanly.');
      } else {
        reportData.anomalies.forEach((a, i) => {
          doc.fontSize(11).text(`${i + 1}. Row ${a.rowNumber} - [${a.severity.toUpperCase()}] ${a.type}`, { bold: true });
          doc.fontSize(10).text(`Description: ${a.description}`);
          doc.text(`Resolution Action: ${a.decision || 'N/A'} (Status: ${a.status})`);
          doc.moveDown(0.5);
        });
      }

      doc.end();
      return;
    }

    return res.status(400).json({ error: 'Unsupported format. Use format=json or format=pdf.' });
  } catch (err) {
    console.error('exportReport error:', err);
    return res.status(500).json({ error: 'Database error exporting report.' });
  }
};

module.exports = {
  uploadCSV,
  getImportAnomalies,
  getImportReport,
  approveImport,
  rejectImport,
  exportReport
};
