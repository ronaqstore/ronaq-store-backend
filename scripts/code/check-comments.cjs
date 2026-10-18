'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('Comments Audit (Zero-Comments Rule)', { emoji: '💬' });
const srcRoot = path.join(__dirname, '../../src');

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    if (relPath.includes('src/generated/') || relPath.endsWith('.d.ts')) return;

    const code = fs.readFileSync(absPath, 'utf8');
    const lines = code.split('\n');
    let inBlockComment = false;

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      if (inBlockComment) {
        r.addViolation(
          relPath,
          index + 1,
          'Forbidden comment — zero-comments rule is active',
        );
        if (trimmed.includes('*/')) inBlockComment = false;
        return;
      }

      if (trimmed.startsWith('/*')) {
        r.addViolation(
          relPath,
          index + 1,
          'Forbidden block / JSDoc comment — zero-comments rule is active',
        );
        if (!trimmed.includes('*/')) inBlockComment = true;
        return;
      }

      if (trimmed.startsWith('//')) {
        r.addViolation(
          relPath,
          index + 1,
          `Forbidden line comment "${trimmed.slice(0, 40)}" — zero-comments rule is active`,
        );
        return;
      }

      const slashIndex = line.indexOf('//');
      if (slashIndex !== -1) {
        const prefix = line.slice(0, slashIndex);
        if (
          !prefix.includes('http:') &&
          !prefix.includes('https:') &&
          !prefix.includes('"') &&
          !prefix.includes("'") &&
          !prefix.includes('`')
        ) {
          r.addViolation(
            relPath,
            index + 1,
            `Forbidden trailing comment "${line.slice(slashIndex, slashIndex + 40)}"`,
          );
        }
      }
    });
  });
}

r.finish({
  fixTip:
    'Zero comments in src/: use clear names, Swagger decorators, and self-documenting Nest modules.',
});
