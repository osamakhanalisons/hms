import mysql from 'mysql2/promise';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();
async function test() {
  const db = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });
  const code = fs.readFileSync('src/lib/db.server.ts', 'utf8');
  const queries = code.match(/`([\s\S]*?)`/g);
  let failed = false;
  for (let qStr of queries) {
    qStr = qStr.replace(/^`/, '').replace(/`$/, '');
    if (!qStr.trim().startsWith('CREATE') && !qStr.trim().startsWith('INSERT') && !qStr.trim().startsWith('ALTER')) continue;
    try {
      await db.query(qStr);
    } catch (err) {
      console.error('\nFAILED QUERY:\n' + qStr);
      console.error('ERROR:', err.message);
      failed = true;
      break;
    }
  }
  if (!failed) console.log('All queries passed!');
  process.exit(0);
}
test();
