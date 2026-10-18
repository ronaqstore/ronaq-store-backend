'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('Injectable / Provider Audit', { emoji: '💉' });
const srcRoot = path.join(__dirname, '../../src');

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.service\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    const code = fs.readFileSync(absPath, 'utf8');

    if (!code.includes('@Injectable')) {
      r.addViolation(
        relPath,
        1,
        'Service class missing `@Injectable()` decorator',
      );
    }

    if (!/export\s+class\s+\w+Service/.test(code)) {
      r.addViolation(
        relPath,
        1,
        'Service file should export a `*Service` class',
      );
    }
  });
}

r.finish({
  fixTip:
    'Every Nest service must be `@Injectable()` and registered in its module providers.',
});
