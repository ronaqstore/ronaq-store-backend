'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('Transaction Safety Audit', { emoji: '🔁' });
const srcRoot = path.join(__dirname, '../../src');

const MONEY_WRITE_HINT =
  /\b(createSale|createPurchase|createPayment|createExpense|cancelSale|cancelPurchase|createReturn|createSupplierPayment|createCash|openingCash|createReconciliation)\b/;

const MONEY_MODULES = [
  'sales',
  'purchases',
  'payments',
  'expenses',
  'supplier-payments',
  'inventory',
  'cash',
  'cash-reconciliations',
  'returns',
];

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.service\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    const isMoney = MONEY_MODULES.some((m) => relPath.includes(`src/${m}/`));
    if (!isMoney) return;

    const code = fs.readFileSync(absPath, 'utf8');
    if (
      !/\$transaction/.test(code) &&
      /prisma\.\w+\.(create|update|upsert)/.test(code)
    ) {
      r.addWarning(
        relPath,
        1,
        'Money-domain service writes Prisma rows without `$transaction` — verify multi-table writes are atomic',
      );
    }

    const lines = code.split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (MONEY_WRITE_HINT.test(line) && !code.includes('$transaction')) {
        r.addViolation(
          relPath,
          idx + 1,
          'Money mutation path detected without `$transaction` in this service file',
          {
            fix: 'Wrap multi-table money mutations in prisma.$transaction(async tx => { ... }).',
          },
        );
      }
    });
  });
}

r.finish({
  fixTip:
    'One business action = one DB transaction. Sales/purchases/payments/expenses must be atomic.',
  warnOnly: true,
});
