'use strict';

const fs = require('fs');
const path = require('path');
const traverse = require('@babel/traverse').default;
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');
const { parseFile } = require('./lib/parseFile.cjs');

const r = new Reporter('Financial Paisa Safety Audit', { emoji: '💰' });
const srcRoot = path.join(__dirname, '../../src');

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    if (relPath.includes('src/generated/') || relPath.includes('/helpers/'))
      return;

    const code = fs.readFileSync(absPath, 'utf8');
    if (!code.includes('100') && !code.includes('.toFixed(')) return;

    let ast;
    try {
      ast = parseFile(absPath, code);
    } catch (e) {
      r.addParseError(relPath, e.message);
      return;
    }

    traverse(ast, {
      CallExpression(p) {
        const callee = p.node.callee;
        if (
          callee.type === 'MemberExpression' &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'toFixed'
        ) {
          r.addViolation(
            relPath,
            p.node.loc ? p.node.loc.start.line : 0,
            'Forbidden `.toFixed()` on money — keep BIGINT paisa integers end-to-end',
          );
        }
      },
      BinaryExpression(p) {
        if (p.node.operator !== '*' && p.node.operator !== '/') return;
        const left = p.node.left;
        const right = p.node.right;
        const has100 =
          (right.type === 'NumericLiteral' && right.value === 100) ||
          (left.type === 'NumericLiteral' && left.value === 100);
        if (!has100) return;

        const name =
          (left.type === 'Identifier' && left.name) ||
          (left.type === 'MemberExpression' &&
            left.property.type === 'Identifier' &&
            left.property.name) ||
          '';
        if (/amount|price|paisa|rupee|cost|total|balance|payment/i.test(name)) {
          r.addViolation(
            relPath,
            p.node.loc ? p.node.loc.start.line : 0,
            `Forbidden raw money math (\`${name} ${p.node.operator} 100\`) — store/use integer paisa only`,
          );
        }
      },
    });
  });
}

r.finish({
  fixTip:
    'Money is BIGINT paisa (Rs 1 = 100). Never convert with float math in services.',
});
