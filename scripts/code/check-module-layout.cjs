'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');

const r = new Reporter('Nest Module Layout Audit', { emoji: '🧱' });
const SRC_DIR = path.join(__dirname, '../../src');

const INFRA_DIRS = new Set([
  'app-configuration',
  'auth-guards',
  'common',
  'common-dto',
  'constants',
  'errors',
  'generated',
  'helpers',
  'prisma',
]);

function hasTsFiles(dir) {
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some((name) => name.endsWith('.ts'));
}

if (fs.existsSync(SRC_DIR)) {
  for (const entry of fs.readdirSync(SRC_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (INFRA_DIRS.has(entry.name)) continue;

    const modDir = path.join(SRC_DIR, entry.name);
    const moduleFile = path.join(modDir, `${entry.name}.module.ts`);
    if (!fs.existsSync(moduleFile)) {
      r.addViolation(
        `src/${entry.name}`,
        0,
        `Missing Nest module file '${entry.name}.module.ts'`,
        {
          fix: `Add src/${entry.name}/${entry.name}.module.ts and register it in AppModule.`,
        },
      );
    }

    const hasControllers = hasTsFiles(path.join(modDir, 'controllers'));
    const hasServices = hasTsFiles(path.join(modDir, 'services'));
    const hasDto = hasTsFiles(path.join(modDir, 'dto'));

    if (!hasControllers && !hasServices) {
      r.addViolation(
        `src/${entry.name}`,
        0,
        'Feature module should have controllers/ and/or services/ folders with .ts files',
      );
    }

    if (hasControllers && !hasDto) {
      r.addWarning(
        `src/${entry.name}`,
        0,
        'Controller module has no dto/ folder — prefer class-validator DTOs under dto/',
      );
    }
  }
}

r.finish({
  fixTip:
    'Standard Nest feature layout: <module>/<module>.module.ts + controllers/ + services/ + dto/.',
  warnOnly: true,
});
