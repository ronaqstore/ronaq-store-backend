'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('Hardcoded URL Audit', { emoji: '🔗' });
const srcRoot = path.join(__dirname, '../../src');

const ALLOW = [
  'src/app-configuration/',
  'src/main.ts',
  'src/store/services/r2-storage.service.ts',
];

const URL_RE = /https?:\/\/[^\s'"`]+/i;

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    if (relPath.includes('src/generated/')) return;
    if (ALLOW.some((a) => relPath.includes(a))) return;

    const lines = fs.readFileSync(absPath, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (!URL_RE.test(line)) return;
      if (
        /swagger|openapi|localhost|example\.com|wa\.me|api\.whatsapp|@ApiProperty|example:/i.test(
          line,
        )
      ) {
        return;
      }
      r.addViolation(
        relPath,
        idx + 1,
        'Hardcoded absolute URL — move to AppConfigurationService / env config',
        { sample: line.trim().slice(0, 100) },
      );
    });
  });
}

r.finish({
  fixTip:
    'External base URLs belong in env / AppConfigurationService, not scattered literals.',
});
