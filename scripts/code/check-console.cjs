'use strict';

const fs = require('fs');
const path = require('path');
const traverse = require('@babel/traverse').default;
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');
const { parseFile } = require('./lib/parseFile.cjs');

const r = new Reporter('Console & Debugger Audit', { emoji: '🛑' });
const srcRoot = path.join(__dirname, '../../src');

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    if (relPath.includes('src/generated/')) return;
    if (relPath.includes('common/logger/')) return;
    if (relPath.includes('helpers/logger-helper.ts')) return;

    const code = fs.readFileSync(absPath, 'utf8');
    if (!code.includes('console.') && !code.includes('debugger')) return;

    let ast;
    try {
      ast = parseFile(absPath, code);
    } catch (e) {
      r.addParseError(relPath, e.message);
      return;
    }

    traverse(ast, {
      DebuggerStatement(p) {
        r.addViolation(
          relPath,
          p.node.loc ? p.node.loc.start.line : 0,
          'Forbidden `debugger` statement',
        );
      },
      CallExpression(p) {
        const callee = p.node.callee;
        if (
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'console' &&
          callee.property.type === 'Identifier'
        ) {
          r.addViolation(
            relPath,
            p.node.loc ? p.node.loc.start.line : 0,
            `Forbidden \`console.${callee.property.name}()\` — use TraceLoggerService`,
            {
              fix: 'Inject TraceLoggerService / Nest Logger instead of console.*',
            },
          );
        }
      },
    });
  });
}

r.finish({
  fixTip:
    'Use NestJS Logger / TraceLoggerService. Zero console leftovers in src/.',
});
