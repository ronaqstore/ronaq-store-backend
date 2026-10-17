'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('Spec Colocation Audit', { emoji: '🧪' });
const srcRoot = path.join(__dirname, '../../src');

if (fs.existsSync(srcRoot)) {
  walkTree(
    srcRoot,
    (absPath, relPathRaw) => {
      if (!/\.spec\.ts$/.test(absPath)) return;
      const relPath = relPathRaw.split(path.sep).join('/');
      const base = path.basename(absPath);
      if (/-validation\.spec\.ts$/.test(base)) return;

      const impl = absPath.replace(/\.spec\.ts$/, '.ts');
      if (!fs.existsSync(impl)) {
        r.addViolation(
          relPath,
          0,
          'Spec has no colocated implementation file (expected *.ts next to *.spec.ts)',
        );
      }
    },
    { includeTests: true },
  );
}

r.finish({
  fixTip:
    'Keep unit specs next to the file under test: `sales.service.ts` + `sales.service.spec.ts`.',
});
