'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('Environment Access Audit', { emoji: '⚙️' });
const srcRoot = path.join(__dirname, '../../src');

const ALLOWED = [
  'src/app-configuration/',
  'src/main.ts',
  'src/prisma/prisma.service.ts',
  'src/helpers/logger-helper.ts',
];

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    if (relPath.includes('src/generated/')) return;
    if (ALLOWED.some((p) => relPath.includes(p) || relPath.endsWith(p))) return;

    const lines = fs.readFileSync(absPath, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (line.includes('process.env')) {
        r.addViolation(
          relPath,
          idx + 1,
          'Forbidden raw `process.env` — use AppConfigurationService / ConfigService',
          {
            fix: 'Inject AppConfigurationService and read typed config getters.',
          },
        );
      }
    });
  });
}

r.finish({
  fixTip:
    'Centralize env reads in app-configuration. Controllers/services must not touch process.env.',
});
