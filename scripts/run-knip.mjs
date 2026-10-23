import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

process.env.KNIP_DISABLE_RAW_TRANSFER = '1';

const result = spawnSync(
  'npx',
  [
    'knip',
    '--include',
    'files,dependencies,unlisted,unresolved,exports,nsExports,types,nsTypes,enumMembers,duplicates,cycles',
    '--reporter',
    'compact',
  ],
  {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
    shell: process.platform === 'win32',
  },
);

process.exit(result.status ?? 1);
