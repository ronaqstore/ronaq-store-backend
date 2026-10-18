'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('File Length Audit', { emoji: '📏' });
const srcRoot = path.join(__dirname, '../../src');

const TIER_LIMITS = {
  MODULE: 120,
  CONTROLLER: 350,
  SERVICE: 550,
  DTO: 250,
  GUARD: 200,
  HELPER: 250,
  DEFAULT: 400,
};

function resolveLimit(relPath) {
  if (relPath.includes('src/generated/')) {
    return { limit: Infinity, category: 'Exempt' };
  }
  if (relPath.endsWith('.module.ts')) {
    return { limit: TIER_LIMITS.MODULE, category: 'Nest Module' };
  }
  if (relPath.includes('/controllers/')) {
    return { limit: TIER_LIMITS.CONTROLLER, category: 'Controller' };
  }
  if (relPath.includes('/services/')) {
    return { limit: TIER_LIMITS.SERVICE, category: 'Service' };
  }
  if (relPath.includes('/dto/') || relPath.includes('/common-dto/')) {
    return { limit: TIER_LIMITS.DTO, category: 'DTO / Filter' };
  }
  if (relPath.includes('/guards/') || relPath.includes('auth-guards/')) {
    return { limit: TIER_LIMITS.GUARD, category: 'Guard / Strategy' };
  }
  if (relPath.includes('/helpers/')) {
    return { limit: TIER_LIMITS.HELPER, category: 'Helper' };
  }
  return { limit: TIER_LIMITS.DEFAULT, category: 'Module file' };
}

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    const { limit, category } = resolveLimit(relPath);
    if (limit === Infinity) return;

    const lineCount = fs.readFileSync(absPath, 'utf8').split('\n').length;
    if (lineCount > limit) {
      r.addViolation(
        relPath,
        lineCount,
        `File has ${lineCount} lines, exceeding the ${limit}-line limit for ${category}`,
        {
          fix: 'Split into smaller services, helpers, or DTO files with a single responsibility.',
        },
      );
    }
  });
}

r.finish({
  fixTip:
    'Keep Nest files focused: modules ≤120, controllers ≤350, services ≤550, DTOs ≤250.',
});
