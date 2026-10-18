'use strict';

const fs = require('fs');
const path = require('path');
const traverse = require('@babel/traverse').default;
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');
const { parseFile } = require('./lib/parseFile.cjs');

const r = new Reporter('Catch Block Audit', { emoji: '🛡️' });
const srcRoot = path.join(__dirname, '../../src');

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    if (relPath.includes('src/generated/')) return;

    const code = fs.readFileSync(absPath, 'utf8');
    if (!code.includes('catch')) return;

    let ast;
    try {
      ast = parseFile(absPath, code);
    } catch (e) {
      r.addParseError(relPath, e.message);
      return;
    }

    traverse(ast, {
      CatchClause(p) {
        const body = p.node.body;
        const line = p.node.loc ? p.node.loc.start.line : 0;
        if (!body || !body.body || body.body.length === 0) {
          r.addViolation(
            relPath,
            line,
            'Empty catch block — handle, rethrow, or map to a Nest HttpException',
            {
              fix: 'Rethrow, wrap with NestJS exceptions, or log via TraceLoggerService.',
            },
          );
        }
      },
    });
  });
}

r.finish({
  fixTip:
    'Catch blocks must rethrow, map to Nest exceptions, or log — never swallow errors silently.',
});
