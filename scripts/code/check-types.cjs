'use strict';

const fs = require('fs');
const path = require('path');
const traverse = require('@babel/traverse').default;
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');
const { parseFile } = require('./lib/parseFile.cjs');

const r = new Reporter('Type Safety Audit', { emoji: '🛡️' });
const ROOT = path.resolve(__dirname, '../..');
const srcRoot = path.join(ROOT, 'src');

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.replace(/\\/g, '/');
    if (relPath.includes('src/generated/') || relPath.endsWith('.d.ts')) return;

    const code = fs.readFileSync(absPath, 'utf8');
    const lines = code.split('\n');
    lines.forEach((line, idx) => {
      if (line.includes('@ts-ignore')) {
        r.addViolation(
          relPath,
          idx + 1,
          'Forbidden `@ts-ignore` — fix the type error instead',
        );
      }
      if (line.includes('@ts-expect-error')) {
        r.addViolation(
          relPath,
          idx + 1,
          'Forbidden `@ts-expect-error` — fix the type error instead',
        );
      }
      if (line.includes('@ts-nocheck')) {
        r.addViolation(
          relPath,
          idx + 1,
          'Forbidden `@ts-nocheck` — keep typechecking enabled',
        );
      }
    });

    let ast;
    try {
      ast = parseFile(absPath, code);
    } catch (e) {
      r.addParseError(relPath, e.message);
      return;
    }

    traverse(ast, {
      TSAnyKeyword(p) {
        r.addViolation(
          relPath,
          p.node.loc ? p.node.loc.start.line : 0,
          'Forbidden `any` type — use explicit types or generics',
        );
      },
      TSNonNullExpression(p) {
        r.addViolation(
          relPath,
          p.node.loc ? p.node.loc.start.line : 0,
          'Forbidden non-null assertion `!` — use optional chaining or guards',
        );
      },
      TSAsExpression(p) {
        const t = p.node.typeAnnotation;
        if (t.type === 'TSUnknownKeyword') {
          r.addViolation(
            relPath,
            p.node.loc ? p.node.loc.start.line : 0,
            'Forbidden `as unknown` assertion',
          );
        }
        if (t.type === 'TSAnyKeyword') {
          r.addViolation(
            relPath,
            p.node.loc ? p.node.loc.start.line : 0,
            'Forbidden `as any` assertion',
          );
        }
      },
      TSTypeReference(p) {
        const name = p.node.typeName && p.node.typeName.name;
        if (name === 'Function') {
          r.addViolation(
            relPath,
            p.node.loc ? p.node.loc.start.line : 0,
            'Forbidden bare `Function` type',
          );
        }
        if (name === 'Object') {
          r.addViolation(
            relPath,
            p.node.loc ? p.node.loc.start.line : 0,
            'Forbidden bare `Object` type — use Record<string, T> or an interface',
          );
        }
        if (
          name === 'String' ||
          name === 'Number' ||
          name === 'Boolean' ||
          name === 'Symbol'
        ) {
          r.addViolation(
            relPath,
            p.node.loc ? p.node.loc.start.line : 0,
            `Forbidden boxed primitive \`${name}\` — use \`${name.toLowerCase()}\``,
          );
        }
      },
    });
  });
}

r.finish({
  fixTip:
    'Keep NestJS services/DTOs strictly typed. Prefer named interfaces/classes over escapes.',
});
