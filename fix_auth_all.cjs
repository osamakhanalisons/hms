const fs = require('fs');
const path = require('path');

// Files that have the faulty LOCAL getSessionUser() with getEvent() pattern
const FILES_TO_FIX = [
  'src/lib/api/visitor.ts',
  'src/lib/api/vendors.ts',
  'src/lib/api/utility-meters.ts',
  'src/lib/api/security-governance.ts',
  'src/lib/api/payments.ts',
  'src/lib/api/parking.ts',
  'src/lib/api/notifications.ts',
  'src/lib/api/notices.ts',
  'src/lib/api/maintenance.ts',
  'src/lib/api/ledger.ts',
  'src/lib/api/complaints.ts',
  'src/lib/api/community.ts',
  'src/lib/api/budget.ts',
  'src/lib/api/assets.ts',
];

// tenants.ts has a partial fix (takes `request?: Request` but uses old pattern) — handle separately
const PARTIAL_FILES = [
  'src/lib/api/tenants.ts',
];

const results = [];

function fixFile(filePath) {
  let code = fs.readFileSync(filePath, 'utf8');
  const original = code;

  // Step 1: Remove the old vinxi/http import line (whole line)
  code = code.replace(/^import \{ getCookie, getEvent \} from "vinxi\/http";\n/m, '');
  code = code.replace(/^import \{ getCookie, getEvent \} from 'vinxi\/http';\n/m, '');

  // Step 2: Add auth-helper import after getDb import (if not already there)
  if (!code.includes('from "./auth-helper"') && !code.includes("from './auth-helper'")) {
    code = code.replace(
      /^(import \{ getDb \} from "\.\.\/db\.server";)/m,
      '$1\nimport { getSessionUser, getUserTenantId } from "./auth-helper";'
    );
  }

  // Step 3: Remove local async function getSessionUser() { ... }
  // This block: from "async function getSessionUser()" to the closing "}"
  code = code.replace(
    /^async function getSessionUser\(\) \{[\s\S]*?^\}\n/m,
    ''
  );
  // Also handle variant with request param (tenants.ts style)
  code = code.replace(
    /^async function getSessionUser\(request\?: Request\) \{[\s\S]*?^\}\n/m,
    ''
  );

  // Step 4: Remove local async function getUserTenantId(userId) { ... }
  code = code.replace(
    /^async function getUserTenantId\(userId: string\) \{[\s\S]*?^\}\n/m,
    ''
  );

  // Step 5: Fix .handler(async ({ ... }) => { — add `request` if missing
  // Pattern: .handler(async () => {   →  .handler(async ({ request }) => {
  code = code.replace(
    /\.handler\(async \(\) => \{/g,
    '.handler(async ({ request }) => {'
  );
  // Pattern: .handler(async ({ data }) => {  →  .handler(async ({ data, request }) => {
  code = code.replace(
    /\.handler\(async \(\{ data \}\) => \{/g,
    '.handler(async ({ data, request }) => {'
  );
  // Pattern: .handler(async ({ data, context }) => { — add request
  code = code.replace(
    /\.handler\(async \(\{ data, context \}\) => \{/g,
    '.handler(async ({ data, context, request }) => {'
  );
  // Handle already-fixed handlers (skip them): .handler(async ({ data, request }) => { — no change needed

  // Step 6: Fix getSessionUser() calls to getSessionUser(request)
  code = code.replace(/await getSessionUser\(\)/g, 'await getSessionUser(request)');

  const changed = code !== original;
  fs.writeFileSync(filePath, code, 'utf8');

  return changed;
}

// Fix main batch
for (const file of FILES_TO_FIX) {
  try {
    const changed = fixFile(file);
    results.push({ file, status: changed ? 'FIXED' : 'NO_CHANGE' });
    console.log(`[${changed ? 'FIXED' : 'SKIP'}] ${file}`);
  } catch (e) {
    results.push({ file, status: 'ERROR: ' + e.message });
    console.error(`[ERROR] ${file}: ${e.message}`);
  }
}

// Fix partial files (tenants.ts, db-functions.ts)
for (const file of PARTIAL_FILES) {
  try {
    const changed = fixFile(file);
    results.push({ file, status: changed ? 'FIXED (PARTIAL)' : 'NO_CHANGE' });
    console.log(`[${changed ? 'FIXED (PARTIAL)' : 'SKIP'}] ${file}`);
  } catch (e) {
    results.push({ file, status: 'ERROR: ' + e.message });
    console.error(`[ERROR] ${file}: ${e.message}`);
  }
}

console.log('\n=== SUMMARY ===');
for (const r of results) {
  console.log(`${r.status.padEnd(15)} ${r.file}`);
}
