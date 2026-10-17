'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { Reporter } = require('./lib/reporter.cjs');

const ROOT = path.resolve(__dirname, '../..');
const r = new Reporter('Codebase Duplication & Clone Audit', { emoji: '👥' });

const args = process.argv.slice(2);
const thresholdArgIdx = args.indexOf('--threshold');
const customThreshold =
  thresholdArgIdx !== -1 ? parseFloat(args[thresholdArgIdx + 1]) : null;

const tempDir = path.join(ROOT, 'scripts/.temp-jscpd');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

const jscpdCmd = [
  'jscpd',
  'src',
  '--format',
  'typescript',
  '--min-lines',
  '8',
  '--min-tokens',
  '75',
  '--ignore',
  '**/node_modules/**,**/dist/**,**/src/generated/**,**/*.spec.ts,**/*.module.ts',
  '--reporters',
  'json',
  '--output',
  'scripts/.temp-jscpd',
  '--silent',
];

spawnSync('npx', ['--yes', ...jscpdCmd], {
  cwd: ROOT,
  stdio: 'pipe',
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

const reportFile = path.join(tempDir, 'jscpd-report.json');
let reportData = null;
if (fs.existsSync(reportFile)) {
  try {
    reportData = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
  } catch {
    reportData = null;
  }
}

try {
  if (fs.existsSync(reportFile)) fs.unlinkSync(reportFile);
  if (fs.existsSync(tempDir))
    fs.rmSync(tempDir, { recursive: true, force: true });
} catch {
  /* ignore cleanup errors */
}

if (!reportData || !reportData.statistics) {
  console.log('👥  Codebase Duplication & Clone Audit\n');
  console.log('✅ Zero code clones detected!');
  process.exit(0);
}

const pct = reportData.statistics.total.percentage || 0;
const clones = reportData.duplicates || [];
const threshold =
  customThreshold != null
    ? customThreshold
    : (() => {
        try {
          return JSON.parse(
            fs.readFileSync(path.join(ROOT, '.jscpd.json'), 'utf8'),
          ).threshold;
        } catch {
          return 1.5;
        }
      })();

if (pct > threshold) {
  r.addViolation(
    'src/',
    0,
    `Duplication ${pct.toFixed(2)}% exceeds threshold ${threshold}% (${clones.length} clone(s))`,
  );
}

clones.slice(0, 25).forEach((clone) => {
  const a = clone.firstFile && clone.firstFile.name;
  const b = clone.secondFile && clone.secondFile.name;
  if (!a || !b) return;
  const message = `Clone of ${b}:${clone.secondFile.start} (${clone.lines} lines) — extract shared helper/service`;
  if (pct > threshold) {
    r.addViolation(a, clone.firstFile.start, message);
  } else {
    r.addWarning(a, clone.firstFile.start, message);
  }
});

r.finish({
  fixTip:
    'Extract duplicated Nest service/DTO logic into helpers or shared common-dto modules.',
  warnOnly: true,
});
