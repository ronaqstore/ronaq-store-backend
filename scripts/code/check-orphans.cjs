'use strict';

const fs = require('fs');
const path = require('path');
const traverse = require('@babel/traverse').default;
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');
const { parseFile } = require('./lib/parseFile.cjs');

const r = new Reporter('Orphan Nest Modules / Files Audit', { emoji: '🧟' });
const ROOT = path.resolve(__dirname, '../..');
const srcRoot = path.join(ROOT, 'src');

function normPath(p) {
  return path.normalize(path.resolve(p)).toLowerCase().replace(/\\/g, '/');
}

function resolveModule(fromFile, source) {
  if (!source.startsWith('.')) return null;
  const withoutExt = source.replace(/\.js$/, '');
  const target = path.resolve(path.dirname(fromFile), withoutExt);
  const candidates = [target, `${target}.ts`, path.join(target, 'index.ts')];
  for (const cand of candidates) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) {
      return normPath(cand);
    }
  }
  return null;
}

const entryFiles = new Set();
const mainFile = path.join(srcRoot, 'main.ts');
if (fs.existsSync(mainFile)) entryFiles.add(normPath(mainFile));

walkTree(srcRoot, (absPath) => {
  if (absPath.endsWith('.module.ts')) entryFiles.add(normPath(absPath));
});

const reachable = new Set(entryFiles);
const queue = [...entryFiles];

while (queue.length > 0) {
  const current = queue.pop();
  const abs = current;
  const realPath = (() => {
    for (const candidate of [abs, abs.replace(/\//g, path.sep)]) {
      if (fs.existsSync(candidate)) return candidate;
    }
    const fromSrc = path.join(
      ROOT,
      abs.replace(/\//g, path.sep).replace(/^.*src[\\/]/, 'src/'),
    );
    if (fs.existsSync(fromSrc)) return fromSrc;
    return null;
  })();

  if (!realPath || !fs.existsSync(realPath)) continue;
  const code = fs.readFileSync(realPath, 'utf8');
  let ast;
  try {
    ast = parseFile(realPath, code);
  } catch {
    continue;
  }

  traverse(ast, {
    ImportDeclaration(p) {
      const resolved = resolveModule(realPath, p.node.source.value);
      if (resolved && !reachable.has(resolved)) {
        reachable.add(resolved);
        queue.push(resolved);
      }
    },
    ExportNamedDeclaration(p) {
      if (!p.node.source) return;
      const resolved = resolveModule(realPath, p.node.source.value);
      if (resolved && !reachable.has(resolved)) {
        reachable.add(resolved);
        queue.push(resolved);
      }
    },
    CallExpression(p) {
      if (
        p.node.callee.type === 'Import' &&
        p.node.arguments[0] &&
        p.node.arguments[0].type === 'StringLiteral'
      ) {
        const resolved = resolveModule(realPath, p.node.arguments[0].value);
        if (resolved && !reachable.has(resolved)) {
          reachable.add(resolved);
          queue.push(resolved);
        }
      }
    },
  });
}

walkTree(srcRoot, (absPath, relPathRaw) => {
  if (!/\.ts$/.test(absPath)) return;
  const relPath = relPathRaw.split(path.sep).join('/');
  if (relPath.includes('src/generated/')) return;
  if (/\.spec\.ts$/.test(absPath)) return;
  if (absPath.endsWith('.module.ts')) return;
  if (absPath.endsWith('main.ts')) return;

  const n = normPath(absPath);
  if (!reachable.has(n)) {
    r.addViolation(
      relPath,
      0,
      'Orphan file — not imported from main.ts / any *.module.ts graph',
      {
        fix: 'Wire it into a Nest module (providers/controllers/exports) or delete it.',
      },
    );
  }
});

r.finish({
  fixTip:
    'Every Nest file should be reachable from AppModule via module imports/providers/controllers.',
});
