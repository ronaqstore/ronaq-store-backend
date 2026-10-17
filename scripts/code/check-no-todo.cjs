'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('TODO / FIXME Leftovers Audit', { emoji: '📝' });
const srcRoot = path.join(__dirname, '../../src');

const MARKER = /\b(TODO|FIXME|HACK|XXX)\b/;

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    if (relPath.includes('src/generated/')) return;

    const lines = fs.readFileSync(absPath, 'utf8').split(/\r?\n/);
    lines.forEach((line, idx) => {
      if (MARKER.test(line)) {
        r.addViolation(
          relPath,
          idx + 1,
          `Forbidden leftover marker "${line.match(MARKER)[1]}" — finish the work or track it outside source`,
          { sample: line.trim().slice(0, 100) },
        );
      }
    });
  });
}

r.finish({
  fixTip:
    'No TODO/FIXME/HACK in committed Nest source. Ship complete code or open a tracked issue.',
});
