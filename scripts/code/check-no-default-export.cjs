'use strict';

const fs = require('fs');
const path = require('path');
const traverse = require('@babel/traverse').default;
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');
const { parseFile } = require('./lib/parseFile.cjs');

const r = new Reporter('Named Export Preference Audit', { emoji: '📤' });
const srcRoot = path.join(__dirname, '../../src');

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    if (relPath.includes('src/generated/')) return;

    const code = fs.readFileSync(absPath, 'utf8');
    let ast;
    try {
      ast = parseFile(absPath, code);
    } catch (e) {
      r.addParseError(relPath, e.message);
      return;
    }

    traverse(ast, {
      ExportDefaultDeclaration(p) {
        r.addViolation(
          relPath,
          p.node.loc ? p.node.loc.start.line : 0,
          'Forbidden `export default` — Nest modules use named class exports',
        );
      },
    });
  });
}

r.finish({
  fixTip:
    'Use named exports (`export class SalesService`) for Nest DI clarity.',
});
