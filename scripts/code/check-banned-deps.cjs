'use strict';

const fs = require('fs');
const path = require('path');
const traverse = require('@babel/traverse').default;
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');
const { parseFile } = require('./lib/parseFile.cjs');

const r = new Reporter('Banned Packages Audit', { emoji: '🚫' });
const srcRoot = path.join(__dirname, '../../src');

const BANNED = {
  axios:
    'Use Nest HttpModule / undici / native fetch if outbound HTTP is required.',
  moment: 'Use native Date / Temporal APIs.',
  dayjs: 'Use native Date APIs.',
  lodash: 'Use standard ES2024 array/object methods.',
  underscore: 'Use standard ES2024 array/object methods.',
  typeorm: 'This project uses Prisma only.',
  sequelize: 'This project uses Prisma only.',
  mongoose: 'This project uses Prisma + PostgreSQL only.',
  nodemailer: 'Email/SMTP is intentionally out of scope for Ronaq Store.',
  'nestjs-typeorm': 'This project uses Prisma only.',
};

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
        const source = p.node.source.value.toLowerCase();
        for (const [pkg, reason] of Object.entries(BANNED)) {
          if (source === pkg || source.startsWith(`${pkg}/`)) {
            r.addViolation(
              relPath,
              p.node.loc ? p.node.loc.start.line : 0,
              `Forbidden package "${source}" — ${reason}`,
            );
          }
        }
      },
    });
  });
}

r.finish({
  fixTip:
    'Stick to NestJS + Prisma + class-validator. Do not introduce alternate ORMs or SMTP.',
});
