const fs = require('fs');
const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');

async function backup() {
  const dbPath = path.join(__dirname, '../ecommerce.sqlite');
  const backupDir = path.join(__dirname, '../backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDir, `backup-${timestamp}.sqlite`);

  try {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    // VACUUM INTO is SQLite's built-in command to create a consistent backup of a live DB
    await db.run(`VACUUM INTO ?`, [backupPath]);
    await db.close();
    console.log(`Backup created successfully at: ${backupPath}`);
    return backupPath;
  } catch (err) {
    console.error('Vacuum into backup failed, falling back to file copy:', err.message);
    fs.copyFileSync(dbPath, backupPath);
    console.log(`Backup copy created at: ${backupPath}`);
    return backupPath;
  }
}

if (require.main === module) {
  backup();
}

module.exports = { backup };
