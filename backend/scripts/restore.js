const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

async function restore(backupFileName) {
  const dbPath = path.join(__dirname, '../ecommerce.sqlite');
  const backupDir = path.join(__dirname, '../backups');
  
  if (!backupFileName) {
    if (!fs.existsSync(backupDir)) {
      throw new Error('No backups directory found');
    }
    const files = fs.readdirSync(backupDir).filter(f => f.startsWith('backup-') && f.endsWith('.sqlite'));
    if (files.length === 0) {
      throw new Error('No backups found to restore');
    }
    files.sort();
    backupFileName = files[files.length - 1];
  }

  const backupPath = path.isAbsolute(backupFileName) ? backupFileName : path.join(backupDir, backupFileName);
  if (!fs.existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }

  console.log(`Verifying backup integrity: ${backupPath}`);
  let verifyDb;
  try {
    verifyDb = await open({
      filename: backupPath,
      driver: sqlite3.Database,
    });
    const integrity = await verifyDb.get('PRAGMA integrity_check');
    if (integrity.integrity_check !== 'ok') {
      throw new Error(`Backup database is corrupt: ${integrity.integrity_check}`);
    }
    const tables = await verifyDb.all("SELECT name FROM sqlite_master WHERE type='table'");
    if (tables.length < 5) {
      throw new Error('Backup database schema is incomplete');
    }
    await verifyDb.close();
    console.log('Integrity check passed.');
  } catch (e) {
    if (verifyDb) await verifyDb.close();
    throw new Error(`Backup verification failed: ${e.message}`);
  }

  console.log(`Restoring database to: ${dbPath}`);
  const tempBackup = dbPath + '.tmp';
  if (fs.existsSync(dbPath)) {
    fs.renameSync(dbPath, tempBackup);
  }

  try {
    fs.copyFileSync(backupPath, dbPath);
    if (fs.existsSync(tempBackup)) {
      fs.unlinkSync(tempBackup);
    }
    console.log('Database restored successfully.');
  } catch (err) {
    console.error('Failed to restore database, rolling back:', err.message);
    if (fs.existsSync(tempBackup)) {
      fs.renameSync(tempBackup, dbPath);
    }
    throw err;
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  restore(args[0]).catch(err => {
    console.error('Restore failed:', err.message);
    process.exit(1);
  });
}

module.exports = { restore };
