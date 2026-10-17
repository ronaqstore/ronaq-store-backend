'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('Empty / Stub Files Audit', { emoji: '📭' });
const srcRoot = path.join(__dirname, '../../src');

if (fs.existsSync(srcRoot)) {
  walkTree(
    srcRoot,
    (absPath, relPathRaw) => {
      if (!/\.ts$/.test(absPath)) return;
      const relPath = relPathRaw.split(path.sep).join('/');
      if (relPath.includes('src/generated/')) return;

      const content = fs.readFileSync(absPath, 'utf8').trim();
      if (!content) {
        r.addViolation(relPath, 0, 'Empty file — remove or implement it');
        return;
      }
      if (
        /^(export\s*\{\s*\};?\s*)+$/.test(content) ||
        content === 'export {};'
      ) {
        r.addViolation(
          relPath,
          1,
          'Stub barrel/empty export file — remove dead code',
        );
      }
    },
    { includeTests: true },
  );
}

r.finish({
  fixTip: 'Delete empty stubs. Every file in src/ must earn its place.',
});
