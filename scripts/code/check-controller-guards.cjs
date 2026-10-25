'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('Controller Guard Audit', { emoji: '🔒' });
const srcRoot = path.join(__dirname, '../../src');

const PUBLIC_ALLOW = [
  'src/app.controller.ts',
  'src/auth/controllers/auth.controller.ts',
  'src/store/controllers/storefront.controller.ts',
  'src/store/controllers/marketplace.controller.ts',
];

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.controller\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    if (PUBLIC_ALLOW.some((a) => relPath.endsWith(a))) return;

    const code = fs.readFileSync(absPath, 'utf8');
    const hasGuard =
      code.includes('@UseGuards') ||
      code.includes('AuthGuard') ||
      code.includes('JwtAuthGuard') ||
      code.includes('RolesGuard') ||
      code.includes('PlatformAdminGuard');

    if (!hasGuard) {
      r.addViolation(
        relPath,
        1,
        'Controller has no `@UseGuards(...)` — tenant/admin routes must be guarded',
        {
          fix: 'Apply AuthGuard + RolesGuard (or platform-admin guard) at class or method level.',
        },
      );
    }
  });
}

r.finish({
  fixTip:
    'Every non-public Nest controller must declare authentication/authorization guards.',
});
