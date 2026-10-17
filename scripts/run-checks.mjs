/**
 * NestJS backend quality gate (same role as web/admin `npm run check`).
 *
 * Runs every auditor in one place: custom scripts/code/*.cjs checks,
 * plus knip, jscpd (duplicates), lint, typecheck, test, prisma validate, build.
 *
 *   npm run check
 *   npm run check -- --only knip,duplicates,lint
 */

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

const CHECKS = [
  { id: 'secrets', cmd: ['node', 'scripts/code/check-secrets.cjs'] },
  { id: 'structure', cmd: ['node', 'scripts/code/check-structure.cjs'] },
  {
    id: 'module-layout',
    cmd: ['node', 'scripts/code/check-module-layout.cjs'],
  },
  {
    id: 'filename-conventions',
    cmd: ['node', 'scripts/code/check-filename-conventions.cjs'],
  },
  { id: 'empty-files', cmd: ['node', 'scripts/code/check-empty-files.cjs'] },
  { id: 'types', cmd: ['node', 'scripts/code/check-types.cjs'] },
  { id: 'nest-type', cmd: ['node', 'scripts/code/check-nest-type.cjs'] },
  { id: 'comments', cmd: ['node', 'scripts/code/check-comments.cjs'] },
  { id: 'console', cmd: ['node', 'scripts/code/check-console.cjs'] },
  { id: 'catch-handling', cmd: ['node', 'scripts/code/check-catch.cjs'] },
  { id: 'no-todo', cmd: ['node', 'scripts/code/check-no-todo.cjs'] },
  { id: 'env-access', cmd: ['node', 'scripts/code/check-env-access.cjs'] },
  { id: 'api-urls', cmd: ['node', 'scripts/code/check-api-urls.cjs'] },
  { id: 'banned-deps', cmd: ['node', 'scripts/code/check-banned-deps.cjs'] },
  { id: 'tenancy', cmd: ['node', 'scripts/code/check-tenancy.cjs'] },
  {
    id: 'financial-safety',
    cmd: ['node', 'scripts/code/check-financial-safety.cjs'],
  },
  {
    id: 'prisma-safety',
    cmd: ['node', 'scripts/code/check-prisma-safety.cjs'],
  },
  {
    id: 'transaction-safety',
    cmd: ['node', 'scripts/code/check-transaction-safety.cjs'],
  },
  { id: 'dto-safety', cmd: ['node', 'scripts/code/check-dto-safety.cjs'] },
  {
    id: 'controller-guards',
    cmd: ['node', 'scripts/code/check-controller-guards.cjs'],
  },
  { id: 'swagger-docs', cmd: ['node', 'scripts/code/check-swagger-docs.cjs'] },
  { id: 'injectable', cmd: ['node', 'scripts/code/check-injectable.cjs'] },
  {
    id: 'import-extensions',
    cmd: ['node', 'scripts/code/check-import-extensions.cjs'],
  },
  {
    id: 'no-default-export',
    cmd: ['node', 'scripts/code/check-no-default-export.cjs'],
  },
  { id: 'max-lines', cmd: ['node', 'scripts/code/check-max-lines.cjs'] },
  {
    id: 'unused-imports',
    cmd: ['node', 'scripts/code/check-unused-imports.cjs'],
  },
  { id: 'orphans', cmd: ['node', 'scripts/code/check-orphans.cjs'] },
  {
    id: 'spec-colocation',
    cmd: ['node', 'scripts/code/check-spec-colocation.cjs'],
  },
  { id: 'duplicates', cmd: ['npm', 'run', 'duplicates'] },
  { id: 'duplicate-audit', cmd: ['node', 'scripts/code/check-duplicates.cjs'] },
  { id: 'knip', cmd: ['npm', 'run', 'knip'] },
  { id: 'format', cmd: ['npm', 'run', 'format:check'] },
  { id: 'lint', cmd: ['npm', 'run', 'lint'] },
  { id: 'typecheck', cmd: ['npm', 'run', 'typecheck'] },
  { id: 'test', cmd: ['npm', 'run', 'test'] },
  { id: 'prisma-validate', cmd: ['npm', 'run', 'prisma:validate'] },
  { id: 'build', cmd: ['npm', 'run', 'build'] },
];

const onlyArg = process.argv.find(
  (a) => a.startsWith('--only=') || a === '--only',
);
let onlyIds = null;
if (onlyArg) {
  const val = onlyArg.startsWith('--only=')
    ? onlyArg.slice(7)
    : process.argv[process.argv.indexOf('--only') + 1];
  onlyIds = new Set(val ? val.split(',').map((s) => s.trim()) : []);
}

const toRun = onlyIds ? CHECKS.filter((c) => onlyIds.has(c.id)) : CHECKS;

let passed = 0;
let failed = 0;
const failures = [];
const PAD = Math.max(...toRun.map((c) => c.id.length)) + 2;

console.log('\n🔍  Running NestJS backend checks...\n');

for (const check of toRun) {
  const label = check.id.padEnd(PAD);
  const result = spawnSync(check.cmd[0], check.cmd.slice(1), {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });

  if (result.status === 0) {
    console.log(`  ✅  ${label} — ok`);
    passed++;
  } else {
    console.log(`  ❌  ${label} — FAILED`);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    failed++;
    failures.push(check.id);
  }
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`  ${passed} passed  •  ${failed} failed`);
if (failed > 0) {
  console.error(`\n  Failed checks: ${failures.join(', ')}\n`);
  process.exit(1);
}

console.log('\n  All checks passed ✅\n');
process.exit(0);
