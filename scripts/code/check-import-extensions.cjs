'use strict';

const fs = require('fs');
const path = require('path');
const traverse = require('@babel/traverse').default;
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');
const { parseFile } = require('./lib/parseFile.cjs');

const r = new Reporter('ESM Import Extension Audit', { emoji: '📎' });
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
      ImportDeclaration(p) {
        const source = p.node.source.value;
        if (!source.startsWith('.')) return;
        if (source.endsWith('.js') || source.endsWith('.json')) return;
        r.addViolation(
          relPath,
          p.node.loc ? p.node.loc.start.line : 0,
          `Relative import "${source}" must use explicit \`.js\` extension (NodeNext ESM)`,
          {
            fix: `Change to "${source}.js" (TypeScript resolves to .ts at compile time).`,
          },
        );
      },
      ExportNamedDeclaration(p) {
        if (!p.node.source) return;
        const source = p.node.source.value;
        if (!source.startsWith('.')) return;
        if (source.endsWith('.js') || source.endsWith('.json')) return;
        r.addViolation(
          relPath,
          p.node.loc ? p.node.loc.start.line : 0,
          `Relative re-export "${source}" must use explicit \`.js\` extension`,
        );
      },
      ExportAllDeclaration(p) {
        const source = p.node.source && p.node.source.value;
        if (!source || !source.startsWith('.')) return;
        if (source.endsWith('.js') || source.endsWith('.json')) return;
        r.addViolation(
          relPath,
          p.node.loc ? p.node.loc.start.line : 0,
          `Relative export-all "${source}" must use explicit \`.js\` extension`,
        );
      },
    });
  });
}

r.finish({
  fixTip:
    'This Nest backend uses NodeNext ESM: relative imports must end with `.js`.',
});
