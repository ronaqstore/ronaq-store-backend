'use strict';

const fs = require('fs');
const path = require('path');
const { Reporter } = require('./lib/reporter.cjs');
const { walkTree } = require('./lib/walkTree.cjs');

const r = new Reporter('Hardcoded Secrets Audit', { emoji: '🔑' });

const PATTERNS = [
  { re: /(['"`])sk-[a-zA-Z0-9]{20,}\1/, label: 'OpenAI API key' },
  {
    re: /(?<![a-zA-Z0-9_])password\s*[:=]\s*['"`][^'"`]{4,}['"`]/i,
    label: 'Hardcoded password',
  },
  {
    re: /api[_-]?key\s*[:=]\s*['"`][^'"`]{8,}['"`]/i,
    label: 'Hardcoded API key',
  },
  { re: /secret\s*[:=]\s*['"`][^'"`]{6,}['"`]/i, label: 'Hardcoded secret' },
  { re: /token\s*[:=]\s*['"`][^'"`]{8,}['"`]/i, label: 'Hardcoded token' },
  {
    re: /private[_-]?key\s*[:=]\s*['"`][^'"`]{10,}['"`]/i,
    label: 'Private key',
  },
  {
    re: /bearer\s+['"`][A-Za-z0-9._\-\/]{10,}['"`]/i,
    label: 'Hardcoded bearer token',
  },
  { re: /AKIA[0-9A-Z]{16}/, label: 'AWS Access Key' },
  { re: /gh[pousr]_[A-Za-z0-9_]{36,}/, label: 'GitHub Token' },
  { re: /sk_(?:live|test)_[0-9a-zA-Z]{24,}/, label: 'Stripe Secret Key' },
  { re: /AIza[0-9A-Za-z\-_]{35}/, label: 'Google API Key' },
  {
    re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    label: 'Private Key block',
  },
];

const ROOT = path.resolve(__dirname, '../..');
const roots = ['src', 'scripts', 'prisma']
  .map((d) => path.join(ROOT, d))
  .filter((p) => fs.existsSync(p));

function scanContent(relPath, content) {
  const lines = content.split(/\r?\n/);
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    if (trimmed.includes('process.env') || trimmed.includes('ConfigService'))
      return;

    PATTERNS.forEach(({ re, label }) => {
      if (!re.test(trimmed)) return;
      if (
        /placeholder|example|dummy|changeme|your[_-]?secret|xxx+/i.test(trimmed)
      ) {
        return;
      }
      if (label === 'Hardcoded password') {
        const valueMatch = trimmed.match(
          /(?<![a-zA-Z0-9_])password\s*[:=]\s*['"`]([^'"`]+)['"`]/i,
        );
        if (valueMatch && /^password$/i.test(valueMatch[1].trim())) return;
      }
      r.addViolation(relPath, idx + 1, `${label} — use ConfigService / .env`, {
        sample: trimmed.slice(0, 100),
      });
    });
  });
}

['package.json', 'nest-cli.json'].forEach((fileName) => {
  const filePath = path.join(ROOT, fileName);
  if (!fs.existsSync(filePath)) return;
  scanContent(fileName, fs.readFileSync(filePath, 'utf8'));
});

roots.forEach((root) => {
  walkTree(
    root,
    (absPath, relPath) => {
      if (relPath.includes('src/generated/')) return;
      if (/\.(spec|test)\.(ts|js)$/.test(absPath)) return;
      if (!/\.(ts|js|cjs|mjs|json)$/.test(absPath)) return;
      scanContent(relPath, fs.readFileSync(absPath, 'utf8'));
    },
    {
      includeTests: false,
      extensions: new Set(['.ts', '.js', '.cjs', '.mjs', '.json']),
    },
  );
});

r.finish({
  fixTip:
    'Never hardcode secrets. Load them via AppConfigurationService / ConfigService from .env.',
});
