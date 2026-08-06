import { initDb } from './src/lib/db.server.ts';
import dotenv from 'dotenv';
dotenv.config();
initDb().then(() => { console.log('Passed'); process.exit(0); }).catch(e => { console.error('FAILED IN INITDB', e); process.exit(1); });
