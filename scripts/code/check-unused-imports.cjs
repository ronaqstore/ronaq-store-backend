'use strict';

const fs = require('fs');
const path = require('path');
const traverse = require('@babel/traverse').default;
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');
const { parseFile } = require('./lib/parseFile.cjs');

const r = new Reporter('Unused Imports Audit', { emoji: '🧹' });
const srcRoot = path.join(__dirname, '../../src');

if (fs.existsSync(srcRoot)) {
  walkTree(
    srcRoot,
    (absPath, relPathRaw) => {
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

      const imports = [];
      const used = new Set();

      traverse(ast, {
        ImportDeclaration(p) {
          p.node.specifiers.forEach((spec) => {
            if (spec.type === 'ImportDefaultSpecifier') {
              imports.push({
                name: spec.local.name,
                line: spec.loc ? spec.loc.start.line : 0,
                kind: 'default',
              });
            } else if (spec.type === 'ImportSpecifier') {
              imports.push({
                name: spec.local.name,
                line: spec.loc ? spec.loc.start.line : 0,
                kind: 'named',
              });
            } else if (spec.type === 'ImportNamespaceSpecifier') {
              imports.push({
                name: spec.local.name,
                line: spec.loc ? spec.loc.start.line : 0,
                kind: 'namespace',
              });
            }
          });
        },
        Identifier(p) {
          if (p.parent.type === 'ImportSpecifier') return;
          if (p.parent.type === 'ImportDefaultSpecifier') return;
          if (p.parent.type === 'ImportNamespaceSpecifier') return;
          if (
            p.parent.type === 'MemberExpression' &&
            p.parent.property === p.node &&
            !p.parent.computed
          ) {
            return;
          }
          used.add(p.node.name);
        },
        JSXIdentifier(p) {
          used.add(p.node.name);
        },
      });

      imports.forEach((imp) => {
        if (!used.has(imp.name)) {
          r.addViolation(
            relPath,
            imp.line,
            `Unused ${imp.kind} import \`${imp.name}\` — remove dead import`,
          );
        }
      });
    },
    { includeTests: true },
  );
}

r.finish({
  fixTip:
    'Remove unused imports. Prefer `npm run lint:fix` / ESLint unused-imports for autofix where available.',
});
