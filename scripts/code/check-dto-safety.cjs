'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('DTO Validation Audit', { emoji: '📋' });
const srcRoot = path.join(__dirname, '../../src');

if (fs.existsSync(srcRoot)) {
  walkTree(srcRoot, (absPath, relPathRaw) => {
    if (!/\.ts$/.test(absPath)) return;
    const relPath = relPathRaw.split(path.sep).join('/');
    if (!relPath.includes('/dto/')) return;
    const base = path.basename(relPath);
    if (/response-/i.test(base) || /-response\.dto\.ts$/i.test(base)) return;

    const code = fs.readFileSync(absPath, 'utf8');
    const classMatch = code.match(/export\s+class\s+(\w+)/);
    if (!classMatch) return;

    const hasClassValidator =
      code.includes('class-validator') ||
      /@(Is|Min|Max|Length|Matches|ValidateNested|Type)\b/.test(code);

    const isRequestDto =
      /^(create|update|cancel|register)-/i.test(base) ||
      /^(owner-login|platform-admin-login|setup-password|change-password)\.dto\.ts$/i.test(
        base,
      );

    if (!hasClassValidator && isRequestDto) {
      r.addViolation(
        relPath,
        1,
        'Request DTO missing class-validator decorators',
        {
          fix: 'Add @IsString / @IsUUID / @IsInt / @ValidateNested etc. Global ValidationPipe forbids non-whitelisted fields.',
        },
      );
    }

    if (
      /^create-|^update-/i.test(base) &&
      /\btotalAmount\b|\bsubtotal\b|\btotalCost\b/.test(code)
    ) {
      r.addWarning(
        relPath,
        1,
        'Client-sent money total field detected — server must recompute totals and ignore client totals',
      );
    }
  });
}

r.finish({
  fixTip:
    'All input DTOs must use class-validator. Server recalculates money totals — never trust the client.',
  warnOnly: true,
});
