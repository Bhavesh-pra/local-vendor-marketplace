const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const path = require('path');

async function run() {
  const db = await open({
    filename: path.join(__dirname, '../ecommerce.sqlite'),
    driver: sqlite3.Database,
  });

  try {
    const tableInfo = await db.all("PRAGMA table_info(inventory_movements)");
    console.log("SCHEMA OF inventory_movements:", tableInfo);
  } catch (err) {
    console.error("ERROR:", err.message);
  } finally {
    await db.close();
  }
}

run();
