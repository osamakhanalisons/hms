const fs = require('fs');
let code = fs.readFileSync('src/lib/api/residents.ts', 'utf8');

// 1. Add import for auth-helper
code = code.replace(
  /import { getCookie, getEvent } from "vinxi\/http";\nimport { getDb } from "\.\.\/db\.server";\n/,
  'import { getDb } from "../db.server";\nimport { getSessionUser, getUserTenantId } from "./auth-helper";\n'
);

// 2. Remove the local auth functions
code = code.replace(/async function getSessionUser\(\) {[\s\S]*?async function getUserTenantId\(userId: string\) {[\s\S]*?return rows\.length \? \(rows\[0\]\.tenant_id as string \| null\) : null;\n}/, '');

// 3. Fix getResidentsFn and others
code = code.replace(
  /\.handler\(async \(\{ data \}\) => \{/g,
  '.handler(async ({ data, request }) => {'
);
code = code.replace(
  /const userId = await getSessionUser\(\);/g,
  'const userId = await getSessionUser(request);'
);

fs.writeFileSync('src/lib/api/residents.ts', code);
console.log('Fixed auth pattern in residents.ts');
