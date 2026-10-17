'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('Swagger Documentation Audit', { emoji: '📘' });
const srcRoot = path.join(__dirname, '../../src');

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.controller\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    const code = fs.readFileSync(absPath, 'utf8');

    if (!code.includes('@ApiTags')) {
      r.addViolation(
        relPath,
        1,
        'Controller missing `@ApiTags` — required for OpenAPI grouping',
      );
    }

    if (
      !code.includes('@ApiBearerAuth') &&
      !relPath.includes('storefront') &&
      !relPath.endsWith('app.controller.ts') &&
      !relPath.includes('auth.controller')
    ) {
      r.addWarning(
        relPath,
        1,
        'Controller may be missing `@ApiBearerAuth` for JWT-protected routes',
      );
    }
  });
}

r.finish({
  fixTip:
    'Document Nest controllers with @ApiTags / @ApiOperation / @ApiBearerAuth for Swagger at /api.',
  warnOnly: true,
});
