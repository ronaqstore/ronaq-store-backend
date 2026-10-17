'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('Prisma Safety Audit', { emoji: '🗄️' });
const srcRoot = path.join(__dirname, '../../src');

const DELETE_ALLOW = [
  'src/store/services/store.service.ts',
  'src/products/services/products.service.ts',
  'src/store/services/store-cache.service.ts',
  'src/store/guards/rate-limit.guard.ts',
];

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    if (relPath.includes('src/generated/')) return;

    const lines = fs.readFileSync(absPath, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      if (
        /\.(delete|deleteMany)\s*\(/.test(trimmed) &&
        !DELETE_ALLOW.some((a) => relPath.endsWith(a) || relPath.includes(a))
      ) {
        if (
          trimmed.includes('entries.delete') ||
          trimmed.includes('buckets.delete')
        )
          return;
        if (
          trimmed.includes('Map') ||
          trimmed.includes('Set') ||
          trimmed.includes('this.entries')
        )
          return;
        r.addViolation(
          relPath,
          idx + 1,
          'Forbidden Prisma `.delete` / `.deleteMany` — deactivate, cancel, or append a reversal instead',
          {
            fix: 'Set isActive=false or status=CANCELLED with reason. History is append-only.',
          },
        );
      }

      if (/\$executeRawUnsafe|\.\$queryRawUnsafe/.test(trimmed)) {
        r.addViolation(
          relPath,
          idx + 1,
          'Forbidden `$executeRawUnsafe` / `$queryRawUnsafe` — use typed Prisma or parameterized `$queryRaw`',
        );
      }
    });
  });
}

r.finish({
  fixTip:
    'Deletes are blocked by domain rules. Prefer cancel/deactivate + ledger reversals.',
});
