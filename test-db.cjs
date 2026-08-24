const mysql = require('mysql2/promise');
require('dotenv').config();
async function test() {
  const db = await mysql.createConnection(process.env.DATABASE_URL);
  const fs = require('fs');
  const code = fs.readFileSync('src/lib/db.server.ts', 'utf8');
  const queries = code.match(/db\.query\([\s\S]*?\)/g);
  for (let q of queries) {
    const match = q.match(/`([\s\S]*?)`/);
    if (match) {
      const qStr = match[1];
      try {
        await db.query(qStr);
      } catch (err) {
        console.error('FAILED:', qStr);
        console.error(err.message);
      }
    }
  }
  process.exit(0);
}
test();
