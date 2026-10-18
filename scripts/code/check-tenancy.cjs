'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('Multi-Tenant shopId Audit', { emoji: '🏢' });
const srcRoot = path.join(__dirname, '../../src');

const TENANT_MODULES = [
  'products',
  'categories',
  'brands',
  'purchases',
  'sales',
  'customers',
  'suppliers',
  'inventory',
  'expenses',
  'expense-categories',
  'cash',
  'cash-reconciliations',
  'payments',
  'supplier-payments',
  'returns',
  'reports',
  'dashboard',
  'store',
];

const DTO_SHOPID_RE =
  /^\s*(readonly\s+|public\s+|private\s+|protected\s+)?shopId\s*[?!]?\s*:/;

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    const isTenant = TENANT_MODULES.some((m) =>
      relPath.startsWith(`src/${m}/`),
    );
    if (!isTenant) return;
    if (!relPath.includes('/dto/')) return;
    if (/response-|query\.filter|list-.*query/i.test(path.basename(relPath))) {
      return;
    }

    const lines = fs.readFileSync(absPath, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (
        DTO_SHOPID_RE.test(line) ||
        /@IsUUID\(.*\)\s*\n?\s*shopId/i.test(line)
      ) {
        r.addViolation(
          relPath,
          idx + 1,
          'Forbidden `shopId` on request DTO — tenancy comes from JWT (`req.user.shopId`) only',
          {
            fix: 'Remove shopId from body/query DTOs. Read shopId from AuthUser / CLS context.',
          },
        );
      }
      if (
        /\bshopId\b/.test(line) &&
        /@(ApiProperty|IsUUID|IsString|IsNotEmpty)/.test(line)
      ) {
        r.addViolation(
          relPath,
          idx + 1,
          'Forbidden validated `shopId` field on tenant DTO',
        );
      }
    });
  });
}

r.finish({
  fixTip:
    'Never accept shopId from clients. Filter every Prisma query with JWT shopId.',
});
