const path = require('path');
const fs = require('fs');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

async function runAudit() {
  const dbPath = path.join(__dirname, '../ecommerce.sqlite');
  console.log(`Starting Database Integrity Audit on: ${dbPath}`);
  
  const db = await open({
    filename: dbPath,
    driver: sqlite3.Database,
  });

  const reports = [];
  const repairs = [];

  const auditQuery = async (title, query, repairSqlGenerator) => {
    try {
      const rows = await db.all(query);
      if (rows.length > 0) {
        reports.push({
          title,
          status: 'FAIL',
          count: rows.length,
          samples: rows.slice(0, 5)
        });
        
        if (repairSqlGenerator) {
          for (const row of rows) {
            const repair = repairSqlGenerator(row);
            if (repair) repairs.push(repair);
          }
        }
      } else {
        reports.push({
          title,
          status: 'PASS',
          count: 0
        });
      }
    } catch (err) {
      reports.push({
        title,
        status: 'ERROR',
        message: err.message
      });
    }
  };

  // 1. Broken Foreign Keys check
  try {
    const fkIssues = await db.all('PRAGMA foreign_key_check');
    if (fkIssues.length > 0) {
      reports.push({
        title: 'Foreign Key Violations',
        status: 'FAIL',
        count: fkIssues.length,
        samples: fkIssues.slice(0, 5)
      });
      for (const issue of fkIssues) {
        repairs.push(`-- FIX FK violation: table ${issue.table}, rowid ${issue.rowid}, parent table ${issue.parent}`);
      }
    } else {
      reports.push({
        title: 'Foreign Key Violations',
        status: 'PASS',
        count: 0
      });
    }
  } catch (err) {
    reports.push({
      title: 'Foreign Key Violations',
      status: 'ERROR',
      message: err.message
    });
  }

  // 2. Orphaned Orders
  await auditQuery(
    'Orphaned Orders (No User)',
    'SELECT order_id, user_id, order_number FROM orders WHERE user_id NOT IN (SELECT user_id FROM users)',
    (row) => `DELETE FROM orders WHERE order_id = ${row.order_id};`
  );

  // 3. Orphaned Order Items
  await auditQuery(
    'Orphaned Order Items (No Variant)',
    'SELECT order_item_id, order_id, variant_id FROM order_items WHERE variant_id NOT IN (SELECT variant_id FROM product_variants)',
    (row) => `DELETE FROM order_items WHERE order_item_id = ${row.order_item_id};`
  );

  // 4. Orphaned Payments
  await auditQuery(
    'Orphaned Payments (No Order)',
    'SELECT payment_id, order_id, transaction_reference FROM payments WHERE order_id NOT IN (SELECT order_id FROM orders)',
    (row) => `DELETE FROM payments WHERE payment_id = ${row.payment_id};`
  );

  // 5. Invalid Payout Records
  await auditQuery(
    'Invalid Payout Records (Negative amount or missing supplier)',
    'SELECT payout_id, supplier_id, amount FROM supplier_payouts WHERE amount < 0 OR supplier_id NOT IN (SELECT user_id FROM users)',
    (row) => `DELETE FROM supplier_payouts WHERE payout_id = ${row.payout_id};`
  );

  // 6. Negative Wallet Balances
  await auditQuery(
    'Negative Wallet Balances',
    `SELECT w.user_id, u.username, 
            SUM(CASE WHEN w.type IN ('deposit', 'refund', 'adjustment_credit') THEN w.amount ELSE -w.amount END) AS balance 
     FROM wallet_transactions w 
     JOIN users u ON w.user_id = u.user_id 
     GROUP BY w.user_id 
     HAVING balance < 0`,
    (row) => `INSERT INTO wallet_transactions (user_id, type, amount, reference_id, idempotency_key) VALUES (${row.user_id}, 'adjustment_credit', ${Math.abs(row.balance)}, 'audit_repair', 'repair_${Date.now()}_${row.user_id}');`
  );

  // 7. Duplicate Idempotency Keys
  await auditQuery(
    'Duplicate Idempotency Keys in Payments',
    'SELECT idempotency_key, COUNT(*) as c FROM payments WHERE idempotency_key IS NOT NULL GROUP BY idempotency_key HAVING c > 1',
    null
  );

  await db.close();

  console.log('\n================ AUDIT REPORT ================');
  reports.forEach(r => {
    console.log(`[${r.status}] ${r.title}: Found ${r.count || 0} issues`);
    if (r.samples && r.samples.length > 0) {
      console.log('  Samples:', JSON.stringify(r.samples));
    }
  });

  const reportDir = path.join(__dirname, '../reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `audit-report-${timestamp}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(reports, null, 2));
  console.log(`\nAudit JSON report saved to: ${reportPath}`);

  if (repairs.length > 0) {
    const repairPath = path.join(reportDir, `repair-script-${timestamp}.sql`);
    const repairContent = `-- Optional Repair Script generated on ${new Date().toISOString()}\n\n` + repairs.join('\n') + '\n';
    fs.writeFileSync(repairPath, repairContent);
    console.log(`Optional SQL repair script generated at: ${repairPath}`);
  } else {
    console.log('\nNo repairs necessary. Database integrity is OK.');
  }
}

if (require.main === module) {
  runAudit().catch(err => {
    console.error('Audit failed:', err.message);
    process.exit(1);
  });
}

module.exports = { runAudit };
