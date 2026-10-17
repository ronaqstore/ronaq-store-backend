'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('Filename Convention Audit', { emoji: '📛' });
const srcRoot = path.join(__dirname, '../../src');

const KEBAB = /^[a-z0-9]+([.-][a-z0-9]+)*\.ts$/;
const ALLOWED_ROOT = new Set([
  'main.ts',
  'app.module.ts',
  'app.controller.ts',
  'app.service.ts',
  'app.controller.spec.ts',
  'app.service.spec.ts',
]);

if (fs.existsSync(srcRoot)) {
  walkTree(
    srcRoot,
    (absPath, relPathRaw) => {
      if (!/\.ts$/.test(absPath)) return;
      const relPath = relPathRaw.split(path.sep).join('/');
      if (relPath.includes('src/generated/')) return;

      const base = path.basename(absPath);
      if (ALLOWED_ROOT.has(base) && relPath === `src/${base}`) return;
      if (/\/decorators?\//.test(relPath)) return;

      if (!KEBAB.test(base)) {
        r.addViolation(
          relPath,
          0,
          `Filename '${base}' must be kebab-case (e.g. create-sale.dto.ts, sales.service.ts)`,
        );
      }

      if (base !== base.toLowerCase()) {
        r.addViolation(relPath, 0, `Filename '${base}' must be lowercase`);
      }
    },
    { includeTests: true },
  );
}

r.finish({
  fixTip:
    'Nest filenames: kebab-case + role suffix (.controller.ts, .service.ts, .dto.ts, .module.ts, .spec.ts).',
});
